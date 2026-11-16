mod features;

use features::{junk, scan, system};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    scan::service::init();
    tauri::Builder::default()
        .manage(scan::state::ScanState::default())
        .invoke_handler(tauri::generate_handler![
            system::commands::get_system_info,
            scan::commands::scan_large_files,
            scan::commands::scan_duplicates,
            scan::commands::scan_temporary_files,
            scan::commands::scan_empty_folders,
            scan::commands::cancel_scan,
            junk::commands::scan_junk_locations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
