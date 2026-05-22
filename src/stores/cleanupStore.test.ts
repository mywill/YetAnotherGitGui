import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCleanupStore } from "./cleanupStore";
import * as git from "../services/git";

vi.mock("../services/git");

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockLoadBranchesAndTags = vi.fn().mockResolvedValue(undefined);
const mockLoadStashes = vi.fn().mockResolvedValue(undefined);
const mockLoadFileStatuses = vi.fn().mockResolvedValue(undefined);

vi.mock("./notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
    }),
  },
}));

vi.mock("./repositoryStore", () => ({
  useRepositoryStore: {
    getState: () => ({
      loadBranchesAndTags: mockLoadBranchesAndTags,
      loadStashes: mockLoadStashes,
      loadFileStatuses: mockLoadFileStatuses,
    }),
  },
}));

function resetStore() {
  useCleanupStore.setState({
    gone: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
    merged: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
    stashes: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
    untracked: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
  });
}

describe("cleanupStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe("refreshCategory", () => {
    it("loads gone branches", async () => {
      vi.mocked(git.listGoneBranches).mockResolvedValue([
        {
          name: "feature/x",
          is_remote: false,
          is_head: false,
          target_hash: "abc",
        },
      ]);
      await useCleanupStore.getState().refreshCategory("gone");
      expect(useCleanupStore.getState().gone.candidates).toHaveLength(1);
      expect(useCleanupStore.getState().gone.candidates[0].name).toBe("feature/x");
    });

    it("surfaces errors as toasts", async () => {
      vi.mocked(git.listOldStashes).mockRejectedValue(new Error("boom"));
      await useCleanupStore.getState().refreshCategory("stashes");
      expect(mockShowError).toHaveBeenCalled();
      expect(useCleanupStore.getState().stashes.loading).toBe(false);
    });
  });

  describe("selection", () => {
    it("toggles a single id on and off", () => {
      const { toggleSelection } = useCleanupStore.getState();
      toggleSelection("gone", "feature/x");
      expect(useCleanupStore.getState().gone.selected.has("feature/x")).toBe(true);
      toggleSelection("gone", "feature/x");
      expect(useCleanupStore.getState().gone.selected.has("feature/x")).toBe(false);
    });

    it("selectAll picks every candidate id", () => {
      useCleanupStore.setState({
        gone: {
          candidates: [
            { name: "a", is_remote: false, is_head: false, target_hash: "" },
            { name: "b", is_remote: false, is_head: false, target_hash: "" },
          ],
          selected: new Set(),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
      useCleanupStore.getState().selectAll("gone");
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a", "b"]));
    });

    it("selectNone clears the set and resets the anchor", () => {
      useCleanupStore.setState({
        gone: {
          candidates: [],
          selected: new Set(["a"]),
          loading: false,
          lastResult: null,
          lastSelectedId: "a",
        },
      });
      useCleanupStore.getState().selectNone("gone");
      expect(useCleanupStore.getState().gone.selected.size).toBe(0);
      expect(useCleanupStore.getState().gone.lastSelectedId).toBeNull();
    });

    it("setRangeSelection replaces selection and sets the anchor", () => {
      useCleanupStore.setState({
        gone: {
          candidates: [
            { name: "a", is_remote: false, is_head: false, target_hash: "" },
            { name: "b", is_remote: false, is_head: false, target_hash: "" },
            { name: "c", is_remote: false, is_head: false, target_hash: "" },
          ],
          selected: new Set(["a"]),
          loading: false,
          lastResult: null,
          lastSelectedId: "a",
        },
      });
      useCleanupStore.getState().setRangeSelection("gone", ["b", "c"]);
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["b", "c"]));
      expect(useCleanupStore.getState().gone.lastSelectedId).toBe("c");
    });

    it("setRangeSelection with empty array clears anchor", () => {
      useCleanupStore.getState().setRangeSelection("gone", []);
      expect(useCleanupStore.getState().gone.selected.size).toBe(0);
      expect(useCleanupStore.getState().gone.lastSelectedId).toBeNull();
    });

    it("toggleSelection updates lastSelectedId to the toggled id", () => {
      useCleanupStore.getState().toggleSelection("gone", "feature/x");
      expect(useCleanupStore.getState().gone.lastSelectedId).toBe("feature/x");
      // Toggling off still records the anchor (so a subsequent shift-click works).
      useCleanupStore.getState().toggleSelection("gone", "feature/x");
      expect(useCleanupStore.getState().gone.lastSelectedId).toBe("feature/x");
    });
  });

  describe("runCategory", () => {
    it("no-ops when nothing is selected", async () => {
      await useCleanupStore.getState().runCategory("gone");
      expect(git.deleteBranches).not.toHaveBeenCalled();
    });

    it("deletes selected branches and shows a success toast", async () => {
      useCleanupStore.setState({
        gone: {
          candidates: [{ name: "feature/x", is_remote: false, is_head: false, target_hash: "" }],
          selected: new Set(["feature/x"]),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
      vi.mocked(git.deleteBranches).mockResolvedValue([
        { item: "feature/x", success: true, error: null },
      ]);
      vi.mocked(git.listGoneBranches).mockResolvedValue([]);

      await useCleanupStore.getState().runCategory("gone");

      expect(git.deleteBranches).toHaveBeenCalledWith(["feature/x"]);
      expect(mockShowSuccess).toHaveBeenCalled();
      expect(mockLoadBranchesAndTags).toHaveBeenCalled();
      expect(useCleanupStore.getState().gone.lastResult).toHaveLength(1);
    });

    it("reports per-item failures in lastResult and shows mixed-result toast", async () => {
      useCleanupStore.setState({
        gone: {
          candidates: [
            { name: "a", is_remote: false, is_head: false, target_hash: "" },
            { name: "b", is_remote: false, is_head: false, target_hash: "" },
          ],
          selected: new Set(["a", "b"]),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
      vi.mocked(git.deleteBranches).mockResolvedValue([
        { item: "a", success: true, error: null },
        { item: "b", success: false, error: "nope" },
      ]);
      vi.mocked(git.listGoneBranches).mockResolvedValue([]);

      await useCleanupStore.getState().runCategory("gone");

      expect(useCleanupStore.getState().gone.lastResult).toEqual([
        { item: "a", success: true, error: null },
        { item: "b", success: false, error: "nope" },
      ]);
      expect(mockShowError).toHaveBeenCalled();
    });

    it("converts stash indices to numbers when dropping", async () => {
      useCleanupStore.setState({
        stashes: {
          candidates: [
            { index: 0, message: "old", commit_hash: "", timestamp: 0, branch_name: "main" },
          ],
          selected: new Set(["0"]),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
      vi.mocked(git.dropStashes).mockResolvedValue([
        { item: "stash@{0}", success: true, error: null },
      ]);
      vi.mocked(git.listOldStashes).mockResolvedValue([]);

      await useCleanupStore.getState().runCategory("stashes");

      expect(git.dropStashes).toHaveBeenCalledWith([0]);
      expect(mockLoadStashes).toHaveBeenCalled();
    });
  });

  describe("pruneRemote", () => {
    it("shows count of pruned refs on success", async () => {
      vi.mocked(git.pruneRemote).mockResolvedValue(["origin/dead-1", "origin/dead-2"]);
      await useCleanupStore.getState().pruneRemote("origin");
      expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining("2"));
      expect(mockLoadBranchesAndTags).toHaveBeenCalled();
    });

    it("shows a 'nothing to prune' toast when no refs returned", async () => {
      vi.mocked(git.pruneRemote).mockResolvedValue([]);
      await useCleanupStore.getState().pruneRemote("origin");
      expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining("Nothing"));
    });

    it("surfaces errors as toasts", async () => {
      vi.mocked(git.pruneRemote).mockRejectedValue(new Error("network down"));
      await useCleanupStore.getState().pruneRemote("origin");
      expect(mockShowError).toHaveBeenCalled();
    });

    it("refreshes gone and merged categories after a successful prune", async () => {
      vi.mocked(git.pruneRemote).mockResolvedValue(["origin/dead"]);
      vi.mocked(git.listGoneBranches).mockResolvedValue([]);
      vi.mocked(git.listMergedBranches).mockResolvedValue([]);

      await useCleanupStore.getState().pruneRemote("origin");

      expect(git.listGoneBranches).toHaveBeenCalled();
      expect(git.listMergedBranches).toHaveBeenCalled();
    });
  });
});
