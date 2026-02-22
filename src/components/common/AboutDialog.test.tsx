import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AboutDialog } from "./AboutDialog";
import { getAppInfo, checkForUpdate, downloadAndInstallUpdate } from "../../services/system";

vi.mock("../../services/system", () => ({
  getAppInfo: vi.fn(),
  checkForUpdate: vi.fn(),
  downloadAndInstallUpdate: vi.fn(),
  writeUpdateLog: vi.fn().mockResolvedValue(undefined),
  getUpdateLogPath: vi.fn().mockResolvedValue("/home/user/.local/share/yagg/update.log"),
  getReleaseUrl: vi.fn(
    (v: string) => `https://github.com/mywill/YetAnotherGitGui/releases/tag/v${v}`
  ),
}));

describe("AboutDialog", () => {
  const mockOnClose = vi.fn();

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

  it("renders the dialog with title", async () => {
    render(<AboutDialog onClose={mockOnClose} />);

    expect(screen.getByText("About Yet Another Git Gui")).toBeInTheDocument();
  });

  it("displays app info when loaded", async () => {
    render(<AboutDialog onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("1.2.0")).toBeInTheDocument();
      expect(screen.getByText("2.0.0")).toBeInTheDocument();
      expect(screen.getByText("macos")).toBeInTheDocument();
      expect(screen.getByText("aarch64")).toBeInTheDocument();
    });
  });

  it("displays labels for each field", async () => {
    render(<AboutDialog onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Version")).toBeInTheDocument();
      expect(screen.getByText("Tauri")).toBeInTheDocument();
      expect(screen.getByText("Platform")).toBeInTheDocument();
      expect(screen.getByText("Architecture")).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching app info", () => {
    vi.mocked(getAppInfo).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    render(<AboutDialog onClose={mockOnClose} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("handles getAppInfo failure gracefully", async () => {
    vi.mocked(getAppInfo).mockRejectedValue(new Error("Failed"));

    render(<AboutDialog onClose={mockOnClose} />);

    // Should show loading initially, then stay in loading state on failure
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", async () => {
    render(<AboutDialog onClose={mockOnClose} />);

    fireEvent.click(screen.getByText("Close"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    render(<AboutDialog onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const { container } = render(<AboutDialog onClose={mockOnClose} />);

    const backdrop = container.querySelector(".confirm-dialog-backdrop");
    fireEvent.click(backdrop!);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when dialog content is clicked", async () => {
    render(<AboutDialog onClose={mockOnClose} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("has correct aria attributes", () => {
    render(<AboutDialog onClose={mockOnClose} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "about-dialog-title");
  });

  it("calls getAppInfo on mount", () => {
    render(<AboutDialog onClose={mockOnClose} />);

    expect(getAppInfo).toHaveBeenCalledTimes(1);
  });

  describe("update status row", () => {
    it("shows Update label", async () => {
      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Update")).toBeInTheDocument();
      });
    });

    it("shows checking state while update check is pending", async () => {
      vi.mocked(checkForUpdate).mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      render(<AboutDialog onClose={mockOnClose} />);

      // Wait for appInfo to load so the table renders
      await waitFor(() => {
        expect(screen.getByText("Version")).toBeInTheDocument();
      });

      expect(screen.getByText("Checking...")).toBeInTheDocument();
    });

    it("shows up to date when no update available", async () => {
      vi.mocked(checkForUpdate).mockResolvedValue({ available: false });

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Up to date")).toBeInTheDocument();
      });
    });

    it("shows available version with update button", async () => {
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/v2.0.0 available/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
        expect(screen.getByText("View release")).toBeInTheDocument();
      });
    });

    it("calls downloadAndInstallUpdate when Update button clicked", async () => {
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });
      vi.mocked(downloadAndInstallUpdate).mockResolvedValue(undefined);

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole("button", { name: "Update" }));
      });

      await waitFor(() => {
        expect(downloadAndInstallUpdate).toHaveBeenCalled();
      });
    });

    it("shows error when auto-update fails", async () => {
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });
      vi.mocked(downloadAndInstallUpdate).mockRejectedValue(new Error("Failed"));

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole("button", { name: "Update" }));
      });

      await waitFor(() => {
        expect(screen.getByText(/Auto-update failed/)).toBeInTheDocument();
        expect(screen.getByText("Download manually")).toBeInTheDocument();
      });
    });

    it("shows check failed when update check errors", async () => {
      vi.mocked(checkForUpdate).mockRejectedValue(new Error("Network error"));

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Check failed")).toBeInTheDocument();
      });
    });

    it("shows symlink-specific error when update check fails due to symlink", async () => {
      vi.mocked(checkForUpdate).mockRejectedValue(
        new Error(
          "StartingBinary found current_exe() that contains a symlink on a non-allowed platform"
        )
      );

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Check failed")).toBeInTheDocument();
        expect(screen.getByText(/outdated CLI symlink/)).toBeInTheDocument();
      });
    });

    it("checks for updates on mount", () => {
      render(<AboutDialog onClose={mockOnClose} />);

      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
