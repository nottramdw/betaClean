use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use super::guard::Guard;
use super::model::{
    Action, CleanupReport, Failure, HistoryEntry, QuarantineEntry, QuarantineRequest,
};
use crate::features::junk::service::dir_usage;
use crate::features::unused::service::now;

const QUARANTINE_DIR: &str = "quarantine";
const INDEX_FILE: &str = "index.json";
const HISTORY_FILE: &str = "history.jsonl";
const QUARANTINE_EXT: &str = "quarantine";
const NOT_CONFIRMED: &str = "Thao tác cần người dùng xác nhận.";

static LOCK: Mutex<()> = Mutex::new(());
static COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct Store {
    root: PathBuf,
}

fn size_of(path: &Path) -> u64 {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.is_dir() => dir_usage(path, &AtomicBool::new(false)).0,
        Ok(meta) => meta.len(),
        Err(_) => 0,
    }
}

fn move_file(from: &Path, to: &Path) -> std::io::Result<()> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    fs::copy(from, to)?;
    if let Err(e) = fs::remove_file(from) {
        let _ = fs::remove_file(to);
        return Err(e);
    }
    Ok(())
}

fn new_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos());
    format!(
        "{nanos:x}{:04x}",
        COUNTER.fetch_add(1, Ordering::Relaxed) & 0xffff
    )
}

impl Store {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn quarantine_dir(&self) -> PathBuf {
        self.root.join(QUARANTINE_DIR)
    }

    fn stored_file(&self, id: &str) -> PathBuf {
        self.quarantine_dir().join(format!("{id}.{QUARANTINE_EXT}"))
    }

    pub fn list_quarantine(&self) -> Vec<QuarantineEntry> {
        fs::read_to_string(self.quarantine_dir().join(INDEX_FILE))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    }

    fn save_quarantine(&self, entries: &[QuarantineEntry]) -> Result<(), String> {
        fs::create_dir_all(self.quarantine_dir()).map_err(|e| e.to_string())?;
        let text = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
        let target = self.quarantine_dir().join(INDEX_FILE);
        let temp = target.with_extension("json.tmp");
        fs::write(&temp, text).map_err(|e| e.to_string())?;
        fs::rename(&temp, &target).map_err(|e| e.to_string())
    }

    fn record(&self, action: Action, path: &str, size: u64, error: Option<String>) {
        let entry = HistoryEntry {
            time: now(),
            action,
            path: path.to_string(),
            size,
            success: error.is_none(),
            error,
        };
        let _ = fs::create_dir_all(&self.root);
        if let (Ok(mut file), Ok(line)) = (
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(self.root.join(HISTORY_FILE)),
            serde_json::to_string(&entry),
        ) {
            let _ = writeln!(file, "{line}");
        }
    }

    pub fn history(&self, limit: usize) -> Vec<HistoryEntry> {
        let text = fs::read_to_string(self.root.join(HISTORY_FILE)).unwrap_or_default();
        text.lines()
            .rev()
            .filter_map(|line| serde_json::from_str(line).ok())
            .take(limit)
            .collect()
    }

    fn finish(
        &self,
        report: &mut CleanupReport,
        action: Action,
        target: &str,
        size: u64,
        outcome: Result<(), String>,
    ) {
        match outcome {
            Ok(()) => {
                report.succeeded.push(target.to_string());
                report.bytes += size;
                self.record(action, target, size, None);
            }
            Err(error) => {
                self.record(action, target, size, Some(error.clone()));
                report.failed.push(Failure {
                    target: target.to_string(),
                    error,
                });
            }
        }
    }

    pub fn move_to_trash(
        &self,
        guard: &Guard,
        paths: &[String],
        confirmed: bool,
    ) -> Result<CleanupReport, String> {
        if !confirmed {
            return Err(NOT_CONFIRMED.to_string());
        }
        let _lock = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let mut report = CleanupReport::default();
        for target in paths {
            let path = Path::new(target);
            let size = size_of(path);
            let outcome = guard.check(path).and_then(|()| {
                if fs::symlink_metadata(path).is_err() {
                    return Err("Không tìm thấy đường dẫn.".to_string());
                }
                trash::delete(path).map_err(|e| e.to_string())
            });
            self.finish(&mut report, Action::Trash, target, size, outcome);
        }
        Ok(report)
    }

    pub fn quarantine(
        &self,
        guard: &Guard,
        items: &[QuarantineRequest],
        confirmed: bool,
    ) -> Result<CleanupReport, String> {
        if !confirmed {
            return Err(NOT_CONFIRMED.to_string());
        }
        let _lock = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        fs::create_dir_all(self.quarantine_dir()).map_err(|e| e.to_string())?;
        let mut entries = self.list_quarantine();
        let mut report = CleanupReport::default();
        for item in items {
            let path = Path::new(&item.path);
            let size = size_of(path);
            let id = new_id();
            let outcome = guard.check(path).and_then(|()| {
                if !path.is_file() {
                    return Err("Chỉ cách ly được tệp.".to_string());
                }
                move_file(path, &self.stored_file(&id)).map_err(|e| e.to_string())
            });
            if outcome.is_ok() {
                entries.push(QuarantineEntry {
                    id,
                    original_path: item.path.clone(),
                    reason: item.reason.clone(),
                    size,
                    quarantined_at: now(),
                });
                self.save_quarantine(&entries)?;
            }
            self.finish(&mut report, Action::Quarantine, &item.path, size, outcome);
        }
        Ok(report)
    }

    pub fn restore(&self, ids: &[String], confirmed: bool) -> Result<CleanupReport, String> {
        if !confirmed {
            return Err(NOT_CONFIRMED.to_string());
        }
        let _lock = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let mut entries = self.list_quarantine();
        let mut report = CleanupReport::default();
        for id in ids {
            let Some(index) = entries.iter().position(|e| &e.id == id) else {
                self.finish(
                    &mut report,
                    Action::Restore,
                    id,
                    0,
                    Err("Không tìm thấy mục cách ly.".to_string()),
                );
                continue;
            };
            let entry = entries[index].clone();
            let original = PathBuf::from(&entry.original_path);
            let outcome = if original.exists() {
                Err("Vị trí gốc đã có tệp khác.".to_string())
            } else {
                original
                    .parent()
                    .map_or(Ok(()), fs::create_dir_all)
                    .and_then(|()| move_file(&self.stored_file(id), &original))
                    .map_err(|e| e.to_string())
            };
            if outcome.is_ok() {
                entries.remove(index);
                self.save_quarantine(&entries)?;
            }
            self.finish(
                &mut report,
                Action::Restore,
                &entry.original_path,
                entry.size,
                outcome,
            );
        }
        Ok(report)
    }

    pub fn delete_quarantined(
        &self,
        ids: &[String],
        confirmed: bool,
    ) -> Result<CleanupReport, String> {
        if !confirmed {
            return Err(NOT_CONFIRMED.to_string());
        }
        let _lock = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let mut entries = self.list_quarantine();
        let mut report = CleanupReport::default();
        for id in ids {
            let Some(index) = entries.iter().position(|e| &e.id == id) else {
                self.finish(
                    &mut report,
                    Action::Delete,
                    id,
                    0,
                    Err("Không tìm thấy mục cách ly.".to_string()),
                );
                continue;
            };
            let entry = entries[index].clone();
            let file = self.stored_file(id);
            let outcome = match fs::remove_file(&file) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(e.to_string()),
            };
            if outcome.is_ok() {
                entries.remove(index);
                self.save_quarantine(&entries)?;
            }
            self.finish(
                &mut report,
                Action::Delete,
                &entry.original_path,
                entry.size,
                outcome,
            );
        }
        Ok(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture {
        base: PathBuf,
        store: Store,
        guard: Guard,
    }

    impl Fixture {
        fn new(name: &str) -> Self {
            let base = std::env::temp_dir()
                .join(format!("betaclean-cleanup-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&base);
            fs::create_dir_all(base.join("data")).unwrap();
            fs::create_dir_all(base.join("files")).unwrap();
            Self {
                store: Store::new(base.join("data")),
                guard: Guard::new(None, Vec::new(), Vec::new()),
                base,
            }
        }

        fn file(&self, name: &str, size: usize) -> String {
            let path = self.base.join("files").join(name);
            fs::write(&path, vec![1u8; size]).unwrap();
            path.to_string_lossy().into_owned()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.base);
        }
    }

    fn request(path: &str) -> Vec<QuarantineRequest> {
        vec![QuarantineRequest {
            path: path.to_string(),
            reason: "Virus:Test".to_string(),
        }]
    }

    #[test]
    fn requires_confirmation() {
        let f = Fixture::new("confirm");
        let path = f.file("a.bin", 10);
        assert!(
            f.store
                .move_to_trash(&f.guard, std::slice::from_ref(&path), false)
                .is_err()
        );
        assert!(
            f.store
                .quarantine(&f.guard, &request(&path), false)
                .is_err()
        );
        assert!(Path::new(&path).exists());
    }

    #[test]
    fn quarantine_and_restore_round_trip() {
        let f = Fixture::new("restore");
        let path = f.file("nghi-van.exe", 42);
        let report = f.store.quarantine(&f.guard, &request(&path), true).unwrap();
        assert_eq!(report.succeeded.len(), 1);
        assert_eq!(report.bytes, 42);
        assert!(!Path::new(&path).exists());
        let entries = f.store.list_quarantine();
        assert_eq!(entries.len(), 1);
        assert!(f.store.stored_file(&entries[0].id).exists());

        let report = f.store.restore(&[entries[0].id.clone()], true).unwrap();
        assert_eq!(report.succeeded.len(), 1);
        assert!(Path::new(&path).exists());
        assert!(f.store.list_quarantine().is_empty());
    }

    #[test]
    fn restore_refuses_to_overwrite() {
        let f = Fixture::new("overwrite");
        let path = f.file("a.exe", 5);
        f.store.quarantine(&f.guard, &request(&path), true).unwrap();
        fs::write(&path, b"moi").unwrap();
        let id = f.store.list_quarantine()[0].id.clone();
        let report = f.store.restore(&[id], true).unwrap();
        assert_eq!(report.failed.len(), 1);
        assert_eq!(f.store.list_quarantine().len(), 1);
    }

    #[test]
    fn delete_removes_quarantined_file() {
        let f = Fixture::new("delete");
        let path = f.file("a.exe", 5);
        f.store.quarantine(&f.guard, &request(&path), true).unwrap();
        let id = f.store.list_quarantine()[0].id.clone();
        let report = f
            .store
            .delete_quarantined(std::slice::from_ref(&id), true)
            .unwrap();
        assert_eq!(report.succeeded.len(), 1);
        assert!(!f.store.stored_file(&id).exists());
        assert!(f.store.list_quarantine().is_empty());
    }

    #[test]
    fn records_history_newest_first() {
        let f = Fixture::new("history");
        let path = f.file("a.exe", 5);
        f.store.quarantine(&f.guard, &request(&path), true).unwrap();
        let missing = f
            .base
            .join("files")
            .join("khong-co")
            .to_string_lossy()
            .into_owned();
        f.store.move_to_trash(&f.guard, &[missing], true).unwrap();
        let history = f.store.history(10);
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].action, Action::Trash);
        assert!(!history[0].success);
        assert_eq!(history[1].action, Action::Quarantine);
        assert!(history[1].success);
    }

    #[test]
    fn guard_blocks_before_any_change() {
        let f = Fixture::new("guard");
        let path = f.file("a.exe", 5);
        let guard = Guard::new(None, vec![f.base.join("files")], Vec::new());
        let report = f.store.quarantine(&guard, &request(&path), true).unwrap();
        assert_eq!(report.failed.len(), 1);
        assert!(Path::new(&path).exists());
    }
}
