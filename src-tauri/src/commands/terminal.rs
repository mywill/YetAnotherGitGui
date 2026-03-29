use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn spawn_terminal(
    cwd: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<u32, AppError> {
    state.terminal_manager.spawn(&cwd, app)
}

#[tauri::command]
pub fn write_terminal(
    session_id: u32,
    data: String,
    state: State<AppState>,
) -> Result<(), AppError> {
    state.terminal_manager.write(session_id, &data)
}

#[tauri::command]
pub fn resize_terminal(
    session_id: u32,
    rows: u16,
    cols: u16,
    state: State<AppState>,
) -> Result<(), AppError> {
    state.terminal_manager.resize(session_id, rows, cols)
}

#[tauri::command]
pub fn kill_terminal(session_id: u32, state: State<AppState>) -> Result<(), AppError> {
    state.terminal_manager.kill(session_id)
}
