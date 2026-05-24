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

/// Appends panic details to the unified per-instance log file, returning the
/// path on success.
///
/// Bypasses the `log` facade intentionally: a panic hook must not depend on
/// the logger's internal mutex (it may be poisoned mid-panic). Opens the
/// underlying file with `append(true)` and writes a single multi-line record.
fn write_crash_log(info: &panic::PanicHookInfo<'_>) -> Option<String> {
    // Prefer the path resolved during logger::init so the panic lands in the
    // same file as the rest of this instance's log lines.
    let log_path = crate::logger::current_log_path()?;

    if let Some(parent) = log_path.parent() {
        if std::fs::create_dir_all(parent).is_err() {
            return None;
        }
    }

    let mut file = match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(f) => f,
        Err(_) => return None,
    };

    let formatted_ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f %z");

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
        "=== CRASH at {formatted_ts} ===\nMessage: {message}\nLocation: {location}\nBacktrace:\n{backtrace}\n"
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
    fn test_log_dir_resolves() {
        // Panic hook appends to the unified log path. Verify the directory it
        // lives under is createable in this environment.
        if let Some(dir) = crate::logger::log_dir() {
            assert!(
                std::fs::create_dir_all(&dir).is_ok(),
                "should be able to create yagg logs directory"
            );
        }
    }

    #[test]
    fn test_setup_installs_hook() {
        // Verify setup doesn't panic when called. We can't easily exercise the
        // hook itself without actually panicking the test thread.
        let _ = std::panic::take_hook();
        setup();
        let _ = std::panic::take_hook();
    }
}
