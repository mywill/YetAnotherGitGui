use std::fs;
use std::io::{BufRead, BufReader};

use git2::{DiffOptions, Oid, Repository};
use serde::Serialize;

use crate::error::AppError;

/// Diff size limits. Currently hard-coded; structured for future user configuration.
pub struct DiffConfig {
    /// Max cumulative bytes of line content before remaining hunks are returned unloaded.
    pub max_diff_bytes: usize,
    /// Max file size (bytes) to read for untracked files before treating as too-large.
    pub max_file_size: u64,
}

impl Default for DiffConfig {
    fn default() -> Self {
        Self {
            max_diff_bytes: 1_048_576, // 1 MB
            max_file_size: 1_048_576,  // 1 MB
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct FileDiff {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
    pub is_binary: bool,
    pub total_lines: u32,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
    pub is_loaded: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffLine {
    pub content: String,
    pub line_type: LineType,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LineType {
    Context,
    Addition,
    Deletion,
    Header,
}

pub fn get_file_diff(repo: &Repository, path: &str, staged: bool) -> Result<FileDiff, AppError> {
    get_file_diff_with_config(repo, path, staged, &DiffConfig::default())
}

pub fn get_file_diff_with_config(
    repo: &Repository,
    path: &str,
    staged: bool,
    config: &DiffConfig,
) -> Result<FileDiff, AppError> {
    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(path);
    diff_opts.include_untracked(true);
    diff_opts.show_untracked_content(true);
    diff_opts.recurse_untracked_dirs(true);

    let diff = if staged {
        // Staged: diff between HEAD and index
        let head_tree = repo.head()?.peel_to_tree().ok();
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))?
    } else {
        // Unstaged: diff between index and workdir (includes untracked files)
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))?
    };

    let mut file_diff = FileDiff {
        path: path.to_string(),
        hunks: Vec::new(),
        is_binary: false,
        total_lines: 0,
    };

    let mut current_hunk: Option<DiffHunk> = None;
    let mut current_hunk_header: Option<String> = None;
    let mut bytes_collected: usize = 0;
    let mut budget_exceeded = false;

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        // Check if binary
        if delta.flags().contains(git2::DiffFlags::BINARY) {
            file_diff.is_binary = true;
            return true;
        }

        if let Some(hunk_info) = hunk {
            let header = String::from_utf8_lossy(hunk_info.header()).to_string();

            // Only create a new hunk if we're seeing a different hunk header
            let is_new_hunk = current_hunk_header.as_ref() != Some(&header);

            if is_new_hunk {
                // Save previous hunk if exists
                if let Some(h) = current_hunk.take() {
                    // If budget was exceeded during this hunk, it was already partially loaded
                    // but we mark the *next* hunks as unloaded
                    file_diff.hunks.push(h);
                }

                if budget_exceeded {
                    // Metadata-only hunk
                    current_hunk = Some(DiffHunk {
                        header: header.clone(),
                        old_start: hunk_info.old_start(),
                        old_lines: hunk_info.old_lines(),
                        new_start: hunk_info.new_start(),
                        new_lines: hunk_info.new_lines(),
                        lines: Vec::new(),
                        is_loaded: false,
                    });
                } else {
                    // Start new hunk with lines
                    current_hunk = Some(DiffHunk {
                        header: header.clone(),
                        old_start: hunk_info.old_start(),
                        old_lines: hunk_info.old_lines(),
                        new_start: hunk_info.new_start(),
                        new_lines: hunk_info.new_lines(),
                        lines: Vec::new(),
                        is_loaded: true,
                    });
                }
                current_hunk_header = Some(header);
            }
        }

        if let Some(ref mut hunk) = current_hunk {
            let content = String::from_utf8_lossy(line.content()).to_string();
            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                ' ' => LineType::Context,
                _ => LineType::Header,
            };

            // Always count total lines
            file_diff.total_lines += 1;

            if hunk.is_loaded {
                bytes_collected += content.len();
                hunk.lines.push(DiffLine {
                    content,
                    line_type,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                });

                if bytes_collected > config.max_diff_bytes {
                    budget_exceeded = true;
                }
            }
        }

        true
    })?;

    // Don't forget the last hunk
    if let Some(h) = current_hunk {
        file_diff.hunks.push(h);
    }

    Ok(file_diff)
}

/// Get diff for an untracked file by reading its content directly
pub fn get_untracked_file_diff(repo: &Repository, path: &str) -> Result<FileDiff, AppError> {
    get_untracked_file_diff_with_config(repo, path, &DiffConfig::default())
}

pub fn get_untracked_file_diff_with_config(
    repo: &Repository,
    path: &str,
    config: &DiffConfig,
) -> Result<FileDiff, AppError> {
    let workdir = repo
        .workdir()
        .ok_or(AppError::InvalidPath("No working directory".into()))?;
    let file_path = workdir.join(path);

    // Check file size first
    let metadata = fs::metadata(&file_path)?;
    let file_size = metadata.len();

    if file_size > config.max_file_size {
        // Large file: count lines and read only up to budget
        let file = fs::File::open(&file_path)?;
        let reader = BufReader::new(file);
        let mut diff_lines: Vec<DiffLine> = Vec::new();
        let mut bytes_collected: usize = 0;
        let mut total_line_count: u32 = 0;
        let mut budget_exceeded = false;

        for line_result in reader.lines() {
            let line_text = match line_result {
                Ok(l) => l,
                Err(_) => {
                    // Likely binary content or encoding issue
                    return Ok(FileDiff {
                        path: path.to_string(),
                        hunks: Vec::new(),
                        is_binary: true,
                        total_lines: 0,
                    });
                }
            };
            total_line_count += 1;

            if !budget_exceeded {
                let content = format!("{}\n", line_text);
                bytes_collected += content.len();
                diff_lines.push(DiffLine {
                    content,
                    line_type: LineType::Addition,
                    old_lineno: None,
                    new_lineno: Some(total_line_count),
                });
                if bytes_collected > config.max_diff_bytes {
                    budget_exceeded = true;
                }
            }
        }

        let hunk = DiffHunk {
            header: format!("@@ -0,0 +1,{} @@\n", total_line_count),
            old_start: 0,
            old_lines: 0,
            new_start: 1,
            new_lines: total_line_count,
            lines: diff_lines,
            is_loaded: !budget_exceeded,
        };

        return Ok(FileDiff {
            path: path.to_string(),
            hunks: vec![hunk],
            is_binary: false,
            total_lines: total_line_count,
        });
    }

    // Check if file is binary by looking for null bytes in first 8KB
    let content = fs::read(&file_path)?;
    let is_binary = content.iter().take(8192).any(|&b| b == 0);

    if is_binary {
        return Ok(FileDiff {
            path: path.to_string(),
            hunks: Vec::new(),
            is_binary: true,
            total_lines: 0,
        });
    }

    // Convert to string
    let text = String::from_utf8_lossy(&content);
    let lines: Vec<&str> = text.lines().collect();

    if lines.is_empty() {
        return Ok(FileDiff {
            path: path.to_string(),
            hunks: Vec::new(),
            is_binary: false,
            total_lines: 0,
        });
    }

    let total_lines = lines.len() as u32;

    // Create a single hunk with all lines as additions
    let diff_lines: Vec<DiffLine> = lines
        .iter()
        .enumerate()
        .map(|(i, line)| DiffLine {
            content: format!("{}\n", line),
            line_type: LineType::Addition,
            old_lineno: None,
            new_lineno: Some((i + 1) as u32),
        })
        .collect();

    let hunk = DiffHunk {
        header: format!("@@ -0,0 +1,{} @@\n", lines.len()),
        old_start: 0,
        old_lines: 0,
        new_start: 1,
        new_lines: lines.len() as u32,
        lines: diff_lines,
        is_loaded: true,
    };

    Ok(FileDiff {
        path: path.to_string(),
        hunks: vec![hunk],
        is_binary: false,
        total_lines,
    })
}

pub fn get_commit_file_diff(
    repo: &Repository,
    hash: &str,
    path: &str,
) -> Result<FileDiff, AppError> {
    get_commit_file_diff_with_config(repo, hash, path, &DiffConfig::default())
}

pub fn get_commit_file_diff_with_config(
    repo: &Repository,
    hash: &str,
    path: &str,
    config: &DiffConfig,
) -> Result<FileDiff, AppError> {
    let oid = Oid::from_str(hash)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(path);

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut diff_opts))?;

    let mut file_diff = FileDiff {
        path: path.to_string(),
        hunks: Vec::new(),
        is_binary: false,
        total_lines: 0,
    };

    let mut current_hunk: Option<DiffHunk> = None;
    let mut current_hunk_header: Option<String> = None;
    let mut bytes_collected: usize = 0;
    let mut budget_exceeded = false;

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        if delta.flags().contains(git2::DiffFlags::BINARY) {
            file_diff.is_binary = true;
            return true;
        }

        if let Some(hunk_info) = hunk {
            let header = String::from_utf8_lossy(hunk_info.header()).to_string();

            // Only create a new hunk if we're seeing a different hunk header
            let is_new_hunk = current_hunk_header.as_ref() != Some(&header);

            if is_new_hunk {
                if let Some(h) = current_hunk.take() {
                    file_diff.hunks.push(h);
                }

                if budget_exceeded {
                    current_hunk = Some(DiffHunk {
                        header: header.clone(),
                        old_start: hunk_info.old_start(),
                        old_lines: hunk_info.old_lines(),
                        new_start: hunk_info.new_start(),
                        new_lines: hunk_info.new_lines(),
                        lines: Vec::new(),
                        is_loaded: false,
                    });
                } else {
                    current_hunk = Some(DiffHunk {
                        header: header.clone(),
                        old_start: hunk_info.old_start(),
                        old_lines: hunk_info.old_lines(),
                        new_start: hunk_info.new_start(),
                        new_lines: hunk_info.new_lines(),
                        lines: Vec::new(),
                        is_loaded: true,
                    });
                }
                current_hunk_header = Some(header);
            }
        }

        if let Some(ref mut hunk) = current_hunk {
            let content = String::from_utf8_lossy(line.content()).to_string();
            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                ' ' => LineType::Context,
                _ => LineType::Header,
            };

            file_diff.total_lines += 1;

            if hunk.is_loaded {
                bytes_collected += content.len();
                hunk.lines.push(DiffLine {
                    content,
                    line_type,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                });

                if bytes_collected > config.max_diff_bytes {
                    budget_exceeded = true;
                }
            }
        }

        true
    })?;

    if let Some(h) = current_hunk {
        file_diff.hunks.push(h);
    }

    Ok(file_diff)
}

/// Load a single hunk's full line content (no budget limit).
pub fn get_diff_hunk(
    repo: &Repository,
    path: &str,
    staged: bool,
    hunk_index: usize,
) -> Result<DiffHunk, AppError> {
    // Re-run the diff with no budget limit
    let no_limit = DiffConfig {
        max_diff_bytes: usize::MAX,
        max_file_size: u64::MAX,
    };
    let file_diff = get_file_diff_with_config(repo, path, staged, &no_limit)?;

    file_diff
        .hunks
        .into_iter()
        .nth(hunk_index)
        .ok_or_else(|| AppError::InvalidPath(format!("Hunk index {} out of range", hunk_index)))
}

/// Load a single hunk for an untracked file (always hunk 0).
pub fn get_untracked_diff_hunk(
    repo: &Repository,
    path: &str,
    hunk_index: usize,
) -> Result<DiffHunk, AppError> {
    let no_limit = DiffConfig {
        max_diff_bytes: usize::MAX,
        max_file_size: u64::MAX,
    };
    let file_diff = get_untracked_file_diff_with_config(repo, path, &no_limit)?;

    file_diff
        .hunks
        .into_iter()
        .nth(hunk_index)
        .ok_or_else(|| AppError::InvalidPath(format!("Hunk index {} out of range", hunk_index)))
}

/// Load a single hunk from a commit file diff (no budget limit).
pub fn get_commit_diff_hunk(
    repo: &Repository,
    hash: &str,
    path: &str,
    hunk_index: usize,
) -> Result<DiffHunk, AppError> {
    let no_limit = DiffConfig {
        max_diff_bytes: usize::MAX,
        max_file_size: u64::MAX,
    };
    let file_diff = get_commit_file_diff_with_config(repo, hash, path, &no_limit)?;

    file_diff
        .hunks
        .into_iter()
        .nth(hunk_index)
        .ok_or_else(|| AppError::InvalidPath(format!("Hunk index {} out of range", hunk_index)))
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn test_get_file_diff_unstaged_modification() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "original\n", "Initial commit");

        // Modify the file (unstaged)
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified\n").unwrap();

        let diff = get_file_diff(&repo, "file.txt", false).unwrap();

        assert_eq!(diff.path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // Check that we have lines (either deletion/addition or context)
        let hunk = &diff.hunks[0];
        assert!(!hunk.lines.is_empty());
    }

    #[test]
    fn test_get_file_diff_staged_modification() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "original\n", "Initial commit");

        // Modify and stage the file
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified\n").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        let diff = get_file_diff(&repo, "file.txt", true).unwrap();

        assert_eq!(diff.path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());
    }

    #[test]
    fn test_get_file_diff_multiline_hunks() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(
            &repo,
            &temp_dir,
            "file.txt",
            "line1\nline2\nline3\nline4\nline5\n",
            "Initial commit",
        );

        // Modify multiple lines
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "line1\nmodified2\nline3\nmodified4\nline5\n").unwrap();

        let diff = get_file_diff(&repo, "file.txt", false).unwrap();

        assert!(!diff.hunks.is_empty());
        // Should have lines in the hunk
        assert!(!diff.hunks[0].lines.is_empty());
    }

    #[test]
    fn test_get_file_diff_no_changes() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Initial commit");

        // No modifications - diff should be empty
        let diff = get_file_diff(&repo, "file.txt", false).unwrap();

        assert!(diff.hunks.is_empty());
    }

    #[test]
    fn test_get_untracked_file_diff_new_file() {
        let (temp_dir, repo) = create_test_repo();

        // Create an untracked file
        let file_path = temp_dir.path().join("new_file.txt");
        fs::write(&file_path, "line1\nline2\nline3\n").unwrap();

        let diff = get_untracked_file_diff(&repo, "new_file.txt").unwrap();

        assert_eq!(diff.path, "new_file.txt");
        assert!(!diff.is_binary);
        assert_eq!(diff.hunks.len(), 1);

        // All lines should be additions
        let hunk = &diff.hunks[0];
        assert!(hunk
            .lines
            .iter()
            .all(|l| matches!(l.line_type, LineType::Addition)));
        assert_eq!(hunk.lines.len(), 3);
    }

    #[test]
    fn test_get_untracked_file_diff_empty_file() {
        let (temp_dir, repo) = create_test_repo();

        // Create an empty untracked file
        let file_path = temp_dir.path().join("empty.txt");
        fs::write(&file_path, "").unwrap();

        let diff = get_untracked_file_diff(&repo, "empty.txt").unwrap();

        assert_eq!(diff.path, "empty.txt");
        assert!(!diff.is_binary);
        assert!(diff.hunks.is_empty());
    }

    #[test]
    fn test_get_untracked_file_diff_binary_file() {
        let (temp_dir, repo) = create_test_repo();

        // Create a binary file (contains null byte)
        let file_path = temp_dir.path().join("binary.bin");
        fs::write(&file_path, b"some\x00binary\x00content").unwrap();

        let diff = get_untracked_file_diff(&repo, "binary.bin").unwrap();

        assert_eq!(diff.path, "binary.bin");
        assert!(diff.is_binary);
        assert!(diff.hunks.is_empty());
    }

    #[test]
    fn test_get_commit_file_diff_added_file() {
        let (temp_dir, repo) = create_test_repo();

        // First commit adds the file
        let oid = create_commit_with_file(
            &repo,
            &temp_dir,
            "new_file.txt",
            "content\n",
            "Add new file",
        );

        let diff = get_commit_file_diff(&repo, &oid.to_string(), "new_file.txt").unwrap();

        assert_eq!(diff.path, "new_file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // All lines should be additions (since it's a new file)
        let has_only_additions = diff.hunks[0]
            .lines
            .iter()
            .filter(|l| !matches!(l.line_type, LineType::Header))
            .all(|l| matches!(l.line_type, LineType::Addition));
        assert!(has_only_additions);
    }

    #[test]
    fn test_get_commit_file_diff_modified_file() {
        let (temp_dir, repo) = create_test_repo();

        // First commit
        create_commit_with_file(&repo, &temp_dir, "file.txt", "original\n", "Initial commit");

        // Second commit modifies the file
        let oid =
            create_commit_with_file(&repo, &temp_dir, "file.txt", "modified\n", "Modify file");

        let diff = get_commit_file_diff(&repo, &oid.to_string(), "file.txt").unwrap();

        assert_eq!(diff.path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // Should have lines in the hunk
        let hunk = &diff.hunks[0];
        assert!(!hunk.lines.is_empty());
    }

    #[test]
    fn test_get_commit_file_diff_deleted_file() {
        let (temp_dir, repo) = create_test_repo();

        // First commit
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Add file");

        // Second commit deletes the file
        let file_path = temp_dir.path().join("file.txt");
        fs::remove_file(&file_path).unwrap();

        let mut index = repo.index().unwrap();
        index.remove_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        let oid = repo
            .commit(Some("HEAD"), &sig, &sig, "Delete file", &tree, &[&parent])
            .unwrap();

        let diff = get_commit_file_diff(&repo, &oid.to_string(), "file.txt").unwrap();

        assert_eq!(diff.path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // All non-header lines should be deletions
        let has_only_deletions = diff.hunks[0]
            .lines
            .iter()
            .filter(|l| !matches!(l.line_type, LineType::Header))
            .all(|l| matches!(l.line_type, LineType::Deletion));
        assert!(has_only_deletions);
    }

    #[test]
    fn test_get_commit_file_diff_invalid_hash() {
        let (_temp_dir, repo) = create_test_repo();

        let result = get_commit_file_diff(&repo, "invalid", "file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_commit_file_diff_nonexistent_commit() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Initial commit");

        let result = get_commit_file_diff(
            &repo,
            "0000000000000000000000000000000000000000",
            "file.txt",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_diff_line_numbers() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(
            &repo,
            &temp_dir,
            "file.txt",
            "line1\nline2\nline3\n",
            "Initial commit",
        );

        // Modify line 2
        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "line1\nmodified\nline3\n").unwrap();

        let diff = get_file_diff(&repo, "file.txt", false).unwrap();

        // Check line numbers are present
        let hunk = &diff.hunks[0];
        for line in &hunk.lines {
            match line.line_type {
                LineType::Context => {
                    assert!(line.old_lineno.is_some());
                    assert!(line.new_lineno.is_some());
                }
                LineType::Addition => {
                    assert!(line.new_lineno.is_some());
                }
                LineType::Deletion => {
                    assert!(line.old_lineno.is_some());
                }
                LineType::Header => {}
            }
        }
    }

    #[test]
    fn test_diff_config_default() {
        let config = DiffConfig::default();
        assert_eq!(config.max_diff_bytes, 1_048_576);
        assert_eq!(config.max_file_size, 1_048_576);
    }

    #[test]
    fn test_small_file_no_truncation() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\nline2\n", "Initial");

        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "line1\nmodified\n").unwrap();

        let diff = get_file_diff(&repo, "file.txt", false).unwrap();

        // All hunks should be loaded
        for hunk in &diff.hunks {
            assert!(hunk.is_loaded);
            assert!(!hunk.lines.is_empty());
        }
        assert!(diff.total_lines > 0);
    }

    #[test]
    fn test_large_file_diff_truncation() {
        let (temp_dir, repo) = create_test_repo();

        // Create a file with content that will produce many diff lines
        let mut original = String::new();
        for i in 0..500 {
            original.push_str(&format!("original line {}\n", i));
        }
        create_commit_with_file(&repo, &temp_dir, "big.txt", &original, "Initial");

        // Modify every other line to create many hunks
        let mut modified = String::new();
        for i in 0..500 {
            if i % 20 == 0 {
                // Add a large block to blow through the budget
                for j in 0..200 {
                    modified.push_str(&format!("extra long modified content {} for line {} to pad the diff size significantly\n", j, i));
                }
            } else {
                modified.push_str(&format!("original line {}\n", i));
            }
        }

        let file_path = temp_dir.path().join("big.txt");
        fs::write(&file_path, &modified).unwrap();

        // Use a small budget to force truncation
        let config = DiffConfig {
            max_diff_bytes: 1024, // Very small: 1KB
            max_file_size: 1_048_576,
        };

        let diff = get_file_diff_with_config(&repo, "big.txt", false, &config).unwrap();

        assert!(!diff.hunks.is_empty());

        // Some hunks should be loaded and some not
        let loaded_count = diff.hunks.iter().filter(|h| h.is_loaded).count();
        let unloaded_count = diff.hunks.iter().filter(|h| !h.is_loaded).count();

        assert!(loaded_count > 0, "At least one hunk should be loaded");
        assert!(unloaded_count > 0, "At least one hunk should be unloaded");

        // Unloaded hunks should have empty lines
        for hunk in &diff.hunks {
            if !hunk.is_loaded {
                assert!(hunk.lines.is_empty());
            }
        }

        // total_lines should count all lines including unloaded
        let loaded_lines: u32 = diff.hunks.iter().map(|h| h.lines.len() as u32).sum();
        assert!(
            diff.total_lines > loaded_lines,
            "total_lines ({}) should be greater than loaded lines ({})",
            diff.total_lines,
            loaded_lines
        );
    }

    #[test]
    fn test_get_diff_hunk_loads_single() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\nline2\n", "Initial");

        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "line1\nmodified\n").unwrap();

        let hunk = get_diff_hunk(&repo, "file.txt", false, 0).unwrap();

        assert!(hunk.is_loaded);
        assert!(!hunk.lines.is_empty());
    }

    #[test]
    fn test_get_diff_hunk_out_of_range() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\n", "Initial");

        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified\n").unwrap();

        let result = get_diff_hunk(&repo, "file.txt", false, 99);
        assert!(result.is_err());
    }

    #[test]
    fn test_untracked_large_file() {
        let (temp_dir, repo) = create_test_repo();
        // Make an initial commit so we have a valid repo
        create_commit_with_file(&repo, &temp_dir, "init.txt", "init\n", "Initial");

        // Create a large untracked file
        let mut content = String::new();
        for i in 0..10000 {
            content.push_str(&format!(
                "line number {} with some extra content to pad it\n",
                i
            ));
        }

        let file_path = temp_dir.path().join("large_untracked.txt");
        fs::write(&file_path, &content).unwrap();

        // Use a small budget
        let config = DiffConfig {
            max_diff_bytes: 512,
            max_file_size: 100, // Very small so it triggers the large file path
        };

        let diff =
            get_untracked_file_diff_with_config(&repo, "large_untracked.txt", &config).unwrap();

        assert!(!diff.is_binary);
        assert_eq!(diff.hunks.len(), 1);

        let hunk = &diff.hunks[0];
        // With such a small budget, the hunk should not be fully loaded
        assert!(!hunk.is_loaded);
        // But lines up to the budget should be present
        assert!(!hunk.lines.is_empty());
        // total_lines should reflect all lines in the file
        assert_eq!(diff.total_lines, 10000);
    }

    #[test]
    fn test_commit_diff_truncation() {
        let (temp_dir, repo) = create_test_repo();

        // Create initial file
        let mut original = String::new();
        for i in 0..200 {
            original.push_str(&format!("original line {}\n", i));
        }
        create_commit_with_file(&repo, &temp_dir, "big.txt", &original, "Initial");

        // Create commit with large modifications
        let mut modified = String::new();
        for i in 0..200 {
            if i % 10 == 0 {
                for j in 0..50 {
                    modified.push_str(&format!("added content {} for block {}\n", j, i));
                }
            } else {
                modified.push_str(&format!("original line {}\n", i));
            }
        }
        let oid = create_commit_with_file(&repo, &temp_dir, "big.txt", &modified, "Big change");

        let config = DiffConfig {
            max_diff_bytes: 512,
            max_file_size: 1_048_576,
        };

        let diff =
            get_commit_file_diff_with_config(&repo, &oid.to_string(), "big.txt", &config).unwrap();

        assert!(!diff.hunks.is_empty());

        let has_unloaded = diff.hunks.iter().any(|h| !h.is_loaded);
        assert!(
            has_unloaded,
            "Should have some unloaded hunks with small budget"
        );
    }

    #[test]
    fn test_get_commit_diff_hunk_loads_single() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Add file");

        let hunk = get_commit_diff_hunk(&repo, &oid.to_string(), "file.txt", 0).unwrap();

        assert!(hunk.is_loaded);
        assert!(!hunk.lines.is_empty());
    }
}
