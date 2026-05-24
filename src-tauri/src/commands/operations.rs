use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn abort_operation(state: State<AppState>) -> Result<(), AppError> {
    crate::log_cmd!("abort_operation");
    let repo = state.get_repo()?;
    git::operations::abort_operation(&repo)
}

#[tauri::command]
pub fn continue_operation(state: State<AppState>) -> Result<String, AppError> {
    crate::log_cmd!("continue_operation");
    let repo = state.get_repo()?;
    git::operations::continue_operation(&repo)
}
