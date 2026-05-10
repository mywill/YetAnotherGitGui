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
    use crate::test_utils::*;
    use git2::Repository;

    use std::fs;
    use std::path::Path;

    #[test]
    fn test_get_file_diff_unstaged() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Modify the file
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();

        let result = git::get_file_diff(&repo, "initial.txt", false);
        assert!(result.is_ok());

        let diff = result.unwrap();
        assert_eq!(diff.path, "initial.txt");
    }

    #[test]
    fn test_get_file_diff_staged() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Modify and stage the file
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("initial.txt")).unwrap();
        index.write().unwrap();

        let result = git::get_file_diff(&repo, "initial.txt", true);
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_untracked_file_diff() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create an untracked file
        let file_path = temp_dir.path().join("untracked.txt");
        fs::write(&file_path, "untracked content").unwrap();

        let result = git::get_untracked_file_diff(&repo, "untracked.txt");
        assert!(result.is_ok());

        let diff = result.unwrap();
        assert_eq!(diff.path, "untracked.txt");
    }

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

        let repo_lock = state.repository.lock();
        let result: Result<&Repository, AppError> =
            repo_lock.as_ref().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }

    /// Mirror of `get_diff_hunk`'s body so we can exercise the
    /// is_conflicted / is_untracked routing the command wrapper performs,
    /// without spinning up a Tauri runtime.
    fn get_diff_hunk_logic(
        repo: &Repository,
        path: &str,
        staged: bool,
        hunk_index: usize,
        is_untracked: Option<bool>,
        is_conflicted: Option<bool>,
    ) -> Result<git::DiffHunk, AppError> {
        if is_conflicted.unwrap_or(false) {
            return git::get_conflicted_diff_hunk(repo, path, hunk_index);
        }
        if is_untracked.unwrap_or(false) {
            return git::get_untracked_diff_hunk(repo, path, hunk_index);
        }
        git::get_diff_hunk(repo, path, staged, hunk_index)
    }

    #[test]
    fn test_get_diff_hunk_routes_to_untracked() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        // Untracked file with multiple lines so a hunk exists.
        let file_path = temp_dir.path().join("new.txt");
        fs::write(&file_path, "a\nb\nc\n").unwrap();

        let result = get_diff_hunk_logic(&repo, "new.txt", false, 0, Some(true), None);
        assert!(
            result.is_ok(),
            "untracked routing should succeed, got {result:?}"
        );
    }

    #[test]
    fn test_get_diff_hunk_routes_to_unstaged_when_flags_unset() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "changed\n").unwrap();

        let result = get_diff_hunk_logic(&repo, "initial.txt", false, 0, None, None);
        assert!(result.is_ok(), "default routing should succeed, got {result:?}");
    }
}
