import { useState, useEffect, useRef, useCallback } from "react";
import {
  checkCliInstalled,
  installCli,
  uninstallCli,
  getAppInfo,
  checkForUpdate,
  downloadAndInstallUpdate,
  getReleaseUrl,
  writeUpdateLog,
  getUpdateLogPath,
  type UpdateInfo,
} from "../../services/system";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useNotificationStore } from "../../stores/notificationStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { AboutDialog } from "./AboutDialog";

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAppInfo()
      .then((info) => {
        const mac = info.platform === "macos";
        setIsMac(mac);
        if (mac) {
          checkCliInstalled()
            .then(setCliInstalled)
            .catch(() => setCliInstalled(null));
        }
      })
      .catch(() => setIsMac(false));
  }, []);

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
    setUpdateError(null);
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

  const handleInstallUpdate = async () => {
    setUpdateInstalling(true);
    setUpdateError(null);
    try {
      await downloadAndInstallUpdate();
    } catch (error) {
      await writeUpdateLog(`ERROR in settings menu install: ${String(error)}`);
      const logPath = await getUpdateLogPath();
      const logHint = logPath ? ` Check ${logPath} for details.` : "";
      setUpdateError(
        `Auto-update failed: ${String(error)}. Please download the update manually.${logHint}`
      );
    } finally {
      setUpdateInstalling(false);
    }
  };

  const releaseUrl = updateInfo?.version ? getReleaseUrl(updateInfo.version) : "";

  return (
    <>
      <div className="settings-menu app-region-no-drag relative flex items-center" ref={menuRef}>
        <button
          className="settings-menu-button"
          onClick={() => setIsOpen(!isOpen)}
          title="Settings"
          aria-label="Settings"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="settings-menu-dropdown border-border bg-bg-secondary shadow-menu absolute top-full right-0 z-100 mt-1 min-w-45 overflow-hidden rounded-md border"
            role="menu"
          >
            {isMac && !cliInstalled && (
              <button
                className="settings-menu-item text-text-primary hover:bg-bg-hover block w-full border-none bg-transparent px-3 py-2 text-left text-xs transition-colors duration-100"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setShowInstallDialog(true);
                }}
              >
                Install CLI Tool
              </button>
            )}
            {isMac && cliInstalled && (
              <button
                className="settings-menu-item text-text-primary hover:bg-bg-hover block w-full border-none bg-transparent px-3 py-2 text-left text-xs transition-colors duration-100"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setShowUninstallDialog(true);
                }}
              >
                Uninstall CLI Tool
              </button>
            )}
            {isMac && (
              <div className="settings-menu-separator bg-border my-1 h-px" role="separator" />
            )}
            <button
              className="settings-menu-item text-text-primary hover:bg-bg-hover block w-full border-none bg-transparent px-3 py-2 text-left text-xs transition-colors duration-100 disabled:cursor-default disabled:opacity-50"
              role="menuitem"
              disabled={updateChecking}
              onClick={handleCheckForUpdates}
            >
              {updateChecking ? "Checking..." : "Check for Updates"}
            </button>
            <div className="settings-menu-separator bg-border my-1 h-px" role="separator" />
            <button
              className="settings-menu-item text-text-primary hover:bg-bg-hover block w-full border-none bg-transparent px-3 py-2 text-left text-xs transition-colors duration-100"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setShowAboutDialog(true);
              }}
            >
              About
            </button>
          </div>
        )}
      </div>

      {showInstallDialog && (
        <ConfirmDialog
          title="Install CLI Tool"
          message={
            <div className="cli-install-info">
              <p className="text-text-secondary mb-2 text-xs leading-normal">
                This will add the{" "}
                <code className="bg-bg-tertiary text-code rounded px-1 py-px">yagg</code> command to{" "}
                <code className="bg-bg-tertiary text-code rounded px-1 py-px">/usr/local/bin</code>.
                You will be prompted for your administrator password.
              </p>
              <p className="text-text-secondary mb-2 text-xs leading-normal">
                Any terminals that are already open will need to be restarted, or you can run{" "}
                <code className="bg-bg-tertiary text-code rounded px-1 py-px">source ~/.zshrc</code>{" "}
                (or your shell&apos;s equivalent) to pick up the new command.
              </p>
              <p className="cli-install-usage-header text-text-secondary mb-1 text-xs leading-normal font-semibold">
                Usage:
              </p>
              <ul className="cli-install-usage text-text-secondary mb-2 pl-5 text-xs leading-relaxed">
                <li>
                  <code className="bg-bg-tertiary text-code rounded px-1 py-px">yagg</code> &mdash;
                  open current directory
                </li>
                <li>
                  <code className="bg-bg-tertiary text-code rounded px-1 py-px">yagg /path</code>{" "}
                  &mdash; open a specific repo
                </li>
              </ul>
              <p className="text-text-secondary text-xs leading-normal">
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

      {showAboutDialog && <AboutDialog onClose={() => setShowAboutDialog(false)} />}

      {showUpdateDialog && updateInfo?.available && updateInfo.version && (
        <ConfirmDialog
          title="Update Available"
          message={
            <div className="update-dialog-content">
              <p className="text-text-secondary mb-2 text-xs">
                Version <strong>{updateInfo.version}</strong> is available.
              </p>
              {updateInfo.notes && (
                <div className="update-dialog-notes overflow-wrap-anywhere bg-bg-primary mb-2 max-h-75 overflow-y-auto rounded p-2 text-xs leading-normal break-words whitespace-pre-wrap">
                  <p className="update-dialog-notes-label text-text-primary font-semibold">
                    Release notes:
                  </p>
                  <p className="text-text-secondary">{updateInfo.notes}</p>
                </div>
              )}
              {updateError && (
                <p className="update-dialog-error text-danger mb-2 text-xs">{updateError}</p>
              )}
              <p className="update-dialog-link text-xs">
                <a
                  className="text-accent"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openUrl(releaseUrl);
                  }}
                >
                  View release on GitHub
                </a>
              </p>
            </div>
          }
          confirmLabel={updateInstalling ? "Installing..." : "Update & Restart"}
          cancelLabel="Later"
          onConfirm={handleInstallUpdate}
          onCancel={() => {
            setShowUpdateDialog(false);
            setUpdateError(null);
          }}
        />
      )}
    </>
  );
}
