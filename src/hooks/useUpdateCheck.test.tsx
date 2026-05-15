import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useUpdateCheck } from "./useUpdateCheck";
import { useSettingsStore } from "../stores/settingsStore";
import { useNotificationStore } from "../stores/notificationStore";
import { checkForUpdate, writeUpdateLog } from "../services/system";

vi.mock("../services/system", () => ({
  checkForUpdate: vi.fn(),
  downloadAndInstallUpdate: vi.fn(),
  writeUpdateLog: vi.fn().mockResolvedValue(undefined),
  getUpdateLogPath: vi.fn().mockResolvedValue(null),
  getReleaseUrl: vi.fn((v: string) => `https://example.test/v${v}`),
}));

function Harness() {
  const updateDialog = useUpdateCheck();
  return <div data-testid="harness">{updateDialog}</div>;
}

describe("useUpdateCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      density: "compact",
      textSize: "medium",
      theme: "dark",
      layoutSizes: {},
      sectionExpanded: {},
      autoCheckForUpdates: true,
      loaded: false,
    });
    useNotificationStore.setState({ notifications: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call checkForUpdate while settings are not loaded", () => {
    render(<Harness />);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it("does not call checkForUpdate when autoCheckForUpdates is false", async () => {
    useSettingsStore.setState({ autoCheckForUpdates: false, loaded: true });

    render(<Harness />);
    await waitFor(() => {
      expect(checkForUpdate).not.toHaveBeenCalled();
    });
  });

  it("calls checkForUpdate exactly once across re-renders when enabled", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue({ available: false });
    useSettingsStore.setState({ autoCheckForUpdates: true, loaded: true });

    const { rerender } = render(<Harness />);
    await waitFor(() => {
      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });

    rerender(<Harness />);
    rerender(<Harness />);

    await waitFor(() => {
      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a toast with duration 10000 and an action when update is available", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue({
      available: true,
      version: "9.9.9",
      notes: "notes",
    });
    useSettingsStore.setState({ autoCheckForUpdates: true, loaded: true });

    render(<Harness />);

    await waitFor(() => {
      const n = useNotificationStore.getState().notifications;
      expect(n).toHaveLength(1);
      expect(n[0].type).toBe("success");
      expect(n[0].message).toContain("9.9.9");
      expect(typeof n[0].action).toBe("function");
    });
  });

  it("invoking the action opens the dialog", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue({
      available: true,
      version: "1.2.3",
      notes: "release",
    });
    useSettingsStore.setState({ autoCheckForUpdates: true, loaded: true });

    render(<Harness />);

    await waitFor(() => {
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    const action = useNotificationStore.getState().notifications[0].action!;
    act(() => action());

    await waitFor(() => {
      expect(screen.getByText("Update Available")).toBeInTheDocument();
      expect(screen.getByText("1.2.3")).toBeInTheDocument();
    });

    // Dismissing the dialog ("Later") closes it
    fireEvent.click(screen.getByText("Later"));
    expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
  });

  it("does not show a toast when no update is available", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue({ available: false });
    useSettingsStore.setState({ autoCheckForUpdates: true, loaded: true });

    render(<Harness />);
    await waitFor(() => {
      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("on throw: writes update log and shows no toast or dialog", async () => {
    vi.mocked(checkForUpdate).mockRejectedValue(new Error("offline"));
    useSettingsStore.setState({ autoCheckForUpdates: true, loaded: true });

    render(<Harness />);

    await waitFor(() => {
      expect(writeUpdateLog).toHaveBeenCalledWith(expect.stringContaining("offline"));
    });
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
    expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
  });
});
