import { useEffect, useRef, useState } from "react";
import { checkForUpdate, writeUpdateLog, type UpdateInfo } from "../services/system";
import { useSettingsStore } from "../stores/settingsStore";
import { useNotificationStore } from "../stores/notificationStore";
import { UpdateDialog } from "../components/common/UpdateDialog";

export function useUpdateCheck() {
  const loaded = useSettingsStore((s) => s.loaded);
  const autoCheckForUpdates = useSettingsStore((s) => s.autoCheckForUpdates);
  const hasRunRef = useRef(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!loaded || hasRunRef.current) return;
    if (!autoCheckForUpdates) return;
    hasRunRef.current = true;

    (async () => {
      try {
        const result = await checkForUpdate();
        if (result.available && result.version) {
          setInfo(result);
          useNotificationStore
            .getState()
            .showSuccess(`Version ${result.version} is available — click to update.`, {
              duration: 10000,
              action: () => setShowDialog(true),
              actionLabel: "Click to update",
            });
        }
      } catch (err) {
        await writeUpdateLog(`ERROR in launch-time update check: ${String(err)}`);
      }
    })();
  }, [loaded, autoCheckForUpdates]);

  if (!showDialog || !info) return null;
  return <UpdateDialog info={info} onClose={() => setShowDialog(false)} />;
}
