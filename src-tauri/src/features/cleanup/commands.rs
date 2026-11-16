use tauri::{AppHandle, Manager};

use super::guard::Guard;
use super::model::{CleanupReport, HistoryEntry, QuarantineEntry, QuarantineRequest};
use super::service::Store;

const DEFAULT_HISTORY_LIMIT: usize = 200;

fn store(app: &AppHandle) -> Result<Store, String> {
    app.path()
        .app_data_dir()
        .map(Store::new)
        .map_err(|e| e.to_string())
}

async fn blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn move_to_trash(
    app: AppHandle,
    paths: Vec<String>,
    confirmed: bool,
) -> Result<CleanupReport, String> {
    let store = store(&app)?;
    blocking(move || store.move_to_trash(&Guard::for_platform(), &paths, confirmed)).await
}

#[tauri::command]
pub async fn quarantine_files(
    app: AppHandle,
    items: Vec<QuarantineRequest>,
    confirmed: bool,
) -> Result<CleanupReport, String> {
    let store = store(&app)?;
    blocking(move || store.quarantine(&Guard::for_platform(), &items, confirmed)).await
}

#[tauri::command]
pub fn list_quarantine(app: AppHandle) -> Result<Vec<QuarantineEntry>, String> {
    Ok(store(&app)?.list_quarantine())
}

#[tauri::command]
pub async fn restore_quarantined(
    app: AppHandle,
    ids: Vec<String>,
    confirmed: bool,
) -> Result<CleanupReport, String> {
    let store = store(&app)?;
    blocking(move || store.restore(&ids, confirmed)).await
}

#[tauri::command]
pub async fn delete_quarantined(
    app: AppHandle,
    ids: Vec<String>,
    confirmed: bool,
) -> Result<CleanupReport, String> {
    let store = store(&app)?;
    blocking(move || store.delete_quarantined(&ids, confirmed)).await
}

#[tauri::command]
pub fn get_cleanup_history(
    app: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<HistoryEntry>, String> {
    Ok(store(&app)?.history(limit.unwrap_or(DEFAULT_HISTORY_LIMIT)))
}
