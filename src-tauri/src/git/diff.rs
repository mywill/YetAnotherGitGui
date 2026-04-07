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
    #[serde(default)]
    pub is_conflicted: bool,
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
    #[serde(rename = "conflict_marker")]
    ConflictMarker,
    #[serde(rename = "conflict_ours")]
    ConflictOurs,
    #[serde(rename = "conflict_theirs")]
    ConflictTheirs,
}

struct DiffPrintCollector {
    file_diff: FileDiff,
    current_hunk: Option<DiffHunk>,
    current_hunk_header: Option<String>,
    bytes_collected: usize,
    budget_exceeded: bool,
    max_diff_bytes: usize,
}

impl DiffPrintCollector {
    fn new(path: &str, max_diff_bytes: usize) -> Self {
        Self {
            file_diff: FileDiff {
                path: path.to_string(),
                hunks: Vec::new(),
                is_binary: false,
                total_lines: 0,
                is_conflicted: false,
            },
            current_hunk: None,
            current_hunk_header: None,
            bytes_collected: 0,
            budget_exceeded: false,
            max_diff_bytes,
        }
    }

    fn handle_line(
        &mut self,
        delta: git2::DiffDelta<'_>,
        hunk: Option<git2::DiffHunk<'_>>,
        line: git2::DiffLine<'_>,
    ) -> bool {
        if delta.flags().contains(git2::DiffFlags::BINARY) {
            self.file_diff.is_binary = true;
            return true;
        }

        if let Some(hunk_info) = hunk {
            let header = String::from_utf8_lossy(hunk_info.header()).to_string();
            let is_new_hunk = self.current_hunk_header.as_ref() != Some(&header);

            if is_new_hunk {
                if let Some(h) = self.current_hunk.take() {
                    self.file_diff.hunks.push(h);
                }

                self.current_hunk = Some(DiffHunk {
                    header: header.clone(),
                    old_start: hunk_info.old_start(),
                    old_lines: hunk_info.old_lines(),
                    new_start: hunk_info.new_start(),
                    new_lines: hunk_info.new_lines(),
                    lines: Vec::new(),
                    is_loaded: !self.budget_exceeded,
                });
                self.current_hunk_header = Some(header);
            }
        }

        if let Some(ref mut hunk) = self.current_hunk {
            let content = String::from_utf8_lossy(line.content()).to_string();
            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                ' ' => LineType::Context,
                _ => LineType::Header,
            };

            self.file_diff.total_lines += 1;

            if hunk.is_loaded {
                self.bytes_collected += content.len();
                hunk.lines.push(DiffLine {
                    content,
                    line_type,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                });

                if self.bytes_collected > self.max_diff_bytes {
                    self.budget_exceeded = true;
                }
            }
        }

        true
    }

    fn finish(mut self) -> FileDiff {
        if let Some(h) = self.current_hunk.take() {
            self.file_diff.hunks.push(h);
        }
        self.file_diff
    }
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
        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))?
    } else {
        // Unstaged: diff between index and workdir (includes untracked files)
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))?
    };

    let mut collector = DiffPrintCollector::new(path, config.max_diff_bytes);
    diff.print(git2::DiffFormat::Patch, |d, h, l| {
        collector.handle_line(d, h, l)
    })?;

    Ok(collector.finish())
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
                        is_conflicted: false,
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
            is_conflicted: false,
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
            is_conflicted: false,
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
            is_conflicted: false,
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
        is_conflicted: false,
    })
}

/// State machine for parsing conflict markers in a file.
#[derive(PartialEq)]
enum ConflictParseState {
    Normal,
    InOurs,
    InTheirs,
}

/// Number of context lines to show around each conflict region.
const CONFLICT_CONTEXT_LINES: usize = 3;

/// Get diff for a conflicted file by reading the workdir copy and parsing conflict markers.
/// Returns one hunk per conflict region with surrounding context lines.
pub fn get_conflicted_file_diff(repo: &Repository, path: &str) -> Result<FileDiff, AppError> {
    let workdir = repo
        .workdir()
        .ok_or(AppError::InvalidPath("No working directory".into()))?;
    let file_path = workdir.join(path);

    // Check if file is binary by looking for null bytes in first 8KB
    let content = fs::read(&file_path)?;
    let is_binary = content.iter().take(8192).any(|&b| b == 0);

    if is_binary {
        return Ok(FileDiff {
            path: path.to_string(),
            hunks: Vec::new(),
            is_binary: true,
            total_lines: 0,
            is_conflicted: true,
        });
    }

    let text = String::from_utf8_lossy(&content);
    let lines: Vec<&str> = text.lines().collect();

    if lines.is_empty() {
        return Ok(FileDiff {
            path: path.to_string(),
            hunks: Vec::new(),
            is_binary: false,
            total_lines: 0,
            is_conflicted: true,
        });
    }

    let total_lines = lines.len();

    // First pass: find conflict region ranges (start_idx of <<<<<<< to end_idx of >>>>>>>)
    let mut regions: Vec<(usize, usize)> = Vec::new();
    let mut conflict_start: Option<usize> = None;
    let mut in_ours = false;
    for (i, line) in lines.iter().enumerate() {
        if line.starts_with("<<<<<<<") {
            conflict_start = Some(i);
            in_ours = true;
        } else if line.starts_with("=======") && in_ours {
            // still inside the same conflict
        } else if line.starts_with(">>>>>>>") && in_ours {
            if let Some(start) = conflict_start {
                regions.push((start, i));
            }
            conflict_start = None;
            in_ours = false;
        }
    }

    if regions.is_empty() {
        // No conflict markers found — return empty
        return Ok(FileDiff {
            path: path.to_string(),
            hunks: Vec::new(),
            is_binary: false,
            total_lines: total_lines as u32,
            is_conflicted: true,
        });
    }

    // Second pass: compute windows with context, merge overlapping
    let mut windows: Vec<(usize, usize)> = Vec::new();
    for &(start, end) in &regions {
        let win_start = start.saturating_sub(CONFLICT_CONTEXT_LINES);
        let win_end = (end + CONFLICT_CONTEXT_LINES).min(total_lines - 1);
        if let Some(last) = windows.last_mut() {
            if win_start <= last.1 + 1 {
                // Merge overlapping/adjacent windows
                last.1 = win_end;
                continue;
            }
        }
        windows.push((win_start, win_end));
    }

    let num_conflicts = regions.len();

    // Build one hunk per window
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut conflict_idx = 0;
    for (win_start, win_end) in &windows {
        // Count how many conflict regions are in this window
        let mut conflicts_in_window = 0;
        let first_conflict_idx = conflict_idx;
        while conflict_idx < regions.len() && regions[conflict_idx].0 <= *win_end {
            conflicts_in_window += 1;
            conflict_idx += 1;
        }

        // Build header showing conflict range
        let header = if conflicts_in_window == 1 {
            format!(
                "@@ Conflict {}/{} @@\n",
                first_conflict_idx + 1,
                num_conflicts
            )
        } else {
            format!(
                "@@ Conflicts {}–{}/{} @@\n",
                first_conflict_idx + 1,
                first_conflict_idx + conflicts_in_window,
                num_conflicts
            )
        };

        // Parse lines within the window
        let mut state = ConflictParseState::Normal;
        let mut diff_lines: Vec<DiffLine> = Vec::new();
        for (offset, line) in lines[*win_start..=*win_end].iter().enumerate() {
            let lineno = (*win_start + offset + 1) as u32;
            let line_type = if line.starts_with("<<<<<<<") {
                state = ConflictParseState::InOurs;
                LineType::ConflictMarker
            } else if line.starts_with("=======") && state == ConflictParseState::InOurs {
                state = ConflictParseState::InTheirs;
                LineType::ConflictMarker
            } else if line.starts_with(">>>>>>>") && state == ConflictParseState::InTheirs {
                state = ConflictParseState::Normal;
                LineType::ConflictMarker
            } else {
                match state {
                    ConflictParseState::InOurs => LineType::ConflictOurs,
                    ConflictParseState::InTheirs => LineType::ConflictTheirs,
                    ConflictParseState::Normal => LineType::Context,
                }
            };
            diff_lines.push(DiffLine {
                content: format!("{}\n", line),
                line_type,
                old_lineno: None,
                new_lineno: Some(lineno),
            });
        }

        let new_lines = diff_lines.len() as u32;
        hunks.push(DiffHunk {
            header,
            old_start: 0,
            old_lines: 0,
            new_start: (*win_start + 1) as u32,
            new_lines,
            lines: diff_lines,
            is_loaded: true,
        });
    }

    Ok(FileDiff {
        path: path.to_string(),
        hunks,
        is_binary: false,
        total_lines: total_lines as u32,
        is_conflicted: true,
    })
}

/// Load a single hunk for a conflicted file by index.
pub fn get_conflicted_diff_hunk(
    repo: &Repository,
    path: &str,
    hunk_index: usize,
) -> Result<DiffHunk, AppError> {
    let file_diff = get_conflicted_file_diff(repo, path)?;

    file_diff
        .hunks
        .into_iter()
        .nth(hunk_index)
        .ok_or_else(|| AppError::InvalidPath(format!("Hunk index {} out of range", hunk_index)))
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

    let mut collector = DiffPrintCollector::new(path, config.max_diff_bytes);
    diff.print(git2::DiffFormat::Patch, |d, h, l| {
        collector.handle_line(d, h, l)
    })?;

    Ok(collector.finish())
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
    use crate::test_utils::*;
    use std::path::Path;

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
                LineType::Header
                | LineType::ConflictMarker
                | LineType::ConflictOurs
                | LineType::ConflictTheirs => {}
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
    fn test_get_file_diff_staged_empty_repo() {
        let (temp_dir, repo) = create_test_repo();

        // Create and stage a file in an empty repo (no commits)
        let file_path = temp_dir.path().join("new.txt");
        fs::write(&file_path, "hello\nworld\n").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("new.txt")).unwrap();
        index.write().unwrap();

        // Getting a staged diff should work even with no HEAD
        let diff = get_file_diff(&repo, "new.txt", true).unwrap();

        assert_eq!(diff.path, "new.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // All lines should be additions since there's no HEAD to compare against
        let hunk = &diff.hunks[0];
        let non_header_lines: Vec<_> = hunk
            .lines
            .iter()
            .filter(|l| !matches!(l.line_type, LineType::Header))
            .collect();
        assert!(!non_header_lines.is_empty());
        assert!(non_header_lines
            .iter()
            .all(|l| matches!(l.line_type, LineType::Addition)));
    }

    #[test]
    fn test_get_commit_diff_hunk_loads_single() {
        let (temp_dir, repo) = create_test_repo();
        let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Add file");

        let hunk = get_commit_diff_hunk(&repo, &oid.to_string(), "file.txt", 0).unwrap();

        assert!(hunk.is_loaded);
        assert!(!hunk.lines.is_empty());
    }

    #[test]
    fn test_get_conflicted_file_diff_basic() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

        // Write a file with conflict markers (simulates a merge conflict)
        let file_path = temp_dir.path().join("file.txt");
        let conflict_content = "\
line before
<<<<<<< HEAD
ours line 1
ours line 2
=======
theirs line 1
theirs line 2
>>>>>>> branch
line after
";
        fs::write(&file_path, conflict_content).unwrap();

        let diff = get_conflicted_file_diff(&repo, "file.txt").unwrap();

        assert_eq!(diff.path, "file.txt");
        assert!(diff.is_conflicted);
        assert!(!diff.is_binary);
        // Small file: context windows cover entire file, so 1 hunk
        assert_eq!(diff.hunks.len(), 1);

        let hunk = &diff.hunks[0];
        assert!(hunk.is_loaded);
        assert!(hunk.header.contains("Conflict 1/1"));

        // Verify line types
        let types: Vec<&LineType> = hunk.lines.iter().map(|l| &l.line_type).collect();
        assert_eq!(types[0], &LineType::Context); // "line before"
        assert_eq!(types[1], &LineType::ConflictMarker); // "<<<<<<<..."
        assert_eq!(types[2], &LineType::ConflictOurs); // "ours line 1"
        assert_eq!(types[3], &LineType::ConflictOurs); // "ours line 2"
        assert_eq!(types[4], &LineType::ConflictMarker); // "======="
        assert_eq!(types[5], &LineType::ConflictTheirs); // "theirs line 1"
        assert_eq!(types[6], &LineType::ConflictTheirs); // "theirs line 2"
        assert_eq!(types[7], &LineType::ConflictMarker); // ">>>>>>>..."
        assert_eq!(types[8], &LineType::Context); // "line after"
    }

    #[test]
    fn test_get_conflicted_file_diff_multiple_regions_merged() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

        // Two conflicts close together — context windows merge into 1 hunk
        let file_path = temp_dir.path().join("file.txt");
        let content = "\
<<<<<<< HEAD
A
=======
B
>>>>>>> branch
middle
<<<<<<< HEAD
C
=======
D
>>>>>>> branch
";
        fs::write(&file_path, content).unwrap();

        let diff = get_conflicted_file_diff(&repo, "file.txt").unwrap();

        assert!(diff.is_conflicted);
        // Close together — windows overlap, so merged into 1 hunk
        assert_eq!(diff.hunks.len(), 1);

        let all_lines: Vec<&DiffLine> = diff.hunks.iter().flat_map(|h| &h.lines).collect();

        let marker_count = all_lines
            .iter()
            .filter(|l| l.line_type == LineType::ConflictMarker)
            .count();
        assert_eq!(marker_count, 6); // 3 per conflict region x 2

        let ours_count = all_lines
            .iter()
            .filter(|l| l.line_type == LineType::ConflictOurs)
            .count();
        assert_eq!(ours_count, 2); // "A" and "C"

        let theirs_count = all_lines
            .iter()
            .filter(|l| l.line_type == LineType::ConflictTheirs)
            .count();
        assert_eq!(theirs_count, 2); // "B" and "D"
    }

    #[test]
    fn test_get_conflicted_file_diff_separate_hunks() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

        // Two conflicts far apart — should produce 2 separate hunks
        let file_path = temp_dir.path().join("file.txt");
        let mut content = String::new();
        content.push_str("<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> branch\n");
        // Add 10 lines of padding (more than 2*CONFLICT_CONTEXT_LINES)
        for i in 0..10 {
            content.push_str(&format!("padding line {}\n", i));
        }
        content.push_str("<<<<<<< HEAD\nC\n=======\nD\n>>>>>>> branch\n");
        fs::write(&file_path, content).unwrap();

        let diff = get_conflicted_file_diff(&repo, "file.txt").unwrap();

        assert!(diff.is_conflicted);
        assert_eq!(diff.hunks.len(), 2);

        // First hunk: conflict 1 + context
        assert!(diff.hunks[0].header.contains("Conflict 1/2"));
        assert!(diff.hunks[0]
            .lines
            .iter()
            .any(|l| l.line_type == LineType::ConflictOurs));

        // Second hunk: conflict 2 + context
        assert!(diff.hunks[1].header.contains("Conflict 2/2"));
        assert!(diff.hunks[1]
            .lines
            .iter()
            .any(|l| l.line_type == LineType::ConflictOurs));

        // Each hunk should have much fewer lines than the full file
        assert!(diff.hunks[0].lines.len() < 12);
        assert!(diff.hunks[1].lines.len() < 12);
    }

    #[test]
    fn test_get_conflicted_file_diff_binary() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "bin.dat", "base\n", "Initial");

        let file_path = temp_dir.path().join("bin.dat");
        fs::write(&file_path, b"some\x00binary\x00content").unwrap();

        let diff = get_conflicted_file_diff(&repo, "bin.dat").unwrap();

        assert!(diff.is_binary);
        assert!(diff.is_conflicted);
        assert!(diff.hunks.is_empty());
    }

    #[test]
    fn test_get_conflicted_file_diff_empty() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "empty.txt", "base\n", "Initial");

        let file_path = temp_dir.path().join("empty.txt");
        fs::write(&file_path, "").unwrap();

        let diff = get_conflicted_file_diff(&repo, "empty.txt").unwrap();

        assert!(diff.is_conflicted);
        assert!(diff.hunks.is_empty());
    }

    #[test]
    fn test_get_conflicted_file_diff_large_file_efficient() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "big.txt", "base\n", "Initial");

        // Create a large file with 1 conflict region buried in the middle
        let mut content = String::new();
        for i in 0..3000 {
            content.push_str(&format!("prefix line {}\n", i));
        }
        content.push_str("<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n");
        for i in 0..3000 {
            content.push_str(&format!("suffix line {}\n", i));
        }

        let file_path = temp_dir.path().join("big.txt");
        fs::write(&file_path, &content).unwrap();

        let diff = get_conflicted_file_diff(&repo, "big.txt").unwrap();

        assert!(diff.is_conflicted);
        assert_eq!(diff.hunks.len(), 1);
        assert!(diff.total_lines > 6000);

        // The hunk should contain only ~11 lines (3 context + 5 conflict + 3 context)
        let hunk = &diff.hunks[0];
        assert_eq!(hunk.lines.len(), 11);
        assert!(hunk
            .lines
            .iter()
            .any(|l| l.line_type == LineType::ConflictMarker));
        // First line should be context near line 2998
        assert!(hunk.new_start >= 2998);
    }

    #[test]
    fn test_get_conflicted_diff_hunk_loads() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

        let file_path = temp_dir.path().join("file.txt");
        fs::write(
            &file_path,
            "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n",
        )
        .unwrap();

        let hunk = get_conflicted_diff_hunk(&repo, "file.txt", 0).unwrap();

        assert!(hunk.is_loaded);
        assert!(!hunk.lines.is_empty());
        assert!(hunk
            .lines
            .iter()
            .any(|l| l.line_type == LineType::ConflictMarker));
    }

    #[test]
    fn test_get_conflicted_file_diff_line_numbers() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

        let file_path = temp_dir.path().join("file.txt");
        fs::write(
            &file_path,
            "line1\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\nline7\n",
        )
        .unwrap();

        let diff = get_conflicted_file_diff(&repo, "file.txt").unwrap();

        let hunk = &diff.hunks[0];
        // All lines should have correct new_lineno based on file position
        // Small file — context covers everything, so starts at line 1
        assert_eq!(hunk.new_start, 1);
        for (i, line) in hunk.lines.iter().enumerate() {
            assert_eq!(line.new_lineno, Some(hunk.new_start + i as u32));
            assert!(line.old_lineno.is_none());
        }
    }

    #[test]
    fn test_conflicted_file_diff_serialization() {
        // Verify serde rename works correctly
        let line = DiffLine {
            content: "test".to_string(),
            line_type: LineType::ConflictMarker,
            old_lineno: None,
            new_lineno: Some(1),
        };
        let json = serde_json::to_string(&line).unwrap();
        assert!(json.contains("\"conflict_marker\""));

        let line_ours = DiffLine {
            content: "test".to_string(),
            line_type: LineType::ConflictOurs,
            old_lineno: None,
            new_lineno: Some(1),
        };
        let json = serde_json::to_string(&line_ours).unwrap();
        assert!(json.contains("\"conflict_ours\""));

        let line_theirs = DiffLine {
            content: "test".to_string(),
            line_type: LineType::ConflictTheirs,
            old_lineno: None,
            new_lineno: Some(1),
        };
        let json = serde_json::to_string(&line_theirs).unwrap();
        assert!(json.contains("\"conflict_theirs\""));
    }

    #[test]
    fn test_file_diff_is_conflicted_default_false() {
        let (temp_dir, repo) = create_test_repo();
        create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\n", "Initial");

        let file_path = temp_dir.path().join("file.txt");
        fs::write(&file_path, "modified\n").unwrap();

        let diff = get_file_diff(&repo, "file.txt", false).unwrap();
        assert!(!diff.is_conflicted);
    }
}
