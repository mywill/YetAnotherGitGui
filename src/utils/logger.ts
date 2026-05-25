import { invoke } from "@tauri-apps/api/core";

function log(level: string, target: string, message: string): void {
  try {
    invoke("log_from_frontend", { level, target, message }).catch(() => {});
  } catch {
    // never throw
  }
}

export function logError(target: string, message: string): void {
  log("error", target, message);
}

export function logInfo(target: string, message: string): void {
  log("info", target, message);
}

export function logDebug(target: string, message: string): void {
  log("debug", target, message);
}
