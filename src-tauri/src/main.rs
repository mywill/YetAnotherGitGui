// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Install crash handler first — covers all panics in all modes.
    yagg_lib::crash_handler::setup();

    // On Unix release builds, detach from the terminal so the shell prompt
    // returns immediately. The detach re-spawns the binary and the parent
    // exits — so anything that creates per-process state (notably the log
    // file) MUST happen after this check, otherwise every release launch
    // leaves a ghost log file from the short-lived parent.
    #[cfg(all(not(debug_assertions), unix))]
    {
        if std::env::var("YAGG_DETACHED").is_err() {
            detach_from_terminal();
            return;
        }
    }

    // Init unified logger (reads debug flag from settings.json before Tauri).
    // Sweep old log files (7-day retention) and emit a startup line so each
    // file is self-identifying.
    let debug_enabled = yagg_lib::commands::settings::read_debug_logging_from_disk();
    if let Err(e) = yagg_lib::logger::init(debug_enabled) {
        // The logger isn't installed yet — print to stderr so a
        // terminal-launched user at least sees that logging is dead.
        eprintln!("yagg: logger init failed: {e}");
    }
    yagg_lib::logger::sweep_old_logs(7);
    log::info!(
        target: "yagg::lifecycle",
        "startup pid={} version={}",
        std::process::id(),
        env!("CARGO_PKG_VERSION")
    );

    yagg_lib::run()
}

/// Re-spawns the current executable with `YAGG_DETACHED=1` and all original arguments,
/// redirecting stdin/stdout/stderr to null so the parent can exit without blocking the shell.
#[cfg(all(not(debug_assertions), unix))]
fn detach_from_terminal() {
    use std::process::{Command, Stdio};

    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => {
            // Can't determine our own path — fall through to run in foreground
            yagg_lib::run();
            return;
        }
    };

    let args: Vec<String> = std::env::args().skip(1).collect();

    let result = Command::new(exe)
        .args(&args)
        .env("YAGG_DETACHED", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();

    if result.is_err() {
        // Spawn failed — run in foreground as fallback
        yagg_lib::run();
    }
}
