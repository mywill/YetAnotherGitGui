import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  installCli,
  uninstallCli,
  checkCliInstalled,
  getAppInfo,
  checkForUpdate,
  downloadAndInstallUpdate,
  getReleaseUrl,
  writeUpdateLog,
  getUpdateLogPath,
} from "./system";

// The mock is already set up in test/setup.ts
describe("system service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: invoke resolves for logging commands, rejects for unknown
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "write_update_log") return undefined;
      if (cmd === "get_update_log_path") return "/home/user/.local/share/yagg/update.log";
      if (cmd === "get_app_info")
        return {
          version: "1.2.0",
          tauri_version: "2.0.0",
          platform: "macos",
          arch: "aarch64",
        };
      return undefined;
    });
  });

  describe("installCli", () => {
    it("invokes install_cli command", async () => {
      vi.mocked(invoke).mockResolvedValue("/usr/local/bin/yagg");

      const result = await installCli();

      expect(invoke).toHaveBeenCalledWith("install_cli");
      expect(result).toBe("/usr/local/bin/yagg");
    });

    it("returns installation path on success", async () => {
      vi.mocked(invoke).mockResolvedValue("/opt/bin/yagg");

      const result = await installCli();

      expect(result).toBe("/opt/bin/yagg");
    });

    it("propagates errors from invoke", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Permission denied"));

      await expect(installCli()).rejects.toThrow("Permission denied");
    });
  });

  describe("checkCliInstalled", () => {
    it("invokes check_cli_installed command", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await checkCliInstalled();

      expect(invoke).toHaveBeenCalledWith("check_cli_installed");
      expect(result).toBe(true);
    });

    it("returns true when CLI is installed", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await checkCliInstalled();

      expect(result).toBe(true);
    });

    it("returns false when CLI is not installed", async () => {
      vi.mocked(invoke).mockResolvedValue(false);

      const result = await checkCliInstalled();

      expect(result).toBe(false);
    });

    it("propagates errors from invoke", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Not on macOS"));

      await expect(checkCliInstalled()).rejects.toThrow("Not on macOS");
    });
  });

  describe("uninstallCli", () => {
    it("invokes uninstall_cli command", async () => {
      vi.mocked(invoke).mockResolvedValue("CLI tool uninstalled successfully.");

      const result = await uninstallCli();

      expect(invoke).toHaveBeenCalledWith("uninstall_cli");
      expect(result).toBe("CLI tool uninstalled successfully.");
    });

    it("propagates errors from invoke", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Not on macOS"));

      await expect(uninstallCli()).rejects.toThrow("Not on macOS");
    });
  });

  describe("getAppInfo", () => {
    it("invokes get_app_info command", async () => {
      const mockInfo = {
        version: "1.2.0",
        tauri_version: "2.0.0",
        platform: "macos",
        arch: "aarch64",
      };
      vi.mocked(invoke).mockResolvedValue(mockInfo);

      const result = await getAppInfo();

      expect(invoke).toHaveBeenCalledWith("get_app_info");
      expect(result).toEqual(mockInfo);
    });

    it("propagates errors from invoke", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Command failed"));

      await expect(getAppInfo()).rejects.toThrow("Command failed");
    });
  });

  describe("writeUpdateLog", () => {
    it("invokes write_update_log command", async () => {
      await writeUpdateLog("test message");

      expect(invoke).toHaveBeenCalledWith("write_update_log", { message: "test message" });
    });

    it("does not throw when invoke fails", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Failed"));

      // Should not throw
      await writeUpdateLog("test message");
    });
  });

  describe("getUpdateLogPath", () => {
    it("invokes get_update_log_path command", async () => {
      vi.mocked(invoke).mockResolvedValue("/path/to/update.log");

      const result = await getUpdateLogPath();

      expect(invoke).toHaveBeenCalledWith("get_update_log_path");
      expect(result).toBe("/path/to/update.log");
    });

    it("returns null when path is unavailable", async () => {
      vi.mocked(invoke).mockResolvedValue(null);

      const result = await getUpdateLogPath();

      expect(result).toBeNull();
    });
  });

  describe("checkForUpdate", () => {
    it("returns available update info when update exists", async () => {
      vi.mocked(check).mockResolvedValue({
        version: "1.4.0",
        body: "Bug fixes and improvements",
        date: "2026-01-15",
        downloadAndInstall: vi.fn(),
        close: vi.fn(),
      } as never);

      const result = await checkForUpdate();

      expect(result).toEqual({
        available: true,
        version: "1.4.0",
        notes: "Bug fixes and improvements",
        date: "2026-01-15",
      });
    });

    it("returns not available when no update", async () => {
      vi.mocked(check).mockResolvedValue(null);

      const result = await checkForUpdate();

      expect(result).toEqual({ available: false });
    });

    it("propagates errors from check", async () => {
      vi.mocked(check).mockRejectedValue(new Error("Network error"));

      await expect(checkForUpdate()).rejects.toThrow("Network error");
    });

    it("handles update with no body or date", async () => {
      vi.mocked(check).mockResolvedValue({
        version: "1.4.0",
        body: null,
        date: null,
        downloadAndInstall: vi.fn(),
        close: vi.fn(),
      } as never);

      const result = await checkForUpdate();

      expect(result).toEqual({
        available: true,
        version: "1.4.0",
        notes: undefined,
        date: undefined,
      });
    });

    it("logs update check and result", async () => {
      vi.mocked(check).mockResolvedValue({
        version: "1.4.0",
        body: null,
        date: null,
        downloadAndInstall: vi.fn(),
        close: vi.fn(),
      } as never);

      await checkForUpdate();

      // Should have logged the check start and result
      expect(invoke).toHaveBeenCalledWith("write_update_log", {
        message: expect.stringContaining("Checking for update"),
      });
      expect(invoke).toHaveBeenCalledWith("write_update_log", {
        message: expect.stringContaining("Update available: v1.4.0"),
      });
    });

    it("logs error when check fails", async () => {
      vi.mocked(check).mockRejectedValue(new Error("Network error"));

      await expect(checkForUpdate()).rejects.toThrow("Network error");

      expect(invoke).toHaveBeenCalledWith("write_update_log", {
        message: expect.stringContaining("ERROR checking for update"),
      });
    });
  });

  describe("downloadAndInstallUpdate", () => {
    it("downloads, installs, and relaunches", async () => {
      const mockDownloadAndInstall = vi.fn().mockResolvedValue(undefined);
      vi.mocked(check).mockResolvedValue({
        version: "1.4.0",
        body: null,
        date: null,
        downloadAndInstall: mockDownloadAndInstall,
        close: vi.fn(),
      } as never);

      await downloadAndInstallUpdate();

      expect(mockDownloadAndInstall).toHaveBeenCalled();
      expect(relaunch).toHaveBeenCalled();
    });

    it("throws when no update available", async () => {
      vi.mocked(check).mockResolvedValue(null);

      await expect(downloadAndInstallUpdate()).rejects.toThrow("No update available");
    });

    it("propagates download errors", async () => {
      const mockDownloadAndInstall = vi.fn().mockRejectedValue(new Error("Download failed"));
      vi.mocked(check).mockResolvedValue({
        version: "1.4.0",
        body: null,
        date: null,
        downloadAndInstall: mockDownloadAndInstall,
        close: vi.fn(),
      } as never);

      await expect(downloadAndInstallUpdate()).rejects.toThrow("Download failed");
    });

    it("logs download start and errors", async () => {
      const mockDownloadAndInstall = vi.fn().mockRejectedValue(new Error("SSL error"));
      vi.mocked(check).mockResolvedValue({
        version: "1.4.0",
        body: null,
        date: null,
        downloadAndInstall: mockDownloadAndInstall,
        close: vi.fn(),
      } as never);

      await expect(downloadAndInstallUpdate()).rejects.toThrow("SSL error");

      expect(invoke).toHaveBeenCalledWith("write_update_log", {
        message: "Starting download and install...",
      });
      expect(invoke).toHaveBeenCalledWith("write_update_log", {
        message: expect.stringContaining("ERROR during download/install"),
      });
    });
  });

  describe("getReleaseUrl", () => {
    it("returns correct GitHub release URL", () => {
      expect(getReleaseUrl("1.4.0")).toBe(
        "https://github.com/mywill/YetAnotherGitGui/releases/tag/v1.4.0"
      );
    });

    it("handles version without v prefix", () => {
      expect(getReleaseUrl("2.0.0")).toBe(
        "https://github.com/mywill/YetAnotherGitGui/releases/tag/v2.0.0"
      );
    });
  });
});
