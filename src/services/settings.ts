import { invoke } from "@tauri-apps/api/core";
import { logError } from "../utils/logger";

export interface SettingsData {
  density?: "compact" | "comfortable" | "spacious";
  textSize?: "small" | "medium" | "large";
  theme?: "dark" | "light";
  layoutSizes?: Record<string, number>;
  sectionExpanded?: Record<string, boolean>;
  autoCheckForUpdates?: boolean;
  debugLoggingEnabled?: boolean;
}

export async function readSettings(): Promise<SettingsData> {
  const raw: string = await invoke("read_settings");
  try {
    return JSON.parse(raw) as SettingsData;
  } catch (e) {
    logError("yagg::fe::settings", `settings JSON parse failed: ${String(e)}`);
    return {};
  }
}

export async function writeSettings(data: SettingsData): Promise<void> {
  await invoke("write_settings", { data: JSON.stringify(data) });
}
