import { useCallback, useEffect, useRef, useState } from "react";
import { getAppInfo, type AppInfo } from "../../services/system";
import "./AboutDialog.css";

interface AboutDialogProps {
  onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getAppInfo()
      .then(setAppInfo)
      .catch(() => setAppInfo(null));
  }, []);

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
