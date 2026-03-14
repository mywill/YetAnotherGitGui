use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn get_file_statuses(state: State<AppState>) -> Result<git::FileStatuses, AppError> {
    let repo = state.get_repo()?;

    git::get_file_statuses(&repo)
}

#[tauri::command]
pub fn stage_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::stage_file(&repo, &path)
}

#[tauri::command]
pub fn unstage_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::unstage_file(&repo, &path)
}

#[tauri::command]
pub fn stage_hunk(path: String, hunk_index: usize, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::stage_hunk(&repo, &path, hunk_index)
}

#[tauri::command]
pub fn unstage_hunk(
    path: String,
    hunk_index: usize,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::unstage_hunk(&repo, &path, hunk_index)
}

#[tauri::command]
pub fn stage_lines(
    path: String,
    hunk_index: usize,
    line_indices: Vec<usize>,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::stage_lines(&repo, &path, hunk_index, line_indices)
}

#[tauri::command]
pub fn discard_hunk(
    path: String,
    hunk_index: usize,
    line_indices: Option<Vec<usize>>,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::discard_hunk(&repo, &path, hunk_index, line_indices)
}

#[tauri::command]
pub fn revert_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    // Checkout the file from HEAD to discard changes
    let head = repo.head()?.peel_to_tree()?;
    repo.checkout_tree(
        head.as_object(),
        Some(git2::build::CheckoutBuilder::new().force().path(&path)),
    )?;
    Ok(())
}

#[tauri::command]
pub fn revert_commit(hash: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::revert_commit(&repo, &hash)
}

#[tauri::command]
pub fn revert_commit_file(
    hash: String,
    path: String,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::revert_commit_file(&repo, &hash, &path)
}

#[tauri::command]
pub fn revert_commit_file_lines(
    hash: String,
    path: String,
    hunk_index: usize,
    line_indices: Vec<usize>,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::revert_commit_file_lines(&repo, &hash, &path, hunk_index, line_indices)
}

#[tauri::command]
pub fn delete_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    let workdir = repo
        .workdir()
        .ok_or(AppError::InvalidPath("No working directory".to_string()))?;
    let file_path = workdir.join(&path);
    std::fs::remove_file(file_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use crate::test_utils::*;
    use git2::Repository;
    use parking_lot::Mutex;
    use std::fs;

    #[test]
    fn test_get_file_statuses_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create an untracked file
        let file_path = temp_dir.path().join("untracked.txt");
        fs::write(&file_path, "untracked").unwrap();

        let result = git::get_file_statuses(&repo);
        assert!(result.is_ok());

        let statuses = result.unwrap();
        assert_eq!(statuses.untracked.len(), 1);
    }

    #[test]
    fn test_stage_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create a new file
        let file_path = temp_dir.path().join("new.txt");
        fs::write(&file_path, "new content").unwrap();

        let result = git::stage_file(&repo, "new.txt");
        assert!(result.is_ok());

        // Verify it's staged
        let statuses = git::get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.iter().any(|s| s.path == "new.txt"));
    }

    #[test]
    fn test_unstage_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and stage a file
        let file_path = temp_dir.path().join("staged.txt");
        fs::write(&file_path, "staged").unwrap();

        git::stage_file(&repo, "staged.txt").unwrap();

        // Verify it's staged
        let statuses = git::get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.iter().any(|s| s.path == "staged.txt"));

        // Unstage it
        let result = git::unstage_file(&repo, "staged.txt");
        assert!(result.is_ok());

        // Verify it's unstaged
        let statuses = git::get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.is_empty());
    }

    #[test]
    fn test_revert_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Modify the file
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();

        // Verify it's modified
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "modified content");

        // Revert it
        let head = repo.head().unwrap().peel_to_tree().unwrap();
        repo.checkout_tree(
            head.as_object(),
            Some(
                git2::build::CheckoutBuilder::new()
                    .force()
                    .path("initial.txt"),
            ),
        )
        .unwrap();

        // Verify content is reverted
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "initial content");
    }

    #[test]
    fn test_delete_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create a file to delete
        let file_path = temp_dir.path().join("to_delete.txt");
        fs::write(&file_path, "delete me").unwrap();

        assert!(file_path.exists());

        // Delete it
        let workdir = repo.workdir().unwrap();
        let full_path = workdir.join("to_delete.txt");
        fs::remove_file(full_path).unwrap();

        assert!(!file_path.exists());
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
