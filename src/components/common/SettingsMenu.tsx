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
import { IconSettings } from "@tabler/icons-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { AboutDialog } from "./AboutDialog";
import { UpdateDialog } from "./UpdateDialog";
import { YaggButton } from "./YaggButton";

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
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMac) {
      checkCliInstalled()
        .then(setCliInstalled)
        .catch(() => setCliInstalled(null));
    }
  }, [isMac]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeMenu]);

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
            className="settings-menu-dropdown border-border bg-bg-panel shadow-menu absolute top-full right-0 z-100 mt-1 min-w-45 overflow-hidden rounded-md border"
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
          </div>
        )}
      </div>

      {showInstallDialog && (
        <ConfirmDialog
          title="Install CLI Tool"
          message={
            <div className="cli-install-info">
              <p className="text-text-muted mb-2 text-xs leading-normal">
                This will add the{" "}
                <code className="bg-bg-well text-code rounded px-1 py-px">yagg</code> command to{" "}
                <code className="bg-bg-well text-code rounded px-1 py-px">/usr/local/bin</code>. You
                will be prompted for your administrator password.
              </p>
              <p className="text-text-muted mb-2 text-xs leading-normal">
                Any terminals that are already open will need to be restarted, or you can run{" "}
                <code className="bg-bg-well text-code rounded px-1 py-px">source ~/.zshrc</code> (or
                your shell&apos;s equivalent) to pick up the new command.
              </p>
              <p className="cli-install-usage-header text-text-muted mb-1 text-xs leading-normal font-semibold">
                Usage:
              </p>
              <ul className="cli-install-usage text-text-muted mb-2 pl-5 text-xs leading-relaxed">
                <li>
                  <code className="bg-bg-well text-code rounded px-1 py-px">yagg</code> &mdash; open
                  current directory
                </li>
                <li>
                  <code className="bg-bg-well text-code rounded px-1 py-px">yagg /path</code>{" "}
                  &mdash; open a specific repo
                </li>
              </ul>
              <p className="text-text-muted text-xs leading-normal">
                You can uninstall the CLI tool at any time from the settings gear menu.
              </p>
            </div>
          }
          confirmLabel="Install"
          cancelLabel="Cancel"
          onConfirm={handleInstall}
          onCancel={() => setShowInstallDialog(false)}
        />
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
