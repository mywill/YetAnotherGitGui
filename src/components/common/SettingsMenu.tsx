import { useState, useEffect, useRef, useCallback } from "react";
import {
  checkCliInstalled,
  installCli,
  uninstallCli,
  checkForUpdate,
  writeUpdateLog,
  type UpdateInfo,
} from "../../services/system";
import { useNotificationStore } from "../../stores/notificationStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Density, TextSize, Theme } from "../../stores/settingsStore";
import { usePlatform } from "../../hooks/usePlatform";
import { IconSettings, IconChevronRight } from "@tabler/icons-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ConfirmDialog } from "./ConfirmDialog";
import { AboutDialog } from "./AboutDialog";
import { UpdateDialog } from "./UpdateDialog";
import { YaggButton } from "./YaggButton";
import { openLogDir } from "../../services/logging";
import { CliInstallDialog } from "./CliInstallDialog";
import { logError } from "../../utils/logger";

// Delay before a hover-out closes the Help submenu. Lets the user travel from
// the trigger row to the submenu without the panel snapping shut underneath.
const HELP_CLOSE_DELAY_MS = 150;

const GITHUB_URL = "https://github.com/mywill/YetAnotherGitGui";

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { platform } = usePlatform();
  const isMac = platform === "macos";
  const currentTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const currentDensity = useSettingsStore((s) => s.density);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const currentTextSize = useSettingsStore((s) => s.textSize);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const autoCheckForUpdates = useSettingsStore((s) => s.autoCheckForUpdates);
  const setAutoCheckForUpdates = useSettingsStore((s) => s.setAutoCheckForUpdates);
  const debugLoggingEnabled = useSettingsStore((s) => s.debugLoggingEnabled);
  const setDebugLoggingEnabled = useSettingsStore((s) => s.setDebugLoggingEnabled);
  const enabledTabs = useSettingsStore((s) => s.enabledTabs);
  const setEnabledTab = useSettingsStore((s) => s.setEnabledTab);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const helpCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isMac) {
      checkCliInstalled()
        .then(setCliInstalled)
        .catch(() => setCliInstalled(null));
    }
  }, [isMac]);

  // Cancel any pending help-close timer when the help submenu re-opens, when
  // the parent menu closes, or on unmount.
  const cancelHelpClose = useCallback(() => {
    if (helpCloseTimerRef.current) {
      clearTimeout(helpCloseTimerRef.current);
      helpCloseTimerRef.current = null;
    }
  }, []);

  const scheduleHelpClose = useCallback(() => {
    cancelHelpClose();
    helpCloseTimerRef.current = setTimeout(() => {
      setHelpOpen(false);
      helpCloseTimerRef.current = null;
    }, HELP_CLOSE_DELAY_MS);
  }, [cancelHelpClose]);

  const openHelp = useCallback(() => {
    cancelHelpClose();
    setHelpOpen(true);
  }, [cancelHelpClose]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setHelpOpen(false);
    cancelHelpClose();
  }, [cancelHelpClose]);

  // Clean up the close timer on unmount.
  useEffect(() => cancelHelpClose, [cancelHelpClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeMenu]);

  // Escape closes the submenu first (if open), then the menu on a second press.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (helpOpen) {
        setHelpOpen(false);
        cancelHelpClose();
      } else {
        closeMenu();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, helpOpen, closeMenu, cancelHelpClose]);

  const handleInstall = async () => {
    setShowInstallDialog(false);
    try {
      const result = await installCli();
      useNotificationStore.getState().showSuccess(result);
      setCliInstalled(true);
    } catch (error) {
      useNotificationStore.getState().showError(String(error));
    }
  };

  const handleUninstall = async () => {
    setShowUninstallDialog(false);
    try {
      const result = await uninstallCli();
      useNotificationStore.getState().showSuccess(result);
      setCliInstalled(false);
    } catch (error) {
      useNotificationStore.getState().showError(String(error));
    }
  };

  const handleReset = () => {
    setShowResetDialog(false);
    resetToDefaults();
    closeMenu();
    useNotificationStore.getState().showSuccess("All settings reset to defaults");
  };

  const handleViewLogs = async () => {
    closeMenu();
    try {
      await openLogDir();
    } catch (e) {
      logError("yagg::fe::ui", `open log dir failed: ${String(e)}`);
      useNotificationStore.getState().showError(`Failed to open log folder: ${String(e)}`);
    }
  };

  const handleOpenGitHub = async () => {
    closeMenu();
    try {
      await openUrl(GITHUB_URL);
    } catch (e) {
      logError("yagg::fe::ui", `open GitHub URL failed: ${String(e)}`);
      useNotificationStore.getState().showError(`Failed to open GitHub: ${String(e)}`);
    }
  };

  const handleCheckForUpdates = async () => {
    closeMenu();
    setUpdateChecking(true);
    setUpdateInfo(null);
    try {
      const info = await checkForUpdate();
      setUpdateInfo(info);
      if (info.available) {
        setShowUpdateDialog(true);
      } else {
        useNotificationStore.getState().showSuccess("You're up to date!");
      }
    } catch (error) {
      const errorStr = String(error);
      await writeUpdateLog(`ERROR in settings menu check: ${errorStr}`);
      const isSymlinkError = errorStr.toLowerCase().includes("symlink");
      useNotificationStore
        .getState()
        .showError(
          isSymlinkError
            ? "Update check failed because the CLI tool uses an outdated symlink. Please reinstall the CLI tool from the settings menu to fix this."
            : `Failed to check for updates: ${errorStr}`
        );
    } finally {
      setUpdateChecking(false);
    }
  };

  return (
    <>
      <div className="settings-menu app-region-no-drag relative flex items-center" ref={menuRef}>
        <YaggButton
          variant="icon"
          className="settings-menu-button"
          onClick={() => setIsOpen(!isOpen)}
          title="Settings"
          aria-label="Settings"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <IconSettings size={14} stroke={1.75} aria-hidden />
        </YaggButton>

        {isOpen && (
          <div
            // No `overflow-hidden` so the Help fly-out submenu can extend past
            // the dropdown's left edge. The submenu carries its own border +
            // rounded corners, so the parent panel still looks clean.
            className="settings-menu-dropdown border-border bg-bg-panel shadow-menu absolute top-full right-0 z-100 mt-1 min-w-45 rounded-md border"
            role="menu"
          >
            {isMac && !cliInstalled && (
              <YaggButton
                variant="menu-item"
                className="settings-menu-item px-3 py-2 text-xs"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setShowInstallDialog(true);
                }}
              >
                Install CLI Tool
              </YaggButton>
            )}
            {isMac && cliInstalled && (
              <YaggButton
                variant="menu-item"
                className="settings-menu-item px-3 py-2 text-xs"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setShowUninstallDialog(true);
                }}
              >
                Uninstall CLI Tool
              </YaggButton>
            )}
            {isMac && (
              <div className="settings-menu-separator bg-border my-1 h-px" role="separator" />
            )}
            <div className="settings-menu-group px-3 py-2">
              <div className="text-text-muted text-2xs mb-1 font-medium tracking-wider uppercase">
                Theme
              </div>
              <div className="flex gap-1">
                {(["dark", "light"] as Theme[]).map((t) => (
                  <YaggButton
                    key={t}
                    variant={currentTheme === t ? "selection" : "outline"}
                    size="sm"
                    className="text-2xs flex-1 capitalize"
                    role="menuitemradio"
                    aria-checked={currentTheme === t}
                    onClick={() => {
                      setTheme(t);
                    }}
                  >
                    {t}
                  </YaggButton>
                ))}
              </div>
            </div>
            <div className="settings-menu-group px-3 py-2">
              <div className="text-text-muted text-2xs mb-1 font-medium tracking-wider uppercase">
                Density
              </div>
              <div className="flex gap-1">
                {(["compact", "comfortable", "spacious"] as Density[]).map((d) => (
                  <YaggButton
                    key={d}
                    variant={currentDensity === d ? "selection" : "outline"}
                    size="sm"
                    className="text-2xs flex-1 capitalize"
                    role="menuitemradio"
                    aria-checked={currentDensity === d}
                    onClick={() => {
                      setDensity(d);
                    }}
                  >
                    {d}
                  </YaggButton>
                ))}
              </div>
            </div>
            <div className="settings-menu-group px-3 py-2">
              <div className="text-text-muted text-2xs mb-1 font-medium tracking-wider uppercase">
                Text size
              </div>
              <div className="flex gap-1">
                {(["small", "medium", "large"] as TextSize[]).map((t) => (
                  <YaggButton
                    key={t}
                    variant={currentTextSize === t ? "selection" : "outline"}
                    size="sm"
                    className="text-2xs flex-1 capitalize"
                    role="menuitemradio"
                    aria-checked={currentTextSize === t}
                    onClick={() => {
                      setTextSize(t);
                    }}
                  >
                    {t}
                  </YaggButton>
                ))}
              </div>
            </div>
            <div className="settings-menu-group px-3 py-2">
              <div className="text-text-muted text-2xs mb-1 font-medium tracking-wider uppercase">
                Auto-check on launch
              </div>
              <div className="flex gap-1">
                <YaggButton
                  variant={autoCheckForUpdates ? "selection" : "outline"}
                  size="sm"
                  className="text-2xs flex-1"
                  role="menuitemradio"
                  aria-checked={autoCheckForUpdates}
                  onClick={() => setAutoCheckForUpdates(true)}
                >
                  On
                </YaggButton>
                <YaggButton
                  variant={!autoCheckForUpdates ? "selection" : "outline"}
                  size="sm"
                  className="text-2xs flex-1"
                  role="menuitemradio"
                  aria-checked={!autoCheckForUpdates}
                  onClick={() => setAutoCheckForUpdates(false)}
                >
                  Off
                </YaggButton>
              </div>
            </div>
            <div className="settings-menu-group px-3 py-2">
              <div className="text-text-muted text-2xs mb-1 font-medium tracking-wider uppercase">
                Tabs
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary text-xs">Worktrees</span>
                  <div className="flex gap-1">
                    <YaggButton
                      variant={enabledTabs.worktrees ? "selection" : "outline"}
                      size="sm"
                      className="text-2xs"
                      role="menuitemradio"
                      aria-checked={enabledTabs.worktrees}
                      onClick={() => setEnabledTab("worktrees", true)}
                    >
                      On
                    </YaggButton>
                    <YaggButton
                      variant={!enabledTabs.worktrees ? "selection" : "outline"}
                      size="sm"
                      className="text-2xs"
                      role="menuitemradio"
                      aria-checked={!enabledTabs.worktrees}
                      onClick={() => setEnabledTab("worktrees", false)}
                    >
                      Off
                    </YaggButton>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary text-xs">Cleanup</span>
                  <div className="flex gap-1">
                    <YaggButton
                      variant={enabledTabs.cleanup ? "selection" : "outline"}
                      size="sm"
                      className="text-2xs"
                      role="menuitemradio"
                      aria-checked={enabledTabs.cleanup}
                      onClick={() => setEnabledTab("cleanup", true)}
                    >
                      On
                    </YaggButton>
                    <YaggButton
                      variant={!enabledTabs.cleanup ? "selection" : "outline"}
                      size="sm"
                      className="text-2xs"
                      role="menuitemradio"
                      aria-checked={!enabledTabs.cleanup}
                      onClick={() => setEnabledTab("cleanup", false)}
                    >
                      Off
                    </YaggButton>
                  </div>
                </div>
              </div>
            </div>
            <div className="settings-menu-separator bg-border my-1 h-px" role="separator" />
            <YaggButton
              variant="menu-item"
              className="settings-menu-item px-3 py-2 text-xs"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setShowResetDialog(true);
              }}
            >
              Reset to Defaults
            </YaggButton>
            <div className="settings-menu-separator bg-border my-1 h-px" role="separator" />
            <YaggButton
              variant="menu-item"
              className="settings-menu-item px-3 py-2 text-xs"
              role="menuitem"
              disabled={updateChecking}
              onClick={handleCheckForUpdates}
            >
              {updateChecking ? "Checking..." : "Check for Updates"}
            </YaggButton>
            <div className="settings-menu-separator bg-border my-1 h-px" role="separator" />
            <YaggButton
              variant="menu-item"
              className="settings-menu-item px-3 py-2 text-xs"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setShowAboutDialog(true);
              }}
            >
              About
            </YaggButton>
            <div className="settings-menu-separator bg-border my-1 h-px" role="separator" />
            <div
              className="settings-menu-help-row relative"
              onMouseEnter={openHelp}
              onMouseLeave={scheduleHelpClose}
            >
              <YaggButton
                variant="menu-item"
                className="settings-menu-item flex w-full items-center gap-1.5 px-3 py-2 text-xs"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={helpOpen}
                onClick={() => (helpOpen ? setHelpOpen(false) : openHelp())}
              >
                <span>Help</span>
                <IconChevronRight size={12} stroke={1.75} aria-hidden />
              </YaggButton>
              {helpOpen && (
                <div
                  className="settings-menu-help-submenu border-border bg-bg-panel shadow-menu absolute top-0 right-full z-100 mr-1 min-w-45 rounded-md border"
                  role="menu"
                  aria-label="Help"
                  onMouseEnter={openHelp}
                  onMouseLeave={scheduleHelpClose}
                >
                  <YaggButton
                    variant="menu-item"
                    className="settings-menu-item px-3 py-2 text-xs"
                    role="menuitem"
                    onClick={handleViewLogs}
                  >
                    View Logs
                  </YaggButton>
                  <YaggButton
                    variant="menu-item"
                    className="settings-menu-item px-3 py-2 text-xs"
                    role="menuitem"
                    onClick={handleOpenGitHub}
                  >
                    GitHub
                  </YaggButton>
                  <div className="settings-menu-group px-3 py-2">
                    <div className="text-text-muted text-2xs mb-1 font-medium tracking-wider uppercase">
                      Verbose debug logging
                    </div>
                    <div className="flex gap-1">
                      <YaggButton
                        variant={debugLoggingEnabled ? "selection" : "outline"}
                        size="sm"
                        className="text-2xs flex-1"
                        role="menuitemradio"
                        aria-checked={debugLoggingEnabled}
                        onClick={() => setDebugLoggingEnabled(true)}
                      >
                        On
                      </YaggButton>
                      <YaggButton
                        variant={!debugLoggingEnabled ? "selection" : "outline"}
                        size="sm"
                        className="text-2xs flex-1"
                        role="menuitemradio"
                        aria-checked={!debugLoggingEnabled}
                        onClick={() => setDebugLoggingEnabled(false)}
                      >
                        Off
                      </YaggButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showResetDialog && (
        <ConfirmDialog
          title="Reset to Defaults"
          message="This will reset all settings to their factory defaults, including panel layout, density, text size, theme, auto-check on launch, visible tabs, and debug logging. This action cannot be undone."
          confirmLabel="Reset"
          cancelLabel="Cancel"
          onConfirm={handleReset}
          onCancel={() => setShowResetDialog(false)}
        />
      )}

      {showInstallDialog && (
        <CliInstallDialog onConfirm={handleInstall} onCancel={() => setShowInstallDialog(false)} />
      )}

      {showUninstallDialog && (
        <ConfirmDialog
          title="Uninstall CLI Tool"
          message="This will remove the yagg command from /usr/local/bin. You will be prompted for your administrator password."
          confirmLabel="Uninstall"
          cancelLabel="Cancel"
          onConfirm={handleUninstall}
          onCancel={() => setShowUninstallDialog(false)}
        />
      )}

      {showAboutDialog && (
        <AboutDialog
          onClose={() => setShowAboutDialog(false)}
          onUpdateRequested={(info) => {
            setShowAboutDialog(false);
            setUpdateInfo(info);
            setShowUpdateDialog(true);
          }}
        />
      )}

      {showUpdateDialog && updateInfo?.available && (
        <UpdateDialog info={updateInfo} onClose={() => setShowUpdateDialog(false)} />
      )}
    </>
  );
}
