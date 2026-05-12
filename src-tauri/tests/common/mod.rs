//! Shared setup helpers for integration tests under `src-tauri/tests/`.
//!
//! Each integration test file in `src-tauri/tests/` is its own crate and
//! includes this module via `mod common;`. The helpers build a real `git2`
//! repository inside a `tempfile::TempDir` so behavior tests run against an
//! actual on-disk repo rather than a mock.
//!
//! `#[allow(dead_code)]` because not every integration binary uses every
//! helper; without the allow, unused-helper warnings would fire per-binary.

#![allow(dead_code)]

use git2::Repository;
use std::fs;
use std::path::Path;
use tempfile::TempDir;

pub fn create_test_repo() -> (TempDir, Repository) {
    let temp_dir = TempDir::new().unwrap();
    let repo = Repository::init(temp_dir.path()).unwrap();

    let mut config = repo.config().unwrap();
    config.set_str("user.name", "Test User").unwrap();
    config.set_str("user.email", "test@example.com").unwrap();

    (temp_dir, repo)
}

pub fn create_initial_commit(repo: &Repository, temp_dir: &TempDir) -> git2::Oid {
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

pub fn create_commit_with_file(
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
