import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSettingsStore } from "./settingsStore";

// Mock the settings service
vi.mock("../services/settings", () => ({
  readSettings: vi.fn().mockResolvedValue({}),
  writeSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("settingsStore", () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useSettingsStore.setState({
      density: "compact",
      textSize: "medium",
      theme: "dark",
      inspectorVisible: true,
      layoutSizes: {},
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
      expect(state.inspectorVisible).toBe(true);
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
        inspectorVisible: false,
        layoutSizes: { "workspace.inspector": 350 },
      });

      await useSettingsStore.getState().load();

      const state = useSettingsStore.getState();
      expect(state.density).toBe("spacious");
      expect(state.theme).toBe("light");
      expect(state.inspectorVisible).toBe(false);
      expect(state.layoutSizes).toEqual({ "workspace.inspector": 350 });
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
      expect(state.inspectorVisible).toBe(true);
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

  describe("setInspectorVisible", () => {
    it("updates inspector visibility", () => {
      useSettingsStore.getState().setInspectorVisible(false);
      expect(useSettingsStore.getState().inspectorVisible).toBe(false);
    });
  });

  describe("setLayoutSize", () => {
    it("sets a layout size by key", () => {
      useSettingsStore.getState().setLayoutSize("workspace.inspector", 400);
      expect(useSettingsStore.getState().layoutSizes["workspace.inspector"]).toBe(400);
    });

    it("merges with existing layout sizes", () => {
      useSettingsStore.getState().setLayoutSize("workspace.inspector", 400);
      useSettingsStore.getState().setLayoutSize("workspace.terminal", 200);
      const sizes = useSettingsStore.getState().layoutSizes;
      expect(sizes["workspace.inspector"]).toBe(400);
      expect(sizes["workspace.terminal"]).toBe(200);
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
});
