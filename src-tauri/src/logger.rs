use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use chrono::{DateTime, Local};
use log::LevelFilter;
use simplelog::{ConfigBuilder, WriteLogger};

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

const APP_DIR_NAME: &str = "yagg";
const LOG_DIR_NAME: &str = "logs";
const FILENAME_RE_PREFIX: &str = "app-";
const FILENAME_RE_PID_SEP: &str = "-pid";
const FILENAME_RE_SUFFIX: &str = ".log";

/// Initialize the unified per-instance logger. Safe to call once.
/// Returns Err with a message if initialization fails — callers should swallow.
pub fn init(debug_enabled: bool) -> Result<(), String> {
    let path = match resolve_log_path() {
        Some(p) => p,
        None => return Err("could not resolve log path".into()),
    };

    if let Some(parent) = path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(format!("could not create log dir: {e}"));
        }
    }

    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("could not open log file: {e}"))?;

    let mut builder = ConfigBuilder::new();
    builder.set_time_format_rfc3339();
    // Best-effort: if local offset can't be determined, fall through to UTC.
    let _ = builder.set_time_offset_to_local();
    let config = builder.build();

    // Install the WriteLogger at the level we actually want from line one —
    // installing at Trace and then narrowing via `set_max_level` leaves a
    // brief window where Trace lines slip through.
    let filter = if debug_enabled {
        LevelFilter::Trace
    } else {
        LevelFilter::Info
    };
    WriteLogger::init(filter, config, file)
        .map_err(|e| format!("could not init WriteLogger: {e}"))?;

    // Sync the facade-level filter to match so runtime toggles work later.
    set_debug_enabled(debug_enabled);

    let _ = LOG_PATH.set(path);
    Ok(())
}

/// Directory containing per-instance log files.
pub fn log_dir() -> Option<PathBuf> {
    let data_dir = dirs::data_dir()?;
    Some(data_dir.join(APP_DIR_NAME).join(LOG_DIR_NAME))
}

/// Path to the current instance's log file. Available after [`init`].
pub fn current_log_path() -> Option<PathBuf> {
    LOG_PATH.get().cloned().or_else(resolve_log_path)
}

/// Flip the live log level. `true` enables Debug/Trace, `false` returns to Info.
pub fn set_debug_enabled(enabled: bool) {
    log::set_max_level(if enabled {
        LevelFilter::Trace
    } else {
        LevelFilter::Info
    });
}

/// Delete log files older than `retain_days` based on the date encoded in the
/// filename (e.g. `app-2026-05-23-pid12345.log`).
pub fn sweep_old_logs(retain_days: u32) {
    let Some(dir) = log_dir() else { return };
    sweep_in(&dir, retain_days, Local::now());
}

fn resolve_log_path() -> Option<PathBuf> {
    let dir = log_dir()?;
    let name = build_log_filename(Local::now(), std::process::id());
    Some(dir.join(name))
}

fn build_log_filename(now: DateTime<Local>, pid: u32) -> String {
    format!(
        "{}{}{}{}{}",
        FILENAME_RE_PREFIX,
        now.format("%Y-%m-%d"),
        FILENAME_RE_PID_SEP,
        pid,
        FILENAME_RE_SUFFIX
    )
}

fn sweep_in(dir: &Path, retain_days: u32, now: DateTime<Local>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let cutoff = now.date_naive() - chrono::Duration::days(retain_days as i64);
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name_str) = name.to_str() else {
            continue;
        };
        let Some(date) = parse_filename_date(name_str) else {
            continue;
        };
        if date < cutoff {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// Parse the date out of a filename matching exactly
/// `app-YYYY-MM-DD-pid<digits>.log`. Returns `None` for anything else so the
/// sweep never deletes adjacent files (e.g. `app-2026-05-23bogus.log`).
fn parse_filename_date(name: &str) -> Option<chrono::NaiveDate> {
    let rest = name.strip_prefix(FILENAME_RE_PREFIX)?;
    let rest = rest.strip_suffix(FILENAME_RE_SUFFIX)?;
    // rest must be exactly `YYYY-MM-DD-pid<digits>`.
    let (date_part, pid_part) = rest.split_once(FILENAME_RE_PID_SEP)?;
    if date_part.len() != 10 || pid_part.is_empty() {
        return None;
    }
    if !pid_part.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d").ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn build_log_filename_format() {
        let now = Local.with_ymd_and_hms(2026, 5, 23, 9, 0, 0).unwrap();
        let name = build_log_filename(now, 12345);
        assert_eq!(name, "app-2026-05-23-pid12345.log");
    }

    #[test]
    fn parse_filename_date_round_trip() {
        let name = build_log_filename(Local.with_ymd_and_hms(2026, 1, 2, 0, 0, 0).unwrap(), 7);
        let parsed = parse_filename_date(&name).unwrap();
        assert_eq!(parsed, chrono::NaiveDate::from_ymd_opt(2026, 1, 2).unwrap());
    }

    #[test]
    fn parse_filename_date_ignores_unrelated() {
        assert!(parse_filename_date("update.log").is_none());
        assert!(parse_filename_date("crash.log").is_none());
        assert!(parse_filename_date("app-not-a-date-pid1.log").is_none());
    }

    #[test]
    fn parse_filename_date_requires_strict_shape() {
        // Sweep must NOT touch files that merely share the prefix/suffix.
        assert!(parse_filename_date("app-2026-05-23bogus.log").is_none());
        assert!(parse_filename_date("app-2026-05-23-pid.log").is_none()); // empty pid
        assert!(parse_filename_date("app-2026-05-23-pidNaN.log").is_none()); // non-digit pid
        assert!(parse_filename_date("app-2026-05-23.log").is_none()); // missing -pid<N>
        assert!(parse_filename_date("app-2026-05-23-pid12345.log").is_some());
    }

    #[test]
    fn sweep_removes_old_files_keeps_fresh() {
        let dir = tempfile::tempdir().unwrap();
        let now = Local.with_ymd_and_hms(2026, 5, 23, 12, 0, 0).unwrap();

        let old = dir.path().join("app-2026-05-15-pid1.log");
        let fresh = dir.path().join("app-2026-05-22-pid2.log");
        let unrelated = dir.path().join("readme.txt");
        std::fs::write(&old, "old").unwrap();
        std::fs::write(&fresh, "fresh").unwrap();
        std::fs::write(&unrelated, "keep").unwrap();

        sweep_in(dir.path(), 7, now);

        assert!(!old.exists(), "old log should be swept");
        assert!(fresh.exists(), "fresh log should remain");
        assert!(unrelated.exists(), "non-log files should be untouched");
    }

    #[test]
    fn set_debug_enabled_changes_max_level() {
        set_debug_enabled(false);
        assert_eq!(log::max_level(), LevelFilter::Info);
        set_debug_enabled(true);
        assert_eq!(log::max_level(), LevelFilter::Trace);
        set_debug_enabled(false);
    }

    #[test]
    fn log_path_resolves_under_data_dir() {
        if let Some(path) = resolve_log_path() {
            let data_dir = dirs::data_dir().unwrap();
            assert!(path.starts_with(data_dir.join("yagg").join(LOG_DIR_NAME)));
            assert!(path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with(FILENAME_RE_PREFIX) && n.ends_with(FILENAME_RE_SUFFIX))
                .unwrap_or(false));
        }
    }
}
