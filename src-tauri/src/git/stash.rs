use git2::{DiffOptions, Repository, StashApplyOptions};
use serde::Serialize;

use crate::error::AppError;
use crate::git::{CommitFileChange, DiffHunk, DiffLine, FileDiff, LineType};

#[derive(Debug, Serialize, Clone)]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub commit_hash: String,
    pub timestamp: i64,
    pub branch_name: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StashDetails {
    pub index: usize,
    pub message: String,
    pub commit_hash: String,
    pub timestamp: i64,
    pub branch_name: String,
    pub files_changed: Vec<CommitFileChange>,
}

pub fn list_stashes(repo: &mut Repository) -> Result<Vec<StashInfo>, AppError> {
    // First pass: collect basic info without accessing repo inside closure
    let mut raw_stashes: Vec<(usize, String, git2::Oid)> = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        raw_stashes.push((index, message.to_string(), *oid));
        true // Continue iterating
    })?;

    // Second pass: enrich with timestamp by looking up commits
    let stashes = raw_stashes
        .into_iter()
        .map(|(index, message, oid)| {
            let branch_name = parse_branch_from_stash_message(&message);
            let timestamp = repo
                .find_commit(oid)
                .map(|c| c.time().seconds())
                .unwrap_or(0);

            StashInfo {
                index,
                message,
                commit_hash: oid.to_string(),
                timestamp,
                branch_name,
            }
        })
        .collect();

    Ok(stashes)
}

fn parse_branch_from_stash_message(message: &str) -> String {
    // Stash messages typically look like:
    // "WIP on branch-name: abc123 commit message"
    // "On branch-name: custom message"
    if let Some(rest) = message.strip_prefix("WIP on ") {
        if let Some(colon_pos) = rest.find(':') {
            return rest[..colon_pos].to_string();
        }
    } else if let Some(rest) = message.strip_prefix("On ") {
        if let Some(colon_pos) = rest.find(':') {
            return rest[..colon_pos].to_string();
        }
    }
    String::new()
}

pub fn get_stash_details(repo: &mut Repository, index: usize) -> Result<StashDetails, AppError> {
    // First pass: find the stash at the given index
    let mut found_stash: Option<(String, git2::Oid)> = None;

    repo.stash_foreach(|idx, message, oid| {
        if idx == index {
            found_stash = Some((message.to_string(), *oid));
            false // Stop iterating
        } else {
            true // Continue
        }
    })?;

    let (message, stash_oid) = found_stash.ok_or_else(|| {
        AppError::Git(git2::Error::from_str(&format!(
            "Stash at index {} not found",
            index
        )))
    })?;

    // Now we can safely access repo again
    let branch_name = parse_branch_from_stash_message(&message);
    let timestamp = repo
        .find_commit(stash_oid)
        .map(|c| c.time().seconds())
        .unwrap_or(0);

    // Get the stash commit
    let stash_commit = repo.find_commit(stash_oid)?;

    // A stash commit has the index tree as parent[1] if it exists
    // The stash commit's tree contains the working directory state
    let stash_tree = stash_commit.tree()?;

    // Get the parent commit (the commit the stash was based on)
    let parent_tree = if stash_commit.parent_count() > 0 {
        Some(stash_commit.parent(0)?.tree()?)
    } else {
        None
    };

    // Diff between parent and stash to get changed files
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&stash_tree), None)?;

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

    Ok(StashDetails {
        index,
        message,
        commit_hash: stash_oid.to_string(),
        timestamp,
        branch_name,
        files_changed,
    })
}

pub fn apply_stash(repo: &mut Repository, index: usize) -> Result<(), AppError> {
    let mut opts = StashApplyOptions::new();
    repo.stash_apply(index, Some(&mut opts))?;
    Ok(())
}

pub fn drop_stash(repo: &mut Repository, index: usize) -> Result<(), AppError> {
    repo.stash_drop(index)?;
    Ok(())
}

pub fn get_stash_file_diff(
    repo: &mut Repository,
    index: usize,
    path: &str,
) -> Result<FileDiff, AppError> {
    // Get the stash commit
    let mut stash_oid: Option<git2::Oid> = None;

    repo.stash_foreach(|idx, _message, oid| {
        if idx == index {
            stash_oid = Some(*oid);
            false
        } else {
            true
        }
    })?;

    let oid = stash_oid.ok_or_else(|| {
        AppError::Git(git2::Error::from_str(&format!(
            "Stash at index {} not found",
            index
        )))
    })?;

    let stash_commit = repo.find_commit(oid)?;
    let stash_tree = stash_commit.tree()?;

    let parent_tree = if stash_commit.parent_count() > 0 {
        Some(stash_commit.parent(0)?.tree()?)
    } else {
        None
    };

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(path);

    let diff = repo.diff_tree_to_tree(
        parent_tree.as_ref(),
        Some(&stash_tree),
        Some(&mut diff_opts),
    )?;

    let mut file_diff = FileDiff {
        path: path.to_string(),
        hunks: Vec::new(),
        is_binary: false,
    };

    let mut current_hunk: Option<DiffHunk> = None;

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        if delta.flags().contains(git2::DiffFlags::BINARY) {
            file_diff.is_binary = true;
            return true;
        }

        if let Some(hunk_info) = hunk {
            if let Some(h) = current_hunk.take() {
                file_diff.hunks.push(h);
            }

            current_hunk = Some(DiffHunk {
                header: String::from_utf8_lossy(hunk_info.header()).to_string(),
                old_start: hunk_info.old_start(),
                old_lines: hunk_info.old_lines(),
                new_start: hunk_info.new_start(),
                new_lines: hunk_info.new_lines(),
                lines: Vec::new(),
            });
        }

        if let Some(ref mut hunk) = current_hunk {
            let content = String::from_utf8_lossy(line.content()).to_string();
            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                ' ' => LineType::Context,
                _ => LineType::Header,
            };

            hunk.lines.push(DiffLine {
                content,
                line_type,
                old_lineno: line.old_lineno(),
                new_lineno: line.new_lineno(),
            });
        }

        true
    })?;

    if let Some(h) = current_hunk {
        file_diff.hunks.push(h);
    }

    Ok(file_diff)
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
    fn test_list_stashes_empty_repo() {
        let (_temp_dir, mut repo) = create_test_repo();

        let stashes = list_stashes(&mut repo).unwrap();

        assert!(stashes.is_empty());
    }

    #[test]
    fn test_list_stashes_no_stashes() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        let stashes = list_stashes(&mut repo).unwrap();

        assert!(stashes.is_empty());
    }

    #[test]
    fn test_list_stashes_with_stash() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        // Modify the file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified content").unwrap();

        // Stash the changes
        let sig = repo.signature().unwrap();
        repo.stash_save(&sig, "Test stash", None).unwrap();

        let stashes = list_stashes(&mut repo).unwrap();

        assert_eq!(stashes.len(), 1);
        assert_eq!(stashes[0].index, 0);
        assert!(stashes[0].message.contains("Test stash"));
    }

    #[test]
    fn test_list_stashes_multiple() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        let file_path = temp_dir.path().join("file.txt");
        let sig = repo.signature().unwrap();

        // Create first stash
        fs::write(&file_path, "modified 1").unwrap();
        repo.stash_save(&sig, "First stash", None).unwrap();

        // Create second stash
        fs::write(&file_path, "modified 2").unwrap();
        repo.stash_save(&sig, "Second stash", None).unwrap();

        let stashes = list_stashes(&mut repo).unwrap();

        assert_eq!(stashes.len(), 2);
        // Stashes are in reverse order (newest first)
        assert_eq!(stashes[0].index, 0);
        assert!(stashes[0].message.contains("Second stash"));
        assert_eq!(stashes[1].index, 1);
        assert!(stashes[1].message.contains("First stash"));
    }

    #[test]
    fn test_get_stash_details() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        // Modify the file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified content").unwrap();

        // Stash the changes
        let sig = repo.signature().unwrap();
        repo.stash_save(&sig, "Test stash", None).unwrap();

        let details = get_stash_details(&mut repo, 0).unwrap();

        assert_eq!(details.index, 0);
        assert!(details.message.contains("Test stash"));
        assert!(!details.files_changed.is_empty());
        assert!(details.files_changed.iter().any(|f| f.path == "file.txt"));
    }

    #[test]
    fn test_get_stash_details_not_found() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        let result = get_stash_details(&mut repo, 0);

        assert!(result.is_err());
    }

    #[test]
    fn test_apply_stash() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        // Modify the file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified content").unwrap();

        // Stash the changes
        let sig = repo.signature().unwrap();
        repo.stash_save(&sig, "Test stash", None).unwrap();

        // Verify file is reverted
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "content");

        // Apply the stash
        apply_stash(&mut repo, 0).unwrap();

        // Verify file has modified content
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "modified content");
    }

    #[test]
    fn test_drop_stash() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        // Modify the file and stash
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified content").unwrap();

        let sig = repo.signature().unwrap();
        repo.stash_save(&sig, "Test stash", None).unwrap();

        // Verify stash exists
        let stashes = list_stashes(&mut repo).unwrap();
        assert_eq!(stashes.len(), 1);

        // Drop the stash
        drop_stash(&mut repo, 0).unwrap();

        // Verify stash is gone
        let stashes = list_stashes(&mut repo).unwrap();
        assert!(stashes.is_empty());
    }

    #[test]
    fn test_get_stash_file_diff() {
        let (temp_dir, mut repo) = create_test_repo();
        create_commit_with_file(
            &repo,
            &temp_dir,
            "file.txt",
            "original\ncontent\n",
            "Initial commit",
        );

        // Modify the file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified\ncontent\n").unwrap();

        // Stash the changes
        let sig = repo.signature().unwrap();
        repo.stash_save(&sig, "Test stash", None).unwrap();

        let diff = get_stash_file_diff(&mut repo, 0, "file.txt").unwrap();

        assert_eq!(diff.path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());
    }

    #[test]
    fn test_parse_branch_from_stash_message() {
        assert_eq!(
            parse_branch_from_stash_message("WIP on main: abc123 commit message"),
            "main"
        );
        assert_eq!(
            parse_branch_from_stash_message("WIP on feature/test: abc123 commit message"),
            "feature/test"
        );
        assert_eq!(
            parse_branch_from_stash_message("On main: custom message"),
            "main"
        );
        assert_eq!(parse_branch_from_stash_message("Random message"), "");
    }
}
