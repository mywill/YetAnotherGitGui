import { useState, useEffect } from "react";
import { installCli, checkCliInstalled } from "../../services/system";
import { ConfirmDialog } from "../common/ConfirmDialog";

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
    <div className="cli-install border-border border-t px-3 py-2">
      <button
        className="cli-install-button w-full px-3 py-1.5 text-xs"
        onClick={() => setShowConfirm(true)}
        disabled={installing}
        title="Install command-line tool to use 'yagg' from terminal"
      >
        {installing ? "Installing..." : "Install CLI Tool"}
      </button>
      {message && (
        <div className="cli-install-message text-text-secondary mt-1.5 text-xs break-words">
          {message}
        </div>
      )}
      {showConfirm && (
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
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
