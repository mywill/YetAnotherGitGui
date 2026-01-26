use std::path::PathBuf;
use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn get_current_dir() -> Result<String, AppError> {
    let cwd = std::env::current_dir().map_err(|e| AppError::InvalidPath(e.to_string()))?;

    // If cwd ends with src-tauri, use parent directory
    if cwd.ends_with("src-tauri") {
        if let Some(parent) = cwd.parent() {
            return Ok(parent.to_string_lossy().to_string());
        }
    }

    Ok(cwd.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_repository(
    path: String,
    state: State<AppState>,
) -> Result<git::RepositoryInfo, AppError> {
    let path = PathBuf::from(&path);
    let canonical_path = path
        .canonicalize()
        .map_err(|_| AppError::InvalidPath(path.display().to_string()))?;

    let repo = git::open_repo(&canonical_path)?;
    let info = git::get_repo_info(&repo)?;

    let mut repo_lock = state.repository.lock();
    *repo_lock = Some(repo);

    Ok(info)
}

#[tauri::command]
pub fn get_repository_info(state: State<AppState>) -> Result<git::RepositoryInfo, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    git::get_repo_info(repo)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use git2::Repository;
    use parking_lot::Mutex;
    use tempfile::TempDir;

    fn create_test_repo() -> (TempDir, Repository) {
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();

        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    #[test]
    fn test_get_current_dir() {
        let result = get_current_dir();
        assert!(result.is_ok());
        let cwd = result.unwrap();
        assert!(!cwd.is_empty());
    }

    #[test]
    fn test_open_repository_logic() {
        // Test the underlying git functions that open_repository uses
        let (temp_dir, _repo) = create_test_repo();

        let result = git::open_repo(temp_dir.path());
        assert!(result.is_ok());

        let repo = result.unwrap();
        let info = git::get_repo_info(&repo);
        assert!(info.is_ok());
    }

    #[test]
    fn test_open_repository_invalid_path() {
        let result = git::open_repo(std::path::Path::new("/nonexistent/path"));
        assert!(result.is_err());
    }

    #[test]
    fn test_get_repository_info_logic() {
        let (_temp_dir, repo) = create_test_repo();

        let result = git::get_repo_info(&repo);
        assert!(result.is_ok());
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
        match result {
            Err(AppError::NoRepository) => {}
            _ => panic!("Expected NoRepository error"),
        }
    }
}
