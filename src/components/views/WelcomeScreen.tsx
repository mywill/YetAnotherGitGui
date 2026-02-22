import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { cleanErrorMessage } from "../../utils/errorMessages";
import "./WelcomeScreen.css";

interface WelcomeScreenProps {
  error: string | null;
  failedPath: string | null;
}

export function WelcomeScreen({ error, failedPath }: WelcomeScreenProps) {
  const openRepository = useRepositoryStore((s) => s.openRepository);

  const [pathInput, setPathInput] = useState(failedPath ?? "");
  const [openError, setOpenError] = useState<string | null>(null);

  const handleOpen = async (path: string) => {
    if (!path.trim()) return;
    setOpenError(null);
    try {
      await openRepository(path.trim());
    } catch (err) {
      setOpenError(String(err));
    }
  };

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      defaultPath: pathInput || undefined,
    });
    if (selected) {
      setOpenError(null);
      try {
        await openRepository(selected);
      } catch (err) {
        setPathInput(selected);
        setOpenError(String(err));
      }
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-screen-content">
        {error && (
          <div className="welcome-error">
            <span className="welcome-error-icon">&#9888;</span>
            <span>{cleanErrorMessage(error)}</span>
          </div>
        )}

        <div className="welcome-card">
          <div className="welcome-card-title">Open a Repository</div>
          <div className="welcome-card-description">Select a Git repository to open</div>
          <div className="welcome-repo-input">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="Path to repository..."
              aria-label="Repository path"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleOpen(pathInput);
              }}
            />
            <div className="welcome-repo-buttons">
              <button onClick={handleBrowse}>Browse...</button>
              <button
                className="primary"
                onClick={() => handleOpen(pathInput)}
                disabled={!pathInput.trim()}
              >
                Open
              </button>
            </div>
          </div>
          {openError && <div className="welcome-open-error">{openError}</div>}
        </div>
      </div>
    </div>
  );
}
