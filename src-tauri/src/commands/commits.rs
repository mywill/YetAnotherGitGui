use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub async fn get_all_commit_graph(
    state: State<'_, AppState>,
) -> Result<Vec<git::GraphCommit>, AppError> {
    // Clone the Arc so the blocking work can own the handle and run off the
    // async runtime without holding the mutex across an .await point.
    let repository = state.repository.clone();
    tokio::task::spawn_blocking(move || {
        let guard = repository.lock();
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;

        let commits = git::get_all_commits(repo)?;
        let refs = git::collect_refs(repo)?;
        let graph = git::build_commit_graph(commits, refs);

        Ok(graph)
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub fn get_commit_details(
    hash: String,
    state: State<AppState>,
) -> Result<git::CommitDetails, AppError> {
    let repo = state.get_repo()?;

    git::get_commit_details(&repo, &hash)
}

#[tauri::command]
pub fn get_commit_file_diff(
    hash: String,
    file_path: String,
    state: State<AppState>,
) -> Result<git::FileDiff, AppError> {
    let repo = state.get_repo()?;

    git::get_commit_file_diff(&repo, &hash, &file_path)
}

#[tauri::command]
pub fn get_commit_diff_hunk(
    hash: String,
    file_path: String,
    hunk_index: usize,
    state: State<AppState>,
) -> Result<git::DiffHunk, AppError> {
    let repo = state.get_repo()?;

    git::get_commit_diff_hunk(&repo, &hash, &file_path, hunk_index)
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
