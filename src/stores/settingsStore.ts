import { create } from "zustand";
import { readSettings, writeSettings } from "../services/settings";
import type { SettingsData } from "../services/settings";
import { useNotificationStore } from "./notificationStore";
import { cleanErrorMessage } from "../utils/errorMessages";
import { setDebugLoggingEnabled as setDebugLoggingEnabledBackend } from "../services/logging";
import { logError } from "../utils/logger";
import { useSelectionStore } from "./selectionStore";

export type Density = "compact" | "comfortable" | "spacious";
export type TextSize = "small" | "medium" | "large";
export type Theme = "dark" | "light";

export interface EnabledTabs {
  cleanup: boolean;
  worktrees: boolean;
}

interface SettingsState {
  density: Density;
  textSize: TextSize;
  theme: Theme;
  layoutSizes: Record<string, number>;
  sectionExpanded: Record<string, boolean>;
  autoCheckForUpdates: boolean;
  debugLoggingEnabled: boolean;
  worktreesDefaultParentDir: string | null;
  worktreesRecent: string[];
  enabledTabs: EnabledTabs;
  loaded: boolean;

  load: () => Promise<void>;
  setDensity: (d: Density) => void;
  setTextSize: (t: TextSize) => void;
  setTheme: (t: Theme) => void;
  setLayoutSize: (key: string, px: number) => void;
  setSectionExpanded: (key: string, value: boolean) => void;
  toggleSectionExpanded: (key: string) => void;
  setAutoCheckForUpdates: (value: boolean) => void;
  setDebugLoggingEnabled: (value: boolean) => void;
  setWorktreesDefaultParentDir: (dir: string | null) => void;
  addRecentWorktree: (name: string) => void;
  setEnabledTab: (tab: "cleanup" | "worktrees", value: boolean) => void;
  resetToDefaults: () => void;
}

const DEFAULTS: Omit<
  SettingsState,
  | "loaded"
  | "load"
  | "setDensity"
  | "setTextSize"
  | "setTheme"
  | "setLayoutSize"
  | "setSectionExpanded"
  | "toggleSectionExpanded"
  | "setAutoCheckForUpdates"
  | "setDebugLoggingEnabled"
  | "setWorktreesDefaultParentDir"
  | "addRecentWorktree"
  | "setEnabledTab"
  | "resetToDefaults"
> = {
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
};

// Module-level so concurrent setter calls coalesce into one persist write.
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// Suppress duplicate "settings save failed" toasts when the user keeps poking
// settings on a broken disk. Tracks the last shown error message + timestamp.
const PERSIST_ERROR_DEBOUNCE_MS = 5000;
let lastPersistErrorMessage: string | null = null;
let lastPersistErrorAt = 0;

function notifyPersistError(message: string) {
  const now = Date.now();
  if (message === lastPersistErrorMessage && now - lastPersistErrorAt < PERSIST_ERROR_DEBOUNCE_MS) {
    return;
  }
  lastPersistErrorMessage = message;
  lastPersistErrorAt = now;
  useNotificationStore.getState().showError(`Failed to save settings: ${message}`);
}

function applyToDOM(density: Density, textSize: TextSize, theme: Theme) {
  document.documentElement.dataset.density = density;
  document.documentElement.dataset.textSize = textSize;
  document.documentElement.dataset.theme = theme;
}

function persistDebounced(getState: () => SettingsState, immediate: boolean) {
  if (persistTimer) clearTimeout(persistTimer);

  const delay = immediate ? 0 : 500;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const {
      density,
      textSize,
      theme,
      layoutSizes,
      sectionExpanded,
      autoCheckForUpdates,
      debugLoggingEnabled,
      worktreesDefaultParentDir,
      worktreesRecent,
      enabledTabs,
    } = getState();
    const data: SettingsData = {
      density,
      textSize,
      theme,
      layoutSizes,
      sectionExpanded,
      autoCheckForUpdates,
      debugLoggingEnabled,
      worktreesDefaultParentDir,
      worktreesRecent,
      enabledTabs,
    };
    writeSettings(data).catch((err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err);
      notifyPersistError(cleanErrorMessage(raw));
    });
  }, delay);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    try {
      const saved = await readSettings();
      const density = saved.density ?? DEFAULTS.density;
      const textSize = saved.textSize ?? DEFAULTS.textSize;
      const theme = saved.theme ?? DEFAULTS.theme;
      const layoutSizes = saved.layoutSizes ?? DEFAULTS.layoutSizes;
      const sectionExpanded = saved.sectionExpanded ?? DEFAULTS.sectionExpanded;
      const autoCheckForUpdates = saved.autoCheckForUpdates ?? DEFAULTS.autoCheckForUpdates;
      const debugLoggingEnabled = saved.debugLoggingEnabled ?? DEFAULTS.debugLoggingEnabled;
      const worktreesDefaultParentDir =
        saved.worktreesDefaultParentDir ?? DEFAULTS.worktreesDefaultParentDir;
      const worktreesRecent = saved.worktreesRecent ?? DEFAULTS.worktreesRecent;
      const enabledTabs: EnabledTabs = {
        cleanup: saved.enabledTabs?.cleanup ?? DEFAULTS.enabledTabs.cleanup,
        worktrees: saved.enabledTabs?.worktrees ?? DEFAULTS.enabledTabs.worktrees,
      };

      applyToDOM(density, textSize, theme);
      set({
        density,
        textSize,
        theme,
        layoutSizes,
        sectionExpanded,
        autoCheckForUpdates,
        debugLoggingEnabled,
        worktreesDefaultParentDir,
        worktreesRecent,
        enabledTabs,
        loaded: true,
      });
    } catch (e) {
      logError("yagg::fe::settings", `settings load failed: ${String(e)}`);
      // If reading fails, use defaults
      applyToDOM(DEFAULTS.density, DEFAULTS.textSize, DEFAULTS.theme);
      set({ ...DEFAULTS, loaded: true });
    }
  },

  setDensity: (density) => {
    document.documentElement.dataset.density = density;
    set({ density });
    persistDebounced(get, true);
  },

  setTextSize: (textSize) => {
    document.documentElement.dataset.textSize = textSize;
    set({ textSize });
    persistDebounced(get, true);
  },

  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    set({ theme });
    persistDebounced(get, true);
  },

  setLayoutSize: (key, px) => {
    set((s) => ({
      layoutSizes: { ...s.layoutSizes, [key]: px },
    }));
    persistDebounced(get, false);
  },

  setSectionExpanded: (key, value) => {
    set((s) => ({
      sectionExpanded: { ...s.sectionExpanded, [key]: value },
    }));
    persistDebounced(get, true);
  },

  toggleSectionExpanded: (key) => {
    set((s) => ({
      sectionExpanded: { ...s.sectionExpanded, [key]: !s.sectionExpanded[key] },
    }));
    persistDebounced(get, true);
  },

  setAutoCheckForUpdates: (autoCheckForUpdates) => {
    set({ autoCheckForUpdates });
    persistDebounced(get, true);
  },

  setDebugLoggingEnabled: (debugLoggingEnabled) => {
    // Two distinct effects with one source of truth each:
    //   1. Local state updates first so the toggle UI reflects the choice.
    //   2. Backend setter flips the LIVE log level (log::set_max_level).
    //   3. persistDebounced writes settings.json — sole writer; the backend
    //      does NOT touch the file. Next launch reads this value via
    //      main.rs::read_debug_logging_from_disk.
    set({ debugLoggingEnabled });
    setDebugLoggingEnabledBackend(debugLoggingEnabled).catch((err: unknown) => {
      logError("yagg::fe::settings", `set_debug_logging_enabled failed: ${String(err)}`);
    });
    persistDebounced(get, true);
  },

  setWorktreesDefaultParentDir: (dir) => {
    set({ worktreesDefaultParentDir: dir });
    persistDebounced(get, true);
  },

  addRecentWorktree: (name) => {
    set((s) => {
      const filtered = s.worktreesRecent.filter((n) => n !== name);
      return { worktreesRecent: [name, ...filtered].slice(0, 20) };
    });
    persistDebounced(get, true);
  },

  setEnabledTab: (tab, value) => {
    set((s) => ({ enabledTabs: { ...s.enabledTabs, [tab]: value } }));

    // If the user just disabled the tab they're currently viewing, drop back
    // to the Working Copy view so the center pane never goes blank.
    if (!value) {
      const activeView = useSelectionStore.getState().activeView;
      if (activeView === tab) {
        useSelectionStore.getState().setActiveView("status");
      }
    }
    persistDebounced(get, true);
  },

  resetToDefaults: () => {
    if (persistTimer) clearTimeout(persistTimer);

    const currentDebugLogging = get().debugLoggingEnabled;
    if (currentDebugLogging) {
      setDebugLoggingEnabledBackend(false).catch((err: unknown) => {
        logError(
          "yagg::fe::settings",
          `set_debug_logging_enabled failed during reset: ${String(err)}`
        );
      });
    }

    applyToDOM(DEFAULTS.density, DEFAULTS.textSize, DEFAULTS.theme);
    set({ ...DEFAULTS, loaded: true });

    const data: SettingsData = {
      density: DEFAULTS.density,
      textSize: DEFAULTS.textSize,
      theme: DEFAULTS.theme,
      layoutSizes: DEFAULTS.layoutSizes,
      sectionExpanded: DEFAULTS.sectionExpanded,
      autoCheckForUpdates: DEFAULTS.autoCheckForUpdates,
      debugLoggingEnabled: DEFAULTS.debugLoggingEnabled,
      worktreesDefaultParentDir: DEFAULTS.worktreesDefaultParentDir,
      worktreesRecent: DEFAULTS.worktreesRecent,
      enabledTabs: DEFAULTS.enabledTabs,
    };
    writeSettings(data).catch((err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err);
      notifyPersistError(cleanErrorMessage(raw));
    });
  },
}));
