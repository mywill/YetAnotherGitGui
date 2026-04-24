import { invoke } from "@tauri-apps/api/core";

export interface SettingsData {
  density?: "compact" | "comfortable" | "spacious";
  textSize?: "small" | "medium" | "large";
  theme?: "dark" | "light";
  inspectorVisible?: boolean;
  layoutSizes?: Record<string, number>;
  sectionExpanded?: Record<string, boolean>;
}

export async function readSettings(): Promise<SettingsData> {
  const raw: string = await invoke("read_settings");
  try {
    return JSON.parse(raw) as SettingsData;
  } catch {
    return {};
  }
}

export async function writeSettings(data: SettingsData): Promise<void> {
  await invoke("write_settings", { data: JSON.stringify(data) });
}
