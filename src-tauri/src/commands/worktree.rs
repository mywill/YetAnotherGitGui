use std::path::PathBuf;

use tauri::State;

use crate::error::AppError;
use crate::git;
use crate::state::AppState;

#[tauri::command]
pub async fn list_worktrees(
    state: State<'_, AppState>,
) -> Result<Vec<git::WorktreeInfo>, AppError> {
    crate::log_cmd_debug!("list_worktrees");
    let repository = state.repository.clone();
    tokio::task::spawn_blocking(move || {
        let guard = repository.lock();
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        git::list_worktrees(repo)
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub async fn add_worktree(
    name: String,
    path: String,
    branch: Option<String>,
    new_branch: Option<String>,
    commit_hash: Option<String>,
    state: State<'_, AppState>,
) -> Result<git::WorktreeInfo, AppError> {
    crate::log_cmd!(
        "add_worktree",
        name = name,
        branch = branch,
        new_branch = new_branch
    );
    let path_buf = PathBuf::from(&path);
    if path_buf.as_os_str().is_empty() {
        return Err(AppError::InvalidPath("Path is empty".to_string()));
    }
    let repository = state.repository.clone();
    tokio::task::spawn_blocking(move || {
        let guard = repository.lock();
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        git::add_worktree(
            repo,
            &name,
            &path_buf,
            branch.as_deref(),
            new_branch.as_deref(),
            commit_hash.as_deref(),
        )
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub async fn remove_worktree(
    name: String,
    force: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    crate::log_cmd!("remove_worktree", name = name, force = force);
    let repository = state.repository.clone();
    tokio::task::spawn_blocking(move || {
        let guard = repository.lock();
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        git::remove_worktree(repo, &name, force)
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub async fn move_worktree(
    name: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    crate::log_cmd!("move_worktree", name = name);
    let path_buf = PathBuf::from(&new_path);
    if path_buf.as_os_str().is_empty() {
        return Err(AppError::InvalidPath("Path is empty".to_string()));
    }
    let repository = state.repository.clone();
    tokio::task::spawn_blocking(move || {
        let guard = repository.lock();
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        git::move_worktree(repo, &name, &path_buf)
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub fn lock_worktree(
    name: String,
    reason: Option<String>,
    state: State<AppState>,
) -> Result<(), AppError> {
    crate::log_cmd!("lock_worktree", name = name);
    let repo = state.get_repo()?;
    git::lock_worktree(&repo, &name, reason.as_deref())
}

#[tauri::command]
pub fn unlock_worktree(name: String, state: State<AppState>) -> Result<(), AppError> {
    crate::log_cmd!("unlock_worktree", name = name);
    let repo = state.get_repo()?;
    git::unlock_worktree(&repo, &name)
}
