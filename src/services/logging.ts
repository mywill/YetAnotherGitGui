import { invoke } from "@tauri-apps/api/core";

export async function getLogDir(): Promise<string> {
  return invoke("get_log_dir");
}

export async function openLogDir(): Promise<void> {
  await invoke("open_log_dir");
}

export async function getDebugLoggingEnabled(): Promise<boolean> {
  return invoke<boolean>("get_debug_logging_enabled");
}

export async function setDebugLoggingEnabled(enabled: boolean): Promise<void> {
  await invoke("set_debug_logging_enabled", { enabled });
}
