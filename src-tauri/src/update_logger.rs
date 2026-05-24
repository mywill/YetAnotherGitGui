//! Auto-update logging.
//!
//! Historically wrote to a separate `<data_dir>/yagg/update.log`. The contents
//! now route through the unified per-instance logger so a user only ever has to
//! collect one file when reporting an issue. The public API is kept for
//! backward compatibility with the frontend update flow and the existing Tauri
//! commands `write_update_log` / `get_update_log_path`.

/// Records an auto-update event.
pub fn write_log(message: &str) {
    log::info!(target: "yagg::update", "{message}");
}

/// Returns the path to the current per-instance log file (where update events
/// now land). Returns `None` only if the data directory cannot be resolved.
pub fn get_log_path() -> Option<String> {
    crate::logger::current_log_path().map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_log_does_not_panic_without_init() {
        // The log facade swallows messages when no logger is installed.
        write_log("test update event");
    }

    #[test]
    fn get_log_path_returns_unified_path() {
        if let Some(p) = get_log_path() {
            assert!(p.contains("yagg"));
            assert!(p.ends_with(".log"));
        }
    }
}
