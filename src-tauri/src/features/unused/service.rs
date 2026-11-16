use std::collections::HashSet;
use std::fs::{self, Metadata};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crossbeam_channel::Sender;
use czkawka_core::common::model::CheckingMethod;
use czkawka_core::common::progress_data::{ProgressData, ToolStage};

use super::model::{TimeBasis, UnusedFile, UnusedOptions};

pub const DEFAULT_DAYS: u64 = 180;
pub const DEFAULT_MIN_SIZE: u64 = 1024 * 1024;
pub const DEFAULT_LIMIT: usize = 500;
const DAY: u64 = 86_400;
const PROGRESS_STEP: usize = 2_000;

fn secs(time: std::io::Result<SystemTime>) -> u64 {
    time.ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_secs())
}

pub fn now() -> u64 {
    secs(Ok(SystemTime::now()))
}

pub fn last_used(meta: &Metadata) -> (u64, TimeBasis) {
    let modified = secs(meta.modified());
    let accessed = secs(meta.accessed());
    if accessed > modified {
        (accessed, TimeBasis::Accessed)
    } else {
        (modified, TimeBasis::Modified)
    }
}

fn skip_entry(name: &str, is_dir: bool) -> bool {
    name.starts_with('.') || (is_dir && name.to_ascii_lowercase().ends_with(".app"))
}

#[cfg(target_os = "macos")]
fn recently_used(root: &Path, days: u64) -> HashSet<PathBuf> {
    let query = format!("kMDItemLastUsedDate >= $time.now(-{})", days * DAY);
    std::process::Command::new("mdfind")
        .arg("-onlyin")
        .arg(root)
        .arg(query)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .map(PathBuf::from)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(not(target_os = "macos"))]
fn recently_used(_root: &Path, _days: u64) -> HashSet<PathBuf> {
    HashSet::new()
}

pub fn report(progress: Option<&Sender<ProgressData>>, checked: usize) {
    if let Some(sender) = progress {
        let _ = sender.send(ProgressData {
            stage: ToolStage::CollectingFiles(CheckingMethod::None),
            entries_checked: checked,
            entries_to_check: 0,
            bytes_checked: 0,
            bytes_to_check: 0,
        });
    }
}

pub fn find_unused(
    options: &UnusedOptions,
    stop: &AtomicBool,
    progress: Option<&Sender<ProgressData>>,
) -> Result<Vec<UnusedFile>, String> {
    let roots: Vec<PathBuf> = options
        .paths
        .iter()
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
        .collect();
    if roots.is_empty() {
        return Err("Không có thư mục hợp lệ để quét.".to_string());
    }
    let excluded: Vec<PathBuf> = options.excluded.iter().map(PathBuf::from).collect();
    let days = options.days.unwrap_or(DEFAULT_DAYS);
    let min_size = options.min_size.unwrap_or(DEFAULT_MIN_SIZE);
    let current = now();
    let threshold = current.saturating_sub(days * DAY);
    let mut found = Vec::new();
    let mut checked = 0usize;

    for root in &roots {
        let recent = recently_used(root, days);
        let mut pending = vec![root.clone()];
        while let Some(dir) = pending.pop() {
            if stop.load(Ordering::Relaxed) {
                return Err("Đã huỷ quét.".to_string());
            }
            let Ok(entries) = fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let Ok(kind) = entry.file_type() else {
                    continue;
                };
                let path = entry.path();
                let name = entry.file_name();
                if skip_entry(&name.to_string_lossy(), kind.is_dir())
                    || excluded.iter().any(|e| path.starts_with(e))
                {
                    continue;
                }
                if kind.is_dir() {
                    pending.push(path);
                    continue;
                }
                if !kind.is_file() {
                    continue;
                }
                checked += 1;
                if checked.is_multiple_of(PROGRESS_STEP) {
                    report(progress, checked);
                }
                let Ok(meta) = entry.metadata() else {
                    continue;
                };
                if meta.len() < min_size {
                    continue;
                }
                let (used, basis) = last_used(&meta);
                if used == 0 || used > threshold || recent.contains(&path) {
                    continue;
                }
                found.push(UnusedFile {
                    path: path.to_string_lossy().into_owned(),
                    size: meta.len(),
                    last_used: used,
                    idle_days: (current - used) / DAY,
                    basis,
                });
            }
        }
    }
    report(progress, checked);
    found.sort_by_key(|f| std::cmp::Reverse(f.size));
    found.truncate(options.limit.unwrap_or(DEFAULT_LIMIT));
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{File, FileTimes};
    use std::time::Duration;

    fn age(path: &Path, days: u64) {
        let time = SystemTime::now() - Duration::from_secs(days * DAY);
        let file = File::options().write(true).open(path).unwrap();
        file.set_times(FileTimes::new().set_accessed(time).set_modified(time))
            .unwrap();
    }

    #[test]
    fn finds_only_old_visible_files() {
        let root = std::env::temp_dir().join(format!("betaclean-unused-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("sub")).unwrap();
        fs::create_dir_all(root.join(".an")).unwrap();
        let old = root.join("sub").join("cu.bin");
        let fresh = root.join("moi.bin");
        let hidden = root.join(".an").join("cu.bin");
        for p in [&old, &fresh, &hidden] {
            fs::write(p, vec![0u8; 64]).unwrap();
        }
        age(&old, 400);
        age(&hidden, 400);
        let options = UnusedOptions {
            paths: vec![root.to_string_lossy().into_owned()],
            min_size: Some(1),
            ..Default::default()
        };
        let result = find_unused(&options, &AtomicBool::new(false), None).unwrap();
        fs::remove_dir_all(&root).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].path.ends_with("cu.bin"));
        assert!(result[0].idle_days >= 399);
    }

    #[test]
    fn honours_size_and_cancellation() {
        let root = std::env::temp_dir().join(format!("betaclean-unused2-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let file = root.join("nho.bin");
        fs::write(&file, vec![0u8; 10]).unwrap();
        age(&file, 400);
        let options = UnusedOptions {
            paths: vec![root.to_string_lossy().into_owned()],
            min_size: Some(1024),
            ..Default::default()
        };
        assert!(
            find_unused(&options, &AtomicBool::new(false), None)
                .unwrap()
                .is_empty()
        );
        assert!(find_unused(&options, &AtomicBool::new(true), None).is_err());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn skips_hidden_and_app_bundles() {
        assert!(skip_entry(".git", true));
        assert!(skip_entry("Safari.app", true));
        assert!(!skip_entry("Safari.app", false));
        assert!(!skip_entry("Tai lieu", true));
    }
}
