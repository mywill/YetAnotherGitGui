import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsMenu } from "./SettingsMenu";
import { useRepositoryStore } from "../../stores/repositoryStore";
import {
  checkCliInstalled,
  installCli,
  uninstallCli,
  getAppInfo,
  checkForUpdate,
  downloadAndInstallUpdate,
} from "../../services/system";

vi.mock("../../services/system", () => ({
  checkCliInstalled: vi.fn(),
  installCli: vi.fn(),
  uninstallCli: vi.fn(),
  getAppInfo: vi.fn(),
  checkForUpdate: vi.fn(),
  downloadAndInstallUpdate: vi.fn(),
  writeUpdateLog: vi.fn().mockResolvedValue(undefined),
  getUpdateLogPath: vi.fn().mockResolvedValue("/home/user/.local/share/yagg/update.log"),
  getReleaseUrl: vi.fn(
    (v: string) => `https://github.com/mywill/YetAnotherGitGui/releases/tag/v${v}`
  ),
}));

describe("SettingsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppInfo).mockResolvedValue({
      version: "1.2.0",
      tauri_version: "2.0.0",
      platform: "macos",
      arch: "aarch64",
    });
    vi.mocked(checkForUpdate).mockResolvedValue({ available: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders gear button with correct title", () => {
    vi.mocked(checkCliInstalled).mockResolvedValue(false);

    render(<SettingsMenu />);

    expect(screen.getByTitle("Settings")).toBeInTheDocument();
  });

  it("gear button has correct aria attributes", () => {
    vi.mocked(checkCliInstalled).mockResolvedValue(false);

    render(<SettingsMenu />);

    const button = screen.getByTitle("Settings");
    expect(button).toHaveAttribute("aria-label", "Settings");
    expect(button).toHaveAttribute("aria-haspopup", "true");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  describe("dropdown menu", () => {
    it("opens dropdown when gear button is clicked", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("closes dropdown when gear button is clicked again", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.click(screen.getByTitle("Settings"));

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes dropdown when Escape is pressed", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("always shows About menu item", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      expect(screen.getByText("About")).toBeInTheDocument();
    });
  });

  describe("CLI install/uninstall menu items (macOS)", () => {
    it("shows Install CLI Tool when CLI is not installed", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });
    });

    it("shows Uninstall CLI Tool when CLI is installed", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(true);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        expect(screen.getByText("Uninstall CLI Tool")).toBeInTheDocument();
      });
    });

    it("does not show CLI items on non-macOS platforms", async () => {
      vi.mocked(getAppInfo).mockResolvedValue({
        version: "1.2.0",
        tauri_version: "2.0.0",
        platform: "linux",
        arch: "x86_64",
      });

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      // checkCliInstalled should not have been called on Linux
      expect(checkCliInstalled).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByText("Install CLI Tool")).not.toBeInTheDocument();
        expect(screen.queryByText("Uninstall CLI Tool")).not.toBeInTheDocument();
      });
    });

    it("does not show CLI separator on non-macOS platforms", async () => {
      vi.mocked(getAppInfo).mockResolvedValue({
        version: "1.2.0",
        tauri_version: "2.0.0",
        platform: "linux",
        arch: "x86_64",
      });

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      // Should have exactly one separator (before About), not the macOS CLI separator
      await waitFor(() => {
        const separators = screen.getAllByRole("separator");
        expect(separators).toHaveLength(1);
      });
    });
  });

  describe("install CLI flow", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
    });

    it("shows confirmation dialog when Install CLI Tool is clicked", async () => {
      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText("Install CLI Tool"));
      });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Install")).toBeInTheDocument();
    });

    it("calls installCli when confirmed", async () => {
      vi.mocked(installCli).mockResolvedValue("CLI installed successfully.");

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText("Install CLI Tool"));
      });

      fireEvent.click(screen.getByText("Install"));

      await waitFor(() => {
        expect(installCli).toHaveBeenCalledTimes(1);
      });
    });

    it("closes dialog when Cancel is clicked", async () => {
      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText("Install CLI Tool"));
      });

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("uninstall CLI flow", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(true);
    });

    it("shows confirmation dialog when Uninstall CLI Tool is clicked", async () => {
      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText("Uninstall CLI Tool"));
      });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Uninstall")).toBeInTheDocument();
    });

    it("calls uninstallCli when confirmed", async () => {
      vi.mocked(uninstallCli).mockResolvedValue("CLI tool uninstalled successfully.");

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText("Uninstall CLI Tool"));
      });

      fireEvent.click(screen.getByText("Uninstall"));

      await waitFor(() => {
        expect(uninstallCli).toHaveBeenCalledTimes(1);
      });
    });

    it("updates state to show Install after successful uninstall", async () => {
      vi.mocked(uninstallCli).mockResolvedValue("CLI tool uninstalled successfully.");

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText("Uninstall CLI Tool"));
      });

      fireEvent.click(screen.getByText("Uninstall"));

      // After uninstall, opening menu should show Install option
      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });
    });
  });

  describe("check for updates", () => {
    it("shows Check for Updates menu item", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      expect(screen.getByText("Check for Updates")).toBeInTheDocument();
    });

    it("shows up-to-date notification when no update available", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
      vi.mocked(checkForUpdate).mockResolvedValue({ available: false });

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("Check for Updates"));

      await waitFor(() => {
        const state = useRepositoryStore.getState();
        expect(state.successMessage).toBe("You're up to date!");
      });
    });

    it("shows update dialog when update is available", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
        notes: "New features",
      });

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("Check for Updates"));

      await waitFor(() => {
        expect(screen.getByText("Update Available")).toBeInTheDocument();
        expect(screen.getByText("New features")).toBeInTheDocument();
        expect(screen.getByText("Update & Restart")).toBeInTheDocument();
        expect(screen.getByText("View release on GitHub")).toBeInTheDocument();
      });
    });

    it("calls downloadAndInstallUpdate when Update & Restart is clicked", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });
      vi.mocked(downloadAndInstallUpdate).mockResolvedValue(undefined);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("Check for Updates"));

      await waitFor(() => {
        fireEvent.click(screen.getByText("Update & Restart"));
      });

      await waitFor(() => {
        expect(downloadAndInstallUpdate).toHaveBeenCalled();
      });
    });

    it("shows error when auto-update fails", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });
      vi.mocked(downloadAndInstallUpdate).mockRejectedValue(new Error("Not supported"));

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("Check for Updates"));

      await waitFor(() => {
        fireEvent.click(screen.getByText("Update & Restart"));
      });

      await waitFor(() => {
        expect(screen.getByText(/Auto-update failed/)).toBeInTheDocument();
      });
    });

    it("dismisses update dialog when Later is clicked", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("Check for Updates"));

      await waitFor(() => {
        expect(screen.getByText("Update Available")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Later"));

      expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
    });

    it("sets store error when check fails", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
      vi.mocked(checkForUpdate).mockRejectedValue(new Error("Network error"));

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("Check for Updates"));

      await waitFor(() => {
        expect(useRepositoryStore.getState().error).toContain("Failed to check for updates");
      });
    });

    it("shows symlink-specific error when update check fails due to symlink", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
      vi.mocked(checkForUpdate).mockRejectedValue(
        new Error(
          "StartingBinary found current_exe() that contains a symlink on a non-allowed platform"
        )
      );

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("Check for Updates"));

      await waitFor(() => {
        const error = useRepositoryStore.getState().error;
        expect(error).toContain("outdated symlink");
        expect(error).toContain("reinstall the CLI tool");
      });
    });
  });

  describe("about dialog", () => {
    it("opens About dialog when About is clicked", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("About"));

      expect(screen.getByText("About Yet Another Git Gui")).toBeInTheDocument();
    });

    it("closes About dialog when Close is clicked", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<SettingsMenu />);

      await waitFor(() => {
        fireEvent.click(screen.getByTitle("Settings"));
      });

      fireEvent.click(screen.getByText("About"));

      expect(screen.getByText("About Yet Another Git Gui")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Close"));

      expect(screen.queryByText("About Yet Another Git Gui")).not.toBeInTheDocument();
    });
  });
});
