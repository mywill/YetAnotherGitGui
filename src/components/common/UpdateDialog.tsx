import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  downloadAndInstallUpdate,
  getReleaseUrl,
  getUpdateLogPath,
  writeUpdateLog,
  type UpdateInfo,
} from "../../services/system";
import { ConfirmDialog } from "./ConfirmDialog";

interface UpdateDialogProps {
  info: UpdateInfo;
  onClose: () => void;
}

export function UpdateDialog({ info, onClose }: UpdateDialogProps) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!info.available || !info.version) return null;

  const releaseUrl = getReleaseUrl(info.version);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await downloadAndInstallUpdate();
    } catch (err) {
      await writeUpdateLog(`ERROR in update dialog install: ${String(err)}`);
      const logPath = await getUpdateLogPath();
      const logHint = logPath ? ` Check ${logPath} for details.` : "";
      setError(
        `Auto-update failed: ${String(err)}. Please download the update manually.${logHint}`
      );
    } finally {
      setInstalling(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  return (
    <ConfirmDialog
      title="Update Available"
      message={
        <div className="update-dialog-content">
          <p className="text-text-muted mb-2 text-xs">
            Version <strong>{info.version}</strong> is available.
          </p>
          {info.notes && (
            <div className="update-dialog-notes overflow-wrap-anywhere bg-bg-canvas mb-2 max-h-75 overflow-y-auto rounded p-2 text-xs leading-normal break-words whitespace-pre-wrap">
              <p className="update-dialog-notes-label text-text-primary font-semibold">
                Release notes:
              </p>
              <p className="text-text-muted">{info.notes}</p>
            </div>
          )}
          {error && <p className="update-dialog-error text-danger mb-2 text-xs">{error}</p>}
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
      confirmLabel={installing ? "Installing..." : "Update & Restart"}
      cancelLabel="Later"
      onConfirm={handleInstall}
      onCancel={handleCancel}
    />
  );
}
