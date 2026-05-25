import { invoke } from "@tauri-apps/api/core";

export async function openLogDir(): Promise<void> {
  await invoke("open_log_dir");
}

export async function setDebugLoggingEnabled(enabled: boolean): Promise<void> {
  await invoke("set_debug_logging_enabled", { enabled });
}
