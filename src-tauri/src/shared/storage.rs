use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct StorageKey {
    device: u64,
    id: u64,
}

#[cfg(target_os = "macos")]
fn clone_id(path: &Path) -> Option<u64> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    #[repr(C)]
    struct Reply {
        length: u32,
        returned: [u32; 5],
        clone_id: [u8; 8],
    }

    let c_path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut request = libc::attrlist {
        bitmapcount: libc::ATTR_BIT_MAP_COUNT,
        reserved: 0,
        commonattr: libc::ATTR_CMN_RETURNED_ATTRS,
        volattr: 0,
        dirattr: 0,
        fileattr: 0,
        forkattr: libc::ATTR_CMNEXT_CLONEID,
    };
    let mut reply = Reply {
        length: 0,
        returned: [0; 5],
        clone_id: [0; 8],
    };
    let status = unsafe {
        libc::getattrlist(
            c_path.as_ptr(),
            (&mut request as *mut libc::attrlist).cast(),
            (&mut reply as *mut Reply).cast(),
            std::mem::size_of::<Reply>(),
            libc::FSOPT_NOFOLLOW | libc::FSOPT_ATTR_CMN_EXTENDED,
        )
    };
    if status != 0 || reply.returned[4] & libc::ATTR_CMNEXT_CLONEID == 0 {
        return None;
    }
    Some(u64::from_ne_bytes(reply.clone_id))
}

#[cfg(unix)]
pub fn key(path: &Path) -> Option<StorageKey> {
    use std::os::unix::fs::MetadataExt;
    let meta = std::fs::symlink_metadata(path).ok()?;
    #[cfg(target_os = "macos")]
    let id = clone_id(path).unwrap_or(meta.ino());
    #[cfg(not(target_os = "macos"))]
    let id = meta.ino();
    Some(StorageKey {
        device: meta.dev(),
        id,
    })
}

#[cfg(not(unix))]
pub fn key(_path: &Path) -> Option<StorageKey> {
    None
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::fs;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("betaclean-storage-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn hard_links_share_storage() {
        let original = scratch("hard-a.bin");
        let link = scratch("hard-b.bin");
        let copy = scratch("hard-c.bin");
        let _ = fs::remove_file(&link);
        fs::write(&original, vec![3u8; 4096]).unwrap();
        fs::hard_link(&original, &link).unwrap();
        fs::copy(&original, &copy).unwrap();
        assert_eq!(key(&original), key(&link));
        assert_ne!(key(&original), key(&copy));
        for path in [original, link, copy] {
            fs::remove_file(path).unwrap();
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apfs_clones_share_storage() {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;
        let original = scratch("clone-a.bin");
        let clone = scratch("clone-b.bin");
        let copy = scratch("clone-c.bin");
        let _ = fs::remove_file(&clone);
        fs::write(&original, vec![5u8; 64 * 1024]).unwrap();
        let src = CString::new(original.as_os_str().as_bytes()).unwrap();
        let dst = CString::new(clone.as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { libc::clonefile(src.as_ptr(), dst.as_ptr(), 0) }, 0);
        fs::write(&copy, vec![5u8; 64 * 1024]).unwrap();
        assert!(clone_id(&original).is_some());
        assert_eq!(key(&original), key(&clone));
        assert_ne!(key(&original), key(&copy));
        for path in [original, clone, copy] {
            fs::remove_file(path).unwrap();
        }
    }
}
