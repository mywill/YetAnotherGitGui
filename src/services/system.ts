import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface AppInfo {
  version: string;
  tauri_version: string;
  platform: string;
  arch: string;
}

export interface UpdateInfo {
  available: boolean;
  version?: string;
  notes?: string;
  date?: string;
}

export async function installCli(): Promise<string> {
  return invoke("install_cli");
}

export async function uninstallCli(): Promise<string> {
  return invoke("uninstall_cli");
}

export async function checkCliInstalled(): Promise<boolean> {
  return invoke("check_cli_installed");
}

export async function getAppInfo(): Promise<AppInfo> {
  return invoke("get_app_info");
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const update = await check();
  if (update) {
    return {
      available: true,
      version: update.version,
      notes: update.body ?? undefined,
      date: update.date ?? undefined,
    };
  }
  return { available: false };
}

export async function downloadAndInstallUpdate(): Promise<void> {
  const update = await check();
  if (!update) {
    throw new Error("No update available");
  }
  await update.downloadAndInstall();
  await relaunch();
}

export function getReleaseUrl(version: string): string {
  return `https://github.com/mywill/YetAnotherGitGui/releases/tag/v${version}`;
}

export type { Update };
