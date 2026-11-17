use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Once;
use std::sync::atomic::AtomicBool;

use crossbeam_channel::Sender;
use czkawka_core::common::config_cache_path::set_config_cache_path;
use czkawka_core::common::model::{CheckingMethod, HashType};
use czkawka_core::common::progress_data::ProgressData;
use czkawka_core::common::tool_data::CommonData;
use czkawka_core::common::traits::Search;
use czkawka_core::tools::big_file::{BigFile, BigFileParameters, SearchMode};
use czkawka_core::tools::duplicate::{DuplicateFinder, DuplicateFinderParameters};
use czkawka_core::tools::empty_folder::EmptyFolder;
use czkawka_core::tools::temporary::{Temporary, TemporaryParameters};

use super::model::{DuplicateFile, DuplicateGroup, FileItem, FolderItem, ScanOptions};
use crate::shared::disk_size;
use crate::shared::storage::{self, StorageKey};

pub const DEFAULT_LARGE_FILE_LIMIT: usize = 200;
pub const DEFAULT_DUPLICATE_MIN_SIZE: u64 = 1024;

pub type Progress<'a> = Option<&'a Sender<ProgressData>>;

static INIT: Once = Once::new();

pub fn init() {
    INIT.call_once(|| {
        let _ = set_config_cache_path("betaclean", "betaclean");
    });
}

fn prepare<T: CommonData>(tool: &mut T, options: &ScanOptions) -> Result<(), String> {
    init();
    let included: Vec<PathBuf> = options
        .paths
        .iter()
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
        .collect();
    if included.is_empty() {
        return Err("Không có thư mục hợp lệ để quét.".to_string());
    }
    tool.set_included_paths(included);
    tool.set_excluded_paths(options.excluded.iter().map(PathBuf::from).collect());
    tool.set_recursive_search(true);
    if let Some(min_size) = options.min_size {
        tool.set_minimal_file_size(min_size);
    }
    Ok(())
}

fn finish<T: CommonData, R>(tool: &T, result: R) -> Result<R, String> {
    if tool.get_stopped_search() {
        Err("Đã huỷ quét.".to_string())
    } else {
        Ok(result)
    }
}

fn path_string(path: &std::path::Path) -> String {
    path.to_string_lossy().into_owned()
}

fn storage_index(keys: &mut Vec<Option<StorageKey>>, key: Option<StorageKey>) -> usize {
    if let Some(index) = key.and_then(|k| keys.iter().position(|known| *known == Some(k))) {
        return index;
    }
    keys.push(key);
    keys.len() - 1
}

pub fn large_files(
    options: &ScanOptions,
    stop: &Arc<AtomicBool>,
    progress: Progress,
) -> Result<Vec<FileItem>, String> {
    let limit = options.limit.unwrap_or(DEFAULT_LARGE_FILE_LIMIT);
    let mut tool = BigFile::new(BigFileParameters::new(limit, SearchMode::BiggestFiles));
    prepare(&mut tool, options)?;
    tool.search(stop, progress);
    let min_size = options.min_size.unwrap_or(0);
    let mut items: Vec<FileItem> = tool
        .get_big_files()
        .iter()
        .map(|f| FileItem {
            path: path_string(&f.path),
            size: disk_size::of_path(&f.path).unwrap_or(f.size),
            modified: f.modified_date,
        })
        .filter(|f| f.size >= min_size)
        .collect();
    items.sort_by_key(|f| std::cmp::Reverse(f.size));
    finish(&tool, items)
}

pub fn duplicates(
    options: &ScanOptions,
    stop: &Arc<AtomicBool>,
    progress: Progress,
) -> Result<Vec<DuplicateGroup>, String> {
    let params = DuplicateFinderParameters::new(
        CheckingMethod::Hash,
        HashType::Blake3,
        true,
        DEFAULT_DUPLICATE_MIN_SIZE,
        DEFAULT_DUPLICATE_MIN_SIZE,
        false,
    );
    let mut tool = DuplicateFinder::new(params);
    let mut options = options.clone();
    options.min_size.get_or_insert(1);
    prepare(&mut tool, &options)?;
    tool.search(stop, progress);
    let mut groups: Vec<DuplicateGroup> = tool
        .get_files_sorted_by_hash()
        .iter()
        .flat_map(|(size, groups)| groups.iter().map(move |group| (*size, group)))
        .filter(|(_, group)| group.len() > 1)
        .filter_map(|(size, group)| {
            let mut keys: Vec<Option<StorageKey>> = Vec::new();
            let files: Vec<DuplicateFile> = group
                .iter()
                .map(|e| DuplicateFile {
                    path: path_string(&e.path),
                    size: e.size,
                    modified: e.modified_date,
                    storage: storage_index(&mut keys, storage::key(&e.path)),
                })
                .collect();
            (keys.len() > 1).then(|| DuplicateGroup {
                size,
                hash: group[0].hash.clone(),
                reclaimable: size * (keys.len() as u64 - 1),
                files,
            })
        })
        .collect();
    groups.sort_by_key(|g| std::cmp::Reverse(g.reclaimable));
    finish(&tool, groups)
}

pub fn temporary_files(
    options: &ScanOptions,
    stop: &Arc<AtomicBool>,
    progress: Progress,
) -> Result<Vec<FileItem>, String> {
    let mut tool = Temporary::new(TemporaryParameters::new());
    prepare(&mut tool, options)?;
    tool.search(stop, progress);
    let mut items: Vec<FileItem> = tool
        .get_temporary_files()
        .iter()
        .map(|f| FileItem {
            path: path_string(&f.path),
            size: disk_size::of_path(&f.path).unwrap_or(f.size),
            modified: f.modified_date,
        })
        .collect();
    items.sort_by_key(|f| std::cmp::Reverse(f.size));
    finish(&tool, items)
}

pub fn empty_folders(
    options: &ScanOptions,
    stop: &Arc<AtomicBool>,
    progress: Progress,
) -> Result<Vec<FolderItem>, String> {
    let mut tool = EmptyFolder::new();
    prepare(&mut tool, options)?;
    tool.search(stop, progress);
    let mut items: Vec<FolderItem> = tool
        .get_empty_folder_list()
        .values()
        .map(|f| FolderItem {
            path: path_string(&f.path),
            modified: f.modified_date,
        })
        .collect();
    items.sort_by(|a, b| a.path.cmp(&b.path));
    finish(&tool, items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::Ordering;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("betaclean-test-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn options(&self) -> ScanOptions {
            ScanOptions {
                paths: vec![path_string(&self.0)],
                ..Default::default()
            }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn flag() -> Arc<AtomicBool> {
        Arc::new(AtomicBool::new(false))
    }

    #[test]
    fn rejects_missing_paths() {
        let options = ScanOptions {
            paths: vec!["/khong/ton/tai/betaclean".to_string()],
            ..Default::default()
        };
        assert!(large_files(&options, &flag(), None).is_err());
    }

    #[test]
    fn finds_largest_files_first() {
        let dir = TempDir::new("large");
        fs::write(dir.0.join("small.bin"), vec![1u8; 10]).unwrap();
        fs::write(dir.0.join("big.bin"), vec![1u8; 5000]).unwrap();
        let items = large_files(&dir.options(), &flag(), None).unwrap();
        assert_eq!(items.len(), 2);
        assert!(items[0].path.ends_with("big.bin"));
        assert_eq!(items[0].size, 5000);
    }

    #[test]
    fn groups_identical_files() {
        let dir = TempDir::new("dup");
        fs::create_dir_all(dir.0.join("sub")).unwrap();
        fs::write(dir.0.join("a.txt"), vec![7u8; 4096]).unwrap();
        fs::write(dir.0.join("sub").join("b.txt"), vec![7u8; 4096]).unwrap();
        fs::write(dir.0.join("c.txt"), vec![8u8; 4096]).unwrap();
        let groups = duplicates(&dir.options(), &flag(), None).unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].files.len(), 2);
        assert_eq!(groups[0].reclaimable, 4096);
    }

    #[cfg(unix)]
    #[test]
    fn hard_links_are_not_reclaimable() {
        let dir = TempDir::new("dup-hard");
        fs::write(dir.0.join("a.bin"), vec![9u8; 4096]).unwrap();
        fs::hard_link(dir.0.join("a.bin"), dir.0.join("b.bin")).unwrap();
        assert!(
            duplicates(&dir.options(), &flag(), None)
                .unwrap()
                .is_empty()
        );
        fs::write(dir.0.join("c.bin"), vec![9u8; 4096]).unwrap();
        let groups = duplicates(&dir.options(), &flag(), None).unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].files.len(), 3);
        assert_eq!(groups[0].reclaimable, 4096);
        let shared = |name: &str| {
            groups[0]
                .files
                .iter()
                .find(|f| f.path.ends_with(name))
                .unwrap()
                .storage
        };
        assert_eq!(shared("a.bin"), shared("b.bin"));
        assert_ne!(shared("a.bin"), shared("c.bin"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apfs_clones_are_not_reclaimable() {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;
        let dir = TempDir::new("dup-clone");
        let original = dir.0.join("a.bin");
        fs::write(&original, vec![4u8; 64 * 1024]).unwrap();
        let src = CString::new(original.as_os_str().as_bytes()).unwrap();
        let dst = CString::new(dir.0.join("b.bin").as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { libc::clonefile(src.as_ptr(), dst.as_ptr(), 0) }, 0);
        assert!(
            duplicates(&dir.options(), &flag(), None)
                .unwrap()
                .is_empty()
        );
        fs::write(dir.0.join("c.bin"), vec![4u8; 64 * 1024]).unwrap();
        let groups = duplicates(&dir.options(), &flag(), None).unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].reclaimable, 64 * 1024);
    }

    #[test]
    fn detects_temporary_files() {
        let dir = TempDir::new("tmp");
        fs::write(dir.0.join("report.tmp"), b"x").unwrap();
        fs::write(dir.0.join("report.docx"), b"x").unwrap();
        let items = temporary_files(&dir.options(), &flag(), None).unwrap();
        assert_eq!(items.len(), 1);
        assert!(items[0].path.ends_with("report.tmp"));
    }

    #[test]
    fn detects_empty_folders() {
        let dir = TempDir::new("empty");
        fs::create_dir_all(dir.0.join("rong")).unwrap();
        fs::create_dir_all(dir.0.join("day")).unwrap();
        fs::write(dir.0.join("day").join("f.txt"), b"x").unwrap();
        let items = empty_folders(&dir.options(), &flag(), None).unwrap();
        assert!(items.iter().any(|f| f.path.ends_with("rong")));
        assert!(!items.iter().any(|f| f.path.ends_with("day")));
    }

    #[test]
    fn reports_cancellation() {
        let dir = TempDir::new("cancel");
        fs::write(dir.0.join("f.bin"), vec![1u8; 10]).unwrap();
        let stop = flag();
        stop.store(true, Ordering::Relaxed);
        assert!(large_files(&dir.options(), &stop, None).is_err());
    }
}
