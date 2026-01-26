import { useState, useEffect } from "react";
import { installCli, checkCliInstalled } from "../../services/system";
import "./CliInstall.css";

export function CliInstall() {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Only check on macOS (Tauri will return false on other platforms)
    checkCliInstalled()
      .then(setIsInstalled)
      .catch(() => setIsInstalled(null));
  }, []);

  const handleInstall = async () => {
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
        onClick={handleInstall}
        disabled={installing}
        title="Install command-line tool to use 'yagg' from terminal"
      >
        {installing ? "Installing..." : "Install CLI Tool"}
      </button>
      {message && <div className="cli-install-message">{message}</div>}
    </div>
  );
}
