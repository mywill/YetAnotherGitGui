import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpdateDialog } from "./UpdateDialog";
import {
  downloadAndInstallUpdate,
  writeUpdateLog,
  getUpdateLogPath,
  getReleaseUrl,
} from "../../services/system";
import { openUrl } from "@tauri-apps/plugin-opener";

vi.mock("../../services/system", () => ({
  downloadAndInstallUpdate: vi.fn(),
  writeUpdateLog: vi.fn().mockResolvedValue(undefined),
  getUpdateLogPath: vi.fn().mockResolvedValue("/home/user/.local/share/yagg/update.log"),
  getReleaseUrl: vi.fn(
    (v: string) => `https://github.com/mywill/YetAnotherGitGui/releases/tag/v${v}`
  ),
}));

describe("UpdateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReleaseUrl).mockImplementation(
      (v: string) => `https://github.com/mywill/YetAnotherGitGui/releases/tag/v${v}`
    );
    vi.mocked(getUpdateLogPath).mockResolvedValue("/home/user/.local/share/yagg/update.log");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title, version, and release notes from info", () => {
    render(
      <UpdateDialog
        info={{ available: true, version: "2.5.0", notes: "Bug fixes and improvements" }}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Update Available")).toBeInTheDocument();
    expect(screen.getByText("2.5.0")).toBeInTheDocument();
    expect(screen.getByText("Bug fixes and improvements")).toBeInTheDocument();
    expect(screen.getByText("Update & Restart")).toBeInTheDocument();
    expect(screen.getByText("View release on GitHub")).toBeInTheDocument();
  });

  it("View release on GitHub link calls openUrl with the release URL", () => {
    render(
      <UpdateDialog info={{ available: true, version: "3.0.0", notes: "x" }} onClose={() => {}} />
    );

    fireEvent.click(screen.getByText("View release on GitHub"));

    expect(openUrl).toHaveBeenCalledWith(
      "https://github.com/mywill/YetAnotherGitGui/releases/tag/v3.0.0"
    );
  });

  it("Update & Restart calls downloadAndInstallUpdate and flips button label to Installing...", async () => {
    let resolveInstall: () => void = () => {};
    vi.mocked(downloadAndInstallUpdate).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInstall = resolve;
      })
    );

    render(<UpdateDialog info={{ available: true, version: "2.0.0" }} onClose={() => {}} />);

    fireEvent.click(screen.getByText("Update & Restart"));

    await waitFor(() => {
      expect(downloadAndInstallUpdate).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Installing...")).toBeInTheDocument();
    });

    resolveInstall();
  });

  it("renders error and writes update log when install rejects", async () => {
    vi.mocked(downloadAndInstallUpdate).mockRejectedValue(new Error("not signed"));

    render(<UpdateDialog info={{ available: true, version: "2.0.0" }} onClose={() => {}} />);

    fireEvent.click(screen.getByText("Update & Restart"));

    await waitFor(() => {
      expect(screen.getByText(/Auto-update failed/)).toBeInTheDocument();
      expect(screen.getByText(/not signed/)).toBeInTheDocument();
      expect(screen.getByText(/update\.log/)).toBeInTheDocument();
    });
    expect(writeUpdateLog).toHaveBeenCalledWith(expect.stringContaining("not signed"));
  });

  it("Later button calls onClose", () => {
    const onClose = vi.fn();
    render(<UpdateDialog info={{ available: true, version: "2.0.0" }} onClose={onClose} />);

    fireEvent.click(screen.getByText("Later"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the dialog into document.body via portal", () => {
    const { container } = render(
      <UpdateDialog info={{ available: true, version: "2.0.0" }} onClose={() => {}} />
    );

    // The component itself doesn't render anything inside its mount node — it's portaled.
    expect(container.querySelector(".confirm-dialog")).toBeNull();
    expect(document.body.querySelector(".confirm-dialog")).not.toBeNull();
  });

  it("returns null when info.available is false", () => {
    const { container } = render(<UpdateDialog info={{ available: false }} onClose={() => {}} />);

    expect(container.firstChild).toBeNull();
    expect(document.body.querySelector(".confirm-dialog")).toBeNull();
  });
});
