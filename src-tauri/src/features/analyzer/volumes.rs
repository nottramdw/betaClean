use super::model::Volume;

fn volume(mount: String, total: u64, free: u64) -> Volume {
    Volume {
        mount,
        total,
        free,
        used: total.saturating_sub(free),
    }
}

#[cfg(windows)]
pub fn list() -> Vec<Volume> {
    use windows_sys::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives,
    };
    const DRIVE_REMOVABLE: u32 = 2;
    const DRIVE_FIXED: u32 = 3;
    let mask = unsafe { GetLogicalDrives() };
    (0..26u8)
        .filter(|i| mask & (1 << i) != 0)
        .filter_map(|i| {
            let mount = format!("{}:\\", (b'A' + i) as char);
            let wide: Vec<u16> = mount.encode_utf16().chain(std::iter::once(0)).collect();
            let kind = unsafe { GetDriveTypeW(wide.as_ptr()) };
            if kind != DRIVE_FIXED && kind != DRIVE_REMOVABLE {
                return None;
            }
            let (mut available, mut total, mut free) = (0u64, 0u64, 0u64);
            let ok = unsafe {
                GetDiskFreeSpaceExW(wide.as_ptr(), &mut available, &mut total, &mut free)
            };
            (ok != 0 && total > 0).then(|| volume(mount, total, available))
        })
        .collect()
}

#[cfg(unix)]
fn stat(path: &std::path::Path) -> Option<(u64, u64, bool)> {
    use std::os::unix::ffi::OsStrExt;
    let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut info: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c_path.as_ptr(), &mut info) } != 0 {
        return None;
    }
    let unit = info.f_frsize as u64;
    let read_only = info.f_flag & libc::ST_RDONLY != 0;
    Some((
        info.f_blocks as u64 * unit,
        info.f_bavail as u64 * unit,
        read_only,
    ))
}

#[cfg(target_os = "macos")]
fn foreign_format(path: &std::path::Path) -> bool {
    use std::os::unix::ffi::OsStrExt;
    let Ok(c_path) = std::ffi::CString::new(path.as_os_str().as_bytes()) else {
        return false;
    };
    let mut info: libc::statfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statfs(c_path.as_ptr(), &mut info) } != 0 {
        return false;
    }
    let name = unsafe { std::ffi::CStr::from_ptr(info.f_fstypename.as_ptr()) };
    matches!(
        name.to_bytes(),
        b"ntfs" | b"msdos" | b"exfat" | b"ufsd_NTFS" | b"tuxera_ntfs"
    )
}

#[cfg(all(unix, not(target_os = "macos")))]
fn foreign_format(_path: &std::path::Path) -> bool {
    false
}

#[cfg(unix)]
pub fn list() -> Vec<Volume> {
    let mut mounts = vec![std::path::PathBuf::from("/")];
    if let Ok(entries) = std::fs::read_dir("/Volumes") {
        mounts.extend(
            entries
                .flatten()
                .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
                .map(|e| e.path()),
        );
    }
    let mut seen = std::collections::HashSet::new();
    mounts
        .into_iter()
        .enumerate()
        .filter_map(|(index, m)| {
            let (total, free, read_only) = stat(&m)?;
            let external_image = index > 0 && read_only && !foreign_format(&m);
            (total > 0 && !external_image && seen.insert((total, free)))
                .then(|| volume(m.to_string_lossy().into_owned(), total, free))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_at_least_one_volume() {
        let volumes = list();
        assert!(!volumes.is_empty());
        assert!(
            volumes
                .iter()
                .all(|v| v.total >= v.free && v.used == v.total - v.free)
        );
    }
}
