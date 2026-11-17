use std::path::Path;
use std::process::{Child, Command};

pub enum Target<'a> {
    Item(&'a Path),
    Folder(&'a Path),
}

pub fn target(path: &Path) -> Result<Target<'_>, String> {
    if !path.is_absolute() {
        return Err("Đường dẫn không tuyệt đối.".to_string());
    }
    if path.exists() {
        return Ok(Target::Item(path));
    }
    path.ancestors()
        .skip(1)
        .find(|p| p.is_dir())
        .map(Target::Folder)
        .ok_or_else(|| "Không tìm thấy thư mục chứa tệp.".to_string())
}

#[cfg(windows)]
fn launch(target: &Target) -> std::io::Result<Child> {
    use std::os::windows::process::CommandExt;
    let argument = match target {
        Target::Item(path) => format!("/select,\"{}\"", path.display()),
        Target::Folder(path) => format!("\"{}\"", path.display()),
    };
    Command::new("explorer.exe").raw_arg(argument).spawn()
}

#[cfg(target_os = "macos")]
fn launch(target: &Target) -> std::io::Result<Child> {
    match target {
        Target::Item(path) => Command::new("open").arg("-R").arg(path).spawn(),
        Target::Folder(path) => Command::new("open").arg(path).spawn(),
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch(target: &Target) -> std::io::Result<Child> {
    let folder = match target {
        Target::Item(path) => path.parent().unwrap_or(path),
        Target::Folder(path) => path,
    };
    Command::new("xdg-open").arg(folder).spawn()
}

pub fn reveal(path: &Path) -> Result<(), String> {
    let mut child = launch(&target(path)?).map_err(|e| format!("Không mở được thư mục: {e}"))?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn falls_back_to_nearest_existing_folder() {
        let dir = std::env::temp_dir();
        let missing = dir.join("betaclean-khong-ton-tai").join("a.txt");
        assert!(matches!(target(&missing), Ok(Target::Folder(p)) if p == dir));
        assert!(matches!(target(&dir), Ok(Target::Item(p)) if p == dir));
        assert!(target(Path::new("tuong-doi")).is_err());
    }
}
