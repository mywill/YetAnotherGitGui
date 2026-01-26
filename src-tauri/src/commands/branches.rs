use git2::{BranchType, Oid};
use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_remote: bool,
    pub is_head: bool,
    pub target_hash: String,
}

#[derive(Debug, Serialize)]
pub struct TagInfo {
    pub name: String,
    pub target_hash: String,
    pub is_annotated: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub fn list_branches(state: State<AppState>) -> Result<Vec<BranchInfo>, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    let head = repo.head().ok();
    let head_name = head.as_ref().and_then(|h| h.shorthand().map(String::from));

    let mut branches = Vec::new();

    for branch_result in repo.branches(None)? {
        let (branch, branch_type) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_remote = matches!(branch_type, git2::BranchType::Remote);
        let is_head = head_name.as_ref() == Some(&name) && !is_remote;

        // Get the target commit hash
        let target_hash = branch
            .get()
            .peel_to_commit()
            .map(|c| c.id().to_string())
            .unwrap_or_default();

        branches.push(BranchInfo {
            name,
            is_remote,
            is_head,
            target_hash,
        });
    }

    Ok(branches)
}

#[tauri::command]
pub fn checkout_commit(hash: String, state: State<AppState>) -> Result<(), AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    let oid = Oid::from_str(&hash)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    // Checkout the tree
    repo.checkout_tree(tree.as_object(), None)?;

    // Set HEAD to detached state pointing to this commit
    repo.set_head_detached(oid)?;

    Ok(())
}

#[tauri::command]
pub fn list_tags(state: State<AppState>) -> Result<Vec<TagInfo>, AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    let mut tags = Vec::new();

    repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .trim_start_matches("refs/tags/")
            .to_string();

        // Try to get the tag object (for annotated tags) or commit directly
        if let Ok(obj) = repo.find_object(oid, None) {
            let (target_hash, is_annotated, message) = if let Some(tag) = obj.as_tag() {
                // Annotated tag
                let target = tag.target_id().to_string();
                let msg = tag.message().map(|s: &str| s.to_string());
                (target, true, msg)
            } else {
                // Lightweight tag pointing directly to commit
                (oid.to_string(), false, None)
            };

            tags.push(TagInfo {
                name,
                target_hash,
                is_annotated,
                message,
            });
        }

        true
    })?;

    // Sort tags alphabetically
    tags.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(tags)
}

#[tauri::command]
pub fn checkout_branch(branch_name: String, state: State<AppState>) -> Result<(), AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    // Find the branch
    let branch = repo.find_branch(&branch_name, BranchType::Local)?;
    let reference = branch.get();
    let commit = reference.peel_to_commit()?;
    let tree = commit.tree()?;

    // Checkout the tree
    repo.checkout_tree(tree.as_object(), None)?;

    // Set HEAD to point to the branch
    let refname = reference
        .name()
        .ok_or_else(|| AppError::Git(git2::Error::from_str("Invalid branch reference name")))?;
    repo.set_head(refname)?;

    Ok(())
}

#[tauri::command]
pub fn delete_branch(
    branch_name: String,
    is_remote: bool,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    if is_remote {
        // For remote branches, we need to delete the remote tracking reference
        // The branch_name is expected to be in format "origin/branch-name"
        let refname = format!("refs/remotes/{}", branch_name);
        let mut reference = repo.find_reference(&refname)?;
        reference.delete()?;
    } else {
        // Check if this is the current branch (HEAD)
        if let Ok(head) = repo.head() {
            if head.is_branch() {
                if let Some(head_name) = head.shorthand() {
                    if head_name == branch_name {
                        return Err(AppError::Git(git2::Error::from_str(
                            "Cannot delete the currently checked out branch",
                        )));
                    }
                }
            }
        }

        // Find and delete the local branch
        let mut branch = repo.find_branch(&branch_name, BranchType::Local)?;
        branch.delete()?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_tag(tag_name: String, state: State<AppState>) -> Result<(), AppError> {
    let repo_lock = state.repository.lock();
    let repo = repo_lock.as_ref().ok_or(AppError::NoRepository)?;

    // Delete the tag
    repo.tag_delete(&tag_name)?;

    Ok(())
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
    fn test_list_branches_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Test the underlying branch listing logic
        let head = repo.head().ok();
        let head_name = head.as_ref().and_then(|h| h.shorthand().map(String::from));
        assert!(head_name.is_some());

        let mut branches = Vec::new();
        for branch_result in repo.branches(None).unwrap() {
            let (branch, branch_type) = branch_result.unwrap();
            let name = branch.name().unwrap().unwrap_or("").to_string();
            let is_remote = matches!(branch_type, git2::BranchType::Remote);
            branches.push((name, is_remote));
        }

        assert!(!branches.is_empty());
    }

    #[test]
    fn test_checkout_branch_logic() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo, &temp_dir);
        let commit = repo.find_commit(oid).unwrap();

        // Create a new branch
        repo.branch("test-branch", &commit, false).unwrap();

        // Checkout the branch
        let branch = repo.find_branch("test-branch", BranchType::Local).unwrap();
        let reference = branch.get();
        let commit = reference.peel_to_commit().unwrap();
        let tree = commit.tree().unwrap();

        repo.checkout_tree(tree.as_object(), None).unwrap();
        let refname = reference.name().unwrap();
        repo.set_head(refname).unwrap();

        // Verify we're on the new branch
        let head = repo.head().unwrap();
        assert_eq!(head.shorthand(), Some("test-branch"));
    }

    #[test]
    fn test_checkout_branch_nonexistent() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let result = repo.find_branch("nonexistent-branch", BranchType::Local);
        assert!(result.is_err());
    }

    #[test]
    fn test_checkout_commit_logic() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo, &temp_dir);

        let commit = repo.find_commit(oid).unwrap();
        let tree = commit.tree().unwrap();

        repo.checkout_tree(tree.as_object(), None).unwrap();
        repo.set_head_detached(oid).unwrap();

        // Verify we're in detached HEAD state
        let head = repo.head().unwrap();
        assert!(!head.is_branch());
    }

    #[test]
    fn test_checkout_commit_invalid_hash() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let result = Oid::from_str("invalid");
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_branch_logic() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo, &temp_dir);
        let commit = repo.find_commit(oid).unwrap();

        // Create a new branch
        repo.branch("branch-to-delete", &commit, false).unwrap();

        // Verify branch exists
        assert!(repo
            .find_branch("branch-to-delete", BranchType::Local)
            .is_ok());

        // Delete the branch
        let mut branch = repo
            .find_branch("branch-to-delete", BranchType::Local)
            .unwrap();
        branch.delete().unwrap();

        // Verify branch is gone
        assert!(repo
            .find_branch("branch-to-delete", BranchType::Local)
            .is_err());
    }

    #[test]
    fn test_delete_branch_current_branch_check() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Get current branch name
        let head = repo.head().unwrap();
        assert!(head.is_branch());

        let current_branch = head.shorthand().unwrap();
        // Current branch should be main or master
        assert!(current_branch == "main" || current_branch == "master");
    }

    #[test]
    fn test_list_tags_logic() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo, &temp_dir);
        let commit = repo.find_commit(oid).unwrap();

        // Create a tag
        repo.tag_lightweight("v1.0.0", commit.as_object(), false)
            .unwrap();

        // Verify tag exists
        let mut tags = Vec::new();
        repo.tag_foreach(|_oid, name| {
            let name = String::from_utf8_lossy(name)
                .trim_start_matches("refs/tags/")
                .to_string();
            tags.push(name);
            true
        })
        .unwrap();

        assert!(tags.iter().any(|t| t == "v1.0.0"));
    }

    #[test]
    fn test_delete_tag_logic() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_initial_commit(&repo, &temp_dir);
        let commit = repo.find_commit(oid).unwrap();

        // Create a tag
        repo.tag_lightweight("v1.0.0", commit.as_object(), false)
            .unwrap();

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
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let result = repo.tag_delete("nonexistent-tag");
        assert!(result.is_err());
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
