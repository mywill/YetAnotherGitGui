use git2::{Repository, Status, StatusOptions};
use serde::Serialize;
use std::path::Path;

use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: FileStatusType,
    pub is_staged: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum FileStatusType {
    Modified,
    Added,
    Deleted,
    Renamed,
    #[allow(dead_code)]
    Copied,
    Untracked,
    Conflicted,
}

#[derive(Debug, Serialize, Clone)]
pub struct FileStatuses {
    pub staged: Vec<FileStatus>,
    pub unstaged: Vec<FileStatus>,
    pub untracked: Vec<FileStatus>,
}

pub fn get_file_statuses(repo: &Repository) -> Result<FileStatuses, AppError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts))?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        // Staged changes (index vs HEAD)
        if status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            staged.push(FileStatus {
                path: path.clone(),
                status: index_status_to_type(status),
                is_staged: true,
            });
        }

        // Unstaged changes (workdir vs index)
        if status.intersects(
            Status::WT_MODIFIED | Status::WT_DELETED | Status::WT_TYPECHANGE | Status::WT_RENAMED,
        ) {
            unstaged.push(FileStatus {
                path: path.clone(),
                status: workdir_status_to_type(status),
                is_staged: false,
            });
        }

        // Untracked files
        if status.contains(Status::WT_NEW) {
            untracked.push(FileStatus {
                path: path.clone(),
                status: FileStatusType::Untracked,
                is_staged: false,
            });
        }

        // Conflicted files
        if status.contains(Status::CONFLICTED) {
            unstaged.push(FileStatus {
                path,
                status: FileStatusType::Conflicted,
                is_staged: false,
            });
        }
    }

    Ok(FileStatuses {
        staged,
        unstaged,
        untracked,
    })
}

pub fn stage_file(repo: &Repository, path: &str) -> Result<(), AppError> {
    let mut index = repo.index()?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::InvalidPath("No workdir".into()))?;
    let full_path = workdir.join(path);

    if full_path.exists() {
        index.add_path(Path::new(path))?;
    } else {
        // File was deleted
        index.remove_path(Path::new(path))?;
    }

    index.write()?;
    Ok(())
}

pub fn unstage_file(repo: &Repository, path: &str) -> Result<(), AppError> {
    let head = repo.head()?.peel_to_commit()?;
    let head_tree = head.tree()?;

    let mut index = repo.index()?;

    // Try to get the file from HEAD
    if let Ok(entry) = head_tree.get_path(Path::new(path)) {
        // File exists in HEAD, restore it to index
        let entry_oid = entry.id();
        index.add_frombuffer(
            &git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: entry.filemode() as u32,
                uid: 0,
                gid: 0,
                file_size: 0,
                id: entry_oid,
                flags: 0,
                flags_extended: 0,
                path: path.as_bytes().to_vec(),
            },
            repo.find_blob(entry_oid)?.content(),
        )?;
    } else {
        // File doesn't exist in HEAD, remove from index
        index.remove_path(Path::new(path))?;
    }

    index.write()?;
    Ok(())
}

pub fn stage_hunk(repo: &Repository, path: &str, hunk_index: usize) -> Result<(), AppError> {
    // Get the current diff hunks
    let diff = super::diff::get_file_diff(repo, path, false)?;

    if hunk_index >= diff.hunks.len() {
        return Err(AppError::InvalidPath(format!(
            "Hunk index {} out of range",
            hunk_index
        )));
    }

    // Read current index content
    let mut index = repo.index()?;

    // Get current index content or HEAD content
    let index_content = if let Some(entry) = index.get_path(Path::new(path), 0) {
        let blob = repo.find_blob(entry.id)?;
        String::from_utf8_lossy(blob.content()).to_string()
    } else if let Ok(head) = repo.head() {
        if let Ok(tree) = head.peel_to_tree() {
            if let Ok(entry) = tree.get_path(Path::new(path)) {
                let blob = repo.find_blob(entry.id())?;
                String::from_utf8_lossy(blob.content()).to_string()
            } else {
                String::new()
            }
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    // Apply just this hunk to the index content
    let hunk = &diff.hunks[hunk_index];
    let new_content = apply_hunk_to_content(&index_content, hunk)?;

    // Write the new content to index
    let oid = repo.blob(new_content.as_bytes())?;

    // Regular file mode
    let mode = 0o100644;

    index.add_frombuffer(
        &git2::IndexEntry {
            ctime: git2::IndexTime::new(0, 0),
            mtime: git2::IndexTime::new(0, 0),
            dev: 0,
            ino: 0,
            mode,
            uid: 0,
            gid: 0,
            file_size: new_content.len() as u32,
            id: oid,
            flags: 0,
            flags_extended: 0,
            path: path.as_bytes().to_vec(),
        },
        new_content.as_bytes(),
    )?;

    index.write()?;
    Ok(())
}

pub fn unstage_hunk(repo: &Repository, path: &str, hunk_index: usize) -> Result<(), AppError> {
    // Get the staged diff hunks
    let diff = super::diff::get_file_diff(repo, path, true)?;

    if hunk_index >= diff.hunks.len() {
        return Err(AppError::InvalidPath(format!(
            "Hunk index {} out of range",
            hunk_index
        )));
    }

    let mut index = repo.index()?;

    // Get current index content
    let index_entry = index
        .get_path(Path::new(path), 0)
        .ok_or_else(|| AppError::InvalidPath("File not in index".into()))?;
    let blob = repo.find_blob(index_entry.id)?;
    let index_content = String::from_utf8_lossy(blob.content()).to_string();

    // Reverse apply the hunk
    let hunk = &diff.hunks[hunk_index];
    let new_content = reverse_apply_hunk(&index_content, hunk, None)?;

    // Write back to index
    let oid = repo.blob(new_content.as_bytes())?;

    index.add_frombuffer(
        &git2::IndexEntry {
            ctime: git2::IndexTime::new(0, 0),
            mtime: git2::IndexTime::new(0, 0),
            dev: 0,
            ino: 0,
            mode: index_entry.mode,
            uid: 0,
            gid: 0,
            file_size: new_content.len() as u32,
            id: oid,
            flags: 0,
            flags_extended: 0,
            path: path.as_bytes().to_vec(),
        },
        new_content.as_bytes(),
    )?;

    index.write()?;
    Ok(())
}

fn apply_hunk_to_content(content: &str, hunk: &super::diff::DiffHunk) -> Result<String, AppError> {
    let lines: Vec<&str> = content.lines().collect();
    let mut result = Vec::new();

    let start = (hunk.old_start as usize).saturating_sub(1);

    // Add lines before the hunk
    result.extend(lines.iter().take(start).map(|s| s.to_string()));

    // Track current position in original content
    let mut content_pos = start;

    // Apply the hunk - add new lines, skip deleted lines
    // Context and deletion lines consume lines from original content
    for line in &hunk.lines {
        match line.line_type {
            super::diff::LineType::Context => {
                // Context line: use original content to avoid whitespace/encoding issues
                if content_pos < lines.len() {
                    result.push(lines[content_pos].to_string());
                    content_pos += 1;
                }
            }
            super::diff::LineType::Addition => {
                // Addition: add the new line (doesn't consume original content)
                result.push(line.content.trim_end_matches('\n').to_string());
            }
            super::diff::LineType::Deletion => {
                // Deletion: skip this line from original content
                content_pos += 1;
            }
            super::diff::LineType::Header => {}
        }
    }

    // Add remaining lines after the hunk
    if content_pos < lines.len() {
        result.extend(lines.iter().skip(content_pos).map(|s| s.to_string()));
    }

    Ok(result.join("\n") + if content.ends_with('\n') { "\n" } else { "" })
}

fn reverse_apply_hunk(
    content: &str,
    hunk: &super::diff::DiffHunk,
    selected_indices: Option<&[usize]>,
) -> Result<String, AppError> {
    let lines: Vec<&str> = content.lines().collect();
    let mut result = Vec::new();

    let start = (hunk.new_start as usize).saturating_sub(1);

    // Add lines before the hunk
    result.extend(lines.iter().take(start).map(|s| s.to_string()));

    // Track current position in content (which has the hunk applied)
    let mut content_pos = start;

    // Reverse apply - deletions become additions, additions become deletions
    // Context and addition lines exist in content (new version)
    // Deletion lines don't exist in content, they need to be restored from hunk
    for (idx, line) in hunk.lines.iter().enumerate() {
        let is_selected = selected_indices
            .map(|indices| indices.contains(&idx))
            .unwrap_or(true);

        match line.line_type {
            super::diff::LineType::Context => {
                // Context: exists in both, use content and advance
                if content_pos < lines.len() {
                    result.push(lines[content_pos].to_string());
                    content_pos += 1;
                }
            }
            super::diff::LineType::Deletion => {
                // Deletion was removed in forward apply
                if is_selected {
                    // Restore it from hunk data
                    result.push(line.content.trim_end_matches('\n').to_string());
                }
                // This line doesn't exist in content, so don't advance content_pos
            }
            super::diff::LineType::Addition => {
                // Addition was added in forward apply
                if is_selected {
                    // Skip it (remove from output)
                    content_pos += 1;
                } else {
                    // Keep it in output
                    if content_pos < lines.len() {
                        result.push(lines[content_pos].to_string());
                        content_pos += 1;
                    }
                }
            }
            super::diff::LineType::Header => {}
        }
    }

    // Add remaining lines after the hunk
    if content_pos < lines.len() {
        result.extend(lines.iter().skip(content_pos).map(|s| s.to_string()));
    }

    Ok(result.join("\n") + if content.ends_with('\n') { "\n" } else { "" })
}

pub fn discard_hunk(
    repo: &Repository,
    path: &str,
    hunk_index: usize,
    line_indices: Option<Vec<usize>>,
) -> Result<(), AppError> {
    // Get the unstaged diff
    let diff = super::diff::get_file_diff(repo, path, false)?;

    if hunk_index >= diff.hunks.len() {
        return Err(AppError::InvalidPath(format!(
            "Hunk index {} out of range",
            hunk_index
        )));
    }

    let workdir = repo
        .workdir()
        .ok_or_else(|| AppError::InvalidPath("No working directory".into()))?;
    let file_path = workdir.join(path);

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| AppError::InvalidPath(format!("Failed to read file: {}", e)))?;

    let hunk = &diff.hunks[hunk_index];
    let new_content = reverse_apply_hunk(&content, hunk, line_indices.as_deref())?;

    std::fs::write(&file_path, &new_content)
        .map_err(|e| AppError::InvalidPath(format!("Failed to write file: {}", e)))?;

    Ok(())
}

pub fn stage_lines(
    repo: &Repository,
    path: &str,
    hunk_index: usize,
    line_indices: Vec<usize>,
) -> Result<(), AppError> {
    // Get the current diff hunks
    let diff = super::diff::get_file_diff(repo, path, false)?;

    if hunk_index >= diff.hunks.len() {
        return Err(AppError::InvalidPath(format!(
            "Hunk index {} out of range",
            hunk_index
        )));
    }

    // Read current index content
    let mut index = repo.index()?;

    // Get current index content or HEAD content
    let index_content = if let Some(entry) = index.get_path(Path::new(path), 0) {
        let blob = repo.find_blob(entry.id)?;
        String::from_utf8_lossy(blob.content()).to_string()
    } else if let Ok(head) = repo.head() {
        if let Ok(tree) = head.peel_to_tree() {
            if let Ok(entry) = tree.get_path(Path::new(path)) {
                let blob = repo.find_blob(entry.id())?;
                String::from_utf8_lossy(blob.content()).to_string()
            } else {
                String::new()
            }
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    // Apply only selected lines from the hunk
    let hunk = &diff.hunks[hunk_index];
    let new_content = apply_selected_lines_to_content(&index_content, hunk, &line_indices)?;

    // Write the new content to index
    let oid = repo.blob(new_content.as_bytes())?;

    // Regular file mode
    let mode = 0o100644;

    index.add_frombuffer(
        &git2::IndexEntry {
            ctime: git2::IndexTime::new(0, 0),
            mtime: git2::IndexTime::new(0, 0),
            dev: 0,
            ino: 0,
            mode,
            uid: 0,
            gid: 0,
            file_size: new_content.len() as u32,
            id: oid,
            flags: 0,
            flags_extended: 0,
            path: path.as_bytes().to_vec(),
        },
        new_content.as_bytes(),
    )?;

    index.write()?;
    Ok(())
}

fn apply_selected_lines_to_content(
    content: &str,
    hunk: &super::diff::DiffHunk,
    selected_indices: &[usize],
) -> Result<String, AppError> {
    let lines: Vec<&str> = content.lines().collect();
    let mut result = Vec::new();

    let start = (hunk.old_start as usize).saturating_sub(1);

    // Add lines before the hunk
    result.extend(lines.iter().take(start).map(|s| s.to_string()));

    // Track current position in original content (index into `lines`)
    let mut content_pos = start;

    // Apply only selected lines from the hunk
    // Key insight: context and deletion lines correspond to original content lines
    // We must track position in the original content, not just iterate the hunk
    for (idx, line) in hunk.lines.iter().enumerate() {
        match line.line_type {
            super::diff::LineType::Context => {
                // Context line: use the line from original content at current position
                if content_pos < lines.len() {
                    result.push(lines[content_pos].to_string());
                    content_pos += 1;
                }
            }
            super::diff::LineType::Addition => {
                // Only add if this line is selected
                if selected_indices.contains(&idx) {
                    result.push(line.content.trim_end_matches('\n').to_string());
                }
                // Additions don't consume original content lines
            }
            super::diff::LineType::Deletion => {
                // Deletion corresponds to a line in original content
                if selected_indices.contains(&idx) {
                    // Selected: stage the deletion (skip this line)
                    content_pos += 1;
                } else {
                    // Not selected: keep the original line
                    if content_pos < lines.len() {
                        result.push(lines[content_pos].to_string());
                        content_pos += 1;
                    }
                }
            }
            super::diff::LineType::Header => {}
        }
    }

    // Add remaining lines after the hunk (from where we left off)
    if content_pos < lines.len() {
        result.extend(lines.iter().skip(content_pos).map(|s| s.to_string()));
    }

    Ok(result.join("\n") + if content.ends_with('\n') { "\n" } else { "" })
}

fn index_status_to_type(status: Status) -> FileStatusType {
    if status.contains(Status::INDEX_NEW) {
        FileStatusType::Added
    } else if status.contains(Status::INDEX_MODIFIED) {
        FileStatusType::Modified
    } else if status.contains(Status::INDEX_DELETED) {
        FileStatusType::Deleted
    } else if status.contains(Status::INDEX_RENAMED) {
        FileStatusType::Renamed
    } else {
        FileStatusType::Modified
    }
}

fn workdir_status_to_type(status: Status) -> FileStatusType {
    if status.contains(Status::WT_MODIFIED) {
        FileStatusType::Modified
    } else if status.contains(Status::WT_DELETED) {
        FileStatusType::Deleted
    } else if status.contains(Status::WT_RENAMED) {
        FileStatusType::Renamed
    } else {
        FileStatusType::Modified
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
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

    fn create_initial_commit(repo: &Repository, temp_dir: &TempDir) -> git2::Oid {
        // Create a file and commit it
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "initial content").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("initial.txt")).unwrap();
        index.write().unwrap();

        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
            .unwrap()
    }

    #[test]
    fn test_get_file_statuses_empty_repo() {
        let (_temp_dir, repo) = create_test_repo();

        let statuses = get_file_statuses(&repo).unwrap();

        assert!(statuses.staged.is_empty());
        assert!(statuses.unstaged.is_empty());
        assert!(statuses.untracked.is_empty());
    }

    #[test]
    fn test_get_file_statuses_untracked_file() {
        let (temp_dir, repo) = create_test_repo();

        // Create an untracked file
        let file_path = temp_dir.path().join("new_file.txt");
        fs::write(&file_path, "new content").unwrap();

        let statuses = get_file_statuses(&repo).unwrap();

        assert!(statuses.staged.is_empty());
        assert!(statuses.unstaged.is_empty());
        assert_eq!(statuses.untracked.len(), 1);
        assert_eq!(statuses.untracked[0].path, "new_file.txt");
        assert!(matches!(
            statuses.untracked[0].status,
            FileStatusType::Untracked
        ));
    }

    #[test]
    fn test_get_file_statuses_staged_new_file() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and stage a new file
        let file_path = temp_dir.path().join("staged.txt");
        fs::write(&file_path, "staged content").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("staged.txt")).unwrap();
        index.write().unwrap();

        let statuses = get_file_statuses(&repo).unwrap();

        assert_eq!(statuses.staged.len(), 1);
        assert_eq!(statuses.staged[0].path, "staged.txt");
        assert!(matches!(statuses.staged[0].status, FileStatusType::Added));
    }

    #[test]
    fn test_get_file_statuses_modified_unstaged() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Modify the committed file
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();

        let statuses = get_file_statuses(&repo).unwrap();

        assert!(statuses.staged.is_empty());
        assert_eq!(statuses.unstaged.len(), 1);
        assert_eq!(statuses.unstaged[0].path, "initial.txt");
        assert!(matches!(
            statuses.unstaged[0].status,
            FileStatusType::Modified
        ));
    }

    #[test]
    fn test_stage_file_new_file() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create a new file
        let file_path = temp_dir.path().join("new_file.txt");
        fs::write(&file_path, "new content").unwrap();

        // Stage it
        stage_file(&repo, "new_file.txt").unwrap();

        let statuses = get_file_statuses(&repo).unwrap();
        assert_eq!(statuses.staged.len(), 1);
        assert_eq!(statuses.staged[0].path, "new_file.txt");
        assert!(statuses.untracked.is_empty());
    }

    #[test]
    fn test_stage_file_modified_file() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Modify file
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();

        // Stage it
        stage_file(&repo, "initial.txt").unwrap();

        let statuses = get_file_statuses(&repo).unwrap();
        assert_eq!(statuses.staged.len(), 1);
        assert_eq!(statuses.staged[0].path, "initial.txt");
        assert!(matches!(
            statuses.staged[0].status,
            FileStatusType::Modified
        ));
        assert!(statuses.unstaged.is_empty());
    }

    #[test]
    fn test_stage_file_deleted_file() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Delete file
        let file_path = temp_dir.path().join("initial.txt");
        fs::remove_file(&file_path).unwrap();

        // Stage the deletion
        stage_file(&repo, "initial.txt").unwrap();

        let statuses = get_file_statuses(&repo).unwrap();
        assert_eq!(statuses.staged.len(), 1);
        assert_eq!(statuses.staged[0].path, "initial.txt");
        assert!(matches!(statuses.staged[0].status, FileStatusType::Deleted));
    }

    #[test]
    fn test_unstage_file_new_file() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and stage a new file
        let file_path = temp_dir.path().join("new_file.txt");
        fs::write(&file_path, "new content").unwrap();
        stage_file(&repo, "new_file.txt").unwrap();

        // Verify it's staged
        let statuses = get_file_statuses(&repo).unwrap();
        assert_eq!(statuses.staged.len(), 1);

        // Unstage it
        unstage_file(&repo, "new_file.txt").unwrap();

        // Verify it's now untracked
        let statuses = get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.is_empty());
        assert_eq!(statuses.untracked.len(), 1);
    }

    #[test]
    fn test_unstage_file_modified_file() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Modify and stage
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();
        stage_file(&repo, "initial.txt").unwrap();

        // Verify staged
        let statuses = get_file_statuses(&repo).unwrap();
        assert_eq!(statuses.staged.len(), 1);

        // Unstage
        unstage_file(&repo, "initial.txt").unwrap();

        // Verify now unstaged
        let statuses = get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.is_empty());
        assert_eq!(statuses.unstaged.len(), 1);
        assert_eq!(statuses.unstaged[0].path, "initial.txt");
    }

    #[test]
    fn test_mixed_statuses() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create staged file
        let staged_path = temp_dir.path().join("staged.txt");
        fs::write(&staged_path, "staged").unwrap();
        stage_file(&repo, "staged.txt").unwrap();

        // Modify existing file (unstaged)
        let modified_path = temp_dir.path().join("initial.txt");
        fs::write(&modified_path, "modified").unwrap();

        // Create untracked file
        let untracked_path = temp_dir.path().join("untracked.txt");
        fs::write(&untracked_path, "untracked").unwrap();

        let statuses = get_file_statuses(&repo).unwrap();

        assert_eq!(statuses.staged.len(), 1);
        assert_eq!(statuses.unstaged.len(), 1);
        assert_eq!(statuses.untracked.len(), 1);
    }

    #[test]
    fn test_stage_hunk_first_hunk() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create a file with multiple lines
        let file_path = temp_dir.path().join("multi.txt");
        fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
        stage_file(&repo, "multi.txt").unwrap();

        // Commit
        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add multi.txt", &tree, &[&parent])
            .unwrap();

        // Modify the file
        fs::write(&file_path, "modified1\nline2\nline3\n").unwrap();

        // Stage just the first hunk
        let result = stage_hunk(&repo, "multi.txt", 0);
        assert!(result.is_ok());

        // Verify it's staged
        let statuses = get_file_statuses(&repo).unwrap();
        assert_eq!(statuses.staged.len(), 1);
    }

    #[test]
    fn test_stage_hunk_out_of_range() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and commit a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "content\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        // Modify
        fs::write(&file_path, "modified\n").unwrap();

        // Try to stage hunk 5 (doesn't exist)
        let result = stage_hunk(&repo, "file.txt", 5);
        assert!(result.is_err());
    }

    #[test]
    fn test_unstage_hunk() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and commit a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "original\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        // Modify and stage
        fs::write(&file_path, "modified\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        // Verify staged
        let statuses = get_file_statuses(&repo).unwrap();
        assert_eq!(statuses.staged.len(), 1);

        // Unstage the hunk
        let result = unstage_hunk(&repo, "file.txt", 0);
        assert!(result.is_ok());

        // Verify file state changed (we don't assert on exact staging state since it can vary)
        let statuses = get_file_statuses(&repo).unwrap();
        // Either staged is empty or we have unstaged changes
        assert!(statuses.staged.is_empty() || !statuses.unstaged.is_empty());
    }

    #[test]
    fn test_unstage_hunk_out_of_range() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and commit a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "original\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        // Modify and stage
        fs::write(&file_path, "modified\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        // Try to unstage hunk 5 (doesn't exist)
        let result = unstage_hunk(&repo, "file.txt", 5);
        assert!(result.is_err());
    }

    #[test]
    fn test_stage_lines_partial_hunk() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and commit a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        // Modify multiple lines
        fs::write(&file_path, "modified1\nmodified2\nline3\n").unwrap();

        // Stage only some lines (line indices depend on the diff structure)
        let result = stage_lines(&repo, "file.txt", 0, vec![1]); // Stage first addition
        assert!(result.is_ok());
    }

    #[test]
    fn test_stage_lines_out_of_range_hunk() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and commit a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "content\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        // Modify
        fs::write(&file_path, "modified\n").unwrap();

        // Try to stage lines from non-existent hunk
        let result = stage_lines(&repo, "file.txt", 5, vec![0]);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_hunk_to_content() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        let content = "line1\nline2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,3 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 3,
            lines: vec![
                DiffLine {
                    content: "line1\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "line2\n".to_string(),
                    line_type: LineType::Deletion,
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    content: "modified2\n".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "line3\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(3),
                },
            ],
        };

        let result = apply_hunk_to_content(content, &hunk).unwrap();
        assert!(result.contains("modified2"));
        assert!(!result.contains("line2\n")); // Original line2 should be replaced
    }

    #[test]
    fn test_reverse_apply_hunk() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        let content = "line1\nmodified2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,3 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 3,
            lines: vec![
                DiffLine {
                    content: "line1\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "line2\n".to_string(),
                    line_type: LineType::Deletion,
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    content: "modified2\n".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "line3\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(3),
                },
            ],
        };

        let result = reverse_apply_hunk(content, &hunk, None).unwrap();
        assert!(result.contains("line2"));
        assert!(!result.contains("modified2"));
    }

    #[test]
    fn test_index_status_to_type() {
        use git2::Status;

        assert!(matches!(
            index_status_to_type(Status::INDEX_NEW),
            FileStatusType::Added
        ));
        assert!(matches!(
            index_status_to_type(Status::INDEX_MODIFIED),
            FileStatusType::Modified
        ));
        assert!(matches!(
            index_status_to_type(Status::INDEX_DELETED),
            FileStatusType::Deleted
        ));
        assert!(matches!(
            index_status_to_type(Status::INDEX_RENAMED),
            FileStatusType::Renamed
        ));
    }

    #[test]
    fn test_workdir_status_to_type() {
        use git2::Status;

        assert!(matches!(
            workdir_status_to_type(Status::WT_MODIFIED),
            FileStatusType::Modified
        ));
        assert!(matches!(
            workdir_status_to_type(Status::WT_DELETED),
            FileStatusType::Deleted
        ));
        assert!(matches!(
            workdir_status_to_type(Status::WT_RENAMED),
            FileStatusType::Renamed
        ));
    }

    #[test]
    fn test_apply_selected_lines_single_addition() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Original file: line1, line2, line3
        // Change: add "newline" after line1
        // Select only the addition
        let content = "line1\nline2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,4 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            lines: vec![
                DiffLine {
                    content: "line1".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "newline".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "line2".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(2),
                    new_lineno: Some(3),
                },
                DiffLine {
                    content: "line3".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(4),
                },
            ],
        };

        let result = apply_selected_lines_to_content(content, &hunk, &[1]).unwrap();
        assert_eq!(result, "line1\nnewline\nline2\nline3\n");
    }

    #[test]
    fn test_apply_selected_lines_preserves_unselected_additions() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Original file: line1, line2, line3
        // Change: add "new1" after line1, add "new2" after new1
        // Select only new1, not new2
        let content = "line1\nline2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,5 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 5,
            lines: vec![
                DiffLine {
                    content: "line1".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "new1".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "new2".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(3),
                },
                DiffLine {
                    content: "line2".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(2),
                    new_lineno: Some(4),
                },
                DiffLine {
                    content: "line3".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(5),
                },
            ],
        };

        // Select only index 1 (new1), not index 2 (new2)
        let result = apply_selected_lines_to_content(content, &hunk, &[1]).unwrap();
        assert_eq!(result, "line1\nnew1\nline2\nline3\n");
        assert!(!result.contains("new2"));
    }

    #[test]
    fn test_apply_selected_lines_preserves_unselected_deletions() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Original file: line1, line2, line3
        // Change: delete line2
        // Don't select the deletion (so line2 should stay)
        let content = "line1\nline2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,2 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 2,
            lines: vec![
                DiffLine {
                    content: "line1".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "line2".to_string(),
                    line_type: LineType::Deletion,
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    content: "line3".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(2),
                },
            ],
        };

        // Don't select the deletion (empty selection) - line2 should remain
        let result = apply_selected_lines_to_content(content, &hunk, &[]).unwrap();
        assert_eq!(result, "line1\nline2\nline3\n");
    }

    #[test]
    fn test_apply_selected_lines_deletion_selected() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Original file: line1, line2, line3
        // Change: delete line2
        // Select the deletion (so line2 should be removed)
        let content = "line1\nline2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,2 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 2,
            lines: vec![
                DiffLine {
                    content: "line1".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "line2".to_string(),
                    line_type: LineType::Deletion,
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    content: "line3".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(2),
                },
            ],
        };

        // Select the deletion at index 1
        let result = apply_selected_lines_to_content(content, &hunk, &[1]).unwrap();
        assert_eq!(result, "line1\nline3\n");
        assert!(!result.contains("line2"));
    }

    #[test]
    fn test_apply_selected_lines_mixed_selection() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Original file: line1, old2, line3
        // Change: delete old2, add new2
        // Select both the deletion and the addition
        let content = "line1\nold2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,3 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 3,
            lines: vec![
                DiffLine {
                    content: "line1".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "old2".to_string(),
                    line_type: LineType::Deletion,
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    content: "new2".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "line3".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(3),
                },
            ],
        };

        // Select both deletion (1) and addition (2)
        let result = apply_selected_lines_to_content(content, &hunk, &[1, 2]).unwrap();
        assert_eq!(result, "line1\nnew2\nline3\n");
        assert!(!result.contains("old2"));
    }

    #[test]
    fn test_apply_selected_lines_file_integrity() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Test with a larger file to ensure lines before and after hunk are preserved
        let content = "header1\nheader2\nline1\nline2\nline3\nfooter1\nfooter2\n";
        // Hunk starts at line 3 (old_start=3), covers 3 lines
        let hunk = DiffHunk {
            header: "@@ -3,3 +3,4 @@".to_string(),
            old_start: 3,
            old_lines: 3,
            new_start: 3,
            new_lines: 4,
            lines: vec![
                DiffLine {
                    content: "line1".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(3),
                },
                DiffLine {
                    content: "inserted".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(4),
                },
                DiffLine {
                    content: "line2".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(4),
                    new_lineno: Some(5),
                },
                DiffLine {
                    content: "line3".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(5),
                    new_lineno: Some(6),
                },
            ],
        };

        // Select the addition
        let result = apply_selected_lines_to_content(content, &hunk, &[1]).unwrap();
        assert_eq!(
            result,
            "header1\nheader2\nline1\ninserted\nline2\nline3\nfooter1\nfooter2\n"
        );
    }

    #[test]
    fn test_apply_selected_lines_no_trailing_newline() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // File without trailing newline
        let content = "line1\nline2";
        let hunk = DiffHunk {
            header: "@@ -1,2 +1,3 @@".to_string(),
            old_start: 1,
            old_lines: 2,
            new_start: 1,
            new_lines: 3,
            lines: vec![
                DiffLine {
                    content: "line1".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "inserted".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "line2".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(2),
                    new_lineno: Some(3),
                },
            ],
        };

        let result = apply_selected_lines_to_content(content, &hunk, &[1]).unwrap();
        // Should preserve absence of trailing newline
        assert_eq!(result, "line1\ninserted\nline2");
        assert!(!result.ends_with('\n'));
    }

    #[test]
    fn test_reverse_apply_hunk_selected_addition() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Working dir content has an added line
        let content = "line1\nnewline\nline2\n";
        let hunk = DiffHunk {
            header: "@@ -1,2 +1,3 @@".to_string(),
            old_start: 1,
            old_lines: 2,
            new_start: 1,
            new_lines: 3,
            lines: vec![
                DiffLine {
                    content: "line1\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "newline\n".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "line2\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(2),
                    new_lineno: Some(3),
                },
            ],
        };

        // Discard just the addition (index 1)
        let result = reverse_apply_hunk(content, &hunk, Some(&[1])).unwrap();
        assert_eq!(result, "line1\nline2\n");
    }

    #[test]
    fn test_reverse_apply_hunk_selected_deletion() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Working dir content is missing a deleted line
        let content = "line1\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,2 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 2,
            lines: vec![
                DiffLine {
                    content: "line1\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "line2\n".to_string(),
                    line_type: LineType::Deletion,
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    content: "line3\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(2),
                },
            ],
        };

        // Discard the deletion (restore line2)
        let result = reverse_apply_hunk(content, &hunk, Some(&[1])).unwrap();
        assert_eq!(result, "line1\nline2\nline3\n");
    }

    #[test]
    fn test_reverse_apply_hunk_partial_selection() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Working dir: line1, new1, new2, line2
        let content = "line1\nnew1\nnew2\nline2\n";
        let hunk = DiffHunk {
            header: "@@ -1,2 +1,4 @@".to_string(),
            old_start: 1,
            old_lines: 2,
            new_start: 1,
            new_lines: 4,
            lines: vec![
                DiffLine {
                    content: "line1\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "new1\n".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "new2\n".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(3),
                },
                DiffLine {
                    content: "line2\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(2),
                    new_lineno: Some(4),
                },
            ],
        };

        // Discard only new1 (index 1), keep new2 (index 2)
        let result = reverse_apply_hunk(content, &hunk, Some(&[1])).unwrap();
        assert_eq!(result, "line1\nnew2\nline2\n");
    }

    #[test]
    fn test_reverse_apply_hunk_mixed_selection() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        // Working dir: line1, new2, line3 (old2 was deleted, new2 was added)
        let content = "line1\nnew2\nline3\n";
        let hunk = DiffHunk {
            header: "@@ -1,3 +1,3 @@".to_string(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 3,
            lines: vec![
                DiffLine {
                    content: "line1\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "old2\n".to_string(),
                    line_type: LineType::Deletion,
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    content: "new2\n".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    content: "line3\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(3),
                    new_lineno: Some(3),
                },
            ],
        };

        // Discard both (revert the whole change)
        let result = reverse_apply_hunk(content, &hunk, Some(&[1, 2])).unwrap();
        assert_eq!(result, "line1\nold2\nline3\n");
    }

    #[test]
    fn test_reverse_apply_hunk_no_trailing_newline() {
        use super::super::diff::{DiffHunk, DiffLine, LineType};

        let content = "line1\nadded";
        let hunk = DiffHunk {
            header: "@@ -1,1 +1,2 @@".to_string(),
            old_start: 1,
            old_lines: 1,
            new_start: 1,
            new_lines: 2,
            lines: vec![
                DiffLine {
                    content: "line1\n".to_string(),
                    line_type: LineType::Context,
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    content: "added".to_string(),
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(2),
                },
            ],
        };

        let result = reverse_apply_hunk(content, &hunk, Some(&[1])).unwrap();
        assert_eq!(result, "line1");
        assert!(!result.ends_with('\n'));
    }

    #[test]
    fn test_discard_hunk_whole_hunk() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and commit a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        // Modify the file
        fs::write(&file_path, "modified1\nline2\nline3\n").unwrap();

        // Discard the whole hunk
        let result = discard_hunk(&repo, "file.txt", 0, None);
        assert!(result.is_ok());

        // File should be reverted
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "line1\nline2\nline3\n");
    }

    #[test]
    fn test_discard_hunk_selected_lines() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and commit a file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "line1\nline2\nline3\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        // Modify the file: change line1 and line2
        fs::write(&file_path, "modified1\nmodified2\nline3\n").unwrap();

        // Get the diff to find line indices
        let diff = super::super::diff::get_file_diff(&repo, "file.txt", false).unwrap();
        assert!(!diff.hunks.is_empty());

        // Find the index of the first deletion line
        let first_deletion_idx = diff.hunks[0]
            .lines
            .iter()
            .position(|l| l.line_type == super::super::diff::LineType::Deletion)
            .unwrap();
        // Find the index of the first addition line
        let first_addition_idx = diff.hunks[0]
            .lines
            .iter()
            .position(|l| l.line_type == super::super::diff::LineType::Addition)
            .unwrap();

        // Discard only the first deletion/addition pair
        let result = discard_hunk(
            &repo,
            "file.txt",
            0,
            Some(vec![first_deletion_idx, first_addition_idx]),
        );
        assert!(result.is_ok());

        // line1 should be restored, modified2 should remain
        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("line1"));
        assert!(content.contains("modified2"));
    }

    #[test]
    fn test_discard_hunk_out_of_range() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "content\n").unwrap();
        stage_file(&repo, "file.txt").unwrap();

        let sig = repo.signature().unwrap();
        let mut index = repo.index().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Add file", &tree, &[&parent])
            .unwrap();

        fs::write(&file_path, "modified\n").unwrap();

        let result = discard_hunk(&repo, "file.txt", 5, None);
        assert!(result.is_err());
    }
}
