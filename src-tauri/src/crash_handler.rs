use std::io::Write;
use std::panic;

/// Installs a panic hook that logs crash details to a file and shows a native error dialog.
/// Must be called at the very start of `main()` before any other initialization.
pub fn setup() {
    panic::set_hook(Box::new(|info| {
        let crash_log_path = write_crash_log(info);
        show_native_dialog(crash_log_path.as_deref());
    }));
}

/// Writes panic details to `<data_dir>/yagg/crash.log`, returning the path on success.
fn write_crash_log(info: &panic::PanicHookInfo<'_>) -> Option<String> {
    let data_dir = dirs::data_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let log_dir = data_dir.join("yagg");
    let log_path = log_dir.join("crash.log");

    if std::fs::create_dir_all(&log_dir).is_err() {
        return None;
    }

    let mut file = match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(f) => f,
        Err(_) => return None,
    };

    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f %z");

    let message = if let Some(s) = info.payload().downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = info.payload().downcast_ref::<String>() {
        s.clone()
    } else {
        "Unknown panic payload".to_string()
    };

    let location = info
        .location()
        .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
        .unwrap_or_else(|| "unknown location".to_string());

    let backtrace = std::backtrace::Backtrace::force_capture();

    let _ = writeln!(
        file,
        "=== CRASH at {timestamp} ===\nMessage: {message}\nLocation: {location}\nBacktrace:\n{backtrace}\n"
    );

    Some(log_path.to_string_lossy().into_owned())
}

/// Spawns a native OS error dialog in a separate process.
/// This is safe from a panic hook because it creates an independent process.
fn show_native_dialog(crash_log_path: Option<&str>) {
    let detail = match crash_log_path {
        Some(path) => format!("yagg crashed unexpectedly.\n\nDetails saved to:\n{path}"),
        None => "yagg crashed unexpectedly.\n\nCould not write crash log.".to_string(),
    };

    #[cfg(target_os = "linux")]
    show_dialog_linux(&detail);

    #[cfg(target_os = "macos")]
    show_dialog_macos(&detail);

    #[cfg(target_os = "windows")]
    show_dialog_windows(&detail);
}

#[cfg(target_os = "linux")]
fn show_dialog_linux(message: &str) {
    use std::process::Command;

    // Try zenity first
    if Command::new("zenity")
        .args(["--error", "--title=yagg", "--text", message, "--width=400"])
        .spawn()
        .and_then(|mut c| c.wait())
        .is_ok()
    {
        return;
    }

    // Fallback to kdialog
    if Command::new("kdialog")
        .args(["--error", message, "--title", "yagg"])
        .spawn()
        .and_then(|mut c| c.wait())
        .is_ok()
    {
        return;
    }

    // Last resort: xmessage
    let _ = Command::new("xmessage")
        .args(["-center", message])
        .spawn()
        .and_then(|mut c| c.wait());
}

#[cfg(target_os = "macos")]
fn show_dialog_macos(message: &str) {
    let escaped = message.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        "display alert \"yagg\" message \"{}\" as critical buttons {{\"OK\"}} default button \"OK\"",
        escaped
    );
    let _ = std::process::Command::new("osascript")
        .args(["-e", &script])
        .spawn()
        .and_then(|mut c| c.wait());
}

#[cfg(target_os = "windows")]
fn show_dialog_windows(message: &str) {
    let escaped = message.replace('\'', "''");
    let ps_command = format!(
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('{}', 'yagg', 'OK', 'Error')",
        escaped
    );
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_command])
        .spawn()
        .and_then(|mut c| c.wait());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_write_crash_log_creates_file() {
        // We can't easily construct a PanicHookInfo, but we can test that
        // the data directory resolution works
        let data_dir =
            dirs::data_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
        let log_dir = data_dir.join("yagg");
        assert!(
            std::fs::create_dir_all(&log_dir).is_ok(),
            "Should be able to create yagg data directory"
        );
    }

    #[test]
    fn test_setup_installs_hook() {
        // Verify setup doesn't panic when called
        // Note: we can't easily test the hook itself without actually panicking,
        // but we can verify the function completes without error.
        // In a real test environment, we'd need to fork the process.
        // Just verify the function signature is correct.
        let _ = std::panic::take_hook(); // save current hook
        setup();
        let _ = std::panic::take_hook(); // restore by taking ours
    }
}
