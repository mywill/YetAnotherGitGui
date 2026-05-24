import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { logError, logDebug } from "../utils/logger";

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await writeText(text);
    return;
  } catch (tauriErr) {
    // Tauri's clipboard plugin can fail in non-Tauri preview/test contexts.
    // Log at debug — we still have a fallback to try.
    logDebug(
      "yagg::fe::clipboard",
      `Tauri clipboard failed, falling back: ${String(tauriErr)}`,
    );

    if (!navigator.clipboard) {
      logError(
        "yagg::fe::clipboard",
        `clipboard write failed: navigator.clipboard not available (original: ${String(tauriErr)})`,
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (browserErr) {
      logError(
        "yagg::fe::clipboard",
        `clipboard write failed (both Tauri and browser API): ${String(browserErr)}`,
      );
    }
  }
}
