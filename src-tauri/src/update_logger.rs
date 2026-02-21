use std::io::Write;

/// Writes a timestamped entry to `<data_dir>/yagg/update.log`.
pub fn write_log(message: &str) {
    let data_dir = dirs::data_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let log_dir = data_dir.join("yagg");
    let log_path = log_dir.join("update.log");

    if std::fs::create_dir_all(&log_dir).is_err() {
        return;
    }

    let mut file = match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(f) => f,
        Err(_) => return,
    };

    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f %z");

    let _ = writeln!(file, "=== UPDATE at {timestamp} ===\n{message}\n");
}

/// Returns the path to `update.log` if the data directory can be resolved.
pub fn get_log_path() -> Option<String> {
    let data_dir = dirs::data_dir()?;
    let log_path = data_dir.join("yagg").join("update.log");
    Some(log_path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_write_log_creates_file_and_appends() {
        let data_dir =
            dirs::data_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
        let log_path = data_dir.join("yagg").join("update.log");

        // Remove the file if it exists so we start fresh
        let _ = fs::remove_file(&log_path);

        write_log("Test message one");

        let contents = fs::read_to_string(&log_path).expect("update.log should exist");
        assert!(contents.contains("=== UPDATE at"));
        assert!(contents.contains("Test message one"));

        // Write a second entry and verify append
        write_log("Test message two");

        let contents = fs::read_to_string(&log_path).expect("update.log should exist");
        assert!(contents.contains("Test message one"));
        assert!(contents.contains("Test message two"));

        // Clean up
        let _ = fs::remove_file(&log_path);
    }

    #[test]
    fn test_get_log_path_returns_some() {
        let path = get_log_path();
        // On most systems dirs::data_dir() returns Some
        if dirs::data_dir().is_some() {
            assert!(path.is_some());
            assert!(path.unwrap().contains("update.log"));
        }
    }
}
