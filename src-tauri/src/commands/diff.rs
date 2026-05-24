use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub async fn get_file_diff(
    path: String,
    staged: bool,
    is_untracked: Option<bool>,
    is_conflicted: Option<bool>,
    state: State<'_, AppState>,
) -> Result<git::FileDiff, AppError> {
    crate::log_cmd_debug!(
        "get_file_diff",
        path = path,
        staged = staged,
        is_untracked = is_untracked,
        is_conflicted = is_conflicted
    );
    let repository = state.repository.clone();
    tokio::task::spawn_blocking(move || {
        let guard = repository.lock();
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;

        if is_conflicted.unwrap_or(false) {
            return git::get_conflicted_file_diff(repo, &path);
        }

        // For untracked files, read the file directly
        if is_untracked.unwrap_or(false) {
            return git::get_untracked_file_diff(repo, &path);
        }

        git::get_file_diff(repo, &path, staged)
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub fn get_diff_hunk(
    path: String,
    staged: bool,
    hunk_index: usize,
    is_untracked: Option<bool>,
    is_conflicted: Option<bool>,
    state: State<AppState>,
) -> Result<git::DiffHunk, AppError> {
    crate::log_cmd_debug!(
        "get_diff_hunk",
        path = path,
        staged = staged,
        hunk = hunk_index,
        is_untracked = is_untracked,
        is_conflicted = is_conflicted
    );
    let repo = state.get_repo()?;

    if is_conflicted.unwrap_or(false) {
        return git::get_conflicted_diff_hunk(&repo, &path, hunk_index);
    }

    if is_untracked.unwrap_or(false) {
        return git::get_untracked_diff_hunk(&repo, &path, hunk_index);
    }

    git::get_diff_hunk(&repo, &path, staged, hunk_index)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use git2::Repository;

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

        let repo_lock = state.repository.lock();
        let result: Result<&Repository, AppError> =
            repo_lock.as_ref().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }
}
