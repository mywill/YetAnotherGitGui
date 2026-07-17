use git2::{BranchType, Repository, Status, StatusOptions, Worktree, WorktreePruneOptions};
use serde::Serialize;
use std::path::Path;

use crate::error::AppError;

/// A single worktree row in the cross-worktree dashboard.
///
/// The main worktree (the repository's primary working directory) is included
/// as the first entry with `is_main = true`; linked worktrees follow.
#[derive(Debug, Serialize, Clone)]
pub struct WorktreeInfo {
    /// Worktree name. For the main worktree this is `"main"`.
    pub name: String,
    /// Absolute filesystem path to the working directory.
    pub path: String,
    /// True for the repository's primary working tree.
    pub is_main: bool,
    /// Checked-out local branch name, if not detached.
    pub branch: Option<String>,
    /// HEAD commit hash for this worktree.
    pub head_hash: Option<String>,
    /// Whether the worktree directory is still present on disk.
    pub is_valid: bool,
    /// Whether the worktree is locked.
    pub is_locked: bool,
    /// Lock reason, if any.
    pub lock_reason: Option<String>,
    /// Whether the worktree is eligible for pruning.
    pub is_prunable: bool,
    /// Number of files with staged/unstaged/untracked changes.
    pub dirty_count: u32,
    /// Commits ahead of upstream (local branches with an upstream only).
    pub ahead: Option<u32>,
    /// Commits behind upstream (local branches with an upstream only).
    pub behind: Option<u32>,
    pub last_commit_summary: Option<String>,
    pub last_commit_author: Option<String>,
    pub last_commit_time: Option<i64>,
}

/// Build a `WorktreeInfo` from an open `Repository` handle. The `name` is the
/// display name (for linked worktrees this is the worktree's git name; for the
/// main worktree pass `"main"`). `is_main` flags the primary working tree.
///
/// `wt` is the optional `git2::Worktree` handle — required to read lock/prune
/// status for linked worktrees; `None` for the main worktree (which is never
/// locked or prunable).
fn build_info(
    repo: &Repository,
    name: &str,
    is_main: bool,
    wt: Option<&Worktree>,
) -> Result<WorktreeInfo, AppError> {
    let path = repo
        .workdir()
        .unwrap_or_else(|| repo.path())
        .to_string_lossy()
        .to_string();

    let (is_locked, lock_reason, is_prunable) = match wt {
        Some(w) => {
            let lock = w.is_locked().unwrap_or(git2::WorktreeLockStatus::Unlocked);
            let (locked, reason) = match lock {
                git2::WorktreeLockStatus::Unlocked => (false, None),
                git2::WorktreeLockStatus::Locked(r) => (true, r),
            };
            let prunable = w.is_prunable(None).unwrap_or(false);
            (locked, reason, prunable)
        }
        None => (false, None, false),
    };

    // Head / branch / commit metadata.
    let head = repo.head();
    let (branch, head_hash, last_commit) = match head {
        Ok(reference) => {
            let commit = reference.peel_to_commit().ok();
            let hash = commit.as_ref().map(|c| c.id().to_string());
            let br = if reference.is_branch() {
                reference.shorthand().ok().map(String::from)
            } else {
                None
            };
            let last = commit.as_ref().map(|c| {
                (
                    c.summary().ok().flatten().map(String::from),
                    c.author().name().ok().map(String::from),
                    Some(c.time().seconds()),
                )
            });
            (br, hash, last)
        }
        Err(_) => (None, None, None),
    };

    let (last_commit_summary, last_commit_author, last_commit_time) = match last_commit {
        Some((s, a, t)) => (s, a, t),
        None => (None, None, None),
    };

    // Dirty count: any status entry that isn't current/ignored.
    let dirty_count = count_dirty(repo).unwrap_or(0);

    // Ahead/behind vs upstream (local branch with upstream only).
    let (ahead, behind) = match branch.as_deref() {
        Some(b) => {
            if let Ok(br) = repo.find_branch(b, BranchType::Local) {
                if let Ok(up) = br.upstream() {
                    if let (Some(local_oid), Ok(up_commit)) =
                        (br.get().peel_to_commit().ok(), up.get().peel_to_commit())
                    {
                        if let Ok((a, b)) = repo.graph_ahead_behind(local_oid.id(), up_commit.id())
                        {
                            (
                                Some(a.min(u32::MAX as usize) as u32),
                                Some(b.min(u32::MAX as usize) as u32),
                            )
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        }
        None => (None, None),
    };

    Ok(WorktreeInfo {
        name: name.to_string(),
        path,
        is_main,
        branch,
        head_hash,
        is_valid: true,
        is_locked,
        lock_reason,
        is_prunable,
        dirty_count,
        ahead,
        behind,
        last_commit_summary,
        last_commit_author,
        last_commit_time,
    })
}

/// Count working-tree entries that are not current and not ignored.
fn count_dirty(repo: &Repository) -> Result<u32, AppError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts))?;
    let mut count = 0u32;
    for entry in statuses.iter() {
        let s = entry.status();
        if s.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE
                | Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_TYPECHANGE
                | Status::WT_RENAMED
                | Status::WT_NEW
                | Status::CONFLICTED,
        ) {
            count = count.saturating_add(1);
        }
    }
    Ok(count)
}

/// List all worktrees for the open repository, including the main worktree as
/// the first entry.
pub fn list_worktrees(repo: &Repository) -> Result<Vec<WorktreeInfo>, AppError> {
    crate::log_git_op_debug!("list_worktrees");

    let mut out = Vec::new();

    // Main worktree first.
    let main_info = build_info(repo, "main", true, None)?;
    out.push(main_info);

    // Linked worktrees.
    let names = repo.worktrees()?;
    for name_result in names.iter() {
        let name = match name_result {
            Ok(Some(n)) => n.to_string(),
            _ => continue,
        };
        let wt = match repo.find_worktree(&name) {
            Ok(w) => w,
            Err(_) => continue,
        };

        // Try to open a repo handle on the worktree to read branch/dirty state.
        // If the worktree directory has been deleted (prunable), this fails —
        // surface a minimal row with is_valid=false.
        match Repository::open_from_worktree(&wt) {
            Ok(wt_repo) => {
                let mut info = build_info(&wt_repo, &name, false, Some(&wt))?;
                info.is_valid = wt.validate().is_ok();
                out.push(info);
            }
            Err(_) => {
                let path = wt.path().to_string_lossy().to_string();
                let (is_locked, lock_reason) = match wt.is_locked() {
                    Ok(git2::WorktreeLockStatus::Unlocked) => (false, None),
                    Ok(git2::WorktreeLockStatus::Locked(r)) => (true, r),
                    Err(_) => (false, None),
                };
                let is_prunable = wt.is_prunable(None).unwrap_or(true);
                out.push(WorktreeInfo {
                    name: name.clone(),
                    path,
                    is_main: false,
                    branch: None,
                    head_hash: None,
                    is_valid: false,
                    is_locked,
                    lock_reason,
                    is_prunable,
                    dirty_count: 0,
                    ahead: None,
                    behind: None,
                    last_commit_summary: None,
                    last_commit_author: None,
                    last_commit_time: None,
                });
            }
        }
    }

    Ok(out)
}

/// Create a new linked worktree.
///
/// - `name`: worktree name (also surfaced in `git worktree list`).
/// - `path`: absolute filesystem path at which to create the working tree.
/// - `branch`: existing local branch to check out in the new worktree.
/// - `new_branch`: create a new branch with this name (at `commit_hash` or
///   HEAD) and check it out in the worktree. Mutually exclusive with `branch`.
/// - `commit_hash`: for the detached case (no `branch`/`new_branch`), check
///   out this commit; ignored when `new_branch` is set (used as the new
///   branch's base) — actually when `new_branch` is set, `commit_hash` is the
///   base for the new branch.
pub fn add_worktree(
    repo: &Repository,
    name: &str,
    path: &Path,
    branch: Option<&str>,
    new_branch: Option<&str>,
    commit_hash: Option<&str>,
) -> Result<WorktreeInfo, AppError> {
    crate::log_git_op!(
        "add_worktree",
        name = name,
        branch = branch,
        new_branch = new_branch
    );

    let mut opts = git2::WorktreeAddOptions::new();

    // Resolve the reference to set as the worktree HEAD. The reference must
    // outlive `opts` (WorktreeAddOptions borrows it), so hold it in a single
    // binding that lives until after `repo.worktree(...)`.
    let held_reference: Option<git2::Reference<'_>>;

    if let Some(nb) = new_branch {
        // Create the branch at the requested base (commit_hash or HEAD).
        let base_commit = match commit_hash {
            Some(h) => repo.find_commit(git2::Oid::from_str(h)?)?,
            None => repo.head()?.peel_to_commit()?,
        };
        let created = repo.branch(nb, &base_commit, false)?;
        held_reference = Some(created.into_reference());
    } else if let Some(b) = branch {
        // Check out an existing branch.
        let br = repo.find_branch(b, BranchType::Local)?;
        held_reference = Some(br.into_reference());
    } else {
        held_reference = None;
    }

    if let Some(ref r) = held_reference {
        opts.reference(Some(r));
    }

    let wt = repo.worktree(name, path, Some(&opts))?;

    // For the detached-with-commit case, checkout the specific commit inside
    // the new worktree (libgit2's reference=None only detaches at repo HEAD).
    if branch.is_none() && new_branch.is_none() {
        if let Some(h) = commit_hash {
            let wt_repo = Repository::open_from_worktree(&wt)?;
            let oid = git2::Oid::from_str(h)?;
            let commit = wt_repo.find_commit(oid)?;
            let tree = commit.tree()?;
            wt_repo.checkout_tree(tree.as_object(), None)?;
            wt_repo.set_head_detached(oid)?;
        }
    }

    // Open a repo handle on the new worktree to build the info row.
    let wt_repo = Repository::open_from_worktree(&wt)?;
    build_info(&wt_repo, name, false, Some(&wt))
}

/// Remove (prune) a linked worktree by name. If `force` is true, valid and
/// locked worktrees are also pruned and the working tree is recursively
/// removed from disk; otherwise only invalid (deleted) worktrees are pruned.
pub fn remove_worktree(repo: &Repository, name: &str, force: bool) -> Result<(), AppError> {
    crate::log_git_op!("remove_worktree", name = name, force = force);
    let wt = repo.find_worktree(name)?;
    let mut opts = WorktreePruneOptions::new();
    if force {
        opts.valid(true).locked(true).working_tree(true);
    } else {
        // Default: only prune invalid, unlocked worktrees. Don't remove the
        // working directory contents — refuse a still-present tree.
        if wt.validate().is_ok() {
            return Err(AppError::Internal(format!(
                "Worktree '{name}' is still valid on disk. Use force removal to delete it."
            )));
        }
    }
    wt.prune(Some(&mut opts))?;
    Ok(())
}

/// Move a linked worktree's working directory to a new path.
///
/// libgit2 does not expose `git worktree move` directly, so this performs the
/// move on the filesystem and relies on the worktree admin dir being relocated
/// by `git2`. If libgit2 lacks a move API, the directory is renamed via
/// `std::fs::rename` and the caller is expected to re-list worktrees.
pub fn move_worktree(repo: &Repository, name: &str, new_path: &Path) -> Result<(), AppError> {
    crate::log_git_op!("move_worktree", name = name);
    let wt = repo.find_worktree(name)?;
    let old_path = wt.path().to_path_buf();
    if old_path == new_path {
        return Ok(());
    }
    // libgit2 has no `git_worktree_move`; rename on disk. The gitdir link in
    // `<common>/worktrees/<name>/gitdir` stores an absolute path, so rename
    // keeps the worktree functional as long as both paths are on the same
    // filesystem.
    if new_path.exists() {
        return Err(AppError::InvalidPath(format!(
            "Destination path already exists: {}",
            new_path.display()
        )));
    }
    if let Some(parent) = new_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::rename(&old_path, new_path)?;
    // Update the stored gitdir path so `validate()` still passes.
    let gitdir = repo.path().join("worktrees").join(name).join("gitdir");
    if gitdir.exists() {
        let new_gitdir_line = new_path.join(".git");
        std::fs::write(&gitdir, format!("{}\n", new_gitdir_line.display()))?;
    }
    Ok(())
}

/// Lock a worktree with an optional reason.
pub fn lock_worktree(repo: &Repository, name: &str, reason: Option<&str>) -> Result<(), AppError> {
    crate::log_git_op!("lock_worktree", name = name);
    let wt = repo.find_worktree(name)?;
    wt.lock(reason)?;
    Ok(())
}

/// Unlock a worktree.
pub fn unlock_worktree(repo: &Repository, name: &str) -> Result<(), AppError> {
    crate::log_git_op!("unlock_worktree", name = name);
    let wt = repo.find_worktree(name)?;
    wt.unlock()?;
    Ok(())
}
