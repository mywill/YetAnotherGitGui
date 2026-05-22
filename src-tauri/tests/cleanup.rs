//! Integration tests for the cleanup utilities.

mod common;

use common::{create_commit_with_file, create_initial_commit, create_test_repo};
use git2::{BranchType, Repository};
use std::fs;
use yagg_lib::commands::cleanup::{
    clean_untracked, delete_branches_bulk, drop_stashes_bulk, find_gone_branches,
    find_merged_branches, find_old_stashes, find_untracked_files, is_protected,
};

fn set_upstream(repo: &Repository, branch_name: &str, remote: &str, upstream_branch: &str) {
    let mut config = repo.config().unwrap();
    config
        .set_str(&format!("branch.{}.remote", branch_name), remote)
        .unwrap();
    config
        .set_str(
            &format!("branch.{}.merge", branch_name),
            &format!("refs/heads/{}", upstream_branch),
        )
        .unwrap();
}

fn create_branch_at_head(repo: &Repository, name: &str) {
    let head = repo.head().unwrap().peel_to_commit().unwrap();
    repo.branch(name, &head, false).unwrap();
}

// ============================================================================
// is_protected
// ============================================================================

#[test]
fn is_protected_defaults() {
    assert!(is_protected("main"));
    assert!(is_protected("master"));
    assert!(is_protected("develop"));
    assert!(is_protected("trunk"));
    assert!(!is_protected("feature/x"));
    assert!(!is_protected(""));
}

// ============================================================================
// find_gone_branches
// ============================================================================

#[test]
fn find_gone_branches_includes_branch_with_missing_upstream() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    // Switch HEAD away from the branch we'll be checking so it doesn't get filtered.
    repo.branch("other-head", &commit, false).unwrap();
    let other = repo.find_branch("other-head", BranchType::Local).unwrap();
    repo.set_head(other.get().name().unwrap()).unwrap();

    repo.branch("feature/x", &commit, false).unwrap();
    // Configure upstream pointing to a ref that does NOT exist locally.
    set_upstream(&repo, "feature/x", "origin", "feature/x");

    let gone = find_gone_branches(&repo).unwrap();
    assert!(
        gone.iter().any(|b| b.name == "feature/x"),
        "expected feature/x to be reported as gone, got {:?}",
        gone.iter().map(|b| &b.name).collect::<Vec<_>>()
    );

    drop(temp_dir);
}

#[test]
fn find_gone_branches_skips_branch_with_valid_upstream() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    repo.branch("other-head", &commit, false).unwrap();
    let other = repo.find_branch("other-head", BranchType::Local).unwrap();
    repo.set_head(other.get().name().unwrap()).unwrap();

    // Register the remote so libgit2 has a fetch refspec to map upstream names.
    repo.remote("origin", "https://example.com/origin.git")
        .unwrap();

    repo.branch("feature/y", &commit, false).unwrap();
    repo.reference("refs/remotes/origin/feature/y", oid, true, "test")
        .unwrap();
    set_upstream(&repo, "feature/y", "origin", "feature/y");

    let gone = find_gone_branches(&repo).unwrap();
    assert!(!gone.iter().any(|b| b.name == "feature/y"));

    drop(temp_dir);
}

#[test]
fn find_gone_branches_skips_branches_without_upstream_config() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    repo.branch("other-head", &commit, false).unwrap();
    let other = repo.find_branch("other-head", BranchType::Local).unwrap();
    repo.set_head(other.get().name().unwrap()).unwrap();

    // No upstream config at all — should not be reported as gone.
    repo.branch("local-only", &commit, false).unwrap();

    let gone = find_gone_branches(&repo).unwrap();
    assert!(!gone.iter().any(|b| b.name == "local-only"));

    drop(temp_dir);
}

#[test]
fn find_gone_branches_skips_current_head() {
    let (temp_dir, repo) = create_test_repo();
    let _oid = create_initial_commit(&repo, &temp_dir);

    let head_name = repo.head().unwrap().shorthand().unwrap().to_string();
    // Configure upstream on the current HEAD branch pointing to nothing.
    set_upstream(&repo, &head_name, "origin", &head_name);

    let gone = find_gone_branches(&repo).unwrap();
    assert!(
        !gone.iter().any(|b| b.name == head_name),
        "current HEAD should never appear"
    );

    drop(temp_dir);
}

// ============================================================================
// find_merged_branches
// ============================================================================

#[test]
fn find_merged_branches_returns_ancestor_branches() {
    let (temp_dir, repo) = create_test_repo();
    let first = create_initial_commit(&repo, &temp_dir);
    let first_commit = repo.find_commit(first).unwrap();

    // Branch off the first commit, then advance HEAD past it.
    repo.branch("old-feature", &first_commit, false).unwrap();
    create_commit_with_file(&repo, &temp_dir, "more.txt", "x", "advance HEAD");

    let merged = find_merged_branches(&repo).unwrap();
    assert!(merged.iter().any(|b| b.name == "old-feature"));

    drop(temp_dir);
}

#[test]
fn find_merged_branches_excludes_protected_names() {
    let (temp_dir, repo) = create_test_repo();
    let first = create_initial_commit(&repo, &temp_dir);
    let first_commit = repo.find_commit(first).unwrap();

    repo.branch("develop", &first_commit, false).unwrap();
    create_commit_with_file(&repo, &temp_dir, "more.txt", "x", "advance HEAD");

    let merged = find_merged_branches(&repo).unwrap();
    assert!(
        !merged.iter().any(|b| b.name == "develop"),
        "develop should never appear"
    );

    drop(temp_dir);
}

#[test]
fn find_merged_branches_excludes_current_head() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let head_name = repo.head().unwrap().shorthand().unwrap().to_string();
    let merged = find_merged_branches(&repo).unwrap();
    assert!(!merged.iter().any(|b| b.name == head_name));

    drop(temp_dir);
}

#[test]
fn find_merged_branches_skips_branches_with_extra_commits() {
    let (temp_dir, repo) = create_test_repo();
    let first = create_initial_commit(&repo, &temp_dir);
    let first_commit = repo.find_commit(first).unwrap();

    // diverged-branch will have a commit HEAD doesn't have.
    repo.branch("diverged", &first_commit, false).unwrap();
    let diverged = repo.find_branch("diverged", BranchType::Local).unwrap();
    repo.set_head(diverged.get().name().unwrap()).unwrap();
    create_commit_with_file(&repo, &temp_dir, "div.txt", "x", "on diverged");

    // Switch back to the original branch.
    let main_name = repo
        .branches(Some(BranchType::Local))
        .unwrap()
        .filter_map(|b| {
            let (br, _) = b.ok()?;
            let name = br.name().ok().flatten()?.to_string();
            if name != "diverged" {
                Some(name)
            } else {
                None
            }
        })
        .next()
        .unwrap();
    let main_branch = repo.find_branch(&main_name, BranchType::Local).unwrap();
    repo.set_head(main_branch.get().name().unwrap()).unwrap();

    let merged = find_merged_branches(&repo).unwrap();
    assert!(!merged.iter().any(|b| b.name == "diverged"));

    drop(temp_dir);
}

// ============================================================================
// delete_branches_bulk
// ============================================================================

#[test]
fn delete_branches_bulk_returns_per_item_results() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    create_branch_at_head(&repo, "to-delete-1");
    create_branch_at_head(&repo, "to-delete-2");
    // "missing" doesn't exist; its result should be an error.

    let names = vec![
        "to-delete-1".to_string(),
        "missing".to_string(),
        "to-delete-2".to_string(),
    ];
    let results = delete_branches_bulk(&repo, &names);

    assert_eq!(results.len(), 3);
    assert!(results[0].success);
    assert!(!results[1].success);
    assert!(results[1].error.is_some());
    assert!(results[2].success);

    // Surviving repo state: the two deletions actually happened.
    assert!(repo.find_branch("to-delete-1", BranchType::Local).is_err());
    assert!(repo.find_branch("to-delete-2", BranchType::Local).is_err());

    drop(temp_dir);
}

#[test]
fn delete_branches_bulk_refuses_current_head() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let head_name = repo.head().unwrap().shorthand().unwrap().to_string();
    let results = delete_branches_bulk(&repo, std::slice::from_ref(&head_name));

    assert_eq!(results.len(), 1);
    assert!(!results[0].success);
    let err = results[0].error.as_ref().unwrap();
    assert!(err.contains("currently checked out"), "got: {}", err);
    assert!(repo.find_branch(&head_name, BranchType::Local).is_ok());

    drop(temp_dir);
}

#[test]
fn delete_branches_bulk_refuses_protected() {
    let (temp_dir, repo) = create_test_repo();
    let _oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.head().unwrap().peel_to_commit().unwrap();

    repo.branch("other", &commit, false).unwrap();
    let other = repo.find_branch("other", BranchType::Local).unwrap();
    repo.set_head(other.get().name().unwrap()).unwrap();

    // develop is in the protected list. Create it locally and try to delete.
    repo.branch("develop", &commit, false).unwrap();
    let results = delete_branches_bulk(&repo, &["develop".to_string()]);

    assert!(!results[0].success);
    assert!(results[0].error.as_ref().unwrap().contains("protected"));
    assert!(repo.find_branch("develop", BranchType::Local).is_ok());

    drop(temp_dir);
}

// ============================================================================
// find_old_stashes / drop_stashes_bulk
// ============================================================================

#[test]
fn find_old_stashes_filters_by_age() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "v1", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    let sig = repo.signature().unwrap();

    fs::write(&file_path, "modified").unwrap();
    repo.stash_save(&sig, "Recent stash", None).unwrap();

    // days_old = 0 means "older than now or same as now" — every stash matches.
    let old = find_old_stashes(&mut repo, 0).unwrap();
    assert!(old.iter().any(|s| s.message.contains("Recent stash")));

    // days_old = 365 — the recent stash should NOT appear (it's not 1 year old).
    let very_old = find_old_stashes(&mut repo, 365).unwrap();
    assert!(!very_old.iter().any(|s| s.message.contains("Recent stash")));

    drop(temp_dir);
}

#[test]
fn drop_stashes_bulk_drops_in_descending_order() {
    let (temp_dir, mut repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "v1", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    let sig = repo.signature().unwrap();

    fs::write(&file_path, "v2").unwrap();
    repo.stash_save(&sig, "Stash A", None).unwrap();
    fs::write(&file_path, "v3").unwrap();
    repo.stash_save(&sig, "Stash B", None).unwrap();
    fs::write(&file_path, "v4").unwrap();
    repo.stash_save(&sig, "Stash C", None).unwrap();

    // Drop indices 0 and 2 — if dropped in ascending order this would
    // delete the wrong second stash.
    let results = drop_stashes_bulk(&mut repo, &[0, 2]);
    assert_eq!(results.len(), 2);
    assert!(results.iter().all(|r| r.success));

    let remaining = yagg_lib::git::list_stashes(&mut repo).unwrap();
    assert_eq!(remaining.len(), 1);
    assert!(remaining[0].message.contains("Stash B"));

    drop(temp_dir);
}

// ============================================================================
// find_untracked_files / clean_untracked
// ============================================================================

#[test]
fn find_untracked_files_excludes_ignored() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    fs::write(temp_dir.path().join(".gitignore"), "ignored.txt\n").unwrap();
    fs::write(temp_dir.path().join("ignored.txt"), "skip me").unwrap();
    fs::write(temp_dir.path().join("new.txt"), "include me").unwrap();

    let mut paths = find_untracked_files(&repo).unwrap();
    paths.sort();
    assert!(paths.contains(&"new.txt".to_string()));
    assert!(paths.contains(&".gitignore".to_string()));
    assert!(!paths.contains(&"ignored.txt".to_string()));

    drop(temp_dir);
}

#[test]
fn clean_untracked_deletes_files_and_returns_results() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    fs::write(temp_dir.path().join("a.txt"), "a").unwrap();
    fs::write(temp_dir.path().join("b.txt"), "b").unwrap();

    let results = clean_untracked(&repo, &["a.txt".to_string(), "b.txt".to_string()]).unwrap();
    assert!(results.iter().all(|r| r.success));
    assert!(!temp_dir.path().join("a.txt").exists());
    assert!(!temp_dir.path().join("b.txt").exists());

    drop(temp_dir);
}

#[test]
fn clean_untracked_rejects_paths_escaping_workdir() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    // ../escapes resolves outside the workdir.
    let results = clean_untracked(&repo, &["../escape.txt".to_string()]).unwrap();
    assert!(!results[0].success);
    let err = results[0].error.as_ref().unwrap();
    assert!(
        err.contains("escapes workdir") || err.contains("Bad path"),
        "got: {}",
        err
    );

    drop(temp_dir);
}

#[test]
fn clean_untracked_rejects_absolute_paths() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let results = clean_untracked(&repo, &["/etc/passwd".to_string()]).unwrap();
    assert!(!results[0].success);
    let err = results[0].error.as_ref().unwrap();
    assert!(err.contains("must be relative"), "got: {}", err);

    drop(temp_dir);
}

#[test]
fn clean_untracked_removes_directory_recursively() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let dir = temp_dir.path().join("subdir");
    fs::create_dir(&dir).unwrap();
    fs::write(dir.join("inner.txt"), "x").unwrap();

    let results = clean_untracked(&repo, &["subdir".to_string()]).unwrap();
    assert!(results[0].success, "got: {:?}", results[0].error);
    assert!(!dir.exists());

    drop(temp_dir);
}

/// Regression guard: if a symlink inside the workdir points outside, cleaning
/// it must not nuke the target directory. The current implementation only
/// canonicalizes the *parent*, then trusts std::fs to handle the leaf — so
/// this test pins down the safe behavior.
#[cfg(unix)]
#[test]
fn clean_untracked_does_not_follow_symlinks_pointing_outside_workdir() {
    use std::os::unix::fs::symlink;
    use tempfile::TempDir;

    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    // Create a sibling directory outside the workdir, with content that must
    // survive the clean operation.
    let outside_parent = TempDir::new().unwrap();
    let outside_dir = outside_parent.path().join("victim");
    fs::create_dir(&outside_dir).unwrap();
    let victim_file = outside_dir.join("important.txt");
    fs::write(&victim_file, "do not delete").unwrap();

    // Symlink inside the workdir pointing at the outside directory.
    let link_path = temp_dir.path().join("evil-link");
    symlink(&outside_dir, &link_path).unwrap();

    let _results = clean_untracked(&repo, &["evil-link".to_string()]).unwrap();

    // The critical assertion: the outside victim must still exist regardless
    // of whether the symlink itself got removed.
    assert!(
        outside_dir.exists(),
        "symlink target directory was destroyed"
    );
    assert!(
        victim_file.exists(),
        "file inside symlink target was deleted"
    );

    drop(temp_dir);
    drop(outside_parent);
}
