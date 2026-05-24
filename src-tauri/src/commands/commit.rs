use git2::Signature;
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub fn create_commit(message: String, state: State<AppState>) -> Result<String, AppError> {
    crate::log_cmd!("create_commit", msg_len = message.len());
    let repo = state.get_repo()?;

    // Get the signature from git config
    let signature = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("Unknown", "unknown@example.com").unwrap());

    // Get the index and write it as a tree
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    // Get the parent commit (HEAD)
    let parent = if let Ok(head) = repo.head() {
        Some(head.peel_to_commit()?)
    } else {
        None
    };

    let parents: Vec<&git2::Commit> = parent.iter().collect();

    // Create the commit
    let commit_oid = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &parents,
    )?;

    Ok(commit_oid.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use git2::Repository;

    #[test]
    fn test_no_repository_error() {
        let state = AppState::new();

        let repo_lock = state.repository.lock();
        let result: Result<&Repository, AppError> =
            repo_lock.as_ref().ok_or(AppError::NoRepository);

        assert!(result.is_err());
    }
}
