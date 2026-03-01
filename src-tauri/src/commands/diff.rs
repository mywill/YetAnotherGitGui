use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn get_file_diff(
    path: String,
    staged: bool,
    is_untracked: Option<bool>,
    state: State<AppState>,
) -> Result<git::FileDiff, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    // For untracked files, read the file directly
    if is_untracked.unwrap_or(false) {
        return git::get_untracked_file_diff(repo, &path);
    }

    git::get_file_diff(repo, &path, staged)
}

#[tauri::command]
pub fn get_diff_hunk(
    path: String,
    staged: bool,
    hunk_index: usize,
    is_untracked: Option<bool>,
    state: State<AppState>,
) -> Result<git::DiffHunk, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    if is_untracked.unwrap_or(false) {
        return git::get_untracked_diff_hunk(repo, &path, hunk_index);
    }

    git::get_diff_hunk(repo, &path, staged, hunk_index)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use git2::Repository;
    use parking_lot::Mutex;
    use std::fs;
    use std::path::Path;
    use tempfile::TempDir;

    fn create_test_repo() -> (TempDir, Repository) {
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();

        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    fn create_initial_commit(repo: &Repository, temp_dir: &TempDir) -> git2::Oid {
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "initial content").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("initial.txt")).unwrap();
        index.write().unwrap();

        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
            .unwrap()
    }

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
        let state = AppState {
            repository: Mutex::new(None),
        };

        let repo_lock = state.repository.lock();
        let result: Result<&Repository, AppError> =
            repo_lock.as_ref().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }
}
