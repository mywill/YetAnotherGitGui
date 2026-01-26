use git2::Signature;
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn create_commit(message: String, state: State<AppState>) -> Result<String, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    // Get the signature from git config
    let signature = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("Unknown", "unknown@example.com").unwrap());

    // Get the index and write it as a tree
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    // Get the parent commit (HEAD)
    let parent = if let Ok(head) = repo.head() {
        Some(head.peel_to_commit()?)
    } else {
        None
    };

    let parents: Vec<&git2::Commit> = parent.iter().collect();

    // Create the commit
    let commit_oid = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &parents,
    )?;

    Ok(commit_oid.to_string())
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

    #[test]
    fn test_create_commit_logic() {
        let (temp_dir, repo) = create_test_repo();

        // Create and stage a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "content").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        // Create commit
        let signature = repo.signature().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();

        let commit_oid = repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Test commit",
                &tree,
                &[],
            )
            .unwrap();

        assert!(!commit_oid.to_string().is_empty());
    }

    #[test]
    fn test_create_commit_with_parent() {
        let (temp_dir, repo) = create_test_repo();

        // First commit
        let file_path = temp_dir.path().join("file1.txt");
        fs::write(&file_path, "content1").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file1.txt")).unwrap();
        index.write().unwrap();

        let signature = repo.signature().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();

        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "First commit",
            &tree,
            &[],
        )
        .unwrap();

        // Second commit with parent
        let file_path2 = temp_dir.path().join("file2.txt");
        fs::write(&file_path2, "content2").unwrap();

        index.add_path(Path::new("file2.txt")).unwrap();
        index.write().unwrap();

        let tree_oid2 = index.write_tree().unwrap();
        let tree2 = repo.find_tree(tree_oid2).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();

        let commit_oid = repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                "Second commit",
                &tree2,
                &[&parent],
            )
            .unwrap();

        // Verify the commit has a parent
        let commit = repo.find_commit(commit_oid).unwrap();
        assert_eq!(commit.parent_count(), 1);
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
