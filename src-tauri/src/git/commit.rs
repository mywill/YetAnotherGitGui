use git2::{Oid, Repository, Sort};
use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_hashes: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CommitFileChange {
    pub path: String,
    pub status: String,
    pub old_path: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CommitDetails {
    pub hash: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub committer_name: String,
    pub committer_email: String,
    pub timestamp: i64,
    pub parent_hashes: Vec<String>,
    pub files_changed: Vec<CommitFileChange>,
}

pub fn get_commits(
    repo: &Repository,
    skip: usize,
    limit: usize,
) -> Result<Vec<CommitInfo>, AppError> {
    crate::log_git_op_debug!("get_commits", skip = skip, limit = limit);
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL)?;

    // Start from HEAD
    if let Ok(head) = repo.head() {
        if let Some(target) = head.target() {
            revwalk.push(target)?;
        }
    }

    // Also include all branch tips
    for (branch, _) in repo.branches(None)?.flatten() {
        if let Some(target) = branch.get().target() {
            let _ = revwalk.push(target);
        }
    }

    let commits: Vec<CommitInfo> = revwalk
        .skip(skip)
        .take(limit)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| {
            let commit = repo.find_commit(oid).ok()?;
            Some(commit_to_info(&commit))
        })
        .collect();

    Ok(commits)
}

pub fn get_all_commits(repo: &Repository) -> Result<Vec<CommitInfo>, AppError> {
    crate::log_git_op_debug!("get_all_commits");
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL)?;

    // Start from HEAD
    if let Ok(head) = repo.head() {
        if let Some(target) = head.target() {
            revwalk.push(target)?;
        }
    }

    // Also include all branch tips
    for (branch, _) in repo.branches(None)?.flatten() {
        if let Some(target) = branch.get().target() {
            let _ = revwalk.push(target);
        }
    }

    let commits: Vec<CommitInfo> = revwalk
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| {
            let commit = repo.find_commit(oid).ok()?;
            Some(commit_to_info(&commit))
        })
        .collect();

    Ok(commits)
}

pub fn get_commit_details(repo: &Repository, hash: &str) -> Result<CommitDetails, AppError> {
    crate::log_git_op_debug!("get_commit_details", hash = hash);
    let oid = Oid::from_str(hash)?;
    let commit = repo.find_commit(oid)?;

    let parent_hashes: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

    // Extract author/committer info before borrowing for tree operations
    let commit_hash = commit.id().to_string();
    let message = commit.message().unwrap_or("").to_string();
    let author = commit.author();
    let author_name = author.name().unwrap_or("").to_string();
    let author_email = author.email().unwrap_or("").to_string();
    let committer = commit.committer();
    let committer_name = committer.name().unwrap_or("").to_string();
    let committer_email = committer.email().unwrap_or("").to_string();
    let timestamp = commit.time().seconds();

    // Get changed files
    let tree = commit.tree()?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;
    let files_changed: Vec<CommitFileChange> = diff
        .deltas()
        .filter_map(|delta| {
            let path = delta
                .new_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())?;
            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                git2::Delta::Copied => "copied",
                _ => "modified",
            }
            .to_string();
            let old_path = if delta.status() == git2::Delta::Renamed
                || delta.status() == git2::Delta::Copied
            {
                delta
                    .old_file()
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
            } else {
                None
            };
            Some(CommitFileChange {
                path,
                status,
                old_path,
            })
        })
        .collect();

    Ok(CommitDetails {
        hash: commit_hash,
        message,
        author_name,
        author_email,
        committer_name,
        committer_email,
        timestamp,
        parent_hashes,
        files_changed,
    })
}

fn commit_to_info(commit: &git2::Commit) -> CommitInfo {
    let hash = commit.id().to_string();
    let short_hash = hash[..7.min(hash.len())].to_string();

    CommitInfo {
        hash,
        short_hash,
        message: commit
            .message()
            .unwrap_or("")
            .lines()
            .next()
            .unwrap_or("")
            .to_string(),
        author_name: commit.author().name().unwrap_or("").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        timestamp: commit.time().seconds(),
        parent_hashes: commit.parent_ids().map(|id| id.to_string()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use tempfile::TempDir;

    // Only test that genuinely needs private access — exercises commit_to_info
    // (private helper). Behavior tests for `get_commits` / `get_commit_details`
    // live in tests/commits.rs. The setup is inlined here (rather than using
    // common::create_test_repo) so this is the last consumer of that helper —
    // src/test_utils.rs is no longer needed.
    #[test]
    fn test_commit_to_info_multiline_message() {
        let temp_dir = TempDir::new().unwrap();
        let repo = git2::Repository::init(temp_dir.path()).unwrap();
        {
            let mut config = repo.config().unwrap();
            config.set_str("user.name", "Test User").unwrap();
            config.set_str("user.email", "test@example.com").unwrap();
        }

        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "content").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        let oid = repo
            .commit(
                Some("HEAD"),
                &sig,
                &sig,
                "First line\nSecond line\nThird line",
                &tree,
                &[],
            )
            .unwrap();

        let commit = repo.find_commit(oid).unwrap();
        let info = commit_to_info(&commit);
        assert_eq!(info.message, "First line");
    }
}
