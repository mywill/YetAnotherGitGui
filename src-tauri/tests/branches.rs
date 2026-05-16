//! Integration tests for branch and tag operations.
//!
//! Most tests exercise git2 directly (mirroring what the wrappers do) since
//! the Tauri command wrappers can't be invoked without `tauri::State`.

mod common;

use common::{create_commit_with_file, create_initial_commit, create_test_repo};
use git2::{BranchType, Oid, Repository};
use yagg_lib::error::AppError;

// Mirror of `delete_branch` (in commands/branches.rs) — exercises the
// is_remote routing and the "cannot delete currently checked-out branch"
// guard without needing a `tauri::State`.
fn delete_branch_logic(
    repo: &Repository,
    branch_name: &str,
    is_remote: bool,
) -> Result<(), AppError> {
    if is_remote {
        let refname = format!("refs/remotes/{}", branch_name);
        let mut reference = repo.find_reference(&refname)?;
        reference.delete()?;
    } else {
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
        let mut branch = repo.find_branch(branch_name, BranchType::Local)?;
        branch.delete()?;
    }
    Ok(())
}

#[test]
fn list_branches_logic() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

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
fn checkout_branch_logic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    repo.branch("test-branch", &commit, false).unwrap();

    let branch = repo.find_branch("test-branch", BranchType::Local).unwrap();
    let reference = branch.get();
    let commit = reference.peel_to_commit().unwrap();
    let tree = commit.tree().unwrap();

    repo.checkout_tree(tree.as_object(), None).unwrap();
    let refname = reference.name().unwrap();
    repo.set_head(refname).unwrap();

    let head = repo.head().unwrap();
    assert_eq!(head.shorthand(), Some("test-branch"));
}

#[test]
fn checkout_branch_nonexistent() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = repo.find_branch("nonexistent-branch", BranchType::Local);
    assert!(result.is_err());
}

#[test]
fn checkout_commit_logic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);

    let commit = repo.find_commit(oid).unwrap();
    let tree = commit.tree().unwrap();

    repo.checkout_tree(tree.as_object(), None).unwrap();
    repo.set_head_detached(oid).unwrap();

    let head = repo.head().unwrap();
    assert!(!head.is_branch());
}

#[test]
fn checkout_commit_invalid_hash() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = Oid::from_str("invalid");
    assert!(result.is_err());
}

#[test]
fn delete_branch_logic_basic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    repo.branch("branch-to-delete", &commit, false).unwrap();
    assert!(repo
        .find_branch("branch-to-delete", BranchType::Local)
        .is_ok());

    let mut branch = repo
        .find_branch("branch-to-delete", BranchType::Local)
        .unwrap();
    branch.delete().unwrap();

    assert!(repo
        .find_branch("branch-to-delete", BranchType::Local)
        .is_err());
}

#[test]
fn delete_branch_current_branch_check() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let head = repo.head().unwrap();
    assert!(head.is_branch());

    let current_branch = head.shorthand().unwrap();
    assert!(current_branch == "main" || current_branch == "master");
}

#[test]
fn list_tags_logic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    repo.tag_lightweight("v1.0.0", commit.as_object(), false)
        .unwrap();

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
fn delete_tag_logic() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    repo.tag_lightweight("v1.0.0", commit.as_object(), false)
        .unwrap();
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
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = repo.tag_delete("nonexistent-tag");
    assert!(result.is_err());
}

#[test]
fn branch_upstream_ahead_behind() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    let branch_name = repo.head().unwrap().shorthand().unwrap().to_string();

    repo.remote("origin", "https://example.com/origin.git")
        .unwrap();

    repo.reference(
        &format!("refs/remotes/origin/{}", branch_name),
        oid,
        true,
        "set remote tracking ref for test",
    )
    .unwrap();

    let mut config = repo.config().unwrap();
    config
        .set_str(&format!("branch.{}.remote", branch_name), "origin")
        .unwrap();
    config
        .set_str(
            &format!("branch.{}.merge", branch_name),
            &format!("refs/heads/{}", branch_name),
        )
        .unwrap();

    let new_oid = create_commit_with_file(&repo, &temp_dir, "new.txt", "x", "advance");
    assert_ne!(new_oid, oid);

    let branch = repo.find_branch(&branch_name, BranchType::Local).unwrap();
    let upstream = branch.upstream().expect("upstream configured");
    let up_name = upstream.name().unwrap().unwrap().to_string();
    assert_eq!(up_name, format!("origin/{}", branch_name));

    let local_oid = branch.get().peel_to_commit().unwrap().id();
    let up_oid = upstream.get().peel_to_commit().unwrap().id();
    let (ahead, behind) = repo.graph_ahead_behind(local_oid, up_oid).unwrap();
    assert_eq!(ahead, 1);
    assert_eq!(behind, 0);

    drop(commit);
    drop(temp_dir);
}

#[test]
fn annotated_tag_tagger_extracted() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();

    let sig = git2::Signature::now("Alice", "alice@example.com").unwrap();
    repo.tag("v1.0.0", commit.as_object(), &sig, "First release", false)
        .unwrap();

    let mut found = false;
    repo.tag_foreach(|tag_oid, _name| {
        if let Ok(obj) = repo.find_object(tag_oid, None) {
            if let Some(tag) = obj.as_tag() {
                if tag.name() == Some("v1.0.0") {
                    let tagger = tag.tagger().expect("annotated tag has tagger");
                    assert_eq!(tagger.name(), Some("Alice"));
                    assert!(tagger.when().seconds() > 0);
                    found = true;
                }
            }
        }
        true
    })
    .unwrap();
    assert!(found, "annotated tag not found");

    drop(temp_dir);
}

#[test]
fn delete_branch_refuses_current_branch() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let head_name = repo.head().unwrap().shorthand().unwrap().to_string();
    let result = delete_branch_logic(&repo, &head_name, false);

    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("currently checked out"),
        "expected guard message, got: {err_msg}"
    );
}

#[test]
fn delete_branch_remote_path_deletes_remote_tracking_ref() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);

    repo.reference(
        "refs/remotes/origin/feature",
        oid,
        true,
        "set up remote tracking for test",
    )
    .unwrap();
    assert!(repo.find_reference("refs/remotes/origin/feature").is_ok());

    let result = delete_branch_logic(&repo, "origin/feature", true);
    assert!(result.is_ok(), "expected delete to succeed, got {result:?}");
    assert!(repo.find_reference("refs/remotes/origin/feature").is_err());
}

#[test]
fn delete_branch_remote_path_errors_when_ref_missing() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = delete_branch_logic(&repo, "origin/never-existed", true);
    assert!(result.is_err());
}

#[test]
fn checkout_branch_logic_routes_through_set_head() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();
    repo.branch("audit-test", &commit, false).unwrap();

    let branch = repo.find_branch("audit-test", BranchType::Local).unwrap();
    let reference = branch.get();
    let commit = reference.peel_to_commit().unwrap();
    let tree = commit.tree().unwrap();
    repo.checkout_tree(tree.as_object(), None).unwrap();
    let refname = reference.name().unwrap();
    repo.set_head(refname).unwrap();

    assert_eq!(repo.head().unwrap().shorthand(), Some("audit-test"));
}

// Mirror of `create_branch_and_checkout` — same reason as `delete_branch_logic`.
fn create_branch_and_checkout_logic(repo: &Repository, branch_name: &str) -> Result<(), AppError> {
    let head_commit = repo.head()?.peel_to_commit()?;
    repo.branch(branch_name, &head_commit, false)?;
    let branch = repo.find_branch(branch_name, BranchType::Local)?;
    let reference = branch.get();
    let commit = reference.peel_to_commit()?;
    let tree = commit.tree()?;
    repo.checkout_tree(tree.as_object(), None)?;
    let refname = reference
        .name()
        .ok_or_else(|| AppError::Git(git2::Error::from_str("Invalid branch reference name")))?;
    repo.set_head(refname)?;
    Ok(())
}

#[test]
fn create_branch_and_checkout_succeeds_at_head() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = create_branch_and_checkout_logic(&repo, "feature/new");
    assert!(result.is_ok(), "expected create to succeed, got {result:?}");

    assert!(repo.find_branch("feature/new", BranchType::Local).is_ok());
    assert_eq!(repo.head().unwrap().shorthand(), Some("feature/new"));
}

#[test]
fn create_branch_and_checkout_rejects_duplicate() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_initial_commit(&repo, &temp_dir);
    let commit = repo.find_commit(oid).unwrap();
    repo.branch("existing", &commit, false).unwrap();

    let head_before = repo.head().unwrap().shorthand().map(String::from);
    let result = create_branch_and_checkout_logic(&repo, "existing");
    assert!(result.is_err(), "expected duplicate to fail");
    assert_eq!(
        repo.head().unwrap().shorthand().map(String::from),
        head_before,
        "HEAD should not have moved after a failed create"
    );
}

#[test]
fn create_branch_and_checkout_rejects_invalid_name() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let result = create_branch_and_checkout_logic(&repo, "bad name");
    assert!(result.is_err(), "expected invalid name to fail");
    assert!(repo.find_branch("bad name", BranchType::Local).is_err());
}

#[test]
fn create_branch_and_checkout_uses_current_head() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    let second_oid =
        create_commit_with_file(&repo, &temp_dir, "second.txt", "second", "second commit");

    create_branch_and_checkout_logic(&repo, "from-head").unwrap();

    let branch = repo.find_branch("from-head", BranchType::Local).unwrap();
    let target = branch.get().peel_to_commit().unwrap().id();
    assert_eq!(
        target, second_oid,
        "new branch should point at current HEAD"
    );
}

#[test]
fn create_branch_and_checkout_flips_head_to_new_branch() {
    let (temp_dir, repo) = create_test_repo();
    let main_oid = create_initial_commit(&repo, &temp_dir);
    let main_name = repo.head().unwrap().shorthand().map(String::from).unwrap();

    create_branch_and_checkout_logic(&repo, "feature").unwrap();

    assert_eq!(repo.head().unwrap().shorthand(), Some("feature"));
    let original = repo
        .find_branch(&main_name, BranchType::Local)
        .expect("original branch should still exist");
    let original_target = original.get().peel_to_commit().unwrap().id();
    assert_eq!(original_target, main_oid);
}
