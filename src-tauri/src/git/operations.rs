use git2::{Repository, RepositoryState, ResetType, Status, StatusOptions};

use crate::error::AppError;

pub fn abort_operation(repo: &Repository) -> Result<(), AppError> {
    crate::log_git_op!("abort_operation", state = format!("{:?}", repo.state()));
    match repo.state() {
        RepositoryState::Rebase
        | RepositoryState::RebaseInteractive
        | RepositoryState::RebaseMerge => {
            let mut rebase = repo.open_rebase(None)?;
            rebase.abort()?;
            Ok(())
        }
        RepositoryState::CherryPick
        | RepositoryState::CherryPickSequence
        | RepositoryState::Revert
        | RepositoryState::RevertSequence => {
            let head_commit = repo.head()?.peel_to_commit()?;
            repo.reset(head_commit.as_object(), ResetType::Hard, None)?;
            repo.cleanup_state()?;
            Ok(())
        }
        _ => Err(AppError::NoOperationInProgress),
    }
}

pub fn continue_operation(repo: &Repository) -> Result<String, AppError> {
    crate::log_git_op!("continue_operation", state = format!("{:?}", repo.state()));
    let conflicts = list_conflicted_paths(repo)?;
    if !conflicts.is_empty() {
        return Err(AppError::ConflictsRemaining(conflicts));
    }

    match repo.state() {
        RepositoryState::Rebase
        | RepositoryState::RebaseInteractive
        | RepositoryState::RebaseMerge => continue_rebase(repo),
        RepositoryState::CherryPick | RepositoryState::CherryPickSequence => {
            reject_if_sequencer(repo)?;
            continue_cherry_pick(repo)
        }
        RepositoryState::Revert | RepositoryState::RevertSequence => {
            reject_if_sequencer(repo)?;
            continue_revert(repo)
        }
        _ => Err(AppError::NoOperationInProgress),
    }
}

fn list_conflicted_paths(repo: &Repository) -> Result<Vec<String>, AppError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(false).include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts))?;
    Ok(statuses
        .iter()
        .filter(|e| e.status().contains(Status::CONFLICTED))
        .filter_map(|e| e.path().map(String::from))
        .collect())
}

// libgit2 doesn't drive the multi-commit sequencer (`.git/sequencer/`) that
// porcelain git uses for `cherry-pick A..C` / `revert A..C`. If we tried to
// "continue" with that state on disk we'd commit just the current pick and
// silently drop the remaining ones. Refuse and direct the user to the CLI.
fn reject_if_sequencer(repo: &Repository) -> Result<(), AppError> {
    if repo.path().join("sequencer").exists() {
        return Err(AppError::Internal(
            "Multi-commit cherry-pick/revert sequences aren't supported here. \
             Use the CLI: git cherry-pick --continue or git revert --continue."
                .into(),
        ));
    }
    Ok(())
}

fn continue_rebase(repo: &Repository) -> Result<String, AppError> {
    let mut rebase = repo.open_rebase(None)?;
    let committer = repo.signature()?;

    // Commit the just-resolved step. After a conflict pause, the index holds
    // the user's resolution; rebase.commit() turns it into the next commit in
    // the rebased history.
    let mut last_oid = rebase.commit(None, &committer, None)?;

    // Continue applying remaining picks. next() applies each operation; if
    // any of them produces conflicts we stop and let the user resolve again.
    while let Some(op) = rebase.next() {
        let _op = op?;
        let still_conflicts = list_conflicted_paths(repo)?;
        if !still_conflicts.is_empty() {
            return Err(AppError::ConflictsRemaining(still_conflicts));
        }
        last_oid = rebase.commit(None, &committer, None)?;
    }

    rebase.finish(Some(&committer))?;
    Ok(last_oid.to_string())
}

fn continue_cherry_pick(repo: &Repository) -> Result<String, AppError> {
    let oid_str = std::fs::read_to_string(repo.path().join("CHERRY_PICK_HEAD"))
        .map_err(|e| AppError::Internal(format!("Failed to read CHERRY_PICK_HEAD: {e}")))?;
    let source_oid = git2::Oid::from_str(oid_str.trim())?;
    let source_commit = repo.find_commit(source_oid)?;
    let author = source_commit.author();
    let message = source_commit.message().unwrap_or("").to_string();

    let new_oid = commit_index_to_head(repo, &author, &message)?;
    repo.cleanup_state()?;
    Ok(new_oid.to_string())
}

fn continue_revert(repo: &Repository) -> Result<String, AppError> {
    // libgit2 writes the canonical "Revert ..." message to MERGE_MSG during
    // the initial revert. If it's missing for any reason, fall back to a
    // generic message rather than failing.
    let message = std::fs::read_to_string(repo.path().join("MERGE_MSG"))
        .unwrap_or_else(|_| "Revert".to_string());
    let signature = repo.signature()?;
    let new_oid = commit_index_to_head(repo, &signature, &message)?;
    repo.cleanup_state()?;
    Ok(new_oid.to_string())
}

fn commit_index_to_head(
    repo: &Repository,
    author: &git2::Signature<'_>,
    message: &str,
) -> Result<git2::Oid, AppError> {
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let parent = repo.head()?.peel_to_commit()?;
    let committer = repo.signature()?;
    let oid = repo.commit(Some("HEAD"), author, &committer, message, &tree, &[&parent])?;
    Ok(oid)
}
