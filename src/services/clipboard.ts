import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await writeText(text);
    return;
  } catch {
    // Fallback to browser clipboard API
    try {
      if (!navigator.clipboard) {
        throw new Error("navigator.clipboard not available");
      }
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Both methods failed - silently fail
    }
  }
}
