use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread::JoinHandle;

use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::AppError;

#[derive(Serialize, Clone)]
struct TerminalOutputPayload {
    id: u32,
    data: String,
}

#[derive(Serialize, Clone)]
struct TerminalExitPayload {
    id: u32,
}

pub struct TerminalSession {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
    _reader_thread: Option<JoinHandle<()>>,
}

pub struct TerminalManager {
    sessions: Mutex<HashMap<u32, TerminalSession>>,
    next_id: AtomicU32,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        }
    }

    pub fn spawn(&self, cwd: &str, app_handle: AppHandle) -> Result<u32, AppError> {
        let shell = detect_shell();
        let size = PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(size)
            .map_err(|e| AppError::Terminal(e.to_string()))?;

        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| AppError::Terminal(e.to_string()))?;

        // Drop slave — we only need the master side
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Terminal(e.to_string()))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| AppError::Terminal(e.to_string()))?;

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);

        let reader_app = app_handle.clone();
        let reader_id = id;
        let reader_thread = std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => {
                        let _ =
                            reader_app.emit("terminal:exit", TerminalExitPayload { id: reader_id });
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                        let _ = reader_app.emit(
                            "terminal:output",
                            TerminalOutputPayload {
                                id: reader_id,
                                data,
                            },
                        );
                    }
                }
            }
        });

        let session = TerminalSession {
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
            _reader_thread: Some(reader_thread),
        };

        self.sessions.lock().insert(id, session);
        Ok(id)
    }

    pub fn write(&self, id: u32, data: &str) -> Result<(), AppError> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(&id)
            .ok_or_else(|| AppError::Terminal(format!("No terminal session with id {id}")))?;
        let result = session
            .writer
            .lock()
            .write_all(data.as_bytes())
            .map_err(|e| AppError::Terminal(e.to_string()));
        result
    }

    pub fn resize(&self, id: u32, rows: u16, cols: u16) -> Result<(), AppError> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(&id)
            .ok_or_else(|| AppError::Terminal(format!("No terminal session with id {id}")))?;
        let result = session
            .master
            .lock()
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Terminal(e.to_string()));
        result
    }

    pub fn kill(&self, id: u32) -> Result<(), AppError> {
        let mut sessions = self.sessions.lock();
        if let Some(session) = sessions.remove(&id) {
            // Kill the child process — reader thread will exit on its own
            let _ = session.child.lock().kill();
        }
        Ok(())
    }

    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock();
        for (_, session) in sessions.drain() {
            let _ = session.child.lock().kill();
        }
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

fn detect_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_terminal_manager_new() {
        let manager = TerminalManager::new();
        assert!(manager.sessions.lock().is_empty());
    }

    #[test]
    fn test_terminal_manager_default() {
        let manager = TerminalManager::default();
        assert!(manager.sessions.lock().is_empty());
    }

    #[test]
    fn test_write_invalid_session() {
        let manager = TerminalManager::new();
        let result = manager.write(999, "test");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No terminal session"));
    }

    #[test]
    fn test_resize_invalid_session() {
        let manager = TerminalManager::new();
        let result = manager.resize(999, 24, 80);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No terminal session"));
    }

    #[test]
    fn test_kill_invalid_session_is_ok() {
        let manager = TerminalManager::new();
        // Killing a non-existent session should not error
        let result = manager.kill(999);
        assert!(result.is_ok());
    }

    #[test]
    fn test_kill_all_empty() {
        let manager = TerminalManager::new();
        manager.kill_all();
        assert!(manager.sessions.lock().is_empty());
    }

    #[test]
    fn test_detect_shell_fallback() {
        // Temporarily remove SHELL env var to test fallback
        let original = std::env::var("SHELL").ok();
        std::env::remove_var("SHELL");
        let shell = detect_shell();
        assert_eq!(shell, "/bin/bash");
        // Restore
        if let Some(val) = original {
            std::env::set_var("SHELL", val);
        }
    }

    #[test]
    fn test_detect_shell_from_env() {
        let original = std::env::var("SHELL").ok();
        std::env::set_var("SHELL", "/bin/zsh");
        let shell = detect_shell();
        assert_eq!(shell, "/bin/zsh");
        // Restore
        if let Some(val) = original {
            std::env::set_var("SHELL", val);
        } else {
            std::env::remove_var("SHELL");
        }
    }

    #[test]
    fn test_session_id_increments() {
        let manager = TerminalManager::new();
        let id1 = manager.next_id.fetch_add(1, Ordering::Relaxed);
        let id2 = manager.next_id.fetch_add(1, Ordering::Relaxed);
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
    }

    #[test]
    fn test_terminal_error_display() {
        let error = AppError::Terminal("test error".to_string());
        assert_eq!(error.to_string(), "Terminal error: test error");
    }

    #[test]
    fn test_serialize_terminal_error() {
        let error = AppError::Terminal("pty failed".to_string());
        let json = serde_json::to_string(&error).unwrap();
        assert_eq!(json, "\"Terminal error: pty failed\"");
    }
}
