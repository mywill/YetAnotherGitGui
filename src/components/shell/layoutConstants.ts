// Pixel sizing for resizable shell regions. Centralized so the same numbers
// can be referenced from views and tests.

/** Status view: left "files" column. */
export const STATUS_LEFT_DEFAULT = 280;
export const STATUS_LEFT_MIN = 120;
export const STATUS_LEFT_MAX = 100000;

/** Status view: vertical splits between Staged/Unstaged/Untracked. */
export const STATUS_PANE_MIN = 80;
export const STATUS_PANE_MAX = 100000;

/** History view: right "details" column. */
export const HISTORY_DETAILS_DEFAULT = 360;
export const HISTORY_DETAILS_MIN = 180;
export const HISTORY_DETAILS_EDGE_RESERVE = 400;

/** Layout-size keys persisted via settingsStore.layoutSizes. */
export const LAYOUT_KEYS = {
  statusLeft: "workspace.split.workcopy",
  statusStaged: "workspace.split.status.staged",
  statusUntracked: "workspace.split.status.untracked",
  historyDetails: "history.details",
  historyCommitInfo: "history.commitInfo",
  stashList: "stash.listWidth",
} as const;
