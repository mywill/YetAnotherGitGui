//! Integration tests for the abort / continue operations on real
//! in-progress rebase, cherry-pick, and revert states. Each setup helper
//! builds a small commit history in a tempdir and uses libgit2's high-level
//! cherrypick/revert/rebase to produce the actual on-disk state files
//! (CHERRY_PICK_HEAD, REVERT_HEAD, .git/rebase-merge/, etc.) — so the tests
//! exercise the same code paths the app sees in production.

mod common;

use common::create_test_repo;
use git2::{build::CheckoutBuilder, Oid, Repository, RepositoryState, ResetType};
use std::fs;
use std::path::Path;
use tempfile::TempDir;
use yagg_lib::error::AppError;
use yagg_lib::git::operations::{abort_operation, continue_operation};

fn write_and_commit(
    repo: &Repository,
    temp_dir: &TempDir,
    filename: &str,
    content: &str,
    message: &str,
) -> Oid {
    let file_path = temp_dir.path().join(filename);
    fs::write(&file_path, content).unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new(filename)).unwrap();
    index.write().unwrap();
    let sig = repo.signature().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .unwrap()
}

/// History: base → A (ver-a)  ─┐
///                  └→ B (ver-b)  [HEAD]
/// Cherry-pick A onto B → conflict on file.txt.
fn setup_cherry_pick_conflict(temp_dir: &TempDir, repo: &Repository) -> Oid {
    let base_oid = write_and_commit(repo, temp_dir, "file.txt", "base\n", "base");
    let base = repo.find_commit(base_oid).unwrap();
    let a_oid = write_and_commit(repo, temp_dir, "file.txt", "ver-a\n", "A");
    repo.reset(base.as_object(), ResetType::Hard, None).unwrap();
    let _b_oid = write_and_commit(repo, temp_dir, "file.txt", "ver-b\n", "B");

    let a_commit = repo.find_commit(a_oid).unwrap();
    let _ = repo.cherrypick(&a_commit, None);

    assert_eq!(
        repo.state(),
        RepositoryState::CherryPick,
        "expected CherryPick state after setup"
    );
    assert!(
        repo.index().unwrap().has_conflicts(),
        "expected conflicts in index after cherry-pick setup"
    );

    a_oid
}

/// History: base → A (ver-a) → B (ver-b) [HEAD]
/// Reverting A on top of B → conflict (B changed what A had set).
fn setup_revert_conflict(temp_dir: &TempDir, repo: &Repository) -> Oid {
    let _base = write_and_commit(repo, temp_dir, "file.txt", "base\n", "base");
    let a_oid = write_and_commit(repo, temp_dir, "file.txt", "ver-a\n", "A");
    let _b_oid = write_and_commit(repo, temp_dir, "file.txt", "ver-b\n", "B");

    let a_commit = repo.find_commit(a_oid).unwrap();
    let _ = repo.revert(&a_commit, None);

    assert_eq!(
        repo.state(),
        RepositoryState::Revert,
        "expected Revert state after setup"
    );
    assert!(
        repo.index().unwrap().has_conflicts(),
        "expected conflicts in index after revert setup"
    );

    a_oid
}

/// History: base → main (ver-main)  [original HEAD]
///              └→ feature (ver-feature)
/// Rebase feature onto main → conflict on file.txt.
fn setup_rebase_conflict(temp_dir: &TempDir, repo: &Repository) -> Oid {
    let base_oid = write_and_commit(repo, temp_dir, "file.txt", "base\n", "base");
    let base = repo.find_commit(base_oid).unwrap();
    let main_oid = write_and_commit(repo, temp_dir, "file.txt", "ver-main\n", "main");

    repo.branch("feature", &base, true).unwrap();
    repo.set_head("refs/heads/feature").unwrap();
    repo.checkout_head(Some(CheckoutBuilder::new().force()))
        .unwrap();

    let feature_oid = write_and_commit(repo, temp_dir, "file.txt", "ver-feature\n", "feature");

    let upstream_annot = repo.find_annotated_commit(base_oid).unwrap();
    let onto_annot = repo.find_annotated_commit(main_oid).unwrap();
    let mut rebase = repo
        .rebase(None, Some(&upstream_annot), Some(&onto_annot), None)
        .unwrap();

    let mut applied = 0;
    while let Some(op) = rebase.next() {
        let _op = op.unwrap();
        applied += 1;
        if repo.index().unwrap().has_conflicts() {
            break;
        }
        let sig = repo.signature().unwrap();
        rebase.commit(None, &sig, None).unwrap();
    }
    drop(rebase);

    assert_eq!(applied, 1, "expected exactly 1 rebase op before conflict");
    assert!(
        matches!(
            repo.state(),
            RepositoryState::Rebase
                | RepositoryState::RebaseInteractive
                | RepositoryState::RebaseMerge
        ),
        "expected a Rebase* state after setup, got {:?}",
        repo.state()
    );
    assert!(
        repo.index().unwrap().has_conflicts(),
        "expected conflicts in index after rebase setup"
    );

    feature_oid
}

fn resolve(temp_dir: &TempDir, repo: &Repository, filename: &str, content: &str) {
    let file_path = temp_dir.path().join(filename);
    fs::write(&file_path, content).unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new(filename)).unwrap();
    index.write().unwrap();
}

// ============================================================================
// abort_operation
// ============================================================================

#[test]
fn abort_cherry_pick_clears_state_and_restores_head() {
    let (temp_dir, repo) = create_test_repo();
    setup_cherry_pick_conflict(&temp_dir, &repo);

    abort_operation(&repo).unwrap();

    assert_eq!(repo.state(), RepositoryState::Clean);
    assert!(!repo.index().unwrap().has_conflicts());
    let workdir_content = fs::read_to_string(temp_dir.path().join("file.txt")).unwrap();
    assert_eq!(workdir_content, "ver-b\n");
    assert!(!repo.path().join("CHERRY_PICK_HEAD").exists());
}

#[test]
fn abort_revert_clears_state_and_restores_head() {
    let (temp_dir, repo) = create_test_repo();
    setup_revert_conflict(&temp_dir, &repo);

    abort_operation(&repo).unwrap();

    assert_eq!(repo.state(), RepositoryState::Clean);
    assert!(!repo.index().unwrap().has_conflicts());
    let workdir_content = fs::read_to_string(temp_dir.path().join("file.txt")).unwrap();
    assert_eq!(workdir_content, "ver-b\n");
    assert!(!repo.path().join("REVERT_HEAD").exists());
}

#[test]
fn abort_rebase_clears_state() {
    let (temp_dir, repo) = create_test_repo();
    setup_rebase_conflict(&temp_dir, &repo);

    abort_operation(&repo).unwrap();

    assert_eq!(repo.state(), RepositoryState::Clean);
    assert!(!repo.index().unwrap().has_conflicts());
}

#[test]
fn abort_when_clean_returns_no_operation_in_progress() {
    let (temp_dir, repo) = create_test_repo();
    write_and_commit(&repo, &temp_dir, "file.txt", "x\n", "init");

    let result = abort_operation(&repo);
    assert!(matches!(result, Err(AppError::NoOperationInProgress)));
}

// ============================================================================
// continue_operation
// ============================================================================

#[test]
fn continue_with_unresolved_conflicts_errors() {
    let (temp_dir, repo) = create_test_repo();
    setup_cherry_pick_conflict(&temp_dir, &repo);

    let result = continue_operation(&repo);
    match result {
        Err(AppError::ConflictsRemaining(paths)) => {
            assert!(
                paths.iter().any(|p| p == "file.txt"),
                "expected file.txt in conflicts, got {:?}",
                paths
            );
        }
        other => panic!("expected ConflictsRemaining, got {:?}", other),
    }
}

#[test]
fn continue_cherry_pick_after_resolution_preserves_source_author() {
    let (temp_dir, repo) = create_test_repo();
    let source_oid = setup_cherry_pick_conflict(&temp_dir, &repo);

    resolve(&temp_dir, &repo, "file.txt", "merged\n");

    let new_oid_str = continue_operation(&repo).unwrap();

    assert_eq!(repo.state(), RepositoryState::Clean);
    assert!(!repo.path().join("CHERRY_PICK_HEAD").exists());

    let new_commit = repo
        .find_commit(Oid::from_str(&new_oid_str).unwrap())
        .unwrap();
    let source_commit = repo.find_commit(source_oid).unwrap();
    assert_eq!(
        new_commit.author().email(),
        source_commit.author().email(),
        "cherry-pick continue should preserve the source commit's author"
    );

    let workdir_content = fs::read_to_string(temp_dir.path().join("file.txt")).unwrap();
    assert_eq!(workdir_content, "merged\n");
}

#[test]
fn continue_revert_after_resolution_uses_merge_msg() {
    let (temp_dir, repo) = create_test_repo();
    setup_revert_conflict(&temp_dir, &repo);

    resolve(&temp_dir, &repo, "file.txt", "reverted\n");

    let new_oid_str = continue_operation(&repo).unwrap();

    assert_eq!(repo.state(), RepositoryState::Clean);
    assert!(!repo.path().join("REVERT_HEAD").exists());

    let new_commit = repo
        .find_commit(Oid::from_str(&new_oid_str).unwrap())
        .unwrap();
    assert!(
        new_commit.message().unwrap_or("").starts_with("Revert"),
        "revert continue should use the MERGE_MSG starting with 'Revert', got: {:?}",
        new_commit.message()
    );
}

#[test]
fn continue_rebase_after_resolution_creates_commit_and_clears_state() {
    let (temp_dir, repo) = create_test_repo();
    setup_rebase_conflict(&temp_dir, &repo);

    resolve(&temp_dir, &repo, "file.txt", "rebased\n");

    let new_oid_str = continue_operation(&repo).unwrap();

    assert_eq!(repo.state(), RepositoryState::Clean);
    let _new_commit = repo
        .find_commit(Oid::from_str(&new_oid_str).unwrap())
        .unwrap();
    let workdir_content = fs::read_to_string(temp_dir.path().join("file.txt")).unwrap();
    assert_eq!(workdir_content, "rebased\n");
}

#[test]
fn continue_when_clean_returns_no_operation_in_progress() {
    let (temp_dir, repo) = create_test_repo();
    write_and_commit(&repo, &temp_dir, "file.txt", "x\n", "init");

    let result = continue_operation(&repo);
    assert!(matches!(result, Err(AppError::NoOperationInProgress)));
}

#[test]
fn continue_rejects_multi_commit_cherry_pick_sequencer() {
    let (temp_dir, repo) = create_test_repo();
    setup_cherry_pick_conflict(&temp_dir, &repo);
    resolve(&temp_dir, &repo, "file.txt", "merged\n");

    // Simulate a sequencer (multi-commit cherry-pick) by creating the directory.
    let sequencer_dir = repo.path().join("sequencer");
    fs::create_dir_all(&sequencer_dir).unwrap();

    let result = continue_operation(&repo);
    match result {
        Err(AppError::Internal(msg)) => {
            assert!(
                msg.contains("Multi-commit"),
                "expected sequencer rejection message, got: {}",
                msg
            );
        }
        other => panic!("expected Internal error, got {:?}", other),
    }
}
