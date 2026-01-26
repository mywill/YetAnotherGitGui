use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub fn get_commit_graph(
    skip: usize,
    limit: usize,
    state: State<AppState>,
) -> Result<Vec<git::GraphCommit>, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    let commits = git::get_commits(repo, skip, limit)?;
    let refs = git::collect_refs(repo)?;
    let graph = git::build_commit_graph(commits, refs);

    Ok(graph)
}

#[tauri::command]
pub fn get_commit_details(
    hash: String,
    state: State<AppState>,
) -> Result<git::CommitDetails, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    git::get_commit_details(repo, &hash)
}

#[tauri::command]
pub fn get_commit_file_diff(
    hash: String,
    file_path: String,
    state: State<AppState>,
) -> Result<git::FileDiff, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    git::get_commit_file_diff(repo, &hash, &file_path)
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
    fn test_get_commit_graph_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let commits = git::get_commits(&repo, 0, 10).unwrap();
        let refs = git::collect_refs(&repo).unwrap();
        let graph = git::build_commit_graph(commits, refs);

        assert!(!graph.is_empty());
    }

    #[test]
    fn test_get_commit_details_logic() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo, &temp_dir);

        let result = git::get_commit_details(&repo, &oid.to_string());
        assert!(result.is_ok());

        let details = result.unwrap();
        assert_eq!(details.hash, oid.to_string());
    }

    #[test]
    fn test_get_commit_details_invalid_hash() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let result = git::get_commit_details(&repo, "invalid");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_commit_file_diff_logic() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo, &temp_dir);

        let result = git::get_commit_file_diff(&repo, &oid.to_string(), "initial.txt");
        assert!(result.is_ok());

        let diff = result.unwrap();
        assert_eq!(diff.path, "initial.txt");
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
