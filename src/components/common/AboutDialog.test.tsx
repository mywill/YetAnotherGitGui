import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AboutDialog } from "./AboutDialog";
import { getAppInfo, checkForUpdate } from "../../services/system";

vi.mock("../../services/system", () => ({
  getAppInfo: vi.fn(),
  checkForUpdate: vi.fn(),
  writeUpdateLog: vi.fn().mockResolvedValue(undefined),
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
    render(<AboutDialog onClose={mockOnClose} />);

    const backdrop = document.querySelector(".confirm-dialog-backdrop");
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

    it("shows available version with view update button", async () => {
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/v2.0.0 available/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "View update" })).toBeInTheDocument();
        expect(screen.queryByText("View release")).not.toBeInTheDocument();
      });
    });

    it("calls onUpdateRequested with the update info when Update button is clicked", async () => {
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
        notes: "release notes",
      });
      const onUpdateRequested = vi.fn();

      render(<AboutDialog onClose={mockOnClose} onUpdateRequested={onUpdateRequested} />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole("button", { name: "View update" }));
      });

      expect(onUpdateRequested).toHaveBeenCalledTimes(1);
      expect(onUpdateRequested).toHaveBeenCalledWith({
        available: true,
        version: "2.0.0",
        notes: "release notes",
      });
    });

    it("is safe to click Update when no onUpdateRequested callback is provided", async () => {
      vi.mocked(checkForUpdate).mockResolvedValue({
        available: true,
        version: "2.0.0",
      });

      render(<AboutDialog onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "View update" })).toBeInTheDocument();
      });

      expect(() =>
        fireEvent.click(screen.getByRole("button", { name: "View update" }))
      ).not.toThrow();
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
