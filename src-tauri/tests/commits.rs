//! Integration tests for commit listing, details, and graph building.
//!
//! Pure-function unit tests (if any) live inline in src/git/commit.rs::tests.

mod common;

use common::{create_commit_with_file, create_initial_commit, create_test_repo};
use std::fs;
use std::path::Path;
use yagg_lib::git::{
    self, get_commit_details, get_commit_diff_hunk, get_commit_file_diff, get_commits,
};

// =============================================================================
// get_commits (5 tests)
// =============================================================================

#[test]
fn get_commits_empty_repo() {
    let (_temp_dir, repo) = create_test_repo();
    let commits = get_commits(&repo, 0, 10).unwrap();
    assert!(commits.is_empty());
}

#[test]
fn get_commits_single_commit() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "First commit");

    let commits = get_commits(&repo, 0, 10).unwrap();
    assert_eq!(commits.len(), 1);
    assert_eq!(commits[0].hash, oid.to_string());
    assert_eq!(commits[0].message, "First commit");
    assert_eq!(commits[0].author_name, "Test User");
    assert_eq!(commits[0].author_email, "test@example.com");
}

#[test]
fn get_commits_multiple_commits() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");
    create_commit_with_file(&repo, &temp_dir, "file2.txt", "content2", "Second commit");
    create_commit_with_file(&repo, &temp_dir, "file3.txt", "content3", "Third commit");

    let commits = get_commits(&repo, 0, 10).unwrap();
    assert_eq!(commits.len(), 3);
    assert_eq!(commits[0].message, "Third commit");
    assert_eq!(commits[1].message, "Second commit");
    assert_eq!(commits[2].message, "First commit");
}

#[test]
fn get_commits_with_skip() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");
    create_commit_with_file(&repo, &temp_dir, "file2.txt", "content2", "Second commit");
    create_commit_with_file(&repo, &temp_dir, "file3.txt", "content3", "Third commit");

    let commits = get_commits(&repo, 1, 10).unwrap();
    assert_eq!(commits.len(), 2);
    assert_eq!(commits[0].message, "Second commit");
    assert_eq!(commits[1].message, "First commit");
}

#[test]
fn get_commits_with_limit() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");
    create_commit_with_file(&repo, &temp_dir, "file2.txt", "content2", "Second commit");
    create_commit_with_file(&repo, &temp_dir, "file3.txt", "content3", "Third commit");

    let commits = get_commits(&repo, 0, 2).unwrap();
    assert_eq!(commits.len(), 2);
    assert_eq!(commits[0].message, "Third commit");
    assert_eq!(commits[1].message, "Second commit");
}

#[test]
fn get_commits_short_hash() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Commit");

    let commits = get_commits(&repo, 0, 10).unwrap();
    let full_hash = oid.to_string();
    assert_eq!(commits[0].short_hash, &full_hash[..7]);
}

#[test]
fn get_commits_parent_hashes() {
    let (temp_dir, repo) = create_test_repo();
    let first_oid =
        create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");
    create_commit_with_file(&repo, &temp_dir, "file2.txt", "content2", "Second commit");

    let commits = get_commits(&repo, 0, 10).unwrap();
    assert_eq!(commits[0].parent_hashes, vec![first_oid.to_string()]);
    assert!(commits[1].parent_hashes.is_empty());
}

// =============================================================================
// get_commit_details (4 tests)
// =============================================================================

#[test]
fn get_commit_details_basic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_commit_with_file(
        &repo,
        &temp_dir,
        "test_file.txt",
        "content",
        "Detailed commit message\n\nWith more details",
    );

    let details = get_commit_details(&repo, &oid.to_string()).unwrap();
    assert_eq!(details.hash, oid.to_string());
    assert_eq!(
        details.message,
        "Detailed commit message\n\nWith more details"
    );
    assert_eq!(details.author_name, "Test User");
    assert_eq!(details.author_email, "test@example.com");
    assert_eq!(details.committer_name, "Test User");
    assert_eq!(details.committer_email, "test@example.com");
    assert!(details
        .files_changed
        .iter()
        .any(|f| f.path == "test_file.txt"));
}

#[test]
fn get_commit_details_invalid_hash() {
    let (_temp_dir, repo) = create_test_repo();
    let result = get_commit_details(&repo, "invalid_hash");
    assert!(result.is_err());
}

#[test]
fn get_commit_details_nonexistent_commit() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Commit");

    let result = get_commit_details(&repo, "0000000000000000000000000000000000000000");
    assert!(result.is_err());
}

#[test]
fn get_commit_details_files_changed() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");

    let file1_path = temp_dir.path().join("file1.txt");
    fs::write(&file1_path, "modified content").unwrap();
    let file2_path = temp_dir.path().join("file2.txt");
    fs::write(&file2_path, "new file").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(Path::new("file1.txt")).unwrap();
    index.add_path(Path::new("file2.txt")).unwrap();
    index.write().unwrap();

    let sig = repo.signature().unwrap();
    let tree_id = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    let parent = repo.head().unwrap().peel_to_commit().unwrap();
    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, "Second commit", &tree, &[&parent])
        .unwrap();

    let details = get_commit_details(&repo, &oid.to_string()).unwrap();
    assert!(details.files_changed.iter().any(|f| f.path == "file1.txt"));
    assert!(details.files_changed.iter().any(|f| f.path == "file2.txt"));
}

// (commit_to_info is a private helper — its inline test stays in
// src/git/commit.rs::tests because integration tests can't see private items.)

// =============================================================================
// commands/commits.rs integration tests
// =============================================================================

#[test]
fn commands_commits_graph_logic() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let commits = git::get_commits(&repo, 0, 10).unwrap();
    let refs = git::collect_refs(&repo).unwrap();
    let graph = git::build_commit_graph(commits, refs);

    assert!(!graph.is_empty());
}

#[test]
fn commands_commits_details_logic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);

    let result = git::get_commit_details(&repo, &oid.to_string());
    assert!(result.is_ok());
    let details = result.unwrap();
    assert_eq!(details.hash, oid.to_string());
}

#[test]
fn commands_commits_details_invalid_hash() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = git::get_commit_details(&repo, "invalid");
    assert!(result.is_err());
}

#[test]
fn commands_commits_file_diff_logic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);

    let result = get_commit_file_diff(&repo, &oid.to_string(), "initial.txt");
    assert!(result.is_ok());
    let diff = result.unwrap();
    assert_eq!(diff.path, "initial.txt");
}

#[test]
fn commands_commits_get_all_commit_graph_returns_all() {
    let (temp_dir, repo) = create_test_repo();

    for i in 0..150 {
        let filename = format!("file_{}.txt", i);
        let content = format!("content {}", i);
        let message = format!("Commit {}", i);

        let file_path = temp_dir.path().join(&filename);
        fs::write(&file_path, &content).unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new(&filename)).unwrap();
        index.write().unwrap();

        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();

        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
            .unwrap();
    }

    let commits = git::get_all_commits(&repo).unwrap();
    let refs = git::collect_refs(&repo).unwrap();
    let graph = git::build_commit_graph(commits, refs);

    assert_eq!(
        graph.len(),
        150,
        "Should return all 150 commits, not truncated"
    );
}

#[test]
fn commands_commits_graph_paginates() {
    let (temp_dir, repo) = create_test_repo();
    for i in 0..5 {
        let _ = create_commit_with_file(
            &repo,
            &temp_dir,
            &format!("f{i}.txt"),
            &format!("c{i}"),
            &format!("commit {i}"),
        );
    }

    let commits = git::get_commits(&repo, 0, 3).unwrap();
    let refs = git::collect_refs(&repo).unwrap();
    let graph = git::build_commit_graph(commits, refs);

    assert_eq!(graph.len(), 3, "limit=3 should return 3 entries");
}

#[test]
fn commands_commits_graph_skip_past_end_returns_empty() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let commits = git::get_commits(&repo, 100, 10).unwrap();
    assert!(
        commits.is_empty(),
        "skip past end should yield empty result"
    );
}

#[test]
fn commands_commits_commit_diff_hunk_logic() {
    let (temp_dir, repo) = create_test_repo();
    let initial = create_initial_commit(&repo, &temp_dir);
    let _ = create_commit_with_file(
        &repo,
        &temp_dir,
        "initial.txt",
        "initial content\nadded line\n",
        "edit",
    );

    let head = repo.head().unwrap().target().unwrap();
    assert_ne!(head, initial);

    let result = get_commit_diff_hunk(&repo, &head.to_string(), "initial.txt", 0);
    assert!(result.is_ok(), "expected hunk 0 to load, got {result:?}");
}

// =============================================================================
// commands/commit.rs integration tests
// =============================================================================

#[test]
fn commands_commit_create_commit_logic() {
    let (temp_dir, repo) = create_test_repo();

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "content").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(Path::new("file.txt")).unwrap();
    index.write().unwrap();

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
fn commands_commit_create_commit_with_parent() {
    let (temp_dir, repo) = create_test_repo();

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

    let commit = repo.find_commit(commit_oid).unwrap();
    assert_eq!(commit.parent_count(), 1);
}
