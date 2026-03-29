import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface TerminalOutputPayload {
  id: number;
  data: string;
}

export interface TerminalExitPayload {
  id: number;
}

export async function spawnTerminal(cwd: string): Promise<number> {
  return invoke("spawn_terminal", { cwd });
}

export async function writeTerminal(sessionId: number, data: string): Promise<void> {
  return invoke("write_terminal", { sessionId, data });
}

export async function resizeTerminal(sessionId: number, rows: number, cols: number): Promise<void> {
  return invoke("resize_terminal", { sessionId, rows, cols });
}

export async function killTerminal(sessionId: number): Promise<void> {
  return invoke("kill_terminal", { sessionId });
}

export function onTerminalOutput(
  callback: (payload: TerminalOutputPayload) => void
): Promise<UnlistenFn> {
  return listen<TerminalOutputPayload>("terminal:output", (event) => {
    callback(event.payload);
  });
}

export function onTerminalExit(
  callback: (payload: TerminalExitPayload) => void
): Promise<UnlistenFn> {
  return listen<TerminalExitPayload>("terminal:exit", (event) => {
    callback(event.payload);
  });
}
