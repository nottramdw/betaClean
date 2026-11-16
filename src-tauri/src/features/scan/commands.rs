use tauri::{AppHandle, State};

use super::model::{DuplicateGroup, FileItem, FolderItem, ScanOptions};
use super::runner::run;
use super::service;
use super::state::ScanState;

#[tauri::command]
pub async fn scan_large_files(
    app: AppHandle,
    state: State<'_, ScanState>,
    options: ScanOptions,
) -> Result<Vec<FileItem>, String> {
    run(app, &state, "large", move |stop, tx| {
        service::large_files(&options, stop, Some(tx))
    })
    .await
}

#[tauri::command]
pub async fn scan_duplicates(
    app: AppHandle,
    state: State<'_, ScanState>,
    options: ScanOptions,
) -> Result<Vec<DuplicateGroup>, String> {
    run(app, &state, "duplicates", move |stop, tx| {
        service::duplicates(&options, stop, Some(tx))
    })
    .await
}

#[tauri::command]
pub async fn scan_temporary_files(
    app: AppHandle,
    state: State<'_, ScanState>,
    options: ScanOptions,
) -> Result<Vec<FileItem>, String> {
    run(app, &state, "temporary", move |stop, tx| {
        service::temporary_files(&options, stop, Some(tx))
    })
    .await
}

#[tauri::command]
pub async fn scan_empty_folders(
    app: AppHandle,
    state: State<'_, ScanState>,
    options: ScanOptions,
) -> Result<Vec<FolderItem>, String> {
    run(app, &state, "empty-folders", move |stop, tx| {
        service::empty_folders(&options, stop, Some(tx))
    })
    .await
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, ScanState>) {
    state.cancel();
}
