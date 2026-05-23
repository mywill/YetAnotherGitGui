import { create } from "zustand";
import type { BranchInfo, StashInfo, BulkResult } from "../types";
import * as git from "../services/git";
import { useNotificationStore } from "./notificationStore";
import { useRepositoryStore } from "./repositoryStore";
import { cleanErrorMessage } from "../utils/errorMessages";

export type CleanupCategory = "gone" | "merged" | "stashes" | "untracked";

export const STASH_DAYS_OLD = 30;

interface CategoryState<TCandidate> {
  candidates: TCandidate[];
  selected: Set<string>;
  loading: boolean;
  lastResult: BulkResult[] | null;
  /** Anchor id for shift-click range selection. */
  lastSelectedId: string | null;
}

function emptyCategory<T>(): CategoryState<T> {
  return {
    candidates: [],
    selected: new Set(),
    loading: false,
    lastResult: null,
    lastSelectedId: null,
  };
}

interface CleanupState {
  gone: CategoryState<BranchInfo>;
  merged: CategoryState<BranchInfo>;
  stashes: CategoryState<StashInfo>;
  untracked: CategoryState<string>;

  refreshAll: () => Promise<void>;
  refreshCategory: (category: CleanupCategory) => Promise<void>;

  toggleSelection: (category: CleanupCategory, id: string) => void;
  selectAll: (category: CleanupCategory) => void;
  selectNone: (category: CleanupCategory) => void;
  /** Replace the selection with the given ids, set the anchor to the last one. */
  setRangeSelection: (category: CleanupCategory, ids: string[]) => void;
  /**
   * Replace the selection with the given ids, but leave the anchor
   * (`lastSelectedId`) unchanged. Used by keyboard shift-extends so the user
   * can keep expanding from the original anchor.
   */
  extendSelection: (category: CleanupCategory, ids: string[]) => void;

  runCategory: (category: CleanupCategory) => Promise<void>;
  pruneRemote: (remote: string) => Promise<void>;
}

function idForBranch(b: BranchInfo): string {
  return b.name;
}

function idForStash(s: StashInfo): string {
  return String(s.index);
}

function idForUntracked(p: string): string {
  return p;
}

const categoryFetchers = {
  gone: () => git.listGoneBranches(),
  merged: () => git.listMergedBranches(),
  stashes: () => git.listOldStashes(STASH_DAYS_OLD),
  untracked: () => git.listUntrackedFiles(),
} as const;

const categoryDeleters: Record<CleanupCategory, (ids: string[]) => Promise<BulkResult[]>> = {
  gone: (ids) => git.deleteBranches(ids),
  merged: (ids) => git.deleteBranches(ids),
  stashes: (ids) => git.dropStashes(ids.map(Number)),
  untracked: (ids) => git.cleanUntrackedFiles(ids),
};

const sidebarRefreshAfterRun: Record<CleanupCategory, () => Promise<void>> = {
  gone: () => useRepositoryStore.getState().loadBranchesAndTags(),
  merged: () => useRepositoryStore.getState().loadBranchesAndTags(),
  stashes: () => useRepositoryStore.getState().loadStashes(),
  untracked: () => useRepositoryStore.getState().loadFileStatuses(),
};

export const useCleanupStore = create<CleanupState>((set, get) => ({
  gone: emptyCategory(),
  merged: emptyCategory(),
  stashes: emptyCategory(),
  untracked: emptyCategory(),

  refreshAll: async () => {
    await Promise.all([
      get().refreshCategory("gone"),
      get().refreshCategory("merged"),
      get().refreshCategory("stashes"),
      get().refreshCategory("untracked"),
    ]);
  },

  refreshCategory: async (category) => {
    set(
      (state) => ({ [category]: { ...state[category], loading: true } }) as Partial<CleanupState>
    );
    try {
      const candidates = await categoryFetchers[category]();
      set({ [category]: { ...emptyCategory(), candidates } } as Partial<CleanupState>);
    } catch (err) {
      set(
        (state) => ({ [category]: { ...state[category], loading: false } }) as Partial<CleanupState>
      );
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  toggleSelection: (category, id) => {
    set((state) => {
      const cat = state[category];
      const next = new Set(cat.selected);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return {
        [category]: { ...cat, selected: next, lastSelectedId: id },
      } as Partial<CleanupState>;
    });
  },

  selectAll: (category) => {
    set((state) => {
      const cat = state[category];
      const ids: string[] = (() => {
        switch (category) {
          case "gone":
            return (cat as CategoryState<BranchInfo>).candidates.map(idForBranch);
          case "merged":
            return (cat as CategoryState<BranchInfo>).candidates.map(idForBranch);
          case "stashes":
            return (cat as CategoryState<StashInfo>).candidates.map(idForStash);
          case "untracked":
            return (cat as CategoryState<string>).candidates.map(idForUntracked);
        }
      })();
      return {
        [category]: {
          ...cat,
          selected: new Set(ids),
          lastSelectedId: ids[ids.length - 1] ?? null,
        },
      } as Partial<CleanupState>;
    });
  },

  selectNone: (category) => {
    set(
      (state) =>
        ({
          [category]: { ...state[category], selected: new Set(), lastSelectedId: null },
        }) as Partial<CleanupState>
    );
  },

  setRangeSelection: (category, ids) => {
    set(
      (state) =>
        ({
          [category]: {
            ...state[category],
            selected: new Set(ids),
            lastSelectedId: ids[ids.length - 1] ?? null,
          },
        }) as Partial<CleanupState>
    );
  },

  extendSelection: (category, ids) => {
    set(
      (state) =>
        ({
          [category]: {
            ...state[category],
            selected: new Set(ids),
          },
        }) as Partial<CleanupState>
    );
  },

  runCategory: async (category) => {
    const cat = get()[category];
    const selectedIds = Array.from(cat.selected);
    if (selectedIds.length === 0) return;

    set(
      (state) => ({ [category]: { ...state[category], loading: true } }) as Partial<CleanupState>
    );

    try {
      const results = await categoryDeleters[category](selectedIds);

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.length - succeeded;
      const notif = useNotificationStore.getState();
      if (failed === 0) {
        notif.showSuccess(`Cleaned up ${succeeded} item${succeeded === 1 ? "" : "s"}.`);
      } else if (succeeded === 0) {
        notif.showError(`Cleanup failed for all ${failed} item${failed === 1 ? "" : "s"}.`);
      } else {
        notif.showError(`Cleaned ${succeeded}, failed ${failed}. See list for details.`);
      }

      await get().refreshCategory(category);
      await sidebarRefreshAfterRun[category]();

      // Set lastResult AFTER refresh so the post-run summary persists.
      set(
        (state) =>
          ({
            [category]: {
              ...state[category],
              loading: false,
              lastResult: results,
            },
          }) as Partial<CleanupState>
      );
    } catch (err) {
      set(
        (state) => ({ [category]: { ...state[category], loading: false } }) as Partial<CleanupState>
      );
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },

  pruneRemote: async (remote) => {
    try {
      const pruned = await git.pruneRemote(remote);
      const notif = useNotificationStore.getState();
      if (pruned.length === 0) {
        notif.showSuccess(`Nothing to prune for ${remote}.`);
      } else {
        notif.showSuccess(
          `Pruned ${pruned.length} ref${pruned.length === 1 ? "" : "s"} from ${remote}.`
        );
      }
      await useRepositoryStore.getState().loadBranchesAndTags();
      // Pruning is the operation that *produces* more "gone" locals (and may
      // mark merged candidates differently); re-derive both categories so the
      // user sees the new state without a manual refresh click.
      await Promise.all([get().refreshCategory("gone"), get().refreshCategory("merged")]);
    } catch (err) {
      useNotificationStore.getState().showError(cleanErrorMessage(String(err)));
    }
  },
}));
