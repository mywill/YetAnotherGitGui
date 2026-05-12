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
    let repo = state.get_repo()?;

    git::get_repo_info(&repo)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use git2::Repository;

    #[test]
    fn test_get_current_dir() {
        let result = get_current_dir();
        assert!(result.is_ok());
        let cwd = result.unwrap();
        assert!(!cwd.is_empty());
    }

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

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
