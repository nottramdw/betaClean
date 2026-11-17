use tauri::State;

use super::model::JunkLocation;
use super::service;
use crate::features::scan::state::ScanState;

#[tauri::command]
pub async fn scan_junk_locations(state: State<'_, ScanState>) -> Result<Vec<JunkLocation>, String> {
    let stop = state.begin();
    tauri::async_runtime::spawn_blocking(move || {
        let rules = service::platform_rules()?;
        service::scan_locations(&rules, &stop)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn measure_junk_locations(ids: Vec<String>) -> Result<Vec<JunkLocation>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        service::measure_locations(&ids, &std::sync::atomic::AtomicBool::new(false))
    })
    .await
    .map_err(|e| e.to_string())?
}
