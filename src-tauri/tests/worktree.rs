//! Integration tests for the worktree feature.
//!
//! These exercise `yagg_lib::git::worktree` functions directly (they take
//! `&Repository`, so no Tauri State is needed).

mod common;

use common::{create_initial_commit, create_test_repo};
use tempfile::TempDir;
use yagg_lib::git::{
    add_worktree, list_worktrees, lock_worktree, move_worktree, remove_worktree, unlock_worktree,
};

#[test]
fn list_worktrees_includes_main_only_when_none_linked() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wts = list_worktrees(&repo).unwrap();
    assert_eq!(wts.len(), 1);
    assert!(wts[0].is_main);
    assert_eq!(wts[0].name, "main");
    assert!(!wts[0].is_locked);
    assert!(!wts[0].is_prunable);
    assert!(wts[0].is_valid);
}

#[test]
fn add_worktree_detached_at_head() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-detached");

    let info = add_worktree(&repo, "wt-detached", &wt_path, None, None, None).unwrap();

    assert_eq!(info.name, "wt-detached");
    assert!(wt_path.exists());
    assert!(!info.is_main);
    assert!(info.is_valid);
    assert!(wt_path.join(".git").exists());

    let wts = list_worktrees(&repo).unwrap();
    assert_eq!(wts.len(), 2);
    assert!(wts.iter().any(|w| w.name == "wt-detached"));
}

#[test]
fn add_worktree_with_new_branch() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-newbranch");

    let info = add_worktree(
        &repo,
        "wt-newbranch",
        &wt_path,
        None,
        Some("feature-x"),
        None,
    )
    .unwrap();

    assert_eq!(info.branch.as_deref(), Some("feature-x"));
    // The branch ref now exists in the shared ref store.
    assert!(repo
        .find_branch("feature-x", git2::BranchType::Local)
        .is_ok());
}

#[test]
fn add_worktree_with_existing_branch() {
    let (_td, repo) = create_test_repo();
    let head_oid = create_initial_commit(&repo, &_td);

    // Create a branch at HEAD in the main repo, then check it out in a worktree.
    let head_commit = repo.find_commit(head_oid).unwrap();
    repo.branch("existing", &head_commit, false).unwrap();

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-existing");

    let info = add_worktree(&repo, "wt-existing", &wt_path, Some("existing"), None, None).unwrap();

    assert_eq!(info.branch.as_deref(), Some("existing"));
}

#[test]
fn add_worktree_detached_at_specific_commit() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);
    let second = common::create_commit_with_file(&repo, &_td, "second.txt", "x", "second");
    let second_str = second.to_string();

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-commit");

    let info = add_worktree(&repo, "wt-commit", &wt_path, None, None, Some(&second_str)).unwrap();

    assert_eq!(info.head_hash.as_deref(), Some(second_str.as_str()));
    assert!(info.branch.is_none());
}

#[test]
fn remove_worktree_refuses_valid_without_force() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-rm");

    add_worktree(&repo, "wt-rm", &wt_path, None, None, None).unwrap();

    let err = remove_worktree(&repo, "wt-rm", false).unwrap_err();
    assert!(
        err.to_string().contains("still valid"),
        "expected still-valid error, got: {err}"
    );
    // Worktree still listed.
    let wts = list_worktrees(&repo).unwrap();
    assert!(wts.iter().any(|w| w.name == "wt-rm"));
}

#[test]
fn remove_worktree_force_deletes() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-rmforce");

    add_worktree(&repo, "wt-rmforce", &wt_path, None, None, None).unwrap();

    remove_worktree(&repo, "wt-rmforce", true).unwrap();

    let wts = list_worktrees(&repo).unwrap();
    assert!(!wts.iter().any(|w| w.name == "wt-rmforce"));
    assert!(!wt_path.exists());
}

#[test]
fn lock_and_unlock_worktree() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-lock");

    add_worktree(&repo, "wt-lock", &wt_path, None, None, None).unwrap();

    lock_worktree(&repo, "wt-lock", Some("testing")).unwrap();
    let wts = list_worktrees(&repo).unwrap();
    let row = wts.iter().find(|w| w.name == "wt-lock").unwrap();
    assert!(row.is_locked);
    assert_eq!(row.lock_reason.as_deref(), Some("testing"));

    unlock_worktree(&repo, "wt-lock").unwrap();
    let wts = list_worktrees(&repo).unwrap();
    let row = wts.iter().find(|w| w.name == "wt-lock").unwrap();
    assert!(!row.is_locked);
}

#[test]
fn move_worktree_relocates_directory() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wtdir = TempDir::new().unwrap();
    let old_path = wtdir.path().join("wt-move-old");
    let new_path = wtdir.path().join("wt-move-new");

    add_worktree(&repo, "wt-move", &old_path, None, None, None).unwrap();
    assert!(old_path.exists());

    move_worktree(&repo, "wt-move", &new_path).unwrap();

    assert!(!old_path.exists());
    assert!(new_path.exists());

    // Worktree should still be listed and valid after the move.
    let wts = list_worktrees(&repo).unwrap();
    let row = wts.iter().find(|w| w.name == "wt-move").unwrap();
    assert!(row.is_valid);
    assert_eq!(
        std::path::Path::new(&row.path).canonicalize().unwrap(),
        new_path.canonicalize().unwrap()
    );
}

#[test]
fn dirty_count_reflects_workdir_changes() {
    let (_td, repo) = create_test_repo();
    create_initial_commit(&repo, &_td);

    let wtdir = TempDir::new().unwrap();
    let wt_path = wtdir.path().join("wt-dirty");

    let info = add_worktree(&repo, "wt-dirty", &wt_path, None, None, None).unwrap();
    assert_eq!(info.dirty_count, 0);

    // Create an untracked file in the worktree directory.
    std::fs::write(wt_path.join("new.txt"), "content").unwrap();

    let wts = list_worktrees(&repo).unwrap();
    let row = wts.iter().find(|w| w.name == "wt-dirty").unwrap();
    assert_eq!(row.dirty_count, 1);
}
