//! Integration tests for stash operations.
//!
//! `parse_branch_from_stash_message` (private helper) has its unit test
//! inline in src/git/stash.rs::tests.

mod common;

use common::{create_commit_with_file, create_initial_commit, create_test_repo};
use git2::Repository;
use std::fs;
use tempfile::TempDir;
use yagg_lib::git::{
    apply_stash, drop_stash, get_stash_details, get_stash_file_diff, list_stashes,
};

fn create_stash(repo: &mut Repository, temp_dir: &TempDir) {
    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "modified content").unwrap();

    let sig = repo.signature().unwrap();
    repo.stash_save(&sig, "Test stash", None).unwrap();
}

// =============================================================================
// list_stashes (4 tests)
// =============================================================================

#[test]
fn list_stashes_empty_repo() {
    let (_temp_dir, mut repo) = create_test_repo();
    let stashes = list_stashes(&mut repo).unwrap();
    assert!(stashes.is_empty());
}

#[test]
fn list_stashes_no_stashes() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let stashes = list_stashes(&mut repo).unwrap();
    assert!(stashes.is_empty());
}

#[test]
fn list_stashes_with_stash() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified content").unwrap();

    let sig = repo.signature().unwrap();
    repo.stash_save(&sig, "Test stash", None).unwrap();

    let stashes = list_stashes(&mut repo).unwrap();
    assert_eq!(stashes.len(), 1);
    assert_eq!(stashes[0].index, 0);
    assert!(stashes[0].message.contains("Test stash"));
}

#[test]
fn list_stashes_multiple() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    let sig = repo.signature().unwrap();

    fs::write(&file_path, "modified 1").unwrap();
    repo.stash_save(&sig, "First stash", None).unwrap();

    fs::write(&file_path, "modified 2").unwrap();
    repo.stash_save(&sig, "Second stash", None).unwrap();

    let stashes = list_stashes(&mut repo).unwrap();
    assert_eq!(stashes.len(), 2);
    assert_eq!(stashes[0].index, 0);
    assert!(stashes[0].message.contains("Second stash"));
    assert_eq!(stashes[1].index, 1);
    assert!(stashes[1].message.contains("First stash"));
}

// =============================================================================
// get_stash_details (2 tests)
// =============================================================================

#[test]
fn get_stash_details_basic() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified content").unwrap();

    let sig = repo.signature().unwrap();
    repo.stash_save(&sig, "Test stash", None).unwrap();

    let details = get_stash_details(&mut repo, 0).unwrap();
    assert_eq!(details.index, 0);
    assert!(details.message.contains("Test stash"));
    assert!(!details.files_changed.is_empty());
    assert!(details.files_changed.iter().any(|f| f.path == "file.txt"));
}

#[test]
fn get_stash_details_not_found() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let result = get_stash_details(&mut repo, 0);
    assert!(result.is_err());
}

// =============================================================================
// apply / drop / file diff (3 tests)
// =============================================================================

#[test]
fn apply_stash_restores_changes() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified content").unwrap();

    let sig = repo.signature().unwrap();
    repo.stash_save(&sig, "Test stash", None).unwrap();

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "content");

    apply_stash(&mut repo, 0).unwrap();

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "modified content");
}

#[test]
fn drop_stash_removes_it() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified content").unwrap();

    let sig = repo.signature().unwrap();
    repo.stash_save(&sig, "Test stash", None).unwrap();

    let stashes = list_stashes(&mut repo).unwrap();
    assert_eq!(stashes.len(), 1);

    drop_stash(&mut repo, 0).unwrap();

    let stashes = list_stashes(&mut repo).unwrap();
    assert!(stashes.is_empty());
}

#[test]
fn get_stash_file_diff_basic() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(
        &repo,
        &temp_dir,
        "file.txt",
        "original\ncontent\n",
        "Initial commit",
    );

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified\ncontent\n").unwrap();

    let sig = repo.signature().unwrap();
    repo.stash_save(&sig, "Test stash", None).unwrap();

    let diff = get_stash_file_diff(&mut repo, 0, "file.txt").unwrap();
    assert_eq!(diff.path, "file.txt");
    assert!(!diff.is_binary);
    assert!(!diff.hunks.is_empty());
}

// =============================================================================
// commands/stash.rs integration tests
// =============================================================================

#[test]
fn commands_stash_list_logic() {
    let (temp_dir, mut repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    create_stash(&mut repo, &temp_dir);

    let result = list_stashes(&mut repo);
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 1);
}

#[test]
fn commands_stash_list_empty() {
    let (temp_dir, mut repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = list_stashes(&mut repo);
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}

#[test]
fn commands_stash_details_logic() {
    let (temp_dir, mut repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    create_stash(&mut repo, &temp_dir);

    let result = get_stash_details(&mut repo, 0);
    assert!(result.is_ok());
    assert_eq!(result.unwrap().index, 0);
}

#[test]
fn commands_stash_details_invalid_index() {
    let (temp_dir, mut repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = get_stash_details(&mut repo, 0);
    assert!(result.is_err());
}

#[test]
fn commands_stash_apply_logic() {
    let (temp_dir, mut repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    create_stash(&mut repo, &temp_dir);

    let result = apply_stash(&mut repo, 0);
    assert!(result.is_ok());

    let file_path = temp_dir.path().join("initial.txt");
    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "modified content");
}

#[test]
fn commands_stash_drop_logic() {
    let (temp_dir, mut repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    create_stash(&mut repo, &temp_dir);

    let stashes = list_stashes(&mut repo).unwrap();
    assert_eq!(stashes.len(), 1);

    let result = drop_stash(&mut repo, 0);
    assert!(result.is_ok());

    let stashes = list_stashes(&mut repo).unwrap();
    assert!(stashes.is_empty());
}

#[test]
fn commands_stash_file_diff_logic() {
    let (temp_dir, mut repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    create_stash(&mut repo, &temp_dir);

    let result = get_stash_file_diff(&mut repo, 0, "initial.txt");
    assert!(result.is_ok());
    assert_eq!(result.unwrap().path, "initial.txt");
}
