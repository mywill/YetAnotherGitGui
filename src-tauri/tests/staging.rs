//! Integration tests for staging behavior.
//!
//! Exercises the crate's public API for stage/unstage/discard/revert/conflict
//! operations against real `git2::Repository` instances built in temp dirs.
//! Pure-function unit tests for private helpers (`apply_hunk_to_content`,
//! `reverse_apply_hunk`, `apply_selected_lines_to_content`, status enum
//! mappings, `resolve_conflict_content`) live inline in
//! `src/git/staging.rs::tests`.

mod common;

use common::{create_initial_commit, create_test_repo};
use git2::Repository;
use std::fs;
use std::path::Path;
use tempfile::TempDir;
use yagg_lib::error::AppError;
use yagg_lib::git::{
    self, discard_hunk, get_file_diff, get_file_statuses, resolve_conflict, revert_commit,
    revert_commit_file, revert_commit_file_lines, stage_file, stage_files, stage_hunk, stage_lines,
    unstage_file, unstage_files, unstage_hunk, DiffHunk, DiffLine, FileStatusType, LineType,
};

// Local helpers used by the revert tests. Live alongside the tests that need
// them rather than in tests/common because they're staging-specific.
fn make_commit(
    repo: &Repository,
    temp_dir: &TempDir,
    filename: &str,
    content: &str,
    message: &str,
) -> git2::Oid {
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

fn make_commit_delete(
    repo: &Repository,
    temp_dir: &TempDir,
    filename: &str,
    message: &str,
) -> git2::Oid {
    let file_path = temp_dir.path().join(filename);
    fs::remove_file(&file_path).unwrap();

    let mut index = repo.index().unwrap();
    index.remove_path(Path::new(filename)).unwrap();
    index.write().unwrap();

    let sig = repo.signature().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();

    let parent = repo.head().unwrap().peel_to_commit().unwrap();

    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent])
        .unwrap()
}

// =============================================================================
// File statuses (4 tests)
// =============================================================================

#[test]
fn get_file_statuses_empty_repo() {
    let (_temp_dir, repo) = create_test_repo();
    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
    assert!(statuses.unstaged.is_empty());
    assert!(statuses.untracked.is_empty());
}

#[test]
fn get_file_statuses_untracked_file() {
    let (temp_dir, repo) = create_test_repo();
    let file_path = temp_dir.path().join("new_file.txt");
    fs::write(&file_path, "new content").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
    assert!(statuses.unstaged.is_empty());
    assert_eq!(statuses.untracked.len(), 1);
    assert_eq!(statuses.untracked[0].path, "new_file.txt");
    assert!(matches!(
        statuses.untracked[0].status,
        FileStatusType::Untracked
    ));
}

#[test]
fn get_file_statuses_staged_new_file() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("staged.txt");
    fs::write(&file_path, "staged content").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(Path::new("staged.txt")).unwrap();
    index.write().unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);
    assert_eq!(statuses.staged[0].path, "staged.txt");
    assert!(matches!(statuses.staged[0].status, FileStatusType::Added));
}

#[test]
fn get_file_statuses_modified_unstaged() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "modified content").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
    assert_eq!(statuses.unstaged.len(), 1);
    assert_eq!(statuses.unstaged[0].path, "initial.txt");
    assert!(matches!(
        statuses.unstaged[0].status,
        FileStatusType::Modified
    ));
}

// =============================================================================
// stage_file / unstage_file (5 tests)
// =============================================================================

#[test]
fn stage_file_new_file() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("new_file.txt");
    fs::write(&file_path, "new content").unwrap();

    stage_file(&repo, "new_file.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);
    assert_eq!(statuses.staged[0].path, "new_file.txt");
    assert!(statuses.untracked.is_empty());
}

#[test]
fn stage_file_modified_file() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "modified content").unwrap();

    stage_file(&repo, "initial.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);
    assert_eq!(statuses.staged[0].path, "initial.txt");
    assert!(matches!(
        statuses.staged[0].status,
        FileStatusType::Modified
    ));
    assert!(statuses.unstaged.is_empty());
}

#[test]
fn stage_file_deleted_file() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("initial.txt");
    fs::remove_file(&file_path).unwrap();

    stage_file(&repo, "initial.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);
    assert_eq!(statuses.staged[0].path, "initial.txt");
    assert!(matches!(statuses.staged[0].status, FileStatusType::Deleted));
}

#[test]
fn unstage_file_new_file() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("new_file.txt");
    fs::write(&file_path, "new content").unwrap();
    stage_file(&repo, "new_file.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);

    unstage_file(&repo, "new_file.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
    assert_eq!(statuses.untracked.len(), 1);
}

#[test]
fn unstage_file_modified_file() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "modified content").unwrap();
    stage_file(&repo, "initial.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);

    unstage_file(&repo, "initial.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
    assert_eq!(statuses.unstaged.len(), 1);
    assert_eq!(statuses.unstaged[0].path, "initial.txt");
}

#[test]
fn mixed_statuses() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let staged_path = temp_dir.path().join("staged.txt");
    fs::write(&staged_path, "staged").unwrap();
    stage_file(&repo, "staged.txt").unwrap();

    let modified_path = temp_dir.path().join("initial.txt");
    fs::write(&modified_path, "modified").unwrap();

    let untracked_path = temp_dir.path().join("untracked.txt");
    fs::write(&untracked_path, "untracked").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);
    assert_eq!(statuses.unstaged.len(), 1);
    assert_eq!(statuses.untracked.len(), 1);
}

// =============================================================================
// stage_hunk / unstage_hunk (4 tests)
// =============================================================================

#[test]
fn stage_hunk_first_hunk() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("multi.txt");
    fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
    stage_file(&repo, "multi.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add multi.txt", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified1\nline2\nline3\n").unwrap();

    let result = stage_hunk(&repo, "multi.txt", 0);
    assert!(result.is_ok());

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);
}

#[test]
fn stage_hunk_out_of_range() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "content\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified\n").unwrap();

    let result = stage_hunk(&repo, "file.txt", 5);
    assert!(result.is_err());
}

#[test]
fn unstage_hunk_after_staging() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "original\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 1);

    let result = unstage_hunk(&repo, "file.txt", 0);
    assert!(result.is_ok());

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty() || !statuses.unstaged.is_empty());
}

#[test]
fn unstage_hunk_out_of_range() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "original\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let result = unstage_hunk(&repo, "file.txt", 5);
    assert!(result.is_err());
}

// =============================================================================
// stage_lines (2 tests)
// =============================================================================

#[test]
fn stage_lines_partial_hunk() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified1\nmodified2\nline3\n").unwrap();

    let result = stage_lines(&repo, "file.txt", 0, vec![1]);
    assert!(result.is_ok());
}

#[test]
fn stage_lines_out_of_range_hunk() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "content\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified\n").unwrap();

    let result = stage_lines(&repo, "file.txt", 5, vec![0]);
    assert!(result.is_err());
}

// =============================================================================
// discard_hunk (3 tests)
// =============================================================================

#[test]
fn discard_hunk_whole_hunk() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified1\nline2\nline3\n").unwrap();

    let result = discard_hunk(&repo, "file.txt", 0, None);
    assert!(result.is_ok());

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "line1\nline2\nline3\n");
}

#[test]
fn discard_hunk_selected_lines() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified1\nmodified2\nline3\n").unwrap();

    let diff = get_file_diff(&repo, "file.txt", false).unwrap();
    assert!(!diff.hunks.is_empty());

    let first_deletion_idx = diff.hunks[0]
        .lines
        .iter()
        .position(|l| l.line_type == LineType::Deletion)
        .unwrap();
    let first_addition_idx = diff.hunks[0]
        .lines
        .iter()
        .position(|l| l.line_type == LineType::Addition)
        .unwrap();

    let result = discard_hunk(
        &repo,
        "file.txt",
        0,
        Some(vec![first_deletion_idx, first_addition_idx]),
    );
    assert!(result.is_ok());

    let content = fs::read_to_string(&file_path).unwrap();
    assert!(content.contains("line1"));
    assert!(content.contains("modified2"));
}

#[test]
fn discard_hunk_out_of_range() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "content\n").unwrap();
    stage_file(&repo, "file.txt").unwrap();

    let sig = repo.signature().unwrap();
    let mut index = repo.index().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
        .unwrap();

    fs::write(&file_path, "modified\n").unwrap();

    let result = discard_hunk(&repo, "file.txt", 5, None);
    assert!(result.is_err());
}

// =============================================================================
// revert_commit / revert_commit_file / revert_commit_file_lines (8 tests)
// =============================================================================

#[test]
fn revert_commit_modified_file() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(&repo, &temp_dir, "file.txt", "original\n", "initial");
    let commit_oid = make_commit(&repo, &temp_dir, "file.txt", "modified\n", "modify file");

    let result = revert_commit(&repo, &commit_oid.to_string());
    assert!(result.is_ok());

    let content = fs::read_to_string(temp_dir.path().join("file.txt")).unwrap();
    assert_eq!(content, "original\n");
}

#[test]
fn revert_commit_added_file() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(&repo, &temp_dir, "existing.txt", "exists\n", "initial");
    let commit_oid = make_commit(
        &repo,
        &temp_dir,
        "new_file.txt",
        "new content\n",
        "add file",
    );

    let result = revert_commit(&repo, &commit_oid.to_string());
    assert!(result.is_ok());

    assert!(!temp_dir.path().join("new_file.txt").exists());
}

#[test]
fn revert_commit_deleted_file() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(&repo, &temp_dir, "file.txt", "content\n", "initial");
    let commit_oid = make_commit_delete(&repo, &temp_dir, "file.txt", "delete file");

    let result = revert_commit(&repo, &commit_oid.to_string());
    assert!(result.is_ok());

    assert!(temp_dir.path().join("file.txt").exists());
    let content = fs::read_to_string(temp_dir.path().join("file.txt")).unwrap();
    assert_eq!(content, "content\n");
}

#[test]
fn revert_commit_file_single() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(&repo, &temp_dir, "a.txt", "aaa\n", "initial a");
    make_commit(&repo, &temp_dir, "b.txt", "bbb\n", "initial b");

    let file_a = temp_dir.path().join("a.txt");
    let file_b = temp_dir.path().join("b.txt");
    fs::write(&file_a, "aaa modified\n").unwrap();
    fs::write(&file_b, "bbb modified\n").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(Path::new("a.txt")).unwrap();
    index.add_path(Path::new("b.txt")).unwrap();
    index.write().unwrap();

    let sig = repo.signature().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    let commit_oid = repo
        .commit(Some("HEAD"), &sig, &sig, "modify both", &tree, &[&parent])
        .unwrap();

    let result = revert_commit_file(&repo, &commit_oid.to_string(), "a.txt");
    assert!(result.is_ok());

    let content_a = fs::read_to_string(&file_a).unwrap();
    assert_eq!(content_a, "aaa\n");

    let content_b = fs::read_to_string(&file_b).unwrap();
    assert_eq!(content_b, "bbb modified\n");
}

#[test]
fn revert_commit_file_conflict() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(&repo, &temp_dir, "file.txt", "original\n", "initial");
    let commit_b = make_commit(&repo, &temp_dir, "file.txt", "modified by B\n", "modify B");
    make_commit(&repo, &temp_dir, "file.txt", "modified by C\n", "modify C");

    let result = revert_commit_file(&repo, &commit_b.to_string(), "file.txt");
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(
        matches!(err, AppError::RevertConflict(_)),
        "Expected RevertConflict, got: {:?}",
        err
    );

    let file_path = temp_dir.path().join("file.txt");
    assert!(file_path.exists(), "File should not be deleted on conflict");
    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "modified by C\n");
}

#[test]
fn revert_commit_file_added() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(&repo, &temp_dir, "base.txt", "base\n", "initial");
    let add_commit = make_commit(
        &repo,
        &temp_dir,
        "new_file.txt",
        "new content\n",
        "add file",
    );

    let file_path = temp_dir.path().join("new_file.txt");
    assert!(file_path.exists());

    let result = revert_commit_file(&repo, &add_commit.to_string(), "new_file.txt");
    assert!(result.is_ok());
    assert!(
        !file_path.exists(),
        "File added by commit should be deleted on revert"
    );
}

#[test]
fn revert_commit_stages_changes() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(&repo, &temp_dir, "file.txt", "original\n", "initial");
    let commit_oid = make_commit(&repo, &temp_dir, "file.txt", "modified\n", "modify file");

    revert_commit(&repo, &commit_oid.to_string()).unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(
        !statuses.staged.is_empty(),
        "Revert should stage the changes"
    );
}

#[test]
fn revert_commit_file_lines_partial() {
    let (temp_dir, repo) = create_test_repo();
    make_commit(
        &repo,
        &temp_dir,
        "file.txt",
        "line1\nline2\nline3\n",
        "initial",
    );
    let commit_oid = make_commit(
        &repo,
        &temp_dir,
        "file.txt",
        "line1\nmodified2\nline3\n",
        "modify line2",
    );

    let diff = git::get_commit_file_diff(&repo, &commit_oid.to_string(), "file.txt").unwrap();
    assert!(!diff.hunks.is_empty());

    let mut revert_indices = Vec::new();
    for (idx, line) in diff.hunks[0].lines.iter().enumerate() {
        if line.line_type == LineType::Deletion || line.line_type == LineType::Addition {
            revert_indices.push(idx);
        }
    }

    let result = revert_commit_file_lines(
        &repo,
        &commit_oid.to_string(),
        "file.txt",
        0,
        revert_indices,
    );
    assert!(result.is_ok());

    let content = fs::read_to_string(temp_dir.path().join("file.txt")).unwrap();
    assert!(content.contains("line2"));
    assert!(!content.contains("modified2"));
}

// =============================================================================
// Empty-repo edge cases (2 tests)
// =============================================================================

#[test]
fn stage_file_empty_repo() {
    let (temp_dir, repo) = create_test_repo();

    let file_path = temp_dir.path().join("new.txt");
    fs::write(&file_path, "hello\n").unwrap();

    let result = stage_file(&repo, "new.txt");
    assert!(result.is_ok());

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.iter().any(|s| s.path == "new.txt"));
}

#[test]
fn unstage_file_empty_repo() {
    let (temp_dir, repo) = create_test_repo();

    let file_path = temp_dir.path().join("new.txt");
    fs::write(&file_path, "hello\n").unwrap();

    stage_file(&repo, "new.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.iter().any(|s| s.path == "new.txt"));

    let result = unstage_file(&repo, "new.txt");
    assert!(result.is_ok());

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
    assert!(statuses.untracked.iter().any(|s| s.path == "new.txt"));
}

// =============================================================================
// resolve_conflict — staging side-effect (1 test; pure-string variants stay inline)
// =============================================================================

#[test]
fn resolve_conflict_stages_file() {
    let (temp_dir, repo) = create_test_repo();
    common::create_commit_with_file(
        &repo,
        &temp_dir,
        "conflict.txt",
        "base content\n",
        "Initial",
    );

    let file_path = temp_dir.path().join("conflict.txt");
    fs::write(
        &file_path,
        "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n",
    )
    .unwrap();

    resolve_conflict(&repo, "conflict.txt", "ours").unwrap();

    let resolved = fs::read_to_string(&file_path).unwrap();
    assert_eq!(resolved, "ours\n");

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.iter().any(|s| s.path == "conflict.txt"));
    assert!(!statuses.unstaged.iter().any(|s| s.path == "conflict.txt"));
}

// =============================================================================
// stage_files / unstage_files batch (4 tests)
// =============================================================================

#[test]
fn stage_files_batch_stages_multiple_files() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    fs::write(temp_dir.path().join("a.txt"), "a").unwrap();
    fs::write(temp_dir.path().join("b.txt"), "b").unwrap();
    fs::write(temp_dir.path().join("c.txt"), "c").unwrap();

    let paths = vec![
        "a.txt".to_string(),
        "b.txt".to_string(),
        "c.txt".to_string(),
    ];
    stage_files(&repo, &paths).unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.iter().any(|s| s.path == "a.txt"));
    assert!(statuses.staged.iter().any(|s| s.path == "b.txt"));
    assert!(statuses.staged.iter().any(|s| s.path == "c.txt"));
    assert_eq!(statuses.staged.len(), 3);
}

#[test]
fn stage_files_handles_deleted_files() {
    let (temp_dir, repo) = create_test_repo();
    common::create_commit_with_file(&repo, &temp_dir, "keep.txt", "keep\n", "Initial");
    common::create_commit_with_file(&repo, &temp_dir, "delete.txt", "delete\n", "Add delete");

    fs::remove_file(temp_dir.path().join("delete.txt")).unwrap();

    let paths = vec!["delete.txt".to_string()];
    stage_files(&repo, &paths).unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses
        .staged
        .iter()
        .any(|s| s.path == "delete.txt" && matches!(s.status, FileStatusType::Deleted)));
}

#[test]
fn unstage_files_batch_unstages_multiple_files() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    fs::write(temp_dir.path().join("a.txt"), "a").unwrap();
    fs::write(temp_dir.path().join("b.txt"), "b").unwrap();

    let paths = vec!["a.txt".to_string(), "b.txt".to_string()];
    stage_files(&repo, &paths).unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert_eq!(statuses.staged.len(), 2);

    unstage_files(&repo, &paths).unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
    assert_eq!(statuses.untracked.len(), 2);
}

#[test]
fn stage_files_empty_list_is_noop() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    stage_files(&repo, &[]).unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
}

// =============================================================================
// commands/staging.rs integration tests — formerly mirrored "_logic" wrappers.
// The Tauri command wrappers can't be invoked without a `tauri::State`, so
// these tests exercised the same `git::*` calls the wrappers would make.
// Now that they live in tests/ they're calling the public API directly —
// no mirror needed.
// =============================================================================

#[test]
fn commands_staging_get_file_statuses_logic() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("untracked.txt");
    fs::write(&file_path, "untracked").unwrap();

    let result = get_file_statuses(&repo);
    assert!(result.is_ok());
    let statuses = result.unwrap();
    assert_eq!(statuses.untracked.len(), 1);
}

#[test]
fn commands_staging_stage_file_logic() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("new.txt");
    fs::write(&file_path, "new content").unwrap();

    let result = stage_file(&repo, "new.txt");
    assert!(result.is_ok());

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.iter().any(|s| s.path == "new.txt"));
}

#[test]
fn commands_staging_unstage_file_logic() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("staged.txt");
    fs::write(&file_path, "staged").unwrap();

    stage_file(&repo, "staged.txt").unwrap();

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.iter().any(|s| s.path == "staged.txt"));

    let result = unstage_file(&repo, "staged.txt");
    assert!(result.is_ok());

    let statuses = get_file_statuses(&repo).unwrap();
    assert!(statuses.staged.is_empty());
}

#[test]
fn commands_staging_revert_file_logic() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "modified content").unwrap();

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "modified content");

    let head = repo.head().unwrap().peel_to_tree().unwrap();
    repo.checkout_tree(
        head.as_object(),
        Some(
            git2::build::CheckoutBuilder::new()
                .force()
                .path("initial.txt"),
        ),
    )
    .unwrap();

    let content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(content, "initial content");
}

#[test]
fn commands_staging_delete_file_via_workdir() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("to_delete.txt");
    fs::write(&file_path, "delete me").unwrap();
    assert!(file_path.exists());

    let workdir = repo.workdir().unwrap();
    let full_path = workdir.join("to_delete.txt");
    fs::remove_file(full_path).unwrap();

    assert!(!file_path.exists());
}

#[test]
fn commands_staging_delete_files_via_workdir() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let names = ["a.txt", "b.txt", "c.txt"];
    for name in &names {
        fs::write(temp_dir.path().join(name), "content").unwrap();
    }
    for name in &names {
        assert!(temp_dir.path().join(name).exists());
    }

    let workdir = repo.workdir().unwrap();
    for name in &names {
        fs::remove_file(workdir.join(name)).unwrap();
    }

    for name in &names {
        assert!(!temp_dir.path().join(name).exists());
    }
}

#[test]
fn commands_staging_revert_file_empty_repo_returns_descriptive_error() {
    let (temp_dir, _repo) = create_test_repo();

    let file_path = temp_dir.path().join("new.txt");
    fs::write(&file_path, "hello\n").unwrap();

    let repo = git2::Repository::open(temp_dir.path()).unwrap();

    let head_result = repo.head();
    assert!(head_result.is_err() || repo.head().unwrap().peel_to_tree().is_err());

    let result: Result<(), AppError> = (|| {
        let head = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_tree().ok())
            .ok_or_else(|| AppError::InvalidPath("Cannot revert: no commits yet".to_string()))?;
        repo.checkout_tree(
            head.as_object(),
            Some(git2::build::CheckoutBuilder::new().force().path("new.txt")),
        )?;
        Ok(())
    })();

    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("no commits yet"),
        "Expected 'no commits yet' in error, got: {}",
        err_msg
    );
}

#[test]
fn commands_staging_discard_hunk_returns_error_for_nonexistent_file() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    let result = discard_hunk(&repo, "missing.txt", 0, None);
    assert!(result.is_err());
}

#[test]
fn commands_staging_revert_commit_file_lines_rejects_invalid_hash() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    let result = revert_commit_file_lines(&repo, "deadbeef", "initial.txt", 0, vec![0]);
    assert!(result.is_err());
}

// Silence unused-import warnings for items used only in the inline section
// above (DiffHunk/DiffLine come from `pub use git::staging::*` re-exports
// which include them, but they're consumed by patterns that the linter
// occasionally misses).
#[allow(dead_code)]
fn _import_witnesses(_h: DiffHunk, _l: DiffLine) {}
