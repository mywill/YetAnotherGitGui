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

export async function writeUpdateLog(message: string): Promise<void> {
  try {
    await invoke("write_update_log", { message });
  } catch {
    // Logging should never block the update flow
  }
}

export async function getUpdateLogPath(): Promise<string | null> {
  return invoke("get_update_log_path");
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  let appInfo: AppInfo | undefined;
  try {
    appInfo = await getAppInfo();
  } catch {
    // best-effort
  }
  const infoStr = appInfo
    ? `current version: ${appInfo.version}, platform: ${appInfo.platform}, arch: ${appInfo.arch}`
    : "could not retrieve app info";
  await writeUpdateLog(`Checking for update... (${infoStr})`);

  try {
    const update = await check();
    if (update) {
      await writeUpdateLog(`Update available: v${update.version}`);
      return {
        available: true,
        version: update.version,
        notes: update.body ?? undefined,
        date: update.date ?? undefined,
      };
    }
    await writeUpdateLog("No update available (up to date)");
    return { available: false };
  } catch (error) {
    await writeUpdateLog(`ERROR checking for update: ${String(error)}`);
    throw error;
  }
}

export async function downloadAndInstallUpdate(): Promise<void> {
  await writeUpdateLog("Starting download and install...");
  try {
    const update = await check();
    if (!update) {
      await writeUpdateLog("ERROR: No update available when trying to download");
      throw new Error("No update available");
    }
    await update.downloadAndInstall();
    await writeUpdateLog("Update downloaded and installed, relaunching...");
    await relaunch();
  } catch (error) {
    await writeUpdateLog(`ERROR during download/install: ${String(error)}`);
    throw error;
  }
}

export function getReleaseUrl(version: string): string {
  return `https://github.com/mywill/YetAnotherGitGui/releases/tag/v${version}`;
}

export type { Update };
