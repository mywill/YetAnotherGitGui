import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSettingsStore } from "./settingsStore";
import { useNotificationStore } from "./notificationStore";
import { useSelectionStore } from "./selectionStore";

// Mock the settings service
vi.mock("../services/settings", () => ({
  readSettings: vi.fn().mockResolvedValue({}),
  writeSettings: vi.fn().mockResolvedValue(undefined),
}));

// Mock the logging service so the debug-logging backend setter is controllable
// and its rejection paths can be exercised for coverage.
const mockSetDebugLoggingEnabled = vi.fn().mockResolvedValue(undefined);
vi.mock("../services/logging", () => ({
  setDebugLoggingEnabled: (...args: unknown[]) => mockSetDebugLoggingEnabled(...args),
}));

describe("settingsStore", () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useSettingsStore.setState({
      density: "compact",
      textSize: "medium",
      theme: "dark",
      layoutSizes: {},
      sectionExpanded: {},
      autoCheckForUpdates: true,
      debugLoggingEnabled: false,
      worktreesDefaultParentDir: null,
      worktreesRecent: [],
      enabledTabs: { cleanup: true, worktrees: false },
      loaded: false,
    });
    // Reset DOM dataset
    delete document.documentElement.dataset.density;
    delete document.documentElement.dataset.textSize;
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("defaults", () => {
    it("has correct default values", () => {
      const state = useSettingsStore.getState();
      expect(state.density).toBe("compact");
      expect(state.textSize).toBe("medium");
      expect(state.theme).toBe("dark");
      expect(state.layoutSizes).toEqual({});
      expect(state.loaded).toBe(false);
    });
  });

  describe("load", () => {
    it("loads settings and applies to DOM", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({
        density: "spacious",
        theme: "light",
        layoutSizes: { "history.details": 350 },
      });

      await useSettingsStore.getState().load();

      const state = useSettingsStore.getState();
      expect(state.density).toBe("spacious");
      expect(state.theme).toBe("light");
      expect(state.layoutSizes).toEqual({ "history.details": 350 });
      expect(state.loaded).toBe(true);
      expect(document.documentElement.dataset.density).toBe("spacious");
      expect(document.documentElement.dataset.theme).toBe("light");
    });

    it("uses defaults when settings file is empty", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({});

      await useSettingsStore.getState().load();

      const state = useSettingsStore.getState();
      expect(state.density).toBe("compact");
      expect(state.theme).toBe("dark");
      expect(state.loaded).toBe(true);
    });

    it("uses defaults when read fails", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockRejectedValue(new Error("read error"));

      await useSettingsStore.getState().load();

      const state = useSettingsStore.getState();
      expect(state.density).toBe("compact");
      expect(state.theme).toBe("dark");
      expect(state.loaded).toBe(true);
    });
  });

  describe("setDensity", () => {
    it("updates density and DOM", () => {
      useSettingsStore.getState().setDensity("spacious");
      expect(useSettingsStore.getState().density).toBe("spacious");
      expect(document.documentElement.dataset.density).toBe("spacious");
    });
  });

  describe("setTextSize", () => {
    it("updates text size and DOM", () => {
      useSettingsStore.getState().setTextSize("large");
      expect(useSettingsStore.getState().textSize).toBe("large");
      expect(document.documentElement.dataset.textSize).toBe("large");
    });

    it("loads persisted text size and applies to DOM", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({ textSize: "small" });

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().textSize).toBe("small");
      expect(document.documentElement.dataset.textSize).toBe("small");
    });

    it("defaults to medium when settings file lacks textSize", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({ density: "comfortable" });

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().textSize).toBe("medium");
      expect(document.documentElement.dataset.textSize).toBe("medium");
    });
  });

  describe("setTheme", () => {
    it("updates theme and DOM", () => {
      useSettingsStore.getState().setTheme("light");
      expect(useSettingsStore.getState().theme).toBe("light");
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });

  describe("autoCheckForUpdates", () => {
    it("defaults to true after fresh load with empty saved state", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({});

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().autoCheckForUpdates).toBe(true);
    });

    it("setAutoCheckForUpdates(false) persists with the field", async () => {
      const { writeSettings } = await import("../services/settings");
      vi.useFakeTimers();

      useSettingsStore.getState().setAutoCheckForUpdates(false);
      vi.advanceTimersByTime(0);

      expect(useSettingsStore.getState().autoCheckForUpdates).toBe(false);
      expect(writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoCheckForUpdates: false })
      );
      vi.useRealTimers();
    });

    it("load() round-trips a persisted autoCheckForUpdates: false", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({ autoCheckForUpdates: false });

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().autoCheckForUpdates).toBe(false);
    });
  });

  describe("setLayoutSize", () => {
    it("sets a layout size by key", () => {
      useSettingsStore.getState().setLayoutSize("history.details", 400);
      expect(useSettingsStore.getState().layoutSizes["history.details"]).toBe(400);
    });

    it("merges with existing layout sizes", () => {
      useSettingsStore.getState().setLayoutSize("history.details", 400);
      useSettingsStore.getState().setLayoutSize("workspace.terminal", 200);
      const sizes = useSettingsStore.getState().layoutSizes;
      expect(sizes["history.details"]).toBe(400);
      expect(sizes["workspace.terminal"]).toBe(200);
    });
  });

  describe("toggleSectionExpanded", () => {
    beforeEach(() => {
      // The outer beforeEach doesn't reset sectionExpanded, so do it here
      // to keep these tests isolated from each other.
      useSettingsStore.setState({ sectionExpanded: {} });
    });

    it("flips an unset key to true on first toggle", () => {
      useSettingsStore.getState().toggleSectionExpanded("cleanup.gone");
      expect(useSettingsStore.getState().sectionExpanded["cleanup.gone"]).toBe(true);
    });

    it("flips back to false on a second toggle", () => {
      useSettingsStore.getState().toggleSectionExpanded("cleanup.gone");
      useSettingsStore.getState().toggleSectionExpanded("cleanup.gone");
      expect(useSettingsStore.getState().sectionExpanded["cleanup.gone"]).toBe(false);
    });

    it("does not clobber other keys when toggling one key", () => {
      useSettingsStore.getState().setSectionExpanded("cleanup.merged", true);
      useSettingsStore.getState().toggleSectionExpanded("cleanup.gone");
      expect(useSettingsStore.getState().sectionExpanded["cleanup.merged"]).toBe(true);
      expect(useSettingsStore.getState().sectionExpanded["cleanup.gone"]).toBe(true);
    });
  });

  describe("persistence", () => {
    it("calls writeSettings on density change", async () => {
      const { writeSettings } = await import("../services/settings");
      vi.useFakeTimers();

      useSettingsStore.getState().setDensity("comfortable");
      vi.advanceTimersByTime(0);

      expect(writeSettings).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("debounces writeSettings on layout size changes", async () => {
      const { writeSettings } = await import("../services/settings");
      vi.useFakeTimers();

      useSettingsStore.getState().setLayoutSize("a", 100);
      useSettingsStore.getState().setLayoutSize("b", 200);
      useSettingsStore.getState().setLayoutSize("c", 300);

      // Should not have been called yet (debounced 500ms)
      vi.advanceTimersByTime(100);
      const callsBeforeDebounce = vi.mocked(writeSettings).mock.calls.length;

      vi.advanceTimersByTime(500);
      const callsAfterDebounce = vi.mocked(writeSettings).mock.calls.length;

      // Should have called once after debounce, not three times
      expect(callsAfterDebounce - callsBeforeDebounce).toBe(1);
      vi.useRealTimers();
    });
  });

  describe("persistence error surfacing", () => {
    beforeEach(() => {
      useNotificationStore.setState({ notifications: [] });
    });

    it("shows an error toast when writeSettings rejects", async () => {
      const { writeSettings } = await import("../services/settings");
      vi.mocked(writeSettings).mockRejectedValueOnce(new Error("disk full"));

      vi.useFakeTimers();
      useSettingsStore.getState().setTheme("light");
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();

      // Let the rejected promise propagate.
      await Promise.resolve();
      await Promise.resolve();

      const toasts = useNotificationStore.getState().notifications;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe("error");
      expect(toasts[0].message).toContain("Failed to save settings");
      expect(toasts[0].message).toContain("disk full");
    });

    it("debounces identical errors within 5s", async () => {
      const { writeSettings } = await import("../services/settings");
      vi.mocked(writeSettings).mockRejectedValue(new Error("permission denied"));

      // Two changes back-to-back with the same failure should produce ONE toast.
      useSettingsStore.getState().setTheme("light");
      // Allow microtasks/macrotasks to run for the first persist+catch.
      await new Promise((r) => setTimeout(r, 5));
      useSettingsStore.getState().setTheme("dark");
      await new Promise((r) => setTimeout(r, 5));

      const toasts = useNotificationStore.getState().notifications;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toContain("permission denied");
    });

    it("propagates non-Error rejections via String() conversion", async () => {
      const { writeSettings } = await import("../services/settings");
      vi.mocked(writeSettings).mockRejectedValueOnce("Invalid path: /nope");

      useSettingsStore.getState().setDensity("spacious");
      await new Promise((r) => setTimeout(r, 5));

      const toasts = useNotificationStore.getState().notifications;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toContain("Invalid path: /nope");
    });
  });

  describe("resetToDefaults", () => {
    beforeEach(() => {
      useNotificationStore.setState({ notifications: [] });
      // Put the store in a non-default state before each test
      useSettingsStore.setState({
        density: "spacious",
        textSize: "large",
        theme: "light",
        layoutSizes: { "history.details": 350 },
        sectionExpanded: { "cleanup.gone": true },
        autoCheckForUpdates: false,
        debugLoggingEnabled: true,
        worktreesDefaultParentDir: "/tmp/wts",
        worktreesRecent: ["a", "b"],
        enabledTabs: { cleanup: false, worktrees: true },
        loaded: true,
      });
      document.documentElement.dataset.density = "spacious";
      document.documentElement.dataset.textSize = "large";
      document.documentElement.dataset.theme = "light";
    });

    it("resets all settings to default values", () => {
      useSettingsStore.getState().resetToDefaults();
      const state = useSettingsStore.getState();
      expect(state.density).toBe("compact");
      expect(state.textSize).toBe("medium");
      expect(state.theme).toBe("dark");
      expect(state.layoutSizes).toEqual({});
      expect(state.sectionExpanded).toEqual({});
      expect(state.autoCheckForUpdates).toBe(true);
      expect(state.debugLoggingEnabled).toBe(false);
      expect(state.enabledTabs).toEqual({ cleanup: true, worktrees: false });
    });

    it("applies defaults to DOM dataset", () => {
      useSettingsStore.getState().resetToDefaults();
      expect(document.documentElement.dataset.density).toBe("compact");
      expect(document.documentElement.dataset.textSize).toBe("medium");
      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    it("clears pending persist timer before writing", async () => {
      vi.useFakeTimers();
      // Call a setter so a timer is pending
      useSettingsStore.getState().setDensity("comfortable");
      // Don't advance the timer — now reset
      useSettingsStore.getState().resetToDefaults();
      // Advance past the original timer — should NOT trigger a stale write
      vi.advanceTimersByTime(1000);

      const { writeSettings } = await import("../services/settings");
      // The call from resetToDefaults + no stale call
      expect(writeSettings).toHaveBeenCalledTimes(1);
      expect(writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ density: "compact", layoutSizes: {} })
      );
      vi.useRealTimers();
    });

    it("calls writeSettings with default values", async () => {
      const { writeSettings } = await import("../services/settings");
      useSettingsStore.getState().resetToDefaults();

      await new Promise((r) => setTimeout(r, 5));

      expect(writeSettings).toHaveBeenCalledWith({
        density: "compact",
        textSize: "medium",
        theme: "dark",
        layoutSizes: {},
        sectionExpanded: {},
        autoCheckForUpdates: true,
        debugLoggingEnabled: false,
        worktreesDefaultParentDir: null,
        worktreesRecent: [],
        enabledTabs: { cleanup: true, worktrees: false },
      });
    });

    it("shows error toast when writeSettings rejects", async () => {
      const { writeSettings } = await import("../services/settings");
      vi.mocked(writeSettings).mockRejectedValueOnce(new Error("disk full"));

      useSettingsStore.getState().resetToDefaults();
      await new Promise((r) => setTimeout(r, 5));

      const toasts = useNotificationStore.getState().notifications;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe("error");
      expect(toasts[0].message).toContain("disk full");
    });

    it("swallows a backend rejection when disabling debug logging during reset", async () => {
      mockSetDebugLoggingEnabled.mockRejectedValueOnce(new Error("backend down"));

      useSettingsStore.getState().resetToDefaults();
      // Let the rejected promise + catch handler flush.
      await new Promise((r) => setTimeout(r, 5));

      // State still resets despite the backend rejection.
      expect(useSettingsStore.getState().debugLoggingEnabled).toBe(false);
    });
  });

  describe("debug logging", () => {
    afterEach(() => {
      mockSetDebugLoggingEnabled.mockReset();
      mockSetDebugLoggingEnabled.mockResolvedValue(undefined);
    });

    it("setDebugLoggingEnabled forwards to the backend and persists", async () => {
      useSettingsStore.getState().setDebugLoggingEnabled(true);
      await new Promise((r) => setTimeout(r, 5));

      expect(useSettingsStore.getState().debugLoggingEnabled).toBe(true);
      expect(mockSetDebugLoggingEnabled).toHaveBeenCalledWith(true);
    });

    it("swallows a backend rejection without throwing", async () => {
      mockSetDebugLoggingEnabled.mockRejectedValueOnce(new Error("nope"));

      useSettingsStore.getState().setDebugLoggingEnabled(false);
      await new Promise((r) => setTimeout(r, 5));

      // State still updated locally even though the backend rejected.
      expect(useSettingsStore.getState().debugLoggingEnabled).toBe(false);
    });
  });

  describe("worktree settings", () => {
    it("setWorktreesDefaultParentDir updates state and persists", async () => {
      const { writeSettings } = await import("../services/settings");
      useSettingsStore.getState().setWorktreesDefaultParentDir("/tmp/wts");
      await new Promise((r) => setTimeout(r, 5));
      expect(useSettingsStore.getState().worktreesDefaultParentDir).toBe("/tmp/wts");
      expect(writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ worktreesDefaultParentDir: "/tmp/wts" })
      );
    });

    it("addRecentWorktree prepends and deduplicates", async () => {
      useSettingsStore.setState({ worktreesRecent: ["b", "c"] });
      useSettingsStore.getState().addRecentWorktree("a");
      useSettingsStore.getState().addRecentWorktree("b");
      expect(useSettingsStore.getState().worktreesRecent).toEqual(["b", "a", "c"]);
    });

    it("addRecentWorktree caps at 20 entries", () => {
      for (let i = 0; i < 25; i++) {
        useSettingsStore.getState().addRecentWorktree(`wt-${i}`);
      }
      expect(useSettingsStore.getState().worktreesRecent.length).toBe(20);
    });
  });

  describe("enabledTabs", () => {
    it("defaults to cleanup on, worktrees off", () => {
      const { enabledTabs } = useSettingsStore.getState();
      expect(enabledTabs.cleanup).toBe(true);
      expect(enabledTabs.worktrees).toBe(false);
    });

    it("setEnabledTab updates state and persists", async () => {
      const { writeSettings } = await import("../services/settings");
      useSettingsStore.getState().setEnabledTab("worktrees", true);
      await new Promise((r) => setTimeout(r, 5));
      expect(useSettingsStore.getState().enabledTabs.worktrees).toBe(true);
      expect(writeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ enabledTabs: { cleanup: true, worktrees: true } })
      );
    });

    it("load() applies per-field fallback for old settings without enabledTabs", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({ density: "spacious" });

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().enabledTabs).toEqual({
        cleanup: true,
        worktrees: false,
      });
    });

    it("load() round-trips a persisted enabledTabs", async () => {
      const { readSettings } = await import("../services/settings");
      vi.mocked(readSettings).mockResolvedValue({
        enabledTabs: { cleanup: false, worktrees: true },
      });

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().enabledTabs).toEqual({
        cleanup: false,
        worktrees: true,
      });
    });

    it("disabling the currently-active tab switches to Working Copy", () => {
      useSettingsStore.setState({
        enabledTabs: { cleanup: true, worktrees: true },
      });
      useSelectionStore.setState({ activeView: "worktrees" });

      useSettingsStore.getState().setEnabledTab("worktrees", false);

      expect(useSettingsStore.getState().enabledTabs.worktrees).toBe(false);
      expect(useSelectionStore.getState().activeView).toBe("status");
    });

    it("disabling a non-active tab leaves the active view untouched", () => {
      useSettingsStore.setState({
        enabledTabs: { cleanup: true, worktrees: true },
      });
      useSelectionStore.setState({ activeView: "history" });

      useSettingsStore.getState().setEnabledTab("worktrees", false);

      expect(useSettingsStore.getState().enabledTabs.worktrees).toBe(false);
      expect(useSelectionStore.getState().activeView).toBe("history");
    });
  });
});
