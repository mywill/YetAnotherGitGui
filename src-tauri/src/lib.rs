pub mod commands;
pub mod crash_handler;
pub mod error;
pub mod git;
pub mod logger;
mod state;
pub mod terminal;
pub mod update_logger;

/// Log a Tauri command invocation. Captures the command name and (optionally)
/// key parameters by identifier and value. Never log file contents, diff
/// payloads, commit message bodies, or terminal stdin — only identifiers and
/// lengths.
///
/// **Wire format.** Output is a single line on the `yagg::cmd` target:
/// `cmd=<name> <k1>={:?} <k2>={:?} …`. Values use Rust's `{:?}` formatter,
/// so string args render with surrounding quotes (`path="src/foo.rs"`,
/// `hash="abc123"`); numbers and bools render bare. Examples:
///
/// - `log_cmd!("list_branches")` → `cmd=list_branches`
/// - `log_cmd!("stage_file", path = path)` → `cmd=stage_file path="src/x"`
/// - `log_cmd!("delete_branch", branch = name, is_remote = b)`
///   → `cmd=delete_branch branch="foo" is_remote=false`
#[macro_export]
macro_rules! log_cmd {
    ($name:literal) => {
        log::info!(target: "yagg::cmd", "cmd={}", $name);
    };
    ($name:literal, $($k:ident = $v:expr),+ $(,)?) => {
        log::info!(target: "yagg::cmd",
            concat!("cmd=", $name, $(" ", stringify!($k), "={:?}"),+),
            $($v),+);
    };
}

/// Log a git helper call. Use at the top of every public `pub fn` in `git/`.
#[macro_export]
macro_rules! log_git_op {
    ($name:literal) => {
        log::info!(target: "yagg::git", "op={}", $name);
    };
    ($name:literal, $($k:ident = $v:expr),+ $(,)?) => {
        log::info!(target: "yagg::git",
            concat!("op=", $name, $(" ", stringify!($k), "={:?}"),+),
            $($v),+);
    };
}

/// Debug-level counterpart to `log_cmd!`. Use for pure read commands so the
/// default-on log doesn't fill with `cmd=list_branches` on every refresh.
/// Same wire format on the same `yagg::cmd` target — only the level differs.
#[macro_export]
macro_rules! log_cmd_debug {
    ($name:literal) => {
        log::debug!(target: "yagg::cmd", "cmd={}", $name);
    };
    ($name:literal, $($k:ident = $v:expr),+ $(,)?) => {
        log::debug!(target: "yagg::cmd",
            concat!("cmd=", $name, $(" ", stringify!($k), "={:?}"),+),
            $($v),+);
    };
}

/// Debug-level counterpart to `log_git_op!`. Use for read-only git helpers.
#[macro_export]
macro_rules! log_git_op_debug {
    ($name:literal) => {
        log::debug!(target: "yagg::git", "op={}", $name);
    };
    ($name:literal, $($k:ident = $v:expr),+ $(,)?) => {
        log::debug!(target: "yagg::git",
            concat!("op=", $name, $(" ", stringify!($k), "={:?}"),+),
            $($v),+);
    };
}

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_current_dir,
            commands::open_repository,
            commands::get_repository_info,
            commands::get_all_commit_graph,
            commands::get_commit_details,
            commands::get_commit_file_diff,
            commands::get_commit_diff_hunk,
            commands::list_branches,
            commands::list_tags,
            commands::checkout_commit,
            commands::checkout_branch,
            commands::create_branch_and_checkout,
            commands::validate_branch_name,
            commands::delete_branch,
            commands::delete_tag,
            commands::get_file_statuses,
            commands::stage_file,
            commands::unstage_file,
            commands::stage_files,
            commands::unstage_files,
            commands::stage_hunk,
            commands::unstage_hunk,
            commands::stage_lines,
            commands::discard_hunk,
            commands::get_file_diff,
            commands::get_diff_hunk,
            commands::create_commit,
            commands::revert_file,
            commands::revert_commit,
            commands::revert_commit_file,
            commands::revert_commit_file_lines,
            commands::delete_file,
            commands::delete_files,
            commands::resolve_conflict,
            commands::abort_operation,
            commands::continue_operation,
            commands::install_cli,
            commands::uninstall_cli,
            commands::check_cli_installed,
            commands::get_app_info,
            commands::list_stashes,
            commands::get_stash_details,
            commands::apply_stash,
            commands::drop_stash,
            commands::get_stash_file_diff,
            commands::list_gone_branches,
            commands::list_merged_branches,
            commands::delete_branches,
            commands::prune_remote,
            commands::list_old_stashes,
            commands::drop_stashes,
            commands::list_untracked_files,
            commands::clean_untracked_files,
            commands::write_update_log,
            commands::get_update_log_path,
            commands::get_log_dir,
            commands::open_log_dir,
            commands::log_from_frontend,
            commands::set_debug_logging_enabled,
            commands::get_debug_logging_enabled,
            commands::read_settings,
            commands::write_settings,
            commands::spawn_terminal,
            commands::write_terminal,
            commands::resize_terminal,
            commands::kill_terminal,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                log::info!(target: "yagg::lifecycle", "window destroyed");
                let state = window.state::<AppState>();
                state.terminal_manager.kill_all();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    log::info!(target: "yagg::lifecycle", "shutdown");
}
