use crate::error::AppError;

#[tauri::command]
pub fn install_cli() -> Result<String, AppError> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let exe_path = std::env::current_exe()
            .map_err(|e| AppError::InvalidPath(format!("Failed to get executable path: {}", e)))?;

        let exe_str = exe_path.to_string_lossy();
        let symlink_path = "/usr/local/bin/yagg";

        // Use osascript to get admin privileges and create symlink
        let script = format!(
            r#"do shell script "ln -sf '{}' '{}'" with administrator privileges"#,
            exe_str, symlink_path
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| AppError::InvalidPath(format!("Failed to run osascript: {}", e)))?;

        if output.status.success() {
            Ok(format!(
                "CLI installed successfully. You can now use 'yagg' from the terminal."
            ))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("User canceled") {
                Err(AppError::InvalidPath(
                    "Installation cancelled by user.".into(),
                ))
            } else {
                Err(AppError::InvalidPath(format!(
                    "Failed to install CLI: {}",
                    stderr
                )))
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err(AppError::InvalidPath(
            "CLI installation is only supported on macOS. On Linux, the CLI is automatically available after installing the .deb or .rpm package.".into()
        ))
    }
}

#[tauri::command]
pub fn check_cli_installed() -> bool {
    // Only show CLI install option on macOS
    #[cfg(target_os = "macos")]
    {
        std::path::Path::new("/usr/local/bin/yagg").exists()
    }
    #[cfg(not(target_os = "macos"))]
    {
        // Return true on non-macOS to hide the install button
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_cli_installed() {
        // This test just verifies the function runs without panicking
        // The actual result depends on the system state
        let result = check_cli_installed();
        // On Linux, this should always return true
        #[cfg(not(target_os = "macos"))]
        assert!(result);
        // On macOS, result depends on whether the symlink exists
        #[cfg(target_os = "macos")]
        {
            let _ = result; // Just verify it runs
        }
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn test_install_cli_not_macos() {
        let result = install_cli();
        assert!(result.is_err());
        match result {
            Err(AppError::InvalidPath(msg)) => {
                assert!(msg.contains("only supported on macOS"));
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }
}
