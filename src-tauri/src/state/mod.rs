use git2::Repository;
use parking_lot::Mutex;

pub struct AppState {
    pub repository: Mutex<Option<Repository>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            repository: Mutex::new(None),
        }
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
            let _lock1 = state.repository.lock();
        }
        {
            let _lock2 = state.repository.lock();
        }
        // If we get here, mutex works correctly
        assert!(true);
    }
}
