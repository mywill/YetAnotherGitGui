use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn list_stashes(state: State<AppState>) -> Result<Vec<git::StashInfo>, AppError> {
    let mut repo = state.get_repo_mut()?;

    git::list_stashes(&mut repo)
}

#[tauri::command]
pub fn get_stash_details(
    index: usize,
    state: State<AppState>,
) -> Result<git::StashDetails, AppError> {
    let mut repo = state.get_repo_mut()?;

    git::get_stash_details(&mut repo, index)
}

#[tauri::command]
pub fn apply_stash(index: usize, state: State<AppState>) -> Result<(), AppError> {
    let mut repo = state.get_repo_mut()?;

    git::apply_stash(&mut repo, index)
}

#[tauri::command]
pub fn drop_stash(index: usize, state: State<AppState>) -> Result<(), AppError> {
    let mut repo = state.get_repo_mut()?;

    git::drop_stash(&mut repo, index)
}

#[tauri::command]
pub fn get_stash_file_diff(
    index: usize,
    file_path: String,
    state: State<AppState>,
) -> Result<git::FileDiff, AppError> {
    let mut repo = state.get_repo_mut()?;

    git::get_stash_file_diff(&mut repo, index, &file_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use crate::test_utils::*;
    use git2::Repository;

    use std::fs;
    use tempfile::TempDir;

    fn create_stash(repo: &mut Repository, temp_dir: &TempDir) {
        // Modify a file
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();

        // Stash changes
        let sig = repo.signature().unwrap();
        repo.stash_save(&sig, "Test stash", None).unwrap();
    }

    #[test]
    fn test_list_stashes_logic() {
        let (temp_dir, mut repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        create_stash(&mut repo, &temp_dir);

        let result = git::list_stashes(&mut repo);
        assert!(result.is_ok());

        let stashes = result.unwrap();
        assert_eq!(stashes.len(), 1);
    }

    #[test]
    fn test_list_stashes_empty() {
        let (temp_dir, mut repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let result = git::list_stashes(&mut repo);
        assert!(result.is_ok());

        let stashes = result.unwrap();
        assert!(stashes.is_empty());
    }

    #[test]
    fn test_get_stash_details_logic() {
        let (temp_dir, mut repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        create_stash(&mut repo, &temp_dir);

        let result = git::get_stash_details(&mut repo, 0);
        assert!(result.is_ok());

        let details = result.unwrap();
        assert_eq!(details.index, 0);
    }

    #[test]
    fn test_get_stash_details_invalid_index() {
        let (temp_dir, mut repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let result = git::get_stash_details(&mut repo, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_stash_logic() {
        let (temp_dir, mut repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        create_stash(&mut repo, &temp_dir);

        let result = git::apply_stash(&mut repo, 0);
        assert!(result.is_ok());

        // Verify file has modified content
        let file_path = temp_dir.path().join("initial.txt");
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "modified content");
    }

    #[test]
    fn test_drop_stash_logic() {
        let (temp_dir, mut repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        create_stash(&mut repo, &temp_dir);

        // Verify stash exists
        let stashes = git::list_stashes(&mut repo).unwrap();
        assert_eq!(stashes.len(), 1);

        // Drop stash
        let result = git::drop_stash(&mut repo, 0);
        assert!(result.is_ok());

        // Verify stash is gone
        let stashes = git::list_stashes(&mut repo).unwrap();
        assert!(stashes.is_empty());
    }

    #[test]
    fn test_get_stash_file_diff_logic() {
        let (temp_dir, mut repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        create_stash(&mut repo, &temp_dir);

        let result = git::get_stash_file_diff(&mut repo, 0, "initial.txt");
        assert!(result.is_ok());

        let diff = result.unwrap();
        assert_eq!(diff.path, "initial.txt");
    }

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

        let mut repo_lock = state.repository.lock();
        let result: Result<&mut Repository, AppError> =
            repo_lock.as_mut().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }
}
