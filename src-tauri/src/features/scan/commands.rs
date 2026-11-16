use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use crossbeam_channel::Sender;
use czkawka_core::common::progress_data::ProgressData;
use tauri::{AppHandle, Emitter, State};

use super::model::{DuplicateGroup, FileItem, FolderItem, ScanOptions, ScanProgress};
use super::service;
use super::state::ScanState;

pub const PROGRESS_EVENT: &str = "scan-progress";

async fn run<T, F>(
    app: AppHandle,
    state: &ScanState,
    tool: &'static str,
    task: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&Arc<AtomicBool>, &Sender<ProgressData>) -> Result<T, String> + Send + 'static,
{
    let stop = state.begin();
    let (sender, receiver) = crossbeam_channel::unbounded::<ProgressData>();
    std::thread::spawn(move || {
        for data in receiver {
            let _ = app.emit(PROGRESS_EVENT, ScanProgress::from_data(tool, &data));
        }
    });
    tauri::async_runtime::spawn_blocking(move || task(&stop, &sender))
        .await
        .map_err(|e| e.to_string())?
}

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
