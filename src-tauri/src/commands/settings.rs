use crate::error::AppError;
use std::fs;
use std::path::PathBuf;

/// Get the settings file path: <app_data_dir>/yagg/settings.json
fn settings_path() -> Result<PathBuf, AppError> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| AppError::InvalidPath("Could not determine data directory".into()))?;
    Ok(data_dir.join("yagg").join("settings.json"))
}

#[tauri::command]
pub fn read_settings() -> Result<String, AppError> {
    crate::log_cmd_debug!("read_settings");
    let path = settings_path()?;
    if !path.exists() {
        log::info!(target: "yagg::lifecycle", "settings loaded (no file, returning defaults)");
        return Ok("{}".to_string());
    }
    let body = fs::read_to_string(&path).map_err(|e| {
        log::error!(target: "yagg::error", "settings read failed path={:?} err={e}", path);
        AppError::InvalidPath(format!("Failed to read settings: {}", e))
    })?;
    log::info!(target: "yagg::lifecycle", "settings loaded bytes={}", body.len());
    Ok(body)
}

#[tauri::command]
pub fn write_settings(data: String) -> Result<(), AppError> {
    crate::log_cmd!("write_settings", bytes = data.len());
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            log::error!(target: "yagg::error", "settings create_dir failed err={e}");
            AppError::InvalidPath(format!("Failed to create settings dir: {}", e))
        })?;
    }
    fs::write(&path, &data).map_err(|e| {
        log::error!(target: "yagg::error", "settings write failed path={:?} err={e}", path);
        AppError::InvalidPath(format!("Failed to write settings: {}", e))
    })?;
    log::info!(target: "yagg::lifecycle", "settings written bytes={}", data.len());
    Ok(())
}

/// Settings JSON key that controls verbose debug logging. Stored camelCase to
/// match the rest of the frontend-written settings (autoCheckForUpdates,
/// layoutSizes, sectionExpanded, textSize, …).
const DEBUG_LOGGING_KEY: &str = "debugLoggingEnabled";

/// Read the debug-logging flag from settings.json without requiring Tauri
/// state — used by `main.rs` before the Tauri runtime starts. Returns `false`
/// for any read or parse failure (logging defaults to off).
pub fn read_debug_logging_from_disk() -> bool {
    let path = match settings_path() {
        Ok(p) => p,
        Err(_) => return false,
    };
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    serde_json::from_str::<serde_json::Value>(&content)
        .ok()
        .and_then(|v| v.get(DEBUG_LOGGING_KEY).and_then(|b| b.as_bool()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Both fs-touching tests share the real user settings file at
    // <data_dir>/yagg/settings.json. Without this lock, parallel test execution
    // can race: the read test sees an empty/partial file while the roundtrip
    // test is mid-write, and `serde_json::from_str("")` fails.
    static FS_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn test_settings_path_is_valid() {
        let path = settings_path();
        assert!(path.is_ok());
        let path = path.unwrap();
        assert!(path.ends_with("yagg/settings.json"));
    }

    #[test]
    fn test_read_settings_returns_empty_when_no_file() {
        let _guard = FS_LOCK.lock().unwrap_or_else(|e| e.into_inner());

        // This test works because the settings file likely doesn't exist in the test env
        // If it does exist, it should return valid JSON either way
        let result = read_settings();
        assert!(result.is_ok());
        let data = result.unwrap();
        // Should be valid JSON
        let parsed: Result<serde_json::Value, _> = serde_json::from_str(&data);
        assert!(parsed.is_ok());
    }

    #[test]
    fn test_write_and_read_roundtrip() {
        let _guard = FS_LOCK.lock().unwrap_or_else(|e| e.into_inner());

        let test_data = r#"{"density":"compact","theme":"dark"}"#.to_string();
        let write_result = write_settings(test_data.clone());
        assert!(write_result.is_ok());

        let read_result = read_settings();
        assert!(read_result.is_ok());
        assert_eq!(read_result.unwrap(), test_data);

        // Clean up: write back empty
        let _ = write_settings("{}".to_string());
    }
}
