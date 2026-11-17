use super::{model::SystemInfo, reveal, service};

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    service::system_info()
}

#[tauri::command]
pub async fn reveal_path(path: String) -> Result<(), String> {
    reveal::reveal(std::path::Path::new(&path))
}
