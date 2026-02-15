import { useState, useEffect } from "react";
import { installCli, checkCliInstalled } from "../../services/system";
import { ConfirmDialog } from "../common/ConfirmDialog";
import "./CliInstall.css";

export function CliInstall() {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Only check on macOS (Tauri will return false on other platforms)
    checkCliInstalled()
      .then(setIsInstalled)
      .catch(() => setIsInstalled(null));
  }, []);

  const handleInstall = async () => {
    setShowConfirm(false);
    setInstalling(true);
    setMessage(null);
    try {
      const result = await installCli();
      setMessage(result);
      setIsInstalled(true);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setInstalling(false);
    }
  };

  // Don't render on non-macOS or if already installed
  if (isInstalled === null || isInstalled === true) {
    return null;
  }

  return (
    <div className="cli-install">
      <button
        className="cli-install-button"
        onClick={() => setShowConfirm(true)}
        disabled={installing}
        title="Install command-line tool to use 'yagg' from terminal"
      >
        {installing ? "Installing..." : "Install CLI Tool"}
      </button>
      {message && <div className="cli-install-message">{message}</div>}
      {showConfirm && (
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
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
