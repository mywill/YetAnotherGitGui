import type { StashInfo } from "../types";

/** Cap how many items we list inside a confirm dialog body. */
const CONFIRM_LIST_CAP = 10;

/**
 * Render a bullet list capped at CONFIRM_LIST_CAP entries with an "...and N
 * more" suffix when over the cap. Used by every dialog that previews bulk
 * targets (branches, stashes, untracked files) so capping is consistent.
 */
export function formatList(items: string[]): string {
  const shown = items.slice(0, CONFIRM_LIST_CAP).map((s) => `  • ${s}`);
  const extra = items.length - shown.length;
  if (extra > 0) {
    shown.push(`  …and ${extra} more`);
  }
  return shown.join("\n");
}

/**
 * Build the confirm-dialog body for dropping stashes. Shared so the Cleanup
 * view, the Stashes-view quick action, and the single-stash context menu all
 * render an identical dialog.
 */
export function buildStashDropMessage(stashes: StashInfo[]): string {
  const n = stashes.length;
  const list = formatList(stashes.map((s) => `stash@{${s.index}} — ${s.message}`));
  return `Drop ${n} stash${n === 1 ? "" : "es"}? Stashes cannot be recovered after dropping.\n\n${list}`;
}
