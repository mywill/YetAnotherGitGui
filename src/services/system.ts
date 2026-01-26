import { invoke } from "@tauri-apps/api/core";

export async function installCli(): Promise<string> {
  return invoke("install_cli");
}

export async function checkCliInstalled(): Promise<boolean> {
  return invoke("check_cli_installed");
}
