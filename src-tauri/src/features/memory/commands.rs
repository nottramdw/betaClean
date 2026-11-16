use std::sync::Arc;

use tauri::State;

use super::model::MemoryReport;
use super::service::Monitor;
use crate::features::cleanup::model::CleanupReport;

#[derive(Default)]
pub struct MemoryState(pub Arc<Monitor>);

#[tauri::command]
pub async fn memory_usage(state: State<'_, MemoryState>) -> Result<MemoryReport, String> {
    let monitor = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || monitor.snapshot())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn stop_processes(
    state: State<'_, MemoryState>,
    id: String,
    pids: Vec<u32>,
    force: bool,
    confirmed: bool,
) -> Result<CleanupReport, String> {
    let monitor = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || monitor.terminate(&id, &pids, force, confirmed))
        .await
        .map_err(|e| e.to_string())?
}
