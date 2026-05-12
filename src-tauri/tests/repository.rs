//! Integration tests for repository open/info, branch/tag operations, and
//! repository-state detection.
//!
//! `test_map_repo_state_values` (private helper test) stays inline in
//! src/git/repository.rs::tests.

mod common;

use common::create_test_repo;
use git2::Repository;
use std::path::Path;
use tempfile::TempDir;
use yagg_lib::git::{self, get_repo_info, open_repo};

// Local helper — git/repository.rs's tests had this inline because they
// don't need `create_initial_commit` from common (which writes a file
// first). This version uses the empty index.
fn create_initial_commit(repo: &Repository) -> git2::Oid {
    let sig = repo.signature().unwrap();
    let tree_id = repo.index().unwrap().write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();

    repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
        .unwrap()
}

// =============================================================================
// open_repo (3 tests)
// =============================================================================

#[test]
fn open_repo_success() {
    let (temp_dir, _repo) = create_test_repo();
    let result = open_repo(temp_dir.path());
    assert!(result.is_ok());
}

#[test]
fn open_repo_invalid_path() {
    let result = open_repo(Path::new("/nonexistent/path"));
    assert!(result.is_err());
}

#[test]
fn open_repo_not_a_repo() {
    let temp_dir = TempDir::new().unwrap();
    let result = open_repo(temp_dir.path());
    assert!(result.is_err());
}

// =============================================================================
// get_repo_info (5 tests)
// =============================================================================

#[test]
fn get_repo_info_new_repo() {
    let (temp_dir, repo) = create_test_repo();
    let info = get_repo_info(&repo).unwrap();

    assert!(info.path.contains(temp_dir.path().to_str().unwrap()));
    assert!(info.current_branch.is_none());
    assert!(!info.is_detached);
    assert!(info.remotes.is_empty());
    assert!(info.head_hash.is_none());
    assert_eq!(info.repo_state, "clean");
}

#[test]
fn get_repo_info_with_commit() {
    let (_temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo);

    let info = get_repo_info(&repo).unwrap();
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
fn get_repo_info_detached_head() {
    let (_temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo);

    repo.set_head_detached(oid).unwrap();

    let info = get_repo_info(&repo).unwrap();
    assert!(info.is_detached);
    assert!(info.current_branch.is_none());
    assert_eq!(info.head_hash, Some(oid.to_string()));
}

#[test]
fn get_repo_info_with_remote() {
    let (_temp_dir, repo) = create_test_repo();
    repo.remote("origin", "https://github.com/test/repo.git")
        .unwrap();

    let info = get_repo_info(&repo).unwrap();
    assert_eq!(info.remotes, vec!["origin".to_string()]);
}

#[test]
fn get_repo_info_multiple_remotes() {
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

// =============================================================================
// branch/tag deletion (4 tests)
// =============================================================================

#[test]
fn delete_local_branch() {
    let (_temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo);

    let head = repo.head().unwrap();
    let commit = head.peel_to_commit().unwrap();
    repo.branch("feature-branch", &commit, false).unwrap();

    assert!(repo
        .find_branch("feature-branch", git2::BranchType::Local)
        .is_ok());

    let mut branch = repo
        .find_branch("feature-branch", git2::BranchType::Local)
        .unwrap();
    branch.delete().unwrap();

    assert!(repo
        .find_branch("feature-branch", git2::BranchType::Local)
        .is_err());
}

#[test]
fn delete_local_branch_nonexistent() {
    let (_temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo);

    let result = repo.find_branch("nonexistent-branch", git2::BranchType::Local);
    assert!(result.is_err());
}

#[test]
fn delete_tag() {
    let (_temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo);
    let commit = repo.find_commit(oid).unwrap();

    repo.tag_lightweight("v1.0.0", commit.as_object(), false)
        .unwrap();

    let mut tag_exists = false;
    repo.tag_foreach(|_oid, name| {
        if String::from_utf8_lossy(name).contains("v1.0.0") {
            tag_exists = true;
        }
        true
    })
    .unwrap();
    assert!(tag_exists);

    repo.tag_delete("v1.0.0").unwrap();

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
fn delete_tag_nonexistent() {
    let (_temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo);

    let result = repo.tag_delete("nonexistent-tag");
    assert!(result.is_err());
}

// =============================================================================
// repo state (2 tests)
// =============================================================================

#[test]
fn repo_state_clean() {
    let (_temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo);

    let info = get_repo_info(&repo).unwrap();
    assert_eq!(info.repo_state, "clean");
}

#[test]
fn repo_state_merge() {
    let (temp_dir, repo) = create_test_repo();
    let initial_oid = create_initial_commit(&repo);
    let initial_commit = repo.find_commit(initial_oid).unwrap();

    let branch = repo.branch("feature", &initial_commit, false).unwrap();
    let branch_ref = branch.into_reference();
    repo.set_head(branch_ref.name().unwrap()).unwrap();
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .unwrap();

    std::fs::write(temp_dir.path().join("conflict.txt"), "feature content").unwrap();
    let mut index = repo.index().unwrap();
    index
        .add_path(std::path::Path::new("conflict.txt"))
        .unwrap();
    index.write().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let sig = repo.signature().unwrap();
    let feature_oid = repo
        .commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Feature commit",
            &tree,
            &[&initial_commit],
        )
        .unwrap();

    let default_branch = if repo.find_branch("master", git2::BranchType::Local).is_ok() {
        "refs/heads/master"
    } else {
        "refs/heads/main"
    };
    repo.set_head(default_branch).unwrap();
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .unwrap();

    std::fs::write(temp_dir.path().join("conflict.txt"), "main content").unwrap();
    let mut index = repo.index().unwrap();
    index
        .add_path(std::path::Path::new("conflict.txt"))
        .unwrap();
    index.write().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let head_commit = repo
        .find_commit(repo.head().unwrap().target().unwrap())
        .unwrap();
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "Main commit",
        &tree,
        &[&head_commit],
    )
    .unwrap();

    let feature_commit = repo.find_commit(feature_oid).unwrap();
    let annotated = repo.find_annotated_commit(feature_commit.id()).unwrap();
    let _ = repo.merge(&[&annotated], None, None);

    let info = get_repo_info(&repo).unwrap();
    assert_eq!(info.repo_state, "merge");
}

// =============================================================================
// commands/repository.rs integration tests
// =============================================================================

#[test]
fn commands_repository_get_current_dir() {
    // The actual `get_current_dir` command is a Tauri wrapper around
    // std::env::current_dir(); call the std fn directly to validate the
    // same behavior without the Tauri runtime.
    let cwd = std::env::current_dir().unwrap();
    assert!(!cwd.as_os_str().is_empty());
}

#[test]
fn commands_repository_open_repository_logic() {
    let (temp_dir, _repo) = create_test_repo();

    let result = git::open_repo(temp_dir.path());
    assert!(result.is_ok());

    let repo = result.unwrap();
    let info = git::get_repo_info(&repo);
    assert!(info.is_ok());
}

#[test]
fn commands_repository_open_repository_invalid_path() {
    let result = git::open_repo(std::path::Path::new("/nonexistent/path"));
    assert!(result.is_err());
}

#[test]
fn commands_repository_get_repository_info_logic() {
    let (_temp_dir, repo) = create_test_repo();

    let result = git::get_repo_info(&repo);
    assert!(result.is_ok());
}
