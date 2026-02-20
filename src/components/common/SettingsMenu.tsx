import { useState, useEffect, useRef, useCallback } from "react";
import {
  checkCliInstalled,
  installCli,
  uninstallCli,
  getAppInfo,
  checkForUpdate,
  downloadAndInstallUpdate,
  getReleaseUrl,
  type UpdateInfo,
} from "../../services/system";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { AboutDialog } from "./AboutDialog";
import "./SettingsMenu.css";

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
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
    setActionMessage(null);
    try {
      const result = await installCli();
      setActionMessage(result);
      setCliInstalled(true);
    } catch (error) {
      setActionMessage(String(error));
    }
  };

  const handleUninstall = async () => {
    setShowUninstallDialog(false);
    setActionMessage(null);
    try {
      const result = await uninstallCli();
      setActionMessage(result);
      setCliInstalled(false);
    } catch (error) {
      setActionMessage(String(error));
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
        useRepositoryStore.setState({ successMessage: "You're up to date!" });
        setTimeout(() => useRepositoryStore.setState({ successMessage: null }), 3000);
      }
    } catch {
      useRepositoryStore.setState({ error: "Failed to check for updates." });
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateInstalling(true);
    setUpdateError(null);
    try {
      await downloadAndInstallUpdate();
    } catch {
      setUpdateError(
        "Auto-update is not available for your installation type. Please download the update manually."
      );
    } finally {
      setUpdateInstalling(false);
    }
  };

  return (
    <>
      <div className="settings-menu" ref={menuRef}>
        <button
          className="settings-menu-button"
          onClick={() => setIsOpen(!isOpen)}
          title="Settings"
          aria-label="Settings"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <svg
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
          <div className="settings-menu-dropdown" role="menu">
            {isMac && !cliInstalled && (
              <button
                className="settings-menu-item"
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
                className="settings-menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setShowUninstallDialog(true);
                }}
              >
                Uninstall CLI Tool
              </button>
            )}
            {isMac && <div className="settings-menu-separator" role="separator" />}
            <button
              className="settings-menu-item"
              role="menuitem"
              disabled={updateChecking}
              onClick={handleCheckForUpdates}
            >
              {updateChecking ? "Checking..." : "Check for Updates"}
            </button>
            <div className="settings-menu-separator" role="separator" />
            <button
              className="settings-menu-item"
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

      {actionMessage && <div className="settings-menu-uninstall-message">{actionMessage}</div>}

      {showInstallDialog && (
        <ConfirmDialog
          title="Install CLI Tool"
          message={
            <div className="cli-install-info">
              <p>
                This will add the <code>yagg</code> command to your PATH by creating a symlink at{" "}
                <code>/usr/local/bin/yagg</code>. You will be prompted for your administrator
                password.
              </p>
              <p>
                Any terminals that are already open will need to be restarted, or you can run{" "}
                <code>source ~/.zshrc</code> (or your shell's equivalent) to pick up the new
                command.
              </p>
              <p className="cli-install-usage-header">Usage:</p>
              <ul className="cli-install-usage">
                <li>
                  <code>yagg</code> &mdash; open current directory
                </li>
                <li>
                  <code>yagg /path</code> &mdash; open a specific repo
                </li>
              </ul>
              <p>You can uninstall the CLI tool at any time from the settings gear menu.</p>
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
              <p>
                Version <strong>{updateInfo.version}</strong> is available.
              </p>
              {updateInfo.notes && (
                <div className="update-dialog-notes">
                  <p className="update-dialog-notes-label">Release notes:</p>
                  <p>{updateInfo.notes}</p>
                </div>
              )}
              {updateError && <p className="update-dialog-error">{updateError}</p>}
              <p className="update-dialog-link">
                <a
                  href={getReleaseUrl(updateInfo.version)}
                  target="_blank"
                  rel="noopener noreferrer"
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
