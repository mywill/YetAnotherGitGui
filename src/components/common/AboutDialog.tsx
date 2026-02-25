import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
        const errorStr = String(error);
        await writeUpdateLog(`ERROR in about dialog check: ${errorStr}`);
        if (errorStr.toLowerCase().includes("symlink")) {
          setUpdateError(
            "Update check failed due to an outdated CLI symlink. Reinstall the CLI tool from the settings menu."
          );
        }
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

  return createPortal(
    <div
      className="confirm-dialog-backdrop fixed inset-0 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className="about-dialog border-border bg-bg-secondary shadow-dialog max-w-md min-w-80 rounded-lg border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
      >
        <div className="about-dialog-header border-border border-b p-3">
          <h2 id="about-dialog-title" className="text-text-primary font-semibold">
            About Yet Another Git Gui
          </h2>
        </div>
        <div className="about-dialog-body p-3">
          {appInfo ? (
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="text-text-primary pr-3 text-xs font-semibold whitespace-nowrap">
                    Version
                  </td>
                  <td className="text-text-secondary py-1 text-xs">{appInfo.version}</td>
                </tr>
                <tr>
                  <td className="text-text-primary pr-3 text-xs font-semibold whitespace-nowrap">
                    Tauri
                  </td>
                  <td className="text-text-secondary py-1 text-xs">{appInfo.tauri_version}</td>
                </tr>
                <tr>
                  <td className="text-text-primary pr-3 text-xs font-semibold whitespace-nowrap">
                    Platform
                  </td>
                  <td className="text-text-secondary py-1 text-xs">{appInfo.platform}</td>
                </tr>
                <tr>
                  <td className="text-text-primary pr-3 text-xs font-semibold whitespace-nowrap">
                    Architecture
                  </td>
                  <td className="text-text-secondary py-1 text-xs">{appInfo.arch}</td>
                </tr>
                <tr>
                  <td className="text-text-primary pr-3 text-xs font-semibold whitespace-nowrap">
                    Update
                  </td>
                  <td className="about-update-cell text-text-secondary flex flex-col gap-1 py-1 text-xs">
                    {updateStatus === "checking" && (
                      <span className="about-update-checking text-text-secondary italic">
                        Checking...
                      </span>
                    )}
                    {updateStatus === "up-to-date" && (
                      <span className="about-update-ok text-success">Up to date</span>
                    )}
                    {updateStatus === "available" && updateInfo?.version && (
                      <span className="about-update-available flex flex-wrap items-center gap-2">
                        v{updateInfo.version} available{" "}
                        <button
                          className="about-update-btn bg-accent rounded border-none px-2 py-px text-xs text-white hover:opacity-90"
                          onClick={handleUpdate}
                        >
                          Update
                        </button>
                        <a
                          className="about-update-link text-accent text-xs"
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
                      <span className="about-update-checking text-text-secondary italic">
                        Installing...
                      </span>
                    )}
                    {updateStatus === "error" && (
                      <span className="about-update-error text-danger">Check failed</span>
                    )}
                    {updateError && (
                      <span className="about-update-error-detail text-danger text-xs">
                        {updateError}
                        {updateInfo?.version && (
                          <>
                            {" "}
                            <a
                              className="text-accent"
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
        <div className="about-dialog-actions border-border flex justify-end border-t p-3">
          <button
            className="dialog-btn confirm border-bg-selected bg-bg-selected focus:ring-bg-selected rounded text-xs text-white transition-all duration-150 hover:brightness-110 focus:ring-2 focus:ring-offset-2"
            onClick={onClose}
            ref={closeButtonRef}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
