use std::fs::{self, Metadata};
use std::path::Path;

#[cfg(unix)]
pub fn on_disk(_path: &Path, meta: &Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    meta.len().min(meta.blocks().saturating_mul(512))
}

#[cfg(windows)]
pub fn on_disk(path: &Path, meta: &Metadata) -> u64 {
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_COMPRESSED, FILE_ATTRIBUTE_SPARSE_FILE, GetCompressedFileSizeW,
        INVALID_FILE_SIZE,
    };
    let len = meta.len();
    if meta.file_attributes() & (FILE_ATTRIBUTE_SPARSE_FILE | FILE_ATTRIBUTE_COMPRESSED) == 0 {
        return len;
    }
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut high = 0u32;
    let low = unsafe { GetCompressedFileSizeW(wide.as_ptr(), &mut high) };
    if low == INVALID_FILE_SIZE && std::io::Error::last_os_error().raw_os_error() != Some(0) {
        return len;
    }
    len.min((u64::from(high) << 32) | u64::from(low))
}

pub fn of_path(path: &Path) -> Option<u64> {
    let meta = fs::metadata(path).ok()?;
    Some(on_disk(path, &meta))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("betaclean-size-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn regular_file_reports_its_length() {
        let path = scratch("data.bin");
        fs::write(&path, vec![7u8; 10_000]).unwrap();
        assert_eq!(of_path(&path), Some(10_000));
        fs::remove_file(&path).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn sparse_file_reports_allocated_bytes() {
        let path = scratch("sparse.raw");
        let file = fs::File::create(&path).unwrap();
        file.set_len(8 * 1024 * 1024 * 1024).unwrap();
        assert!(of_path(&path).unwrap() < 1024 * 1024);
        fs::remove_file(&path).unwrap();
    }
}
