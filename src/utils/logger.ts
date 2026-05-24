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

export function logWarn(target: string, message: string): void {
  log("warn", target, message);
}

export function logInfo(target: string, message: string): void {
  log("info", target, message);
}

export function logDebug(target: string, message: string): void {
  log("debug", target, message);
}

export function logTrace(target: string, message: string): void {
  log("trace", target, message);
}
