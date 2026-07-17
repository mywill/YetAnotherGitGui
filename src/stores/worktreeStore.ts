import { create } from "zustand";
import type { WorktreeInfo } from "../types";
import * as worktreeService from "../services/worktree";
import { useNotificationStore } from "./notificationStore";
import { useRepositoryStore } from "./repositoryStore";
import { useDialogStore } from "./dialogStore";
import { cleanErrorMessage } from "../utils/errorMessages";

interface AddWorktreePreset {
  branch?: string;
  commitHash?: string;
}

interface WorktreeState {
  worktrees: WorktreeInfo[];
  loading: boolean;
  addDialogOpen: boolean;
  addDialogPreset: AddWorktreePreset | null;

  refresh: () => Promise<void>;
  openAddDialog: (preset?: AddWorktreePreset) => void;
  closeAddDialog: () => void;
  addWorktree: (params: {
    name: string;
    path: string;
    branch?: string | null;
    newBranch?: string | null;
    commitHash?: string | null;
  }) => Promise<boolean>;
  removeWorktree: (name: string, force: boolean) => Promise<void>;
  pruneWorktrees: () => Promise<void>;
  moveWorktree: (name: string, newPath: string) => Promise<void>;
  lockWorktree: (name: string, reason?: string | null) => Promise<void>;
  unlockWorktree: (name: string) => Promise<void>;
}

export const useWorktreeStore = create<WorktreeState>((set, get) => ({
  worktrees: [],
  loading: false,
  addDialogOpen: false,
  addDialogPreset: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const worktrees = await worktreeService.listWorktrees();
      set({ worktrees, loading: false });
    } catch (err) {
      set({ loading: false });
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  openAddDialog: (preset) => set({ addDialogOpen: true, addDialogPreset: preset ?? null }),
  closeAddDialog: () => set({ addDialogOpen: false, addDialogPreset: null }),

  addWorktree: async (params) => {
    try {
      await worktreeService.addWorktree(params);
      useNotificationStore.getState().showSuccess(`Created worktree "${params.name}".`);
      await get().refresh();
      // A new worktree may create a branch ref, so refresh the branch list.
      await useRepositoryStore.getState().loadBranchesAndTags();
      get().closeAddDialog();
      return true;
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
      return false;
    }
  },

  removeWorktree: async (name, force) => {
    const confirmed = await useDialogStore.getState().showConfirm({
      title: "Remove worktree",
      message: force
        ? `Force-remove worktree "${name}"? This deletes the working directory and prunes the worktree, even if locked or dirty.`
        : `Remove worktree "${name}"?`,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    try {
      await worktreeService.removeWorktree(name, force);
      useNotificationStore.getState().showSuccess(`Removed worktree "${name}".`);
      await get().refresh();
    } catch (err) {
      // If the user requested a non-force removal and the backend refused
      // because the tree is still valid, offer a force retry.
      const msg = cleanErrorMessage(String(err));
      if (!force && msg.includes("still valid")) {
        const forceConfirmed = await useDialogStore.getState().showConfirm({
          title: "Force remove?",
          message: `Worktree "${name}" is still present on disk. Force-remove will delete its working directory and prune, even if dirty or locked.`,
          confirmLabel: "Force remove",
          cancelLabel: "Cancel",
        });
        if (forceConfirmed) {
          await get().removeWorktree(name, true);
        }
        return;
      }
      useNotificationStore.getState().showError(msg);
    }
  },

  moveWorktree: async (name, newPath) => {
    try {
      await worktreeService.moveWorktree(name, newPath);
      useNotificationStore.getState().showSuccess(`Moved worktree "${name}".`);
      await get().refresh();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  pruneWorktrees: async () => {
    const prunable = get().worktrees.filter((w) => w.is_prunable && !w.is_main);
    if (prunable.length === 0) {
      useNotificationStore.getState().showSuccess("No prunable worktrees.");
      return;
    }
    const names = prunable.map((w) => w.name).join(", ");
    const confirmed = await useDialogStore.getState().showConfirm({
      title: "Prune worktrees",
      message: `Remove ${prunable.length} prunable worktree${prunable.length === 1 ? "" : "s"}?\n\n${names}\n\nThis will delete the working directories and prune the worktree metadata.`,
      confirmLabel: "Prune",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    let succeeded = 0;
    let failed = 0;
    for (const wt of prunable) {
      try {
        await worktreeService.removeWorktree(wt.name, true);
        succeeded++;
      } catch {
        failed++;
      }
    }
    const notif = useNotificationStore.getState();
    if (failed === 0) {
      notif.showSuccess(`Pruned ${succeeded} worktree${succeeded === 1 ? "" : "s"}.`);
    } else {
      notif.showError(`Pruned ${succeeded}, failed ${failed}.`);
    }
    await get().refresh();
  },

  lockWorktree: async (name, reason) => {
    try {
      await worktreeService.lockWorktree(name, reason);
      await get().refresh();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  unlockWorktree: async (name) => {
    try {
      await worktreeService.unlockWorktree(name);
      await get().refresh();
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },
}));
