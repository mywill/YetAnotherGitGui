import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { cleanErrorMessage } from "../../utils/errorMessages";

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
    <div className="welcome-screen flex h-full flex-col items-center justify-center gap-4 p-4">
      <div className="welcome-screen-content flex w-full max-w-lg flex-col gap-4">
        {error && (
          <div className="welcome-error border-status-modified bg-status-modified/20 text-text-secondary flex items-start gap-2 rounded border-l-4 p-3 text-sm break-words whitespace-pre-line">
            <span className="welcome-error-icon text-status-modified shrink-0 text-lg">
              &#9888;
            </span>
            <span>{cleanErrorMessage(error)}</span>
          </div>
        )}

        <div className="welcome-card border-border bg-bg-secondary rounded-md border p-3">
          <div className="welcome-card-title text-text-primary mb-1 text-sm font-semibold">
            Open a Repository
          </div>
          <div className="welcome-card-description text-text-muted mb-3 text-xs">
            Select a Git repository to open
          </div>
          <div className="welcome-repo-input flex flex-col gap-2">
            <input
              className="w-full"
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="Path to repository..."
              aria-label="Repository path"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleOpen(pathInput);
              }}
            />
            <div className="welcome-repo-buttons flex justify-end gap-2">
              <button onClick={handleBrowse}>Browse...</button>
              <button
                className="primary bg-bg-selected border-bg-selected hover:bg-bg-selected-hover"
                onClick={() => handleOpen(pathInput)}
                disabled={!pathInput.trim()}
              >
                Open
              </button>
            </div>
          </div>
          {openError && (
            <div className="welcome-open-error text-status-deleted mt-2 text-xs">{openError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
