import { invoke } from "@tauri-apps/api/core";

export interface AppInfo {
  version: string;
  tauri_version: string;
  platform: string;
  arch: string;
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
