use crate::error::AppError;
use crate::update_logger;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub tauri_version: String,
    pub platform: String,
    pub arch: String,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[tauri::command]
pub fn uninstall_cli() -> Result<String, AppError> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let symlink_path = "/usr/local/bin/yagg";

        if !std::path::Path::new(symlink_path).exists() {
            return Err(AppError::InvalidPath("CLI tool is not installed.".into()));
        }

        let script = format!(
            r#"do shell script "rm '{}'" with administrator privileges"#,
            symlink_path
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| AppError::InvalidPath(format!("Failed to run osascript: {}", e)))?;

        if output.status.success() {
            Ok("CLI tool uninstalled successfully.".to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("User canceled") {
                Err(AppError::InvalidPath("Uninstall cancelled by user.".into()))
            } else {
                Err(AppError::InvalidPath(format!(
                    "Failed to uninstall CLI: {}",
                    stderr
                )))
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err(AppError::InvalidPath(
            "CLI uninstallation is only supported on macOS.".into(),
        ))
    }
}

/// Build the shell command that creates the CLI wrapper script.
///
/// Uses `printf '%s\n' ... > file` so the entire command stays on one line
/// (required because AppleScript `do shell script "..."` cannot contain
/// literal newlines). The app binary path is passed as a printf `%s`
/// argument, which avoids format-specifier and nested-quote issues.
///
/// The caller must run [`escape_for_applescript`] on the returned string
/// before embedding it in `do shell script "..."`.
#[cfg(any(target_os = "macos", test))]
fn build_install_command(resolved_path: &str, cli_path: &str) -> String {
    // Escape single quotes for shell single-quoted strings: ' → '\''
    let escaped_path = resolved_path.replace('\'', "'\\''");
    let escaped_cli_path = cli_path.replace('\'', "'\\''");
    // printf format string breakdown (shell-level quoting):
    //   '#!/bin/bash\nexec '  – literal text with \n interpreted by printf
    //   "'"                   – literal single quote (via double-quoting)
    //   '%s'                  – printf substitution placeholder
    //   "'"                   – literal single quote
    //   ' "$@"\n'             – literal text ($@ is in single quotes → no expansion)
    // Result written to file: #!/bin/bash\nexec '<path>' "$@"\n
    format!(
        "mkdir -p /usr/local/bin && printf '#!/bin/bash\\nexec '\"'\"'%s'\"'\"' \"$@\"\\n' '{escaped_path}' > '{escaped_cli_path}' && chmod +x '{escaped_cli_path}'"
    )
}

/// Escape a string for embedding inside an AppleScript `"..."` string.
///
/// AppleScript interprets `\\`, `\"`, `\n`, `\t`, and `\r` inside
/// double-quoted strings, so we must escape `\` first (to `\\`), then
/// `"` (to `\"`).
#[cfg(any(target_os = "macos", test))]
fn escape_for_applescript(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

#[tauri::command]
pub fn install_cli() -> Result<String, AppError> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let exe_path = std::env::current_exe()
            .map_err(|e| AppError::InvalidPath(format!("Failed to get executable path: {}", e)))?;

        // Resolve symlinks to get the real path to the binary
        let resolved_path = std::fs::canonicalize(&exe_path).map_err(|e| {
            AppError::InvalidPath(format!("Failed to resolve executable path: {}", e))
        })?;
        let resolved_str = resolved_path.to_string_lossy();
        let cli_path = "/usr/local/bin/yagg";

        // Create a wrapper script instead of a symlink to avoid Tauri updater issues
        // The updater rejects symlinks on macOS, so we use a script that exec's the real binary
        let shell_cmd = build_install_command(&resolved_str, cli_path);
        let script = format!(
            r#"do shell script "{}" with administrator privileges"#,
            escape_for_applescript(&shell_cmd)
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| AppError::InvalidPath(format!("Failed to run osascript: {}", e)))?;

        if output.status.success() {
            Ok("CLI installed successfully. You can now use 'yagg' from the terminal.".to_string())
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

#[tauri::command]
pub fn write_update_log(message: String) {
    update_logger::write_log(&message);
}

#[tauri::command]
pub fn get_update_log_path() -> Option<String> {
    update_logger::get_log_path()
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

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn test_uninstall_cli_not_macos() {
        let result = uninstall_cli();
        assert!(result.is_err());
        match result {
            Err(AppError::InvalidPath(msg)) => {
                assert!(msg.contains("only supported on macOS"));
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[test]
    fn test_get_app_info() {
        let info = get_app_info();
        assert!(!info.version.is_empty());
        assert!(!info.tauri_version.is_empty());
        assert!(!info.platform.is_empty());
        assert!(!info.arch.is_empty());
    }

    #[test]
    fn test_write_update_log_does_not_panic() {
        write_update_log("Test from command".to_string());
    }

    #[test]
    fn test_get_update_log_path_returns_value() {
        let path = get_update_log_path();
        if dirs::data_dir().is_some() {
            assert!(path.is_some());
            assert!(path.unwrap().contains("update.log"));
        }
    }

    #[test]
    fn test_build_install_command_normal_path() {
        let cmd = build_install_command("/usr/local/bin/myapp", "/usr/local/bin/yagg");
        assert!(cmd.contains("mkdir -p /usr/local/bin"));
        assert!(cmd.contains("printf '#!/bin/bash\\nexec '"));
        assert!(cmd.contains("'/usr/local/bin/myapp'"));
        assert!(cmd.contains("> '/usr/local/bin/yagg'"));
        assert!(cmd.contains("chmod +x '/usr/local/bin/yagg'"));
        // Must use %s to avoid format-specifier issues with path contents
        assert!(cmd.contains("%s"));
    }

    #[test]
    fn test_build_install_command_path_with_spaces() {
        let cmd = build_install_command(
            "/Applications/Yet Another Git Gui.app/Contents/MacOS/Yet Another Git Gui",
            "/usr/local/bin/yagg",
        );
        // Path with spaces is passed as a printf argument in single quotes
        assert!(cmd.contains(
            "'/Applications/Yet Another Git Gui.app/Contents/MacOS/Yet Another Git Gui'"
        ));
    }

    #[test]
    fn test_build_install_command_path_with_single_quotes() {
        let cmd = build_install_command("/Users/John's Mac/app", "/usr/local/bin/yagg");
        // Single quotes in path are escaped with '\'' trick
        assert!(cmd.contains("'/Users/John'\\''s Mac/app'"));
    }

    #[test]
    fn test_build_install_command_creates_directory() {
        let cmd = build_install_command("/some/path", "/usr/local/bin/yagg");
        assert!(cmd.starts_with("mkdir -p /usr/local/bin"));
    }

    #[test]
    fn test_build_install_command_correct_shebang() {
        let cmd = build_install_command("/some/path", "/usr/local/bin/yagg");
        assert!(cmd.contains("#!/bin/bash"));
        assert!(cmd.contains("\"$@\""));
    }

    #[test]
    fn test_build_install_command_no_literal_newlines() {
        // The command must be a single line — AppleScript do shell script
        // cannot contain literal newlines inside "..."
        let cmd = build_install_command("/some/path", "/usr/local/bin/yagg");
        assert!(
            !cmd.contains('\n'),
            "command must not contain literal newlines"
        );
        // But it should contain \n as an escape sequence for printf
        assert!(cmd.contains("\\n"));
    }

    #[test]
    fn test_escape_for_applescript() {
        // Backslashes must be escaped first, then double quotes
        assert_eq!(escape_for_applescript(r#"hello"world"#), r#"hello\"world"#);
        assert_eq!(escape_for_applescript("back\\slash"), "back\\\\slash");
        assert_eq!(escape_for_applescript("a\\b\"c"), "a\\\\b\\\"c");
    }

    #[test]
    fn test_applescript_roundtrip_preserves_printf_newlines() {
        // After AppleScript unescaping, the shell must still see \n for printf
        let cmd = build_install_command("/some/path", "/usr/local/bin/yagg");
        let escaped = escape_for_applescript(&cmd);
        // The escaped string should have \\n (which AppleScript unescapes to \n)
        assert!(
            escaped.contains("\\\\n"),
            "AppleScript-escaped command should contain \\\\n so the shell sees \\n"
        );
        // And \" for double quotes (which AppleScript unescapes to ")
        assert!(escaped.contains("\\\"$@\\\""));
    }

    #[test]
    fn test_app_info_serialization() {
        let info = get_app_info();
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("version"));
        assert!(json.contains("tauri_version"));
        assert!(json.contains("platform"));
        assert!(json.contains("arch"));
    }
}
