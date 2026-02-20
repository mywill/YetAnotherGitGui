import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAppInfo,
  checkForUpdate,
  downloadAndInstallUpdate,
  getReleaseUrl,
  writeUpdateLog,
  getUpdateLogPath,
  type AppInfo,
  type UpdateInfo,
} from "../../services/system";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./AboutDialog.css";

interface AboutDialogProps {
  onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<
    "checking" | "up-to-date" | "available" | "installing" | "error"
  >("checking");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getAppInfo()
      .then(setAppInfo)
      .catch(() => setAppInfo(null));
  }, []);

  useEffect(() => {
    checkForUpdate()
      .then((info) => {
        setUpdateInfo(info);
        setUpdateStatus(info.available ? "available" : "up-to-date");
      })
      .catch(async (error) => {
        await writeUpdateLog(`ERROR in about dialog check: ${String(error)}`);
        setUpdateStatus("error");
      });
  }, []);

  const handleUpdate = async () => {
    setUpdateStatus("installing");
    setUpdateError(null);
    try {
      await downloadAndInstallUpdate();
    } catch (error) {
      await writeUpdateLog(`ERROR in about dialog install: ${String(error)}`);
      const logPath = await getUpdateLogPath();
      const logHint = logPath ? ` Check ${logPath} for details.` : "";
      setUpdateError(`Auto-update failed: ${String(error)}.${logHint}`);
      setUpdateStatus("available");
    }
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const releaseUrl = updateInfo?.version ? getReleaseUrl(updateInfo.version) : "";

  return (
    <div className="confirm-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
      >
        <div className="about-dialog-header">
          <h2 id="about-dialog-title">About Yet Another Git Gui</h2>
        </div>
        <div className="about-dialog-body">
          {appInfo ? (
            <table>
              <tbody>
                <tr>
                  <td>Version</td>
                  <td>{appInfo.version}</td>
                </tr>
                <tr>
                  <td>Tauri</td>
                  <td>{appInfo.tauri_version}</td>
                </tr>
                <tr>
                  <td>Platform</td>
                  <td>{appInfo.platform}</td>
                </tr>
                <tr>
                  <td>Architecture</td>
                  <td>{appInfo.arch}</td>
                </tr>
                <tr>
                  <td>Update</td>
                  <td className="about-update-cell">
                    {updateStatus === "checking" && (
                      <span className="about-update-checking">Checking...</span>
                    )}
                    {updateStatus === "up-to-date" && (
                      <span className="about-update-ok">Up to date</span>
                    )}
                    {updateStatus === "available" && updateInfo?.version && (
                      <span className="about-update-available">
                        v{updateInfo.version} available{" "}
                        <button className="about-update-btn" onClick={handleUpdate}>
                          Update
                        </button>
                        <a
                          className="about-update-link"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openUrl(releaseUrl);
                          }}
                        >
                          View release
                        </a>
                      </span>
                    )}
                    {updateStatus === "installing" && (
                      <span className="about-update-checking">Installing...</span>
                    )}
                    {updateStatus === "error" && (
                      <span className="about-update-error">Check failed</span>
                    )}
                    {updateError && (
                      <span className="about-update-error-detail">
                        {updateError}
                        {updateInfo?.version && (
                          <>
                            {" "}
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                openUrl(releaseUrl);
                              }}
                            >
                              Download manually
                            </a>
                          </>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p>Loading...</p>
          )}
        </div>
        <div className="about-dialog-actions">
          <button className="dialog-btn confirm" onClick={onClose} ref={closeButtonRef}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
