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
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub last_commit_summary: Option<String>,
    pub last_commit_author: Option<String>,
    pub last_commit_time: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct TagInfo {
    pub name: String,
    pub target_hash: String,
    pub is_annotated: bool,
    pub message: Option<String>,
    pub tagger_name: Option<String>,
    pub tagger_time: Option<i64>,
    pub last_commit_summary: Option<String>,
}

#[tauri::command]
pub fn list_branches(state: State<AppState>) -> Result<Vec<BranchInfo>, AppError> {
    let repo = state.get_repo()?;

    let head = repo.head().ok();
    let head_name = head.as_ref().and_then(|h| h.shorthand().map(String::from));

    let mut branches = Vec::new();

    for branch_result in repo.branches(None)? {
        let (branch, branch_type) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_remote = matches!(branch_type, git2::BranchType::Remote);
        let is_head = head_name.as_ref() == Some(&name) && !is_remote;

        let tip = branch.get().peel_to_commit().ok();
        let target_hash = tip.as_ref().map(|c| c.id().to_string()).unwrap_or_default();
        let last_commit_summary = tip.as_ref().and_then(|c| c.summary().map(String::from));
        let last_commit_author = tip
            .as_ref()
            .and_then(|c| c.author().name().map(String::from));
        let last_commit_time = tip.as_ref().map(|c| c.time().seconds());

        // Upstream tracking + ahead/behind (local branches only)
        let mut upstream = None;
        let mut ahead = 0u32;
        let mut behind = 0u32;
        if !is_remote {
            if let Ok(up) = branch.upstream() {
                if let Ok(Some(up_name)) = up.name() {
                    upstream = Some(up_name.to_string());
                }
                if let (Some(local_oid), Ok(up_oid)) =
                    (tip.as_ref().map(|c| c.id()), up.get().peel_to_commit())
                {
                    if let Ok((a, b)) = repo.graph_ahead_behind(local_oid, up_oid.id()) {
                        ahead = a.min(u32::MAX as usize) as u32;
                        behind = b.min(u32::MAX as usize) as u32;
                    }
                }
            }
        }

        branches.push(BranchInfo {
            name,
            is_remote,
            is_head,
            target_hash,
            upstream,
            ahead,
            behind,
            last_commit_summary,
            last_commit_author,
            last_commit_time,
        });
    }

    Ok(branches)
}

#[tauri::command]
pub fn checkout_commit(hash: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

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
    let repo = state.get_repo()?;

    let mut tags = Vec::new();

    repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .trim_start_matches("refs/tags/")
            .to_string();

        if let Ok(obj) = repo.find_object(oid, None) {
            let (target_hash, is_annotated, message, tagger_name, tagger_time) =
                if let Some(tag) = obj.as_tag() {
                    let target = tag.target_id().to_string();
                    let msg = tag.message().map(|s: &str| s.to_string());
                    let (t_name, t_time) = tag
                        .tagger()
                        .map(|sig| (sig.name().map(String::from), Some(sig.when().seconds())))
                        .unwrap_or((None, None));
                    (target, true, msg, t_name, t_time)
                } else {
                    (oid.to_string(), false, None, None, None)
                };

            // Last commit summary for the commit the tag points to.
            let last_commit_summary = Oid::from_str(&target_hash)
                .ok()
                .and_then(|o| repo.find_commit(o).ok())
                .and_then(|c| c.summary().map(String::from));

            tags.push(TagInfo {
                name,
                target_hash,
                is_annotated,
                message,
                tagger_name,
                tagger_time,
                last_commit_summary,
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
    let repo = state.get_repo()?;

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
    let repo = state.get_repo()?;

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
    let repo = state.get_repo()?;

    // Delete the tag
    repo.tag_delete(&tag_name)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use git2::Repository;

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

        let repo_lock = state.repository.lock();
        let result: Result<&Repository, AppError> =
            repo_lock.as_ref().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }
}
