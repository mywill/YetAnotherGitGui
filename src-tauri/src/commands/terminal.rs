use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn spawn_terminal(
    cwd: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<u32, AppError> {
    crate::log_cmd!("spawn_terminal", cwd = cwd);
    state.terminal_manager.spawn(&cwd, app)
}

#[tauri::command]
pub fn write_terminal(
    session_id: u32,
    data: String,
    state: State<AppState>,
) -> Result<(), AppError> {
    // Intentionally never log `data` — terminal input may contain secrets.
    // Logs only the session id and byte length, and only at trace level so a
    // user with debug logging off sees nothing per-keystroke.
    log::trace!(target: "yagg::cmd", "cmd=write_terminal session={} bytes={}", session_id, data.len());
    state.terminal_manager.write(session_id, &data)
}

#[tauri::command]
pub fn resize_terminal(
    session_id: u32,
    rows: u16,
    cols: u16,
    state: State<AppState>,
) -> Result<(), AppError> {
    crate::log_cmd!(
        "resize_terminal",
        session = session_id,
        rows = rows,
        cols = cols
    );
    state.terminal_manager.resize(session_id, rows, cols)
}

#[tauri::command]
pub fn kill_terminal(session_id: u32, state: State<AppState>) -> Result<(), AppError> {
    crate::log_cmd!("kill_terminal", session = session_id);
    state.terminal_manager.kill(session_id)
}
