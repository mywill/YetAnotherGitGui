use crate::error::AppError;
use crate::logger;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn get_log_dir() -> Result<String, AppError> {
    crate::log_cmd_debug!("get_log_dir");
    // Side effect: create_dir_all if missing. Intentional — the "View Logs"
    // button needs a real directory to open even before any log has been
    // written (e.g. first launch on a brand-new machine).
    let dir = logger::log_dir()
        .ok_or_else(|| AppError::InvalidPath("Could not resolve log directory".into()))?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| {
            log::error!(target: "yagg::error", "logs create_dir failed path={:?} err={e}", dir);
            AppError::InvalidPath(format!("Failed to create log dir: {e}"))
        })?;
    }
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_log_dir(app: tauri::AppHandle) -> Result<(), AppError> {
    crate::log_cmd!("open_log_dir");
    let dir = logger::log_dir()
        .ok_or_else(|| AppError::InvalidPath("Could not resolve log directory".into()))?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| {
            log::error!(target: "yagg::error", "logs create_dir failed path={:?} err={e}", dir);
            AppError::InvalidPath(format!("Failed to create log dir: {e}"))
        })?;
    }
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| {
            log::error!(target: "yagg::error", "open log dir failed: {e}");
            AppError::Internal(format!("Failed to open log directory: {e}"))
        })?;
    Ok(())
}

/// Required prefix for frontend-supplied log targets. Prevents a
/// (compromised or buggy) renderer from impersonating backend targets like
/// `yagg::cmd`, `yagg::git`, `yagg::lifecycle`, `yagg::error`.
const FE_TARGET_PREFIX: &str = "yagg::fe::";

/// Maximum bytes accepted for a single frontend log message. Caps disk usage
/// from a runaway renderer; combined with 7-day retention this still lets a
/// bug write a lot, but bounds any single record.
const FE_MESSAGE_MAX_BYTES: usize = 8 * 1024;

/// Truncate `s` at the longest UTF-8 char boundary `<= max_bytes`.
fn truncate_at_char_boundary(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

#[tauri::command]
pub fn log_from_frontend(level: String, target: String, message: String) {
    // Reject targets the frontend isn't allowed to claim. Silent drop —
    // returning Err would surface as an error toast which is exactly what
    // the logger must never do.
    if !target.starts_with(FE_TARGET_PREFIX) {
        return;
    }

    let lvl = match level.as_str() {
        "error" => log::Level::Error,
        "warn" => log::Level::Warn,
        "info" => log::Level::Info,
        "debug" => log::Level::Debug,
        "trace" => log::Level::Trace,
        _ => log::Level::Info,
    };

    let truncated = truncate_at_char_boundary(&message, FE_MESSAGE_MAX_BYTES);
    log::log!(target: &target, lvl, "{truncated}");
}

#[tauri::command]
pub fn set_debug_logging_enabled(enabled: bool) -> Result<(), AppError> {
    // Only flips the live log level. settings.json is owned by the frontend
    // (persisted via `persistDebounced`); persisting here too would just
    // race-write the same value.
    logger::set_debug_enabled(enabled);
    log::info!(target: "yagg::lifecycle", "debug logging set enabled={enabled}");
    Ok(())
}

#[tauri::command]
pub fn get_debug_logging_enabled() -> Result<bool, AppError> {
    crate::log_cmd_debug!("get_debug_logging_enabled");
    Ok(crate::commands::settings::read_debug_logging_from_disk())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_from_frontend_does_not_panic_on_unknown_level() {
        log_from_frontend(
            "bogus".to_string(),
            "yagg::fe::test".to_string(),
            "hi".to_string(),
        );
    }

    #[test]
    fn log_from_frontend_rejects_non_fe_target() {
        // Should silently drop — assertion is that it doesn't panic and
        // doesn't error. Spot-check a few targets the backend uses itself.
        for target in ["yagg::cmd", "yagg::git", "yagg::lifecycle", "yagg::error"] {
            log_from_frontend("error".into(), target.into(), "spoof".into());
        }
    }

    #[test]
    fn truncate_at_char_boundary_caps_long_strings() {
        let s = "a".repeat(20_000);
        let out = truncate_at_char_boundary(&s, FE_MESSAGE_MAX_BYTES);
        assert_eq!(out.len(), FE_MESSAGE_MAX_BYTES);
    }

    #[test]
    fn truncate_at_char_boundary_passes_short_strings_through() {
        assert_eq!(truncate_at_char_boundary("hello", 8 * 1024), "hello");
    }

    #[test]
    fn truncate_at_char_boundary_respects_utf8() {
        // 4-byte char straddling the limit must drop entirely, not split.
        // "a" * 7 + "🦀" (4 bytes) = 11 bytes, cap at 10 → "aaaaaaa" (7 bytes).
        let s = format!("{}🦀", "a".repeat(7));
        let out = truncate_at_char_boundary(&s, 10);
        assert_eq!(out, "aaaaaaa");
        // Resulting string must itself be valid UTF-8 (str slice guarantees it).
        assert!(std::str::from_utf8(out.as_bytes()).is_ok());
    }

    #[test]
    fn log_dir_resolves_under_data_dir() {
        // Pure path-resolution check — must NOT call get_log_dir() (which
        // creates the directory as a side effect against the real user data
        // dir). We assert on the underlying resolver instead.
        if let Some(dir) = logger::log_dir() {
            let s = dir.to_string_lossy();
            assert!(s.contains("yagg"));
            assert!(s.ends_with("logs"));
        }
    }
}
