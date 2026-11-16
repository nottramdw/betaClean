mod features;
mod shared;

use features::{analyzer, antivirus, cleanup, junk, memory, scan, system, unused};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    scan::service::init();
    tauri::Builder::default()
        .manage(scan::state::ScanState::default())
        .manage(memory::commands::MemoryState::default())
        .invoke_handler(tauri::generate_handler![
            system::commands::get_system_info,
            scan::commands::scan_large_files,
            scan::commands::scan_duplicates,
            scan::commands::scan_temporary_files,
            scan::commands::scan_empty_folders,
            scan::commands::cancel_scan,
            junk::commands::scan_junk_locations,
            unused::commands::scan_unused_files,
            antivirus::commands::antivirus_status,
            antivirus::commands::update_virus_database,
            antivirus::commands::scan_viruses,
            cleanup::commands::move_to_trash,
            cleanup::commands::quarantine_files,
            cleanup::commands::list_quarantine,
            cleanup::commands::restore_quarantined,
            cleanup::commands::delete_quarantined,
            cleanup::commands::get_cleanup_history,
            analyzer::commands::list_volumes,
            analyzer::commands::analyze_disk,
            memory::commands::memory_usage,
            memory::commands::stop_processes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
