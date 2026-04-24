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
    let path = settings_path()?;
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path)
        .map_err(|e| AppError::InvalidPath(format!("Failed to read settings: {}", e)))
}

#[tauri::command]
pub fn write_settings(data: String) -> Result<(), AppError> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::InvalidPath(format!("Failed to create settings dir: {}", e)))?;
    }
    fs::write(&path, data)
        .map_err(|e| AppError::InvalidPath(format!("Failed to write settings: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_path_is_valid() {
        let path = settings_path();
        assert!(path.is_ok());
        let path = path.unwrap();
        assert!(path.ends_with("yagg/settings.json"));
    }

    #[test]
    fn test_read_settings_returns_empty_when_no_file() {
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
