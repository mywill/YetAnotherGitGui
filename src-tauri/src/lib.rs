mod commands;
pub mod crash_handler;
mod error;
mod git;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_current_dir,
            commands::open_repository,
            commands::get_repository_info,
            commands::get_commit_graph,
            commands::get_commit_details,
            commands::get_commit_file_diff,
            commands::list_branches,
            commands::list_tags,
            commands::checkout_commit,
            commands::checkout_branch,
            commands::delete_branch,
            commands::delete_tag,
            commands::get_file_statuses,
            commands::stage_file,
            commands::unstage_file,
            commands::stage_hunk,
            commands::unstage_hunk,
            commands::stage_lines,
            commands::get_file_diff,
            commands::create_commit,
            commands::revert_file,
            commands::delete_file,
            commands::install_cli,
            commands::uninstall_cli,
            commands::check_cli_installed,
            commands::get_app_info,
            commands::list_stashes,
            commands::get_stash_details,
            commands::apply_stash,
            commands::drop_stash,
            commands::get_stash_file_diff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
