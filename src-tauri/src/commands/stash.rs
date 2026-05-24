use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn list_stashes(state: State<AppState>) -> Result<Vec<git::StashInfo>, AppError> {
    crate::log_cmd_debug!("list_stashes");
    let mut repo = state.get_repo()?;

    git::list_stashes(&mut repo)
}

#[tauri::command]
pub fn get_stash_details(
    index: usize,
    state: State<AppState>,
) -> Result<git::StashDetails, AppError> {
    crate::log_cmd_debug!("get_stash_details", index = index);
    let mut repo = state.get_repo()?;

    git::get_stash_details(&mut repo, index)
}

#[tauri::command]
pub fn apply_stash(index: usize, state: State<AppState>) -> Result<(), AppError> {
    crate::log_cmd!("apply_stash", index = index);
    let mut repo = state.get_repo()?;

    git::apply_stash(&mut repo, index)
}

#[tauri::command]
pub fn drop_stash(index: usize, state: State<AppState>) -> Result<(), AppError> {
    crate::log_cmd!("drop_stash", index = index);
    let mut repo = state.get_repo()?;

    git::drop_stash(&mut repo, index)
}

#[tauri::command]
pub fn get_stash_file_diff(
    index: usize,
    file_path: String,
    state: State<AppState>,
) -> Result<git::FileDiff, AppError> {
    crate::log_cmd_debug!("get_stash_file_diff", index = index, file = file_path);
    let mut repo = state.get_repo()?;

    git::get_stash_file_diff(&mut repo, index, &file_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use git2::Repository;

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

        let mut repo_lock = state.repository.lock();
        let result: Result<&mut Repository, AppError> =
            repo_lock.as_mut().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }
}
