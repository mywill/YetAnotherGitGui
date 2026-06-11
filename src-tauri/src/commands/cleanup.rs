use git2::{BranchType, Repository, Status, StatusOptions};
use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::commands::branches::BranchInfo;
use crate::error::AppError;
use crate::git::StashInfo;
use crate::state::AppState;

pub const PROTECTED_BRANCHES: &[&str] = &["main", "master", "develop", "trunk"];

#[derive(Debug, Serialize, Clone)]
pub struct BulkResult {
    pub item: String,
    pub success: bool,
    pub error: Option<String>,
}

pub fn is_protected(name: &str) -> bool {
    PROTECTED_BRANCHES.contains(&name)
}

fn build_branch_info(branch: &git2::Branch) -> Result<BranchInfo, AppError> {
    let name = branch.name()?.unwrap_or("").to_string();
    let tip = branch.get().peel_to_commit().ok();
    let target_hash = tip.as_ref().map(|c| c.id().to_string()).unwrap_or_default();
    let last_commit_summary = tip.as_ref().and_then(|c| c.summary().ok().flatten().map(String::from));
    let last_commit_author = tip
        .as_ref()
        .and_then(|c| c.author().name().ok().map(String::from));
    let last_commit_time = tip.as_ref().map(|c| c.time().seconds());

    Ok(BranchInfo {
        name,
        is_remote: false,
        is_head: false,
        target_hash,
        upstream: None,
        ahead: 0,
        behind: 0,
        last_commit_summary,
        last_commit_author,
        last_commit_time,
    })
}

/// Return local branches whose upstream is configured but the upstream ref
/// no longer resolves. The classic "gone" case: the remote branch was deleted
/// (e.g., after a PR merge + branch cleanup on the remote).
pub fn find_gone_branches(repo: &Repository) -> Result<Vec<BranchInfo>, AppError> {
    let head_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().ok().map(String::from));
    let config = repo.config()?;

    let mut result = Vec::new();
    for branch_result in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }
        if head_name.as_deref() == Some(name.as_str()) {
            continue;
        }

        // Must have an upstream configured in the first place.
        let remote_key = format!("branch.{}.remote", name);
        let merge_key = format!("branch.{}.merge", name);
        let has_upstream_config =
            config.get_string(&remote_key).is_ok() && config.get_string(&merge_key).is_ok();
        if !has_upstream_config {
            continue;
        }

        // ...but the upstream no longer resolves.
        let is_gone = branch.upstream().is_err();
        if is_gone {
            result.push(build_branch_info(&branch)?);
        }
    }
    Ok(result)
}

/// Return local branches fully merged into HEAD (excluding HEAD itself and
/// the hard-coded protected list).
pub fn find_merged_branches(repo: &Repository) -> Result<Vec<BranchInfo>, AppError> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(Vec::new()),
    };
    let head_commit = head.peel_to_commit()?;
    let head_name = head.shorthand().ok().map(String::from);
    let head_oid = head_commit.id();

    let mut result = Vec::new();
    for branch_result in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }
        if head_name.as_deref() == Some(name.as_str()) {
            continue;
        }
        if is_protected(&name) {
            continue;
        }
        let branch_oid = match branch.get().peel_to_commit() {
            Ok(c) => c.id(),
            Err(_) => continue,
        };
        let merged = branch_oid == head_oid || repo.graph_descendant_of(head_oid, branch_oid)?;
        if merged {
            result.push(build_branch_info(&branch)?);
        }
    }
    Ok(result)
}

/// Bulk-delete local branches. Each name gets its own result so a single
/// failure (e.g., branch was already removed mid-flight) doesn't abort the
/// rest of the batch.
pub fn delete_branches_bulk(repo: &Repository, names: &[String]) -> Vec<BulkResult> {
    let head_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().ok().map(String::from));

    names
        .iter()
        .map(|name| {
            let res = (|| -> Result<(), AppError> {
                if head_name.as_deref() == Some(name.as_str()) {
                    return Err(AppError::Git(git2::Error::from_str(
                        "Cannot delete the currently checked out branch",
                    )));
                }
                if is_protected(name) {
                    return Err(AppError::Git(git2::Error::from_str(
                        "Cannot delete a protected branch",
                    )));
                }
                let mut branch = repo.find_branch(name, BranchType::Local)?;
                branch.delete()?;
                Ok(())
            })();
            match res {
                Ok(()) => BulkResult {
                    item: name.clone(),
                    success: true,
                    error: None,
                },
                Err(e) => BulkResult {
                    item: name.clone(),
                    success: false,
                    error: Some(e.to_string()),
                },
            }
        })
        .collect()
}

/// Shell out to `git remote prune <remote>`. We use the CLI here (rather than
/// git2's `Remote::prune`) so the user's existing credentials, SSH agent,
/// and credential helpers all work — auth via libgit2 is brittle.
///
/// Returns the list of remote refs that were pruned.
pub fn run_remote_prune(repo: &Repository, remote: &str) -> Result<Vec<String>, AppError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::InvalidPath("No working directory".into()))?;

    let output = std::process::Command::new("git")
        .args(["remote", "prune", remote])
        .current_dir(workdir)
        .output()
        .map_err(|e| AppError::Internal(format!("Failed to run git: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::Internal(format!(
            "git remote prune failed: {}",
            stderr
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // NOTE: `git remote prune` has no `--porcelain` flag and the `[pruned]`
    // line format is from human-facing output. If git ever changes the
    // wording, this returns an empty list while the operation itself still
    // succeeded. Callers should not rely on the length to detect failure.
    let pruned: Vec<String> = stdout
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim_start();
            trimmed
                .strip_prefix("* [pruned] ")
                .or_else(|| trimmed.strip_prefix("[pruned] "))
                .map(|s| s.trim().to_string())
        })
        .collect();

    Ok(pruned)
}

/// Filter stashes to those at least `days_old` days old (timestamp `<=` cutoff,
/// so `days_old=0` matches every stash including ones created "now").
pub fn find_old_stashes(repo: &mut Repository, days_old: u32) -> Result<Vec<StashInfo>, AppError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let cutoff = now - (days_old as i64) * 86_400;

    let all = crate::git::list_stashes(repo)?;
    Ok(all.into_iter().filter(|s| s.timestamp <= cutoff).collect())
}

/// Drop multiple stashes. Sorted descending internally so each drop doesn't
/// shift the remaining indices.
pub fn drop_stashes_bulk(repo: &mut Repository, indices: &[usize]) -> Vec<BulkResult> {
    let mut sorted: Vec<usize> = indices.to_vec();
    sorted.sort_unstable_by(|a, b| b.cmp(a));

    sorted
        .into_iter()
        .map(|idx| {
            let item = format!("stash@{{{}}}", idx);
            match repo.stash_drop(idx) {
                Ok(_) => BulkResult {
                    item,
                    success: true,
                    error: None,
                },
                Err(e) => BulkResult {
                    item,
                    success: false,
                    error: Some(e.to_string()),
                },
            }
        })
        .collect()
}

/// Untracked files in the working tree, excluding gitignored paths.
pub fn find_untracked_files(repo: &Repository) -> Result<Vec<String>, AppError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut paths = Vec::new();
    for entry in statuses.iter() {
        if entry.status().contains(Status::WT_NEW) {
            if let Ok(path) = entry.path() {
                paths.push(path.to_string());
            }
        }
    }
    Ok(paths)
}

/// Delete untracked files. Each path is canonicalized and verified to be
/// inside the repo workdir before removal — paths attempting to escape are
/// rejected.
pub fn clean_untracked(repo: &Repository, paths: &[String]) -> Result<Vec<BulkResult>, AppError> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::InvalidPath("No working directory".into()))?;
    let workdir_canon = workdir
        .canonicalize()
        .map_err(|e| AppError::Internal(format!("Failed to canonicalize workdir: {}", e)))?;

    Ok(paths
        .iter()
        .map(|rel| {
            let res = (|| -> Result<(), AppError> {
                if Path::new(rel).is_absolute() {
                    return Err(AppError::InvalidPath(format!(
                        "Path must be relative: {}",
                        rel
                    )));
                }
                let abs = workdir.join(rel);
                // canonicalize fails if the file doesn't exist; resolve the parent then re-join.
                let parent = abs
                    .parent()
                    .ok_or_else(|| AppError::InvalidPath(format!("No parent for: {}", rel)))?;
                let parent_canon = parent
                    .canonicalize()
                    .map_err(|e| AppError::InvalidPath(format!("Bad path '{}': {}", rel, e)))?;
                if !parent_canon.starts_with(&workdir_canon) {
                    return Err(AppError::InvalidPath(format!(
                        "Path escapes workdir: {}",
                        rel
                    )));
                }
                let file_name = abs
                    .file_name()
                    .ok_or_else(|| AppError::InvalidPath(format!("No file name in: {}", rel)))?;
                let final_path = parent_canon.join(file_name);
                if final_path.is_dir() {
                    std::fs::remove_dir_all(&final_path)?;
                } else if final_path.exists() {
                    std::fs::remove_file(&final_path)?;
                } else {
                    return Err(AppError::InvalidPath(format!(
                        "Path does not exist: {}",
                        rel
                    )));
                }
                Ok(())
            })();
            match res {
                Ok(_) => BulkResult {
                    item: rel.clone(),
                    success: true,
                    error: None,
                },
                Err(e) => BulkResult {
                    item: rel.clone(),
                    success: false,
                    error: Some(e.to_string()),
                },
            }
        })
        .collect())
}

// ---- Tauri commands ----

#[tauri::command]
pub fn list_gone_branches(state: State<AppState>) -> Result<Vec<BranchInfo>, AppError> {
    crate::log_cmd_debug!("list_gone_branches");
    let repo = state.get_repo()?;
    find_gone_branches(&repo)
}

#[tauri::command]
pub fn list_merged_branches(state: State<AppState>) -> Result<Vec<BranchInfo>, AppError> {
    crate::log_cmd_debug!("list_merged_branches");
    let repo = state.get_repo()?;
    find_merged_branches(&repo)
}

#[tauri::command]
pub fn delete_branches(
    names: Vec<String>,
    state: State<AppState>,
) -> Result<Vec<BulkResult>, AppError> {
    crate::log_cmd!("delete_branches", count = names.len());
    let repo = state.get_repo()?;
    Ok(delete_branches_bulk(&repo, &names))
}

#[tauri::command]
pub fn prune_remote(remote: String, state: State<AppState>) -> Result<Vec<String>, AppError> {
    crate::log_cmd!("prune_remote", remote = remote);
    let repo = state.get_repo()?;
    run_remote_prune(&repo, &remote)
}

#[tauri::command]
pub fn list_old_stashes(days_old: u32, state: State<AppState>) -> Result<Vec<StashInfo>, AppError> {
    crate::log_cmd_debug!("list_old_stashes", days_old = days_old);
    let mut repo = state.get_repo()?;
    find_old_stashes(&mut repo, days_old)
}

#[tauri::command]
pub fn drop_stashes(
    indices: Vec<usize>,
    state: State<AppState>,
) -> Result<Vec<BulkResult>, AppError> {
    crate::log_cmd!("drop_stashes", count = indices.len());
    let mut repo = state.get_repo()?;
    Ok(drop_stashes_bulk(&mut repo, &indices))
}

#[tauri::command]
pub fn list_untracked_files(state: State<AppState>) -> Result<Vec<String>, AppError> {
    crate::log_cmd_debug!("list_untracked_files");
    let repo = state.get_repo()?;
    find_untracked_files(&repo)
}

#[tauri::command]
pub fn clean_untracked_files(
    paths: Vec<String>,
    state: State<AppState>,
) -> Result<Vec<BulkResult>, AppError> {
    crate::log_cmd!("clean_untracked_files", count = paths.len());
    let repo = state.get_repo()?;
    clean_untracked(&repo, &paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_protected_matches_defaults() {
        assert!(is_protected("main"));
        assert!(is_protected("master"));
        assert!(is_protected("develop"));
        assert!(is_protected("trunk"));
    }

    #[test]
    fn is_protected_rejects_others() {
        assert!(!is_protected("feature/foo"));
        assert!(!is_protected("MAIN"));
        assert!(!is_protected(""));
    }
}
