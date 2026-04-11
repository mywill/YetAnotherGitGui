use std::sync::Arc;

use git2::Repository;
use parking_lot::{MappedMutexGuard, Mutex, MutexGuard};

use crate::error::AppError;
use crate::terminal::TerminalManager;

pub struct AppState {
    /// `Arc<Mutex<...>>` so async commands can `clone()` the handle and move
    /// it into `tokio::task::spawn_blocking`, keeping blocking git work off
    /// the async runtime without holding the mutex across `.await`.
    pub repository: Arc<Mutex<Option<Repository>>>,
    pub terminal_manager: TerminalManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            repository: Arc::new(Mutex::new(None)),
            terminal_manager: TerminalManager::new(),
        }
    }

    pub fn get_repo(&self) -> Result<MappedMutexGuard<'_, Repository>, AppError> {
        MutexGuard::try_map(self.repository.lock(), |opt| opt.as_mut())
            .map_err(|_| AppError::NoRepository)
    }

    pub fn get_repo_mut(&self) -> Result<MappedMutexGuard<'_, Repository>, AppError> {
        MutexGuard::try_map(self.repository.lock(), |opt| opt.as_mut())
            .map_err(|_| AppError::NoRepository)
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_new() {
        let state = AppState::new();
        let repo = state.repository.lock();
        assert!(repo.is_none());
    }

    #[test]
    fn test_app_state_default() {
        let state = AppState::default();
        let repo = state.repository.lock();
        assert!(repo.is_none());
    }

    #[test]
    fn test_app_state_mutex_is_unlocked() {
        let state = AppState::new();
        // Should be able to lock multiple times (after releasing)
        {
            let lock1 = state.repository.lock();
            assert!(lock1.is_none());
        }
        {
            let lock2 = state.repository.lock();
            assert!(lock2.is_none());
        }
    }
}
