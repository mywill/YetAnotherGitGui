import { useState, useEffect } from "react";
import { installCli, checkCliInstalled } from "../../services/system";
import { CliInstallDialog } from "../common/CliInstallDialog";
import { YaggButton } from "../common/YaggButton";

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
      <YaggButton
        className="cli-install-button w-full px-3 py-1.5 text-xs"
        onClick={() => setShowConfirm(true)}
        disabled={installing}
        title="Install command-line tool to use 'yagg' from terminal"
      >
        {installing ? "Installing..." : "Install CLI Tool"}
      </YaggButton>
      {message && (
        <div className="cli-install-message text-text-muted mt-1.5 text-xs break-words">
          {message}
        </div>
      )}
      {showConfirm && (
        <CliInstallDialog onConfirm={handleInstall} onCancel={() => setShowConfirm(false)} />
      )}
    </div>
  );
}
