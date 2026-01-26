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

pub fn get_commit_details(repo: &Repository, hash: &str) -> Result<CommitDetails, AppError> {
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

    fn create_test_repo() -> (TempDir, Repository) {
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();

        // Configure user for commits
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    fn create_commit_with_file(
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

    #[test]
    fn test_get_commits_empty_repo() {
        let (_temp_dir, repo) = create_test_repo();

        let commits = get_commits(&repo, 0, 10).unwrap();

        assert!(commits.is_empty());
    }

    #[test]
    fn test_get_commits_single_commit() {
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
    fn test_get_commits_multiple_commits() {
        let (temp_dir, repo) = create_test_repo();

        create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");
        create_commit_with_file(&repo, &temp_dir, "file2.txt", "content2", "Second commit");
        create_commit_with_file(&repo, &temp_dir, "file3.txt", "content3", "Third commit");

        let commits = get_commits(&repo, 0, 10).unwrap();

        assert_eq!(commits.len(), 3);
        // Commits should be in reverse chronological order
        assert_eq!(commits[0].message, "Third commit");
        assert_eq!(commits[1].message, "Second commit");
        assert_eq!(commits[2].message, "First commit");
    }

    #[test]
    fn test_get_commits_with_skip() {
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
    fn test_get_commits_with_limit() {
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
    fn test_get_commits_short_hash() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Commit");

        let commits = get_commits(&repo, 0, 10).unwrap();

        let full_hash = oid.to_string();
        assert_eq!(commits[0].short_hash, &full_hash[..7]);
    }

    #[test]
    fn test_get_commits_parent_hashes() {
        let (temp_dir, repo) = create_test_repo();

        let first_oid =
            create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");
        create_commit_with_file(&repo, &temp_dir, "file2.txt", "content2", "Second commit");

        let commits = get_commits(&repo, 0, 10).unwrap();

        // First commit (most recent) should have first_oid as parent
        assert_eq!(commits[0].parent_hashes, vec![first_oid.to_string()]);
        // Second commit (oldest) should have no parents
        assert!(commits[1].parent_hashes.is_empty());
    }

    #[test]
    fn test_get_commit_details() {
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
    fn test_get_commit_details_invalid_hash() {
        let (_temp_dir, repo) = create_test_repo();

        let result = get_commit_details(&repo, "invalid_hash");

        assert!(result.is_err());
    }

    #[test]
    fn test_get_commit_details_nonexistent_commit() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Commit");

        // Valid format but doesn't exist
        let result = get_commit_details(&repo, "0000000000000000000000000000000000000000");

        assert!(result.is_err());
    }

    #[test]
    fn test_get_commit_details_files_changed() {
        let (temp_dir, repo) = create_test_repo();

        // First commit
        create_commit_with_file(&repo, &temp_dir, "file1.txt", "content1", "First commit");

        // Second commit that modifies file1 and adds file2
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

    #[test]
    fn test_commit_to_info_multiline_message() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_commit_with_file(
            &repo,
            &temp_dir,
            "file.txt",
            "content",
            "First line\nSecond line\nThird line",
        );

        let commit = repo.find_commit(oid).unwrap();
        let info = commit_to_info(&commit);

        // Should only show first line in message
        assert_eq!(info.message, "First line");
    }
}
