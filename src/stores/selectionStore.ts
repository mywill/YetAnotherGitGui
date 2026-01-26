import { create } from "zustand";

export type ViewType = "history" | "status";

// Selection key format: "staged:path" or "unstaged:path"
type SelectionKey = string;

function makeSelectionKey(path: string, staged: boolean): SelectionKey {
  return `${staged ? "staged" : "unstaged"}:${path}`;
}

function parseSelectionKey(key: SelectionKey): { path: string; staged: boolean } | null {
  const colonIdx = key.indexOf(":");
  if (colonIdx === -1) return null;
  const prefix = key.slice(0, colonIdx);
  const path = key.slice(colonIdx + 1);
  return { path, staged: prefix === "staged" };
}

interface SelectionState {
  selectedCommitHash: string | null;
  selectedFilePath: string | null;
  selectedFileStaged: boolean;
  activeView: ViewType;
  scrollToCommit: string | null; // Triggers scroll in CommitGraph

  // Multi-file selection - keys are "staged:path" or "unstaged:path"
  selectedFilePaths: Set<SelectionKey>;
  lastSelectedFilePath: string | null; // For shift-click range selection
  lastSelectedFileStaged: boolean | null; // Track staged context for shift-click

  selectCommit: (hash: string | null) => void;
  selectFile: (path: string | null, staged: boolean) => void;
  setActiveView: (view: ViewType) => void;
  selectAndScrollToCommit: (hash: string) => void;
  clearScrollToCommit: () => void;

  // Multi-file selection actions
  toggleFileSelection: (
    path: string,
    staged: boolean,
    isCtrl: boolean,
    isShift: boolean,
    allFilePaths: string[]
  ) => void;
  clearFileSelection: () => void;
  isFileSelected: (path: string, staged: boolean) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedCommitHash: null,
  selectedFilePath: null,
  selectedFileStaged: false,
  activeView: "status",
  scrollToCommit: null,

  selectedFilePaths: new Set(),
  lastSelectedFilePath: null,
  lastSelectedFileStaged: null,

  selectCommit: (hash) => set({ selectedCommitHash: hash }),
  selectFile: (path, staged) => set({ selectedFilePath: path, selectedFileStaged: staged }),
  setActiveView: (view) => set({ activeView: view }),
  selectAndScrollToCommit: (hash) =>
    set({ selectedCommitHash: hash, scrollToCommit: hash, activeView: "history" }),
  clearScrollToCommit: () => set({ scrollToCommit: null }),

  toggleFileSelection: (path, staged, isCtrl, isShift, allFilePaths) => {
    const { selectedFilePaths, lastSelectedFilePath, lastSelectedFileStaged } = get();
    const newSelection = new Set(selectedFilePaths);
    const key = makeSelectionKey(path, staged);

    if (isShift && lastSelectedFilePath && lastSelectedFileStaged === staged) {
      // Range selection: select all files between last selected and current (within same section)
      const lastIndex = allFilePaths.indexOf(lastSelectedFilePath);
      const currentIndex = allFilePaths.indexOf(path);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);

        for (let i = start; i <= end; i++) {
          newSelection.add(makeSelectionKey(allFilePaths[i], staged));
        }
      }
    } else if (isCtrl) {
      // Toggle selection: add or remove from selection
      if (newSelection.has(key)) {
        newSelection.delete(key);
      } else {
        newSelection.add(key);
      }
    } else {
      // Normal click: clear selection and select only this file
      newSelection.clear();
      newSelection.add(key);
    }

    set({
      selectedFilePaths: newSelection,
      lastSelectedFilePath: path,
      lastSelectedFileStaged: staged,
    });
  },

  clearFileSelection: () =>
    set({
      selectedFilePaths: new Set(),
      lastSelectedFilePath: null,
      lastSelectedFileStaged: null,
    }),

  isFileSelected: (path, staged) => get().selectedFilePaths.has(makeSelectionKey(path, staged)),
}));

// Export helpers for use in other components
export { makeSelectionKey, parseSelectionKey };
