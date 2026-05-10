use std::path::{Path, PathBuf};

use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

/// Resolve a frontend-supplied repo-relative path to an absolute path inside
/// the working directory, rejecting any input that would escape it.
///
/// The function canonicalizes the parent directory (which must exist) and
/// re-attaches the basename, then verifies the result is still under the
/// workdir's canonical path. This catches `..`, absolute paths, and symlink
/// escapes via the parent. The target file itself is allowed to not exist —
/// callers like `delete_file` need to surface a real `Io::NotFound` when the
/// frontend asks to delete an already-gone file.
fn resolve_repo_path(workdir: &Path, user_path: &str) -> Result<PathBuf, AppError> {
    let workdir_canonical = workdir
        .canonicalize()
        .map_err(|e| AppError::InvalidPath(format!("Cannot canonicalize workdir: {e}")))?;

    let requested = workdir.join(user_path);
    let parent = requested
        .parent()
        .ok_or_else(|| AppError::InvalidPath(format!("Path has no parent: {user_path}")))?;
    let basename = requested
        .file_name()
        .ok_or_else(|| AppError::InvalidPath(format!("Path has no file name: {user_path}")))?;
    let parent_canonical = parent
        .canonicalize()
        .map_err(|e| AppError::InvalidPath(format!("Cannot resolve '{user_path}': {e}")))?;
    let resolved = parent_canonical.join(basename);

    if !resolved.starts_with(&workdir_canonical) {
        return Err(AppError::InvalidPath(format!(
            "Path '{user_path}' escapes the repository working directory"
        )));
    }

    Ok(resolved)
}

#[tauri::command]
pub async fn get_file_statuses(state: State<'_, AppState>) -> Result<git::FileStatuses, AppError> {
    let repository = state.repository.clone();
    tokio::task::spawn_blocking(move || {
        let guard = repository.lock();
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        git::get_file_statuses(repo)
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub fn stage_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::stage_file(&repo, &path)
}

#[tauri::command]
pub fn unstage_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::unstage_file(&repo, &path)
}

#[tauri::command]
pub fn stage_files(paths: Vec<String>, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::stage_files(&repo, &paths)
}

#[tauri::command]
pub fn unstage_files(paths: Vec<String>, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::unstage_files(&repo, &paths)
}

#[tauri::command]
pub fn stage_hunk(path: String, hunk_index: usize, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::stage_hunk(&repo, &path, hunk_index)
}

#[tauri::command]
pub fn unstage_hunk(
    path: String,
    hunk_index: usize,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::unstage_hunk(&repo, &path, hunk_index)
}

#[tauri::command]
pub fn stage_lines(
    path: String,
    hunk_index: usize,
    line_indices: Vec<usize>,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::stage_lines(&repo, &path, hunk_index, line_indices)
}

#[tauri::command]
pub fn discard_hunk(
    path: String,
    hunk_index: usize,
    line_indices: Option<Vec<usize>>,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::discard_hunk(&repo, &path, hunk_index, line_indices)
}

#[tauri::command]
pub fn revert_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    // Checkout the file from HEAD to discard changes
    let head = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok())
        .ok_or_else(|| AppError::InvalidPath("Cannot revert: no commits yet".to_string()))?;
    repo.checkout_tree(
        head.as_object(),
        Some(git2::build::CheckoutBuilder::new().force().path(&path)),
    )?;
    Ok(())
}

#[tauri::command]
pub fn revert_commit(hash: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::revert_commit(&repo, &hash)
}

#[tauri::command]
pub fn revert_commit_file(
    hash: String,
    path: String,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::revert_commit_file(&repo, &hash, &path)
}

#[tauri::command]
pub fn revert_commit_file_lines(
    hash: String,
    path: String,
    hunk_index: usize,
    line_indices: Vec<usize>,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    git::revert_commit_file_lines(&repo, &hash, &path, hunk_index, line_indices)
}

#[tauri::command]
pub fn delete_file(path: String, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    let workdir = repo
        .workdir()
        .ok_or(AppError::InvalidPath("No working directory".to_string()))?;
    let file_path = resolve_repo_path(workdir, &path)?;
    std::fs::remove_file(file_path)?;
    Ok(())
}

#[tauri::command]
pub fn delete_files(paths: Vec<String>, state: State<AppState>) -> Result<(), AppError> {
    let repo = state.get_repo()?;

    let workdir = repo
        .workdir()
        .ok_or(AppError::InvalidPath("No working directory".to_string()))?;
    for path in &paths {
        let resolved = resolve_repo_path(workdir, path)?;
        std::fs::remove_file(resolved)?;
    }
    Ok(())
}

#[tauri::command]
pub fn resolve_conflict(
    path: String,
    strategy: String,
    state: State<AppState>,
) -> Result<(), AppError> {
    let repo = state.get_repo()?;
    git::resolve_conflict(&repo, &path, &strategy)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use crate::test_utils::*;
    use git2::Repository;

    use std::fs;

    #[test]
    fn test_get_file_statuses_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create an untracked file
        let file_path = temp_dir.path().join("untracked.txt");
        fs::write(&file_path, "untracked").unwrap();

        let result = git::get_file_statuses(&repo);
        assert!(result.is_ok());

        let statuses = result.unwrap();
        assert_eq!(statuses.untracked.len(), 1);
    }

    #[test]
    fn test_stage_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create a new file
        let file_path = temp_dir.path().join("new.txt");
        fs::write(&file_path, "new content").unwrap();

        let result = git::stage_file(&repo, "new.txt");
        assert!(result.is_ok());

        // Verify it's staged
        let statuses = git::get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.iter().any(|s| s.path == "new.txt"));
    }

    #[test]
    fn test_unstage_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create and stage a file
        let file_path = temp_dir.path().join("staged.txt");
        fs::write(&file_path, "staged").unwrap();

        git::stage_file(&repo, "staged.txt").unwrap();

        // Verify it's staged
        let statuses = git::get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.iter().any(|s| s.path == "staged.txt"));

        // Unstage it
        let result = git::unstage_file(&repo, "staged.txt");
        assert!(result.is_ok());

        // Verify it's unstaged
        let statuses = git::get_file_statuses(&repo).unwrap();
        assert!(statuses.staged.is_empty());
    }

    #[test]
    fn test_revert_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Modify the file
        let file_path = temp_dir.path().join("initial.txt");
        fs::write(&file_path, "modified content").unwrap();

        // Verify it's modified
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "modified content");

        // Revert it
        let head = repo.head().unwrap().peel_to_tree().unwrap();
        repo.checkout_tree(
            head.as_object(),
            Some(
                git2::build::CheckoutBuilder::new()
                    .force()
                    .path("initial.txt"),
            ),
        )
        .unwrap();

        // Verify content is reverted
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "initial content");
    }

    #[test]
    fn test_delete_file_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        // Create a file to delete
        let file_path = temp_dir.path().join("to_delete.txt");
        fs::write(&file_path, "delete me").unwrap();

        assert!(file_path.exists());

        // Delete it
        let workdir = repo.workdir().unwrap();
        let full_path = workdir.join("to_delete.txt");
        fs::remove_file(full_path).unwrap();

        assert!(!file_path.exists());
    }

    #[test]
    fn test_delete_files_logic() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);

        let names = ["a.txt", "b.txt", "c.txt"];
        for name in &names {
            fs::write(temp_dir.path().join(name), "content").unwrap();
        }
        for name in &names {
            assert!(temp_dir.path().join(name).exists());
        }

        let workdir = repo.workdir().unwrap();
        for name in &names {
            fs::remove_file(workdir.join(name)).unwrap();
        }

        for name in &names {
            assert!(!temp_dir.path().join(name).exists());
        }
    }

    #[test]
    fn test_revert_file_empty_repo() {
        let (temp_dir, _repo) = create_test_repo();

        // Create a file in an empty repo (no commits)
        let file_path = temp_dir.path().join("new.txt");
        fs::write(&file_path, "hello\n").unwrap();

        // Open repo fresh to simulate the command handler
        let repo = Repository::open(temp_dir.path()).unwrap();

        // Reverting should fail with a descriptive error, not a cryptic git2 crash
        let head_result = repo.head();
        assert!(head_result.is_err() || repo.head().unwrap().peel_to_tree().is_err());

        // The actual revert_file command logic: repo.head()?.peel_to_tree()?
        // should produce an error containing "no commits yet"
        let result: Result<(), AppError> = (|| {
            let head = repo
                .head()
                .ok()
                .and_then(|h| h.peel_to_tree().ok())
                .ok_or_else(|| {
                    AppError::InvalidPath("Cannot revert: no commits yet".to_string())
                })?;
            repo.checkout_tree(
                head.as_object(),
                Some(git2::build::CheckoutBuilder::new().force().path("new.txt")),
            )?;
            Ok(())
        })();

        // For now, test the expected behavior: error with descriptive message
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("no commits yet"),
            "Expected 'no commits yet' in error, got: {}",
            err_msg
        );
    }

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

        let repo_lock = state.repository.lock();
        let result: Result<&Repository, AppError> =
            repo_lock.as_ref().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }

    // ---------------------------------------------------------------------
    // SECURITY: delete_file / delete_files path-traversal regression guards
    //
    // These tests guard against the path-traversal vulnerability discovered
    // and closed during the uiRedesign pre-merge audit. Before the fix, both
    // delete_file (line 138) and delete_files (line 150) constructed the
    // target as `workdir.join(user_input)` + std::fs::remove_file, so a
    // relative `../sentinel.txt` or absolute `/tmp/marker` would delete
    // files outside the working directory. The fix routes both commands
    // through `resolve_repo_path`, which canonicalizes the parent dir and
    // verifies the resolved path is still under workdir.
    //
    // The wrappers below mirror the production functions exactly (calling
    // `resolve_repo_path` then `remove_file`) so we can exercise the
    // security-relevant code path without spinning up a Tauri runtime.
    // ---------------------------------------------------------------------

    /// Mirror of `delete_files` (the production fn at line 149) for tests
    /// that don't have an `AppState`. Must stay in sync.
    fn delete_files_logic(repo: &Repository, paths: &[String]) -> Result<(), AppError> {
        let workdir = repo
            .workdir()
            .ok_or(AppError::InvalidPath("No working directory".to_string()))?;
        for path in paths {
            let resolved = resolve_repo_path(workdir, path)?;
            std::fs::remove_file(resolved)?;
        }
        Ok(())
    }

    #[test]
    fn delete_files_rejects_relative_path_traversal() {
        // Set up: an outer temp dir contains both the repo and a sentinel file.
        // The frontend passes "../sentinel.txt" — workdir.join() resolves it
        // *outside* the repo, and remove_file deletes the sentinel.
        let outer = tempfile::tempdir().unwrap();
        let sentinel = outer.path().join("sentinel.txt");
        fs::write(&sentinel, "MUST NOT BE DELETED").unwrap();
        assert!(sentinel.exists());

        let repo_path = outer.path().join("repo");
        fs::create_dir(&repo_path).unwrap();
        let repo = Repository::init(&repo_path).unwrap();

        let result = delete_files_logic(&repo, &["../sentinel.txt".to_string()]);

        // After the fix: the command refuses to traverse outside workdir,
        // returns InvalidPath, and the sentinel survives.
        assert!(
            matches!(result, Err(AppError::InvalidPath(_))),
            "expected InvalidPath rejection, got {result:?}"
        );
        assert!(
            sentinel.exists(),
            "REGRESSION: delete_files deleted a file outside repo workdir via '../' traversal"
        );
    }

    #[test]
    fn delete_files_rejects_absolute_paths() {
        // Path::join with an absolute path *replaces* the base entirely.
        // So workdir.join("/tmp/marker") becomes "/tmp/marker".
        let outer = tempfile::tempdir().unwrap();
        let abs_marker = outer.path().join("abs_marker.txt");
        fs::write(&abs_marker, "MUST NOT BE DELETED").unwrap();

        let repo_path = outer.path().join("repo");
        fs::create_dir(&repo_path).unwrap();
        let repo = Repository::init(&repo_path).unwrap();

        let result =
            delete_files_logic(&repo, &[abs_marker.to_string_lossy().into_owned()]);

        assert!(
            matches!(result, Err(AppError::InvalidPath(_))),
            "expected InvalidPath rejection, got {result:?}"
        );
        assert!(
            abs_marker.exists(),
            "REGRESSION: delete_files accepted an absolute path and deleted a file outside the repo"
        );
    }

    #[test]
    fn delete_files_rejects_symlink_escape() {
        // Defense-in-depth: a symlink inside the repo pointing outside.
        // Rust's std::fs::remove_file unlinks the symlink itself rather than
        // following it, so the target outside survives even without the
        // resolve_repo_path check. This test catches a future regression
        // where the implementation switches to fs::canonicalize+remove or
        // fs::remove_dir_all (either of which would follow the link).
        // (Skipped on platforms without symlink support — Linux/macOS only.)
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;

            let outer = tempfile::tempdir().unwrap();
            let target = outer.path().join("symlink_target.txt");
            fs::write(&target, "MUST NOT BE DELETED").unwrap();

            let repo_path = outer.path().join("repo");
            fs::create_dir(&repo_path).unwrap();
            let repo = Repository::init(&repo_path).unwrap();

            let link_inside_repo = repo_path.join("link_to_target");
            symlink(&target, &link_inside_repo).unwrap();

            let _ = delete_files_logic(&repo, &["link_to_target".to_string()]);

            assert!(
                target.exists(),
                "REGRESSION: delete_files followed a symlink and deleted a file outside the repo"
            );
        }
    }

    /// Mirror of `delete_file` (the production fn at line 138) for tests
    /// that don't have an `AppState`. Must stay in sync.
    fn delete_file_logic(repo: &Repository, path: &str) -> Result<(), AppError> {
        let workdir = repo
            .workdir()
            .ok_or(AppError::InvalidPath("No working directory".to_string()))?;
        let file_path = resolve_repo_path(workdir, path)?;
        std::fs::remove_file(file_path)?;
        Ok(())
    }

    /// Mirror of `discard_hunk` (line 78) — exercises the wrapper.
    fn discard_hunk_logic(
        repo: &Repository,
        path: &str,
        hunk_index: usize,
        line_indices: Option<Vec<usize>>,
    ) -> Result<(), AppError> {
        git::discard_hunk(repo, path, hunk_index, line_indices)
    }

    #[test]
    fn discard_hunk_logic_returns_error_for_nonexistent_file() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        let result = discard_hunk_logic(&repo, "missing.txt", 0, None);
        assert!(result.is_err());
    }

    /// Mirror of `revert_commit_file_lines` (line 124).
    fn revert_commit_file_lines_logic(
        repo: &Repository,
        hash: &str,
        path: &str,
        hunk_index: usize,
        line_indices: Vec<usize>,
    ) -> Result<(), AppError> {
        git::revert_commit_file_lines(repo, hash, path, hunk_index, line_indices)
    }

    #[test]
    fn revert_commit_file_lines_rejects_invalid_hash() {
        let (temp_dir, repo) = create_test_repo();
        create_initial_commit(&repo, &temp_dir);
        let result = revert_commit_file_lines_logic(&repo, "deadbeef", "initial.txt", 0, vec![0]);
        assert!(result.is_err());
    }

    #[test]
    fn delete_file_rejects_relative_path_traversal() {
        let outer = tempfile::tempdir().unwrap();
        let sentinel = outer.path().join("sentinel.txt");
        fs::write(&sentinel, "MUST NOT BE DELETED").unwrap();

        let repo_path = outer.path().join("repo");
        fs::create_dir(&repo_path).unwrap();
        let repo = Repository::init(&repo_path).unwrap();

        let result = delete_file_logic(&repo, "../sentinel.txt");

        assert!(
            matches!(result, Err(AppError::InvalidPath(_))),
            "expected InvalidPath rejection, got {result:?}"
        );
        assert!(
            sentinel.exists(),
            "REGRESSION: delete_file deleted a file outside repo workdir via '../' traversal"
        );
    }
}
