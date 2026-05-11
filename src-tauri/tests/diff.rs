//! Integration tests for diff behavior (file, untracked, commit, conflict).
//!
//! Pure-function unit tests for `DiffConfig::default` and the serde renames
//! on `LineType` stay inline in `src/git/diff.rs::tests`.

mod common;

use common::{create_commit_with_file, create_initial_commit, create_test_repo};
use std::fs;
use std::path::Path;
use yagg_lib::git::{
    self, get_commit_diff_hunk, get_commit_file_diff, get_commit_file_diff_with_config,
    get_conflicted_diff_hunk, get_conflicted_file_diff, get_diff_hunk, get_file_diff,
    get_file_diff_with_config, get_untracked_diff_hunk, get_untracked_file_diff,
    get_untracked_file_diff_with_config, DiffConfig, DiffLine, LineType,
};

// =============================================================================
// get_file_diff (4 tests)
// =============================================================================

#[test]
fn get_file_diff_unstaged_modification() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "original\n", "Initial commit");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified\n").unwrap();

    let diff = get_file_diff(&repo, "file.txt", false).unwrap();
    assert_eq!(diff.path, "file.txt");
    assert!(!diff.is_binary);
    assert!(!diff.hunks.is_empty());
    assert!(!diff.hunks[0].lines.is_empty());
}

#[test]
fn get_file_diff_staged_modification() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "original\n", "Initial commit");

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
fn get_file_diff_multiline_hunks() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(
        &repo,
        &temp_dir,
        "file.txt",
        "line1\nline2\nline3\nline4\nline5\n",
        "Initial commit",
    );
    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "line1\nmodified2\nline3\nmodified4\nline5\n").unwrap();

    let diff = get_file_diff(&repo, "file.txt", false).unwrap();
    assert!(!diff.hunks.is_empty());
    assert!(!diff.hunks[0].lines.is_empty());
}

#[test]
fn get_file_diff_no_changes() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Initial commit");

    let diff = get_file_diff(&repo, "file.txt", false).unwrap();
    assert!(diff.hunks.is_empty());
}

// =============================================================================
// get_untracked_file_diff (3 tests)
// =============================================================================

#[test]
fn get_untracked_file_diff_new_file() {
    let (temp_dir, repo) = create_test_repo();
    let file_path = temp_dir.path().join("new_file.txt");
    fs::write(&file_path, "line1\nline2\nline3\n").unwrap();

    let diff = get_untracked_file_diff(&repo, "new_file.txt").unwrap();
    assert_eq!(diff.path, "new_file.txt");
    assert!(!diff.is_binary);
    assert_eq!(diff.hunks.len(), 1);

    let hunk = &diff.hunks[0];
    assert!(hunk
        .lines
        .iter()
        .all(|l| matches!(l.line_type, LineType::Addition)));
    assert_eq!(hunk.lines.len(), 3);
}

#[test]
fn get_untracked_file_diff_empty_file() {
    let (temp_dir, repo) = create_test_repo();
    let file_path = temp_dir.path().join("empty.txt");
    fs::write(&file_path, "").unwrap();

    let diff = get_untracked_file_diff(&repo, "empty.txt").unwrap();
    assert_eq!(diff.path, "empty.txt");
    assert!(!diff.is_binary);
    assert!(diff.hunks.is_empty());
}

#[test]
fn get_untracked_file_diff_binary_file() {
    let (temp_dir, repo) = create_test_repo();
    let file_path = temp_dir.path().join("binary.bin");
    fs::write(&file_path, b"some\x00binary\x00content").unwrap();

    let diff = get_untracked_file_diff(&repo, "binary.bin").unwrap();
    assert_eq!(diff.path, "binary.bin");
    assert!(diff.is_binary);
    assert!(diff.hunks.is_empty());
}

// =============================================================================
// get_commit_file_diff (5 tests)
// =============================================================================

#[test]
fn get_commit_file_diff_added_file() {
    let (temp_dir, repo) = create_test_repo();
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

    let has_only_additions = diff.hunks[0]
        .lines
        .iter()
        .filter(|l| !matches!(l.line_type, LineType::Header))
        .all(|l| matches!(l.line_type, LineType::Addition));
    assert!(has_only_additions);
}

#[test]
fn get_commit_file_diff_modified_file() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "original\n", "Initial commit");
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "modified\n", "Modify file");

    let diff = get_commit_file_diff(&repo, &oid.to_string(), "file.txt").unwrap();
    assert_eq!(diff.path, "file.txt");
    assert!(!diff.is_binary);
    assert!(!diff.hunks.is_empty());
    assert!(!diff.hunks[0].lines.is_empty());
}

#[test]
fn get_commit_file_diff_deleted_file() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Add file");

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

    let has_only_deletions = diff.hunks[0]
        .lines
        .iter()
        .filter(|l| !matches!(l.line_type, LineType::Header))
        .all(|l| matches!(l.line_type, LineType::Deletion));
    assert!(has_only_deletions);
}

#[test]
fn get_commit_file_diff_invalid_hash() {
    let (_temp_dir, repo) = create_test_repo();
    let result = get_commit_file_diff(&repo, "invalid", "file.txt");
    assert!(result.is_err());
}

#[test]
fn get_commit_file_diff_nonexistent_commit() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Initial commit");

    let result = get_commit_file_diff(
        &repo,
        "0000000000000000000000000000000000000000",
        "file.txt",
    );
    assert!(result.is_err());
}

// =============================================================================
// Line numbers + truncation (5 tests)
// =============================================================================

#[test]
fn diff_line_numbers() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(
        &repo,
        &temp_dir,
        "file.txt",
        "line1\nline2\nline3\n",
        "Initial commit",
    );

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "line1\nmodified\nline3\n").unwrap();

    let diff = get_file_diff(&repo, "file.txt", false).unwrap();
    let hunk = &diff.hunks[0];
    for line in &hunk.lines {
        match line.line_type {
            LineType::Context => {
                assert!(line.old_lineno.is_some());
                assert!(line.new_lineno.is_some());
            }
            LineType::Addition => assert!(line.new_lineno.is_some()),
            LineType::Deletion => assert!(line.old_lineno.is_some()),
            LineType::Header
            | LineType::ConflictMarker
            | LineType::ConflictOurs
            | LineType::ConflictTheirs => {}
        }
    }
}

#[test]
fn small_file_no_truncation() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\nline2\n", "Initial");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "line1\nmodified\n").unwrap();

    let diff = get_file_diff(&repo, "file.txt", false).unwrap();
    for hunk in &diff.hunks {
        assert!(hunk.is_loaded);
        assert!(!hunk.lines.is_empty());
    }
    assert!(diff.total_lines > 0);
}

#[test]
fn large_file_diff_truncation() {
    let (temp_dir, repo) = create_test_repo();

    let mut original = String::new();
    for i in 0..500 {
        original.push_str(&format!("original line {}\n", i));
    }
    create_commit_with_file(&repo, &temp_dir, "big.txt", &original, "Initial");

    let mut modified = String::new();
    for i in 0..500 {
        if i % 20 == 0 {
            for j in 0..200 {
                modified.push_str(&format!(
                    "extra long modified content {} for line {} to pad the diff size significantly\n",
                    j, i
                ));
            }
        } else {
            modified.push_str(&format!("original line {}\n", i));
        }
    }

    let file_path = temp_dir.path().join("big.txt");
    fs::write(&file_path, &modified).unwrap();

    let config = DiffConfig {
        max_diff_bytes: 1024,
        max_file_size: 1_048_576,
    };

    let diff = get_file_diff_with_config(&repo, "big.txt", false, &config).unwrap();
    assert!(!diff.hunks.is_empty());

    let loaded_count = diff.hunks.iter().filter(|h| h.is_loaded).count();
    let unloaded_count = diff.hunks.iter().filter(|h| !h.is_loaded).count();
    assert!(loaded_count > 0, "At least one hunk should be loaded");
    assert!(unloaded_count > 0, "At least one hunk should be unloaded");

    for hunk in &diff.hunks {
        if !hunk.is_loaded {
            assert!(hunk.lines.is_empty());
        }
    }

    let loaded_lines: u32 = diff.hunks.iter().map(|h| h.lines.len() as u32).sum();
    assert!(
        diff.total_lines > loaded_lines,
        "total_lines ({}) should be greater than loaded lines ({})",
        diff.total_lines,
        loaded_lines
    );
}

#[test]
fn untracked_large_file() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "init.txt", "init\n", "Initial");

    let mut content = String::new();
    for i in 0..10000 {
        content.push_str(&format!(
            "line number {} with some extra content to pad it\n",
            i
        ));
    }

    let file_path = temp_dir.path().join("large_untracked.txt");
    fs::write(&file_path, &content).unwrap();

    let config = DiffConfig {
        max_diff_bytes: 512,
        max_file_size: 100,
    };

    let diff = get_untracked_file_diff_with_config(&repo, "large_untracked.txt", &config).unwrap();
    assert!(!diff.is_binary);
    assert_eq!(diff.hunks.len(), 1);

    let hunk = &diff.hunks[0];
    assert!(!hunk.is_loaded);
    assert!(!hunk.lines.is_empty());
    assert_eq!(diff.total_lines, 10000);
}

#[test]
fn commit_diff_truncation() {
    let (temp_dir, repo) = create_test_repo();

    let mut original = String::new();
    for i in 0..200 {
        original.push_str(&format!("original line {}\n", i));
    }
    create_commit_with_file(&repo, &temp_dir, "big.txt", &original, "Initial");

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

// =============================================================================
// get_diff_hunk single-hunk loaders (4 tests)
// =============================================================================

#[test]
fn get_diff_hunk_loads_single() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\nline2\n", "Initial");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "line1\nmodified\n").unwrap();

    let hunk = get_diff_hunk(&repo, "file.txt", false, 0).unwrap();
    assert!(hunk.is_loaded);
    assert!(!hunk.lines.is_empty());
}

#[test]
fn get_diff_hunk_out_of_range() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\n", "Initial");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified\n").unwrap();

    let result = get_diff_hunk(&repo, "file.txt", false, 99);
    assert!(result.is_err());
}

#[test]
fn get_file_diff_staged_empty_repo() {
    let (temp_dir, repo) = create_test_repo();

    let file_path = temp_dir.path().join("new.txt");
    fs::write(&file_path, "hello\nworld\n").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(Path::new("new.txt")).unwrap();
    index.write().unwrap();

    let diff = get_file_diff(&repo, "new.txt", true).unwrap();
    assert_eq!(diff.path, "new.txt");
    assert!(!diff.is_binary);
    assert!(!diff.hunks.is_empty());

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
fn get_commit_diff_hunk_loads_single() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content\n", "Add file");

    let hunk = get_commit_diff_hunk(&repo, &oid.to_string(), "file.txt", 0).unwrap();
    assert!(hunk.is_loaded);
    assert!(!hunk.lines.is_empty());
}

// =============================================================================
// Conflict diffs (8 tests)
// =============================================================================

#[test]
fn get_conflicted_file_diff_basic() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

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
    assert_eq!(diff.hunks.len(), 1);

    let hunk = &diff.hunks[0];
    assert!(hunk.is_loaded);
    assert!(hunk.header.contains("Conflict 1/1"));

    let types: Vec<&LineType> = hunk.lines.iter().map(|l| &l.line_type).collect();
    assert_eq!(types[0], &LineType::Context);
    assert_eq!(types[1], &LineType::ConflictMarker);
    assert_eq!(types[2], &LineType::ConflictOurs);
    assert_eq!(types[3], &LineType::ConflictOurs);
    assert_eq!(types[4], &LineType::ConflictMarker);
    assert_eq!(types[5], &LineType::ConflictTheirs);
    assert_eq!(types[6], &LineType::ConflictTheirs);
    assert_eq!(types[7], &LineType::ConflictMarker);
    assert_eq!(types[8], &LineType::Context);
}

#[test]
fn get_conflicted_file_diff_multiple_regions_merged() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

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
    assert_eq!(diff.hunks.len(), 1);

    let all_lines: Vec<&DiffLine> = diff.hunks.iter().flat_map(|h| &h.lines).collect();

    let marker_count = all_lines
        .iter()
        .filter(|l| l.line_type == LineType::ConflictMarker)
        .count();
    assert_eq!(marker_count, 6);

    let ours_count = all_lines
        .iter()
        .filter(|l| l.line_type == LineType::ConflictOurs)
        .count();
    assert_eq!(ours_count, 2);

    let theirs_count = all_lines
        .iter()
        .filter(|l| l.line_type == LineType::ConflictTheirs)
        .count();
    assert_eq!(theirs_count, 2);
}

#[test]
fn get_conflicted_file_diff_separate_hunks() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "base\n", "Initial");

    let file_path = temp_dir.path().join("file.txt");
    let mut content = String::new();
    content.push_str("<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> branch\n");
    for i in 0..10 {
        content.push_str(&format!("padding line {}\n", i));
    }
    content.push_str("<<<<<<< HEAD\nC\n=======\nD\n>>>>>>> branch\n");
    fs::write(&file_path, content).unwrap();

    let diff = get_conflicted_file_diff(&repo, "file.txt").unwrap();
    assert!(diff.is_conflicted);
    assert_eq!(diff.hunks.len(), 2);

    assert!(diff.hunks[0].header.contains("Conflict 1/2"));
    assert!(diff.hunks[0]
        .lines
        .iter()
        .any(|l| l.line_type == LineType::ConflictOurs));

    assert!(diff.hunks[1].header.contains("Conflict 2/2"));
    assert!(diff.hunks[1]
        .lines
        .iter()
        .any(|l| l.line_type == LineType::ConflictOurs));

    assert!(diff.hunks[0].lines.len() < 12);
    assert!(diff.hunks[1].lines.len() < 12);
}

#[test]
fn get_conflicted_file_diff_binary() {
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
fn get_conflicted_file_diff_empty() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "empty.txt", "base\n", "Initial");

    let file_path = temp_dir.path().join("empty.txt");
    fs::write(&file_path, "").unwrap();

    let diff = get_conflicted_file_diff(&repo, "empty.txt").unwrap();
    assert!(diff.is_conflicted);
    assert!(diff.hunks.is_empty());
}

#[test]
fn get_conflicted_file_diff_large_file_efficient() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "big.txt", "base\n", "Initial");

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

    let hunk = &diff.hunks[0];
    assert_eq!(hunk.lines.len(), 11);
    assert!(hunk
        .lines
        .iter()
        .any(|l| l.line_type == LineType::ConflictMarker));
    assert!(hunk.new_start >= 2998);
}

#[test]
fn get_conflicted_diff_hunk_loads() {
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
fn get_conflicted_file_diff_line_numbers() {
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
    assert_eq!(hunk.new_start, 1);
    for (i, line) in hunk.lines.iter().enumerate() {
        assert_eq!(line.new_lineno, Some(hunk.new_start + i as u32));
        assert!(line.old_lineno.is_none());
    }
}

#[test]
fn file_diff_is_conflicted_default_false() {
    let (temp_dir, repo) = create_test_repo();
    create_commit_with_file(&repo, &temp_dir, "file.txt", "line1\n", "Initial");

    let file_path = temp_dir.path().join("file.txt");
    fs::write(&file_path, "modified\n").unwrap();

    let diff = get_file_diff(&repo, "file.txt", false).unwrap();
    assert!(!diff.is_conflicted);
}

// =============================================================================
// commands/diff.rs integration tests — formerly mirrored "_logic" wrappers.
// =============================================================================

#[test]
fn commands_diff_get_file_diff_unstaged() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "modified content").unwrap();

    let result = git::get_file_diff(&repo, "initial.txt", false);
    assert!(result.is_ok());
    let diff = result.unwrap();
    assert_eq!(diff.path, "initial.txt");
}

#[test]
fn commands_diff_get_file_diff_staged() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "modified content").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(Path::new("initial.txt")).unwrap();
    index.write().unwrap();

    let result = git::get_file_diff(&repo, "initial.txt", true);
    assert!(result.is_ok());
}

#[test]
fn commands_diff_get_untracked_file_diff() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);

    let file_path = temp_dir.path().join("untracked.txt");
    fs::write(&file_path, "untracked content").unwrap();

    let result = git::get_untracked_file_diff(&repo, "untracked.txt");
    assert!(result.is_ok());
    let diff = result.unwrap();
    assert_eq!(diff.path, "untracked.txt");
}

#[test]
fn commands_diff_get_diff_hunk_routes_to_untracked() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    let file_path = temp_dir.path().join("new.txt");
    fs::write(&file_path, "a\nb\nc\n").unwrap();

    // Mirror of `get_diff_hunk`'s wrapper body — exercises the
    // is_conflicted / is_untracked routing.
    let result = get_untracked_diff_hunk(&repo, "new.txt", 0);
    assert!(
        result.is_ok(),
        "untracked routing should succeed, got {result:?}"
    );
}

#[test]
fn commands_diff_get_diff_hunk_routes_to_unstaged_when_flags_unset() {
    let (temp_dir, repo) = create_test_repo();
    create_initial_commit(&repo, &temp_dir);
    let file_path = temp_dir.path().join("initial.txt");
    fs::write(&file_path, "changed\n").unwrap();

    let result = get_diff_hunk(&repo, "initial.txt", false, 0);
    assert!(
        result.is_ok(),
        "default routing should succeed, got {result:?}"
    );
}
