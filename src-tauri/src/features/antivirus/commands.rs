use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use super::model::{AntivirusStatus, VirusScanOptions, VirusScanResult};
use super::service;
use crate::features::scan::state::ScanState;

fn bundled_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|d| d.join(service::BUNDLED_DIR))
        .filter(|d| d.is_dir())
}

fn database_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join(service::DATABASE_DIR))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn antivirus_status(app: AppHandle) -> Result<AntivirusStatus, String> {
    Ok(service::status(
        bundled_dir(&app).as_deref(),
        &database_dir(&app)?,
    ))
}

#[tauri::command]
pub async fn update_virus_database(
    app: AppHandle,
    state: State<'_, ScanState>,
) -> Result<String, String> {
    let bundled = bundled_dir(&app);
    let db_dir = database_dir(&app)?;
    let stop = state.begin();
    tauri::async_runtime::spawn_blocking(move || {
        service::update_database(bundled.as_deref(), &db_dir, &stop)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scan_viruses(
    app: AppHandle,
    state: State<'_, ScanState>,
    options: VirusScanOptions,
) -> Result<VirusScanResult, String> {
    let bundled = bundled_dir(&app);
    let db_dir = database_dir(&app)?;
    let stop = state.begin();
    tauri::async_runtime::spawn_blocking(move || {
        service::scan(&options, bundled.as_deref(), &db_dir, &stop)
    })
    .await
    .map_err(|e| e.to_string())?
}
