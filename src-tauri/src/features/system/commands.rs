use super::{model::SystemInfo, service};

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    service::system_info()
}
