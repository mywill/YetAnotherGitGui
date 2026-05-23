use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn abort_operation(state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;
    git::operations::abort_operation(&repo)
}

#[tauri::command]
pub fn continue_operation(state: State<AppState>) -> Result<String, AppError> {
    let repo = state.get_repo()?;
    git::operations::continue_operation(&repo)
}
