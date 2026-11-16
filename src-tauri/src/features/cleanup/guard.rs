use std::path::{Path, PathBuf};

use crate::features::junk::model::Safety;
use crate::features::junk::service as junk;

fn key(path: &Path) -> String {
    let text = path.to_string_lossy();
    let text = if cfg!(windows) {
        text.replace('/', "\\")
    } else {
        text.into_owned()
    };
    let trimmed = text.trim_end_matches(['/', '\\']);
    let trimmed = if trimmed.is_empty() {
        text.as_str()
    } else {
        trimmed
    };
    if cfg!(any(windows, target_os = "macos")) {
        trimmed.to_lowercase()
    } else {
        trimmed.to_string()
    }
}

pub fn same(a: &Path, b: &Path) -> bool {
    key(a) == key(b)
}

pub fn within(child: &Path, parent: &Path) -> bool {
    let parent = key(parent);
    let child = key(child);
    child.len() > parent.len()
        && child.starts_with(&parent)
        && child[parent.len()..].starts_with(['/', '\\'])
}

pub struct Guard {
    home: Option<PathBuf>,
    system: Vec<PathBuf>,
    allowed: Vec<PathBuf>,
}

impl Guard {
    pub fn new(home: Option<PathBuf>, system: Vec<PathBuf>, allowed: Vec<PathBuf>) -> Self {
        Self {
            home,
            system,
            allowed,
        }
    }

    pub fn for_platform() -> Self {
        let var = |name: &str| junk::system_variable(name).map(PathBuf::from);
        let home = var("home");
        let mut system: Vec<PathBuf> = if cfg!(windows) {
            ["WINDIR", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"]
                .iter()
                .filter_map(|v| std::env::var(v).ok())
                .map(PathBuf::from)
                .collect()
        } else {
            [
                "/System",
                "/Library",
                "/Applications",
                "/usr",
                "/bin",
                "/sbin",
                "/private",
                "/etc",
                "/var",
                "/opt",
                "/Volumes",
            ]
            .iter()
            .map(PathBuf::from)
            .collect()
        };
        if let Some(home) = &home {
            system.push(home.join("AppData"));
            system.push(home.join("Library"));
        }
        let allowed = junk::all_rules()
            .unwrap_or_default()
            .into_iter()
            .filter(|r| r.os == std::env::consts::OS && r.safety != Safety::KhongDongVao)
            .filter_map(|r| junk::resolve_path(&r.path, junk::system_variable))
            .collect();
        Self::new(home, system, allowed)
    }

    pub fn check(&self, path: &Path) -> Result<(), String> {
        if !path.is_absolute() {
            return Err("Đường dẫn không tuyệt đối.".to_string());
        }
        if path.components().any(|c| {
            matches!(
                c,
                std::path::Component::ParentDir | std::path::Component::CurDir
            )
        }) {
            return Err("Đường dẫn chứa thành phần tương đối.".to_string());
        }
        if path.parent().is_none() || path.parent().is_some_and(|p| p.as_os_str().is_empty()) {
            return Err("Không được xoá thư mục gốc.".to_string());
        }
        if self
            .home
            .as_deref()
            .is_some_and(|h| same(path, h) || within(h, path))
        {
            return Err("Không được xoá thư mục người dùng.".to_string());
        }
        if self.allowed.iter().any(|a| same(path, a)) {
            return Err("Chỉ dọn nội dung bên trong thư mục này.".to_string());
        }
        if self.allowed.iter().any(|a| within(path, a)) {
            return Ok(());
        }
        if self
            .system
            .iter()
            .any(|s| same(path, s) || within(path, s) || within(s, path))
        {
            return Err("Đường dẫn thuộc vùng hệ thống được bảo vệ.".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        if cfg!(windows) {
            PathBuf::from("C:\\")
        } else {
            PathBuf::from("/")
        }
    }

    fn guard() -> Guard {
        let r = root();
        Guard::new(
            Some(r.join("Users").join("an")),
            vec![r.join("Windows")],
            vec![r.join("Windows").join("Temp")],
        )
    }

    #[test]
    fn blocks_roots_home_and_system() {
        let g = guard();
        let r = root();
        assert!(g.check(&r).is_err());
        assert!(g.check(&r.join("Users")).is_err());
        assert!(g.check(&r.join("Users").join("an")).is_err());
        assert!(g.check(&r.join("Windows").join("System32")).is_err());
        assert!(g.check(&r.join("Windows")).is_err());
        assert!(g.check(Path::new("tuong-doi")).is_err());
        let escape = r.join("Windows").join("Temp").join("..").join("System32");
        assert!(g.check(&escape).is_err());
    }

    #[test]
    fn allows_user_files_and_junk_contents() {
        let g = guard();
        let r = root();
        assert!(
            g.check(&r.join("Users").join("an").join("Downloads").join("a.zip"))
                .is_ok()
        );
        assert!(
            g.check(&r.join("Windows").join("Temp").join("x.tmp"))
                .is_ok()
        );
        assert!(g.check(&r.join("Windows").join("Temp")).is_err());
    }

    #[test]
    fn compares_by_component() {
        let r = root();
        assert!(within(&r.join("ab").join("c"), &r.join("ab")));
        assert!(!within(&r.join("abc"), &r.join("ab")));
        assert!(!within(&r.join("ab"), &r.join("ab")));
    }

    #[cfg(windows)]
    #[test]
    fn ignores_case_on_windows() {
        assert!(
            guard()
                .check(Path::new("c:\\windows\\system32\\x.dll"))
                .is_err()
        );
        assert!(guard().check(Path::new("c:\\windows\\temp\\x.tmp")).is_ok());
    }
}
