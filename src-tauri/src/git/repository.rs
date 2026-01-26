use git2::Repository;
use serde::Serialize;
use std::path::Path;

use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct RepositoryInfo {
    pub path: String,
    pub current_branch: Option<String>,
    pub is_detached: bool,
    pub remotes: Vec<String>,
    pub head_hash: Option<String>,
}

pub fn open_repo(path: &Path) -> Result<Repository, AppError> {
    let repo = Repository::open(path)?;
    Ok(repo)
}

pub fn get_repo_info(repo: &Repository) -> Result<RepositoryInfo, AppError> {
    let path = repo
        .workdir()
        .unwrap_or_else(|| repo.path())
        .to_string_lossy()
        .to_string();

    let head = repo.head();
    let (current_branch, is_detached, head_hash) = match head {
        Ok(reference) => {
            let hash = reference.peel_to_commit().ok().map(|c| c.id().to_string());
            if reference.is_branch() {
                (reference.shorthand().map(String::from), false, hash)
            } else {
                (None, true, hash)
            }
        }
        Err(_) => (None, false, None),
    };

    let remotes = repo
        .remotes()?
        .iter()
        .filter_map(|r| r.map(String::from))
        .collect();

    Ok(RepositoryInfo {
        path,
        current_branch,
        is_detached,
        remotes,
        head_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_repo() -> (TempDir, Repository) {
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();

        // Configure user for commits
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    fn create_initial_commit(repo: &Repository) -> git2::Oid {
        let sig = repo.signature().unwrap();
        let tree_id = repo.index().unwrap().write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
            .unwrap()
    }

    #[test]
    fn test_open_repo_success() {
        let (temp_dir, _repo) = create_test_repo();

        let result = open_repo(temp_dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_open_repo_invalid_path() {
        let result = open_repo(Path::new("/nonexistent/path"));
        assert!(result.is_err());
    }

    #[test]
    fn test_open_repo_not_a_repo() {
        let temp_dir = TempDir::new().unwrap();
        // Don't init as repo

        let result = open_repo(temp_dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_get_repo_info_new_repo() {
        let (temp_dir, repo) = create_test_repo();

        let info = get_repo_info(&repo).unwrap();

        assert!(info.path.contains(temp_dir.path().to_str().unwrap()));
        assert!(info.current_branch.is_none()); // No commits yet
        assert!(!info.is_detached);
        assert!(info.remotes.is_empty());
        assert!(info.head_hash.is_none());
    }

    #[test]
    fn test_get_repo_info_with_commit() {
        let (_temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo);

        let info = get_repo_info(&repo).unwrap();

        // Default branch name varies by git version/config (master or main)
        assert!(
            info.current_branch == Some("master".to_string())
                || info.current_branch == Some("main".to_string()),
            "Expected branch to be 'master' or 'main', got {:?}",
            info.current_branch
        );
        assert!(!info.is_detached);
        assert_eq!(info.head_hash, Some(oid.to_string()));
    }

    #[test]
    fn test_get_repo_info_detached_head() {
        let (_temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo);

        // Detach HEAD
        repo.set_head_detached(oid).unwrap();

        let info = get_repo_info(&repo).unwrap();

        assert!(info.is_detached);
        assert!(info.current_branch.is_none());
        assert_eq!(info.head_hash, Some(oid.to_string()));
    }

    #[test]
    fn test_get_repo_info_with_remote() {
        let (_temp_dir, repo) = create_test_repo();

        // Add a remote
        repo.remote("origin", "https://github.com/test/repo.git")
            .unwrap();

        let info = get_repo_info(&repo).unwrap();

        assert_eq!(info.remotes, vec!["origin".to_string()]);
    }

    #[test]
    fn test_get_repo_info_multiple_remotes() {
        let (_temp_dir, repo) = create_test_repo();

        repo.remote("origin", "https://github.com/test/repo.git")
            .unwrap();
        repo.remote("upstream", "https://github.com/upstream/repo.git")
            .unwrap();

        let info = get_repo_info(&repo).unwrap();

        assert_eq!(info.remotes.len(), 2);
        assert!(info.remotes.contains(&"origin".to_string()));
        assert!(info.remotes.contains(&"upstream".to_string()));
    }

    #[test]
    fn test_delete_local_branch() {
        let (_temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo);

        // Create a new branch
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        repo.branch("feature-branch", &commit, false).unwrap();

        // Verify branch exists
        assert!(repo
            .find_branch("feature-branch", git2::BranchType::Local)
            .is_ok());

        // Delete the branch
        let mut branch = repo
            .find_branch("feature-branch", git2::BranchType::Local)
            .unwrap();
        branch.delete().unwrap();

        // Verify branch is gone
        assert!(repo
            .find_branch("feature-branch", git2::BranchType::Local)
            .is_err());
    }

    #[test]
    fn test_delete_local_branch_nonexistent() {
        let (_temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo);

        // Try to find and delete a nonexistent branch
        let result = repo.find_branch("nonexistent-branch", git2::BranchType::Local);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_tag() {
        let (_temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo);
        let commit = repo.find_commit(oid).unwrap();

        // Create a lightweight tag
        repo.tag_lightweight("v1.0.0", commit.as_object(), false)
            .unwrap();

        // Verify tag exists
        let mut tag_exists = false;
        repo.tag_foreach(|_oid, name| {
            if String::from_utf8_lossy(name).contains("v1.0.0") {
                tag_exists = true;
            }
            true
        })
        .unwrap();
        assert!(tag_exists);

        // Delete the tag
        repo.tag_delete("v1.0.0").unwrap();

        // Verify tag is gone
        let mut tag_exists = false;
        repo.tag_foreach(|_oid, name| {
            if String::from_utf8_lossy(name).contains("v1.0.0") {
                tag_exists = true;
            }
            true
        })
        .unwrap();
        assert!(!tag_exists);
    }

    #[test]
    fn test_delete_tag_nonexistent() {
        let (_temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo);

        // Try to delete a nonexistent tag
        let result = repo.tag_delete("nonexistent-tag");
        assert!(result.is_err());
    }
}
