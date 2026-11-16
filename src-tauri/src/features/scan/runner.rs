use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use crossbeam_channel::Sender;
use czkawka_core::common::progress_data::ProgressData;
use tauri::{AppHandle, Emitter};

use super::model::ScanProgress;
use super::state::ScanState;

pub const PROGRESS_EVENT: &str = "scan-progress";

pub async fn run<T, F>(
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
