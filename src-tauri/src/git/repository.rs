use git2::{Repository, RepositoryState};
use serde::Serialize;
use std::path::Path;

use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct RepositoryInfo {
    pub path: String,
    pub current_branch: Option<String>,
    pub is_detached: bool,
    pub remotes: Vec<String>,
    pub head_hash: Option<String>,
    pub repo_state: String,
}

fn map_repo_state(state: RepositoryState) -> &'static str {
    match state {
        RepositoryState::Clean => "clean",
        RepositoryState::Merge => "merge",
        RepositoryState::Revert | RepositoryState::RevertSequence => "revert",
        RepositoryState::CherryPick | RepositoryState::CherryPickSequence => "cherry-pick",
        RepositoryState::Bisect => "bisect",
        RepositoryState::Rebase
        | RepositoryState::RebaseInteractive
        | RepositoryState::RebaseMerge => "rebase",
        _ => "clean",
    }
}

pub fn open_repo(path: &Path) -> Result<Repository, AppError> {
    let repo = Repository::open(path)?;
    Ok(repo)
}

pub fn get_repo_info(repo: &Repository) -> Result<RepositoryInfo, AppError> {
    let path = repo
        .workdir()
        .unwrap_or_else(|| repo.path())
        .to_string_lossy()
        .to_string();

    let head = repo.head();
    let (current_branch, is_detached, head_hash) = match head {
        Ok(reference) => {
            let hash = reference.peel_to_commit().ok().map(|c| c.id().to_string());
            if reference.is_branch() {
                (reference.shorthand().map(String::from), false, hash)
            } else {
                (None, true, hash)
            }
        }
        Err(_) => (None, false, None),
    };

    let remotes = repo
        .remotes()?
        .iter()
        .filter_map(|r| r.map(String::from))
        .collect();

    let repo_state = map_repo_state(repo.state()).to_string();

    Ok(RepositoryInfo {
        path,
        current_branch,
        is_detached,
        remotes,
        head_hash,
        repo_state,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Pure-function unit test for the private `map_repo_state` helper.
    // Behavior tests for `open_repo` / `get_repo_info` live in tests/repository.rs.
    #[test]
    fn test_map_repo_state_values() {
        assert_eq!(map_repo_state(RepositoryState::Clean), "clean");
        assert_eq!(map_repo_state(RepositoryState::Merge), "merge");
        assert_eq!(map_repo_state(RepositoryState::Revert), "revert");
        assert_eq!(map_repo_state(RepositoryState::RevertSequence), "revert");
        assert_eq!(map_repo_state(RepositoryState::CherryPick), "cherry-pick");
        assert_eq!(
            map_repo_state(RepositoryState::CherryPickSequence),
            "cherry-pick"
        );
        assert_eq!(map_repo_state(RepositoryState::Bisect), "bisect");
        assert_eq!(map_repo_state(RepositoryState::Rebase), "rebase");
        assert_eq!(map_repo_state(RepositoryState::RebaseInteractive), "rebase");
        assert_eq!(map_repo_state(RepositoryState::RebaseMerge), "rebase");
    }
}
