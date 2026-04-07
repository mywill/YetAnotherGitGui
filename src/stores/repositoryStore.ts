import { create } from "zustand";
import { useDialogStore } from "./dialogStore";
import type {
  RepositoryInfo,
  GraphCommit,
  FileStatuses,
  FileDiff,
  CommitDetails,
  BranchInfo,
  TagInfo,
  StashInfo,
  StashDetails,
} from "../types";
import * as git from "../services/git";
import { useNotificationStore } from "./notificationStore";
import { cleanErrorMessage } from "../utils/errorMessages";

interface RepositoryState {
  // Repository info
  repositoryInfo: RepositoryInfo | null;
  isLoading: boolean;

  // Commits
  commits: GraphCommit[];
  commitsLoading: boolean;
  hasMoreCommits: boolean;

  // File statuses
  fileStatuses: FileStatuses | null;
  fileStatusesLoading: boolean;

  // Current diff
  currentDiff: FileDiff | null;
  currentDiffPath: string | null;
  currentDiffStaged: boolean;
  currentDiffIsUntracked: boolean;
  currentDiffIsConflicted: boolean;
  diffLoading: boolean;

  // History view - selected commit details
  selectedCommitDetails: CommitDetails | null;
  commitDetailsLoading: boolean;
  expandedCommitFiles: Set<string>;
  commitFileDiffs: Map<string, FileDiff>;

  // Sidebar - branches, tags, and stashes
  branches: BranchInfo[];
  tags: TagInfo[];
  stashes: StashInfo[];

  // Stash details
  selectedStashDetails: StashDetails | null;
  stashDetailsLoading: boolean;
  expandedStashFiles: Set<string>;
  stashFileDiffs: Map<string, FileDiff>;

  // Actions
  openRepository: (path: string) => Promise<void>;
  refreshRepository: () => Promise<void>;
  loadAllCommits: () => Promise<void>;
  loadFileStatuses: () => Promise<void>;
  loadFileDiff: (
    path: string,
    staged: boolean,
    isUntracked?: boolean,
    isConflicted?: boolean
  ) => Promise<void>;
  clearDiff: () => void;
  resolveConflict: (path: string, strategy: string) => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  unstageFiles: (paths: string[]) => Promise<void>;
  stageHunk: (path: string, hunkIndex: number) => Promise<void>;
  unstageHunk: (path: string, hunkIndex: number) => Promise<void>;
  stageLines: (path: string, hunkIndex: number, lineIndices: number[]) => Promise<void>;
  discardHunk: (path: string, hunkIndex: number) => Promise<void>;
  discardLines: (path: string, hunkIndex: number, lineIndices: number[]) => Promise<void>;
  createCommit: (message: string) => Promise<void>;
  checkoutCommit: (hash: string) => Promise<void>;
  revertFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;

  // Lazy hunk loading
  loadDiffHunk: (
    path: string,
    staged: boolean,
    hunkIndex: number,
    isUntracked?: boolean,
    isConflicted?: boolean
  ) => Promise<void>;
  loadCommitDiffHunk: (hash: string, filePath: string, hunkIndex: number) => Promise<void>;

  // History view actions
  loadCommitDetails: (hash: string) => Promise<void>;
  clearCommitDetails: () => void;
  toggleCommitFileExpanded: (filePath: string) => void;
  loadCommitFileDiff: (hash: string, filePath: string) => Promise<void>;

  // History view revert actions
  revertCommit: (hash: string) => Promise<void>;
  revertCommitFile: (hash: string, path: string) => Promise<void>;
  revertCommitFileLines: (
    hash: string,
    path: string,
    hunkIndex: number,
    lineIndices: number[]
  ) => Promise<void>;

  // Sidebar actions
  loadBranchesAndTags: () => Promise<void>;
  checkoutBranch: (branchName: string) => Promise<void>;
  deleteBranch: (branchName: string, isRemote: boolean) => Promise<void>;
  deleteTag: (tagName: string) => Promise<void>;

  // Stash actions
  loadStashes: () => Promise<void>;
  loadStashDetails: (index: number) => Promise<void>;
  clearStashDetails: () => void;
  applyStash: (index: number) => Promise<void>;
  dropStash: (index: number) => Promise<void>;
  toggleStashFileExpanded: (filePath: string) => void;
  loadStashFileDiff: (index: number, filePath: string) => Promise<void>;
}

type DiffRefresh = { path: string; staged: boolean } | { conditionalPath: string; staged: boolean };

async function withStagingRefresh(
  gitOp: () => Promise<void>,
  get: () => RepositoryState,
  diffRefresh?: DiffRefresh
) {
  try {
    await gitOp();
    await get().loadFileStatuses();
    if (diffRefresh) {
      if ("path" in diffRefresh) {
        await get().loadFileDiff(diffRefresh.path, diffRefresh.staged);
      } else if (get().currentDiffPath === diffRefresh.conditionalPath) {
        await get().loadFileDiff(diffRefresh.conditionalPath, diffRefresh.staged);
      }
    }
  } catch (err) {
    useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
  }
}

export function useIsEmptyRepo(): boolean {
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const commits = useRepositoryStore((s) => s.commits);
  return (
    repositoryInfo !== null &&
    repositoryInfo.head_hash === null &&
    !repositoryInfo.is_detached &&
    commits.length === 0
  );
}

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  repositoryInfo: null,
  isLoading: false,

  commits: [],
  commitsLoading: false,
  hasMoreCommits: true,

  fileStatuses: null,
  fileStatusesLoading: false,

  currentDiff: null,
  currentDiffPath: null,
  currentDiffStaged: false,
  currentDiffIsUntracked: false,
  currentDiffIsConflicted: false,
  diffLoading: false,

  selectedCommitDetails: null,
  commitDetailsLoading: false,
  expandedCommitFiles: new Set(),
  commitFileDiffs: new Map(),

  branches: [],
  tags: [],
  stashes: [],

  selectedStashDetails: null,
  stashDetailsLoading: false,
  expandedStashFiles: new Set(),
  stashFileDiffs: new Map(),

  openRepository: async (path: string) => {
    set({ isLoading: true, fileStatusesLoading: true, commitsLoading: true });
    try {
      const info = await git.openRepository(path);
      // Reset loading states before triggering data loads
      set({
        repositoryInfo: info,
        isLoading: false,
        commitsLoading: false,
        fileStatusesLoading: false,
      });

      // Load initial data
      await Promise.all([get().loadAllCommits(), get().loadFileStatuses()]);
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
      set({
        isLoading: false,
        fileStatusesLoading: false,
        commitsLoading: false,
      });
    }
  },

  refreshRepository: async () => {
    const { repositoryInfo } = get();
    if (!repositoryInfo) return;

    set({ commits: [], hasMoreCommits: false });

    try {
      const info = await git.getRepositoryInfo();
      set({ repositoryInfo: info });

      await Promise.all([get().loadAllCommits(), get().loadFileStatuses()]);

      // Refresh current diff if one is selected
      const { currentDiffPath, currentDiffStaged } = get();
      if (currentDiffPath) {
        await get().loadFileDiff(currentDiffPath, currentDiffStaged);
      }
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadAllCommits: async () => {
    const { commitsLoading, repositoryInfo } = get();
    // Don't load if already loading or no repository open
    if (commitsLoading || !repositoryInfo) return;

    set({ commitsLoading: true });
    try {
      const allCommits = await git.getAllCommitGraph();
      set({
        commits: allCommits,
        commitsLoading: false,
        hasMoreCommits: false,
      });
    } catch (err) {
      set({ commitsLoading: false });
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadFileStatuses: async () => {
    set({ fileStatusesLoading: true });
    try {
      const statuses = await git.getFileStatuses();
      set({ fileStatuses: statuses, fileStatusesLoading: false });
    } catch (err) {
      set({ fileStatusesLoading: false });
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadFileDiff: async (
    path: string,
    staged: boolean,
    isUntracked?: boolean,
    isConflicted?: boolean
  ) => {
    // Clear stash selection when viewing a file diff
    set({
      diffLoading: true,
      currentDiffPath: path,
      currentDiffStaged: staged,
      currentDiffIsUntracked: isUntracked ?? false,
      currentDiffIsConflicted: isConflicted ?? false,
      selectedStashDetails: null,
      expandedStashFiles: new Set(),
      stashFileDiffs: new Map(),
    });
    try {
      const diff = await git.getFileDiff(path, staged, isUntracked, isConflicted);
      set({ currentDiff: diff, diffLoading: false });
    } catch (err) {
      set({ diffLoading: false });
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  resolveConflict: async (path: string, strategy: string) => {
    try {
      await git.resolveConflict(path, strategy);
      await get().loadFileStatuses();
      // Clear the conflict diff since the file is now resolved
      set({ currentDiff: null, currentDiffPath: null, currentDiffIsConflicted: false });
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadDiffHunk: async (
    path: string,
    staged: boolean,
    hunkIndex: number,
    isUntracked?: boolean,
    isConflicted?: boolean
  ) => {
    try {
      const loadedHunk = await git.getDiffHunk(path, staged, hunkIndex, isUntracked, isConflicted);
      const { currentDiff } = get();
      if (!currentDiff || currentDiff.path !== path) return;
      const newHunks = [...currentDiff.hunks];
      newHunks[hunkIndex] = loadedHunk;
      set({ currentDiff: { ...currentDiff, hunks: newHunks } });
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadCommitDiffHunk: async (hash: string, filePath: string, hunkIndex: number) => {
    try {
      const loadedHunk = await git.getCommitDiffHunk(hash, filePath, hunkIndex);
      const { commitFileDiffs } = get();
      const diff = commitFileDiffs.get(filePath);
      if (!diff) return;
      const newHunks = [...diff.hunks];
      newHunks[hunkIndex] = loadedHunk;
      const newDiffs = new Map(commitFileDiffs);
      newDiffs.set(filePath, { ...diff, hunks: newHunks });
      set({ commitFileDiffs: newDiffs });
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  clearDiff: () => {
    set({
      currentDiff: null,
      currentDiffPath: null,
      currentDiffIsConflicted: false,
    });
  },

  stageFile: async (path: string) => {
    await withStagingRefresh(() => git.stageFile(path), get, {
      conditionalPath: path,
      staged: true,
    });
  },

  unstageFile: async (path: string) => {
    await withStagingRefresh(() => git.unstageFile(path), get, {
      conditionalPath: path,
      staged: false,
    });
  },

  stageFiles: async (paths: string[]) => {
    await withStagingRefresh(async () => {
      for (const path of paths) {
        await git.stageFile(path);
      }
    }, get);
  },

  unstageFiles: async (paths: string[]) => {
    await withStagingRefresh(async () => {
      for (const path of paths) {
        await git.unstageFile(path);
      }
    }, get);
  },

  stageHunk: async (path: string, hunkIndex: number) => {
    await withStagingRefresh(() => git.stageHunk(path, hunkIndex), get, {
      path,
      staged: false,
    });
  },

  unstageHunk: async (path: string, hunkIndex: number) => {
    await withStagingRefresh(() => git.unstageHunk(path, hunkIndex), get, {
      path,
      staged: true,
    });
  },

  stageLines: async (path: string, hunkIndex: number, lineIndices: number[]) => {
    await withStagingRefresh(() => git.stageLines(path, hunkIndex, lineIndices), get, {
      path,
      staged: false,
    });
  },

  discardHunk: async (path: string, hunkIndex: number) => {
    await withStagingRefresh(() => git.discardHunk(path, hunkIndex), get, {
      path,
      staged: false,
    });
  },

  discardLines: async (path: string, hunkIndex: number, lineIndices: number[]) => {
    await withStagingRefresh(() => git.discardHunk(path, hunkIndex, lineIndices), get, {
      path,
      staged: false,
    });
  },

  createCommit: async (message: string) => {
    try {
      await git.createCommit(message);
      // Clear diff view since the committed file is no longer in the staging area
      get().clearDiff();
      await get().refreshRepository();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  checkoutCommit: async (hash: string) => {
    try {
      await git.checkoutCommit(hash);
      await get().refreshRepository();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  revertFile: async (path: string) => {
    try {
      await git.revertFile(path);
      await get().loadFileStatuses();

      // Clear diff if viewing the reverted file
      const { currentDiffPath } = get();
      if (currentDiffPath === path) {
        set({ currentDiff: null, currentDiffPath: null });
      }
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  deleteFile: async (path: string) => {
    const confirmed = await useDialogStore.getState().showConfirm({
      title: "Delete file",
      message: `Delete ${path}? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    try {
      await git.deleteFile(path);
      await get().loadFileStatuses();

      // Clear diff if viewing the deleted file
      const { currentDiffPath } = get();
      if (currentDiffPath === path) {
        set({ currentDiff: null, currentDiffPath: null });
      }
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadCommitDetails: async (hash: string) => {
    set({ commitDetailsLoading: true, expandedCommitFiles: new Set(), commitFileDiffs: new Map() });
    try {
      const details = await git.getCommitDetails(hash);
      set({ selectedCommitDetails: details, commitDetailsLoading: false });
    } catch (err) {
      set({ commitDetailsLoading: false });
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  clearCommitDetails: () => {
    set({
      selectedCommitDetails: null,
      expandedCommitFiles: new Set(),
      commitFileDiffs: new Map(),
    });
  },

  toggleCommitFileExpanded: (filePath: string) => {
    const { expandedCommitFiles } = get();
    const newExpanded = new Set(expandedCommitFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    set({ expandedCommitFiles: newExpanded });
  },

  loadCommitFileDiff: async (hash: string, filePath: string) => {
    try {
      const diff = await git.getCommitFileDiff(hash, filePath);
      const { commitFileDiffs } = get();
      const newDiffs = new Map(commitFileDiffs);
      newDiffs.set(filePath, diff);
      set({ commitFileDiffs: newDiffs });
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  revertCommit: async (hash: string) => {
    try {
      await git.revertCommit(hash);
      await get().loadFileStatuses();
      useNotificationStore.getState().showSuccess(`Reverted commit ${hash.slice(0, 7)}`);
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  revertCommitFile: async (hash: string, path: string) => {
    try {
      await git.revertCommitFile(hash, path);
      await get().loadFileStatuses();
      useNotificationStore.getState().showSuccess(`Reverted ${path}`);
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  revertCommitFileLines: async (
    hash: string,
    path: string,
    hunkIndex: number,
    lineIndices: number[]
  ) => {
    try {
      await git.revertCommitFileLines(hash, path, hunkIndex, lineIndices);
      await get().loadFileStatuses();
      // Refresh the commit file diff to reflect changes
      await get().loadCommitFileDiff(hash, path);
      useNotificationStore.getState().showSuccess(`Reverted lines in ${path}`);
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadBranchesAndTags: async () => {
    try {
      const [branches, tags, stashes] = await Promise.all([
        git.listBranches(),
        git.listTags(),
        git.listStashes(),
      ]);
      set({ branches, tags, stashes });
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  checkoutBranch: async (branchName: string) => {
    try {
      await git.checkoutBranch(branchName);
      await get().refreshRepository();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  deleteBranch: async (branchName: string, isRemote: boolean) => {
    try {
      await git.deleteBranch(branchName, isRemote);
      await get().refreshRepository();
      await get().loadBranchesAndTags();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  deleteTag: async (tagName: string) => {
    try {
      await git.deleteTag(tagName);
      await get().refreshRepository();
      await get().loadBranchesAndTags();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadStashes: async () => {
    try {
      const stashes = await git.listStashes();
      set({ stashes });
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  loadStashDetails: async (index: number) => {
    set({
      stashDetailsLoading: true,
      expandedStashFiles: new Set(),
      stashFileDiffs: new Map(),
    });
    try {
      const details = await git.getStashDetails(index);
      set({ selectedStashDetails: details, stashDetailsLoading: false });
    } catch (err) {
      set({ stashDetailsLoading: false });
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  clearStashDetails: () => {
    set({
      selectedStashDetails: null,
      expandedStashFiles: new Set(),
      stashFileDiffs: new Map(),
    });
  },

  applyStash: async (index: number) => {
    try {
      await git.applyStash(index);
      await get().refreshRepository();
      await get().loadBranchesAndTags();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  dropStash: async (index: number) => {
    try {
      const { selectedStashDetails } = get();
      await git.dropStash(index);
      await get().loadBranchesAndTags();

      // Clear details if viewing the dropped stash
      if (selectedStashDetails && selectedStashDetails.index === index) {
        set({
          selectedStashDetails: null,
          expandedStashFiles: new Set(),
          stashFileDiffs: new Map(),
        });
      }
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  toggleStashFileExpanded: (filePath: string) => {
    const { expandedStashFiles } = get();
    const newExpanded = new Set(expandedStashFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    set({ expandedStashFiles: newExpanded });
  },

  loadStashFileDiff: async (index: number, filePath: string) => {
    try {
      const diff = await git.getStashFileDiff(index, filePath);
      const { stashFileDiffs } = get();
      const newDiffs = new Map(stashFileDiffs);
      newDiffs.set(filePath, diff);
      set({ stashFileDiffs: newDiffs });
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },
}));
