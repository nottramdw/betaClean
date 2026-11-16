use tauri::{AppHandle, State};

use super::model::{UnusedFile, UnusedOptions};
use super::service;
use crate::features::scan::runner::run;
use crate::features::scan::state::ScanState;

#[tauri::command]
pub async fn scan_unused_files(
    app: AppHandle,
    state: State<'_, ScanState>,
    options: UnusedOptions,
) -> Result<Vec<UnusedFile>, String> {
    run(app, &state, "unused", move |stop, tx| {
        service::find_unused(&options, stop, Some(tx))
    })
    .await
}
