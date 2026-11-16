use tauri::{AppHandle, State};

use super::model::{AnalysisReport, AnalyzeOptions, Volume};
use super::{service, volumes};
use crate::features::scan::runner::run;
use crate::features::scan::state::ScanState;

#[tauri::command]
pub fn list_volumes() -> Vec<Volume> {
    volumes::list()
}

#[tauri::command]
pub async fn analyze_disk(
    app: AppHandle,
    state: State<'_, ScanState>,
    options: AnalyzeOptions,
) -> Result<AnalysisReport, String> {
    run(app, &state, "analyzer", move |stop, tx| {
        service::analyze(&options, stop, Some(tx))
    })
    .await
}
