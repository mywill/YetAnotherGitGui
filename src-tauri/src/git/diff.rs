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
    crate::log_git_op_debug!("get_file_diff", path = path, staged = staged);
    get_file_diff_with_config(repo, path, staged, &DiffConfig::default())
}

pub fn get_file_diff_with_config(
    repo: &Repository,
    path: &str,
    staged: bool,
    config: &DiffConfig,
) -> Result<FileDiff, AppError> {
    crate::log_git_op_debug!("get_file_diff_with_config", path = path, staged = staged);
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
    crate::log_git_op_debug!("get_untracked_file_diff", path = path);
    get_untracked_file_diff_with_config(repo, path, &DiffConfig::default())
}

pub fn get_untracked_file_diff_with_config(
    repo: &Repository,
    path: &str,
    config: &DiffConfig,
) -> Result<FileDiff, AppError> {
    crate::log_git_op_debug!("get_untracked_file_diff_with_config", path = path);
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
    crate::log_git_op_debug!("get_conflicted_file_diff", path = path);
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
    crate::log_git_op_debug!("get_conflicted_diff_hunk", path = path, hunk = hunk_index);
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
    crate::log_git_op_debug!("get_commit_file_diff", hash = hash, path = path);
    get_commit_file_diff_with_config(repo, hash, path, &DiffConfig::default())
}

pub fn get_commit_file_diff_with_config(
    repo: &Repository,
    hash: &str,
    path: &str,
    config: &DiffConfig,
) -> Result<FileDiff, AppError> {
    crate::log_git_op_debug!("get_commit_file_diff_with_config", hash = hash, path = path);
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
    crate::log_git_op_debug!(
        "get_diff_hunk",
        path = path,
        staged = staged,
        hunk = hunk_index
    );
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
    crate::log_git_op_debug!("get_untracked_diff_hunk", path = path, hunk = hunk_index);
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
    crate::log_git_op_debug!(
        "get_commit_diff_hunk",
        hash = hash,
        path = path,
        hunk = hunk_index
    );
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

    #[test]
    fn test_diff_config_default() {
        let config = DiffConfig::default();
        assert_eq!(config.max_diff_bytes, 1_048_576);
        assert_eq!(config.max_file_size, 1_048_576);
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
}
