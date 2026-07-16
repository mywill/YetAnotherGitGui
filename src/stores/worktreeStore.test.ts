import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorktreeStore } from "./worktreeStore";
import * as worktreeService from "../services/worktree";
import type { WorktreeInfo } from "../types";

vi.mock("../services/worktree");

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockLoadBranchesAndTags = vi.fn().mockResolvedValue(undefined);
const mockShowConfirm = vi.fn().mockResolvedValue(true);

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
    }),
  },
}));

vi.mock("./dialogStore", () => ({
  useDialogStore: {
    getState: () => ({
      showConfirm: mockShowConfirm,
    }),
  },
}));

const mainWt: WorktreeInfo = {
  name: "main",
  path: "/repo",
  is_main: true,
  branch: "main",
  head_hash: "abc123",
  is_valid: true,
  is_locked: false,
  lock_reason: null,
  is_prunable: false,
  dirty_count: 0,
  ahead: null,
  behind: null,
  last_commit_summary: "init",
  last_commit_author: "me",
  last_commit_time: 1000,
};

const linkedWt: WorktreeInfo = {
  name: "feature",
  path: "/repo-wt-feature",
  is_main: false,
  branch: "feature",
  head_hash: "def456",
  is_valid: true,
  is_locked: false,
  lock_reason: null,
  is_prunable: false,
  dirty_count: 2,
  ahead: 3,
  behind: 1,
  last_commit_summary: "feat",
  last_commit_author: "you",
  last_commit_time: 2000,
};

function resetStore() {
  useWorktreeStore.setState({
    worktrees: [],
    loading: false,
    addDialogOpen: false,
    addDialogPreset: null,
  });
}

describe("worktreeStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe("refresh", () => {
    it("loads worktrees from the service", async () => {
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt, linkedWt]);
      await useWorktreeStore.getState().refresh();
      expect(useWorktreeStore.getState().worktrees).toEqual([mainWt, linkedWt]);
      expect(useWorktreeStore.getState().loading).toBe(false);
    });

    it("shows an error notification on failure", async () => {
      vi.mocked(worktreeService.listWorktrees).mockRejectedValue(new Error("boom"));
      await useWorktreeStore.getState().refresh();
      expect(mockShowError).toHaveBeenCalledTimes(1);
      expect(useWorktreeStore.getState().loading).toBe(false);
    });
  });

  describe("addWorktree", () => {
    it("creates a worktree, refreshes, and closes the dialog", async () => {
      vi.mocked(worktreeService.addWorktree).mockResolvedValue(linkedWt);
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt, linkedWt]);
      useWorktreeStore.setState({ addDialogOpen: true });

      const ok = await useWorktreeStore.getState().addWorktree({
        name: "feature",
        path: "/repo-wt-feature",
        newBranch: "feature",
      });

      expect(ok).toBe(true);
      expect(worktreeService.addWorktree).toHaveBeenCalledWith({
        name: "feature",
        path: "/repo-wt-feature",
        newBranch: "feature",
      });
      expect(mockShowSuccess).toHaveBeenCalled();
      expect(mockLoadBranchesAndTags).toHaveBeenCalled();
      expect(useWorktreeStore.getState().addDialogOpen).toBe(false);
      expect(useWorktreeStore.getState().worktrees).toHaveLength(2);
    });

    it("surfaces an error and leaves the dialog open on failure", async () => {
      vi.mocked(worktreeService.addWorktree).mockRejectedValue(new Error("nope"));
      useWorktreeStore.setState({ addDialogOpen: true });

      const ok = await useWorktreeStore.getState().addWorktree({
        name: "x",
        path: "/x",
      });

      expect(ok).toBe(false);
      expect(mockShowError).toHaveBeenCalled();
      expect(useWorktreeStore.getState().addDialogOpen).toBe(true);
    });
  });

  describe("removeWorktree", () => {
    it("aborts when the confirm dialog is cancelled", async () => {
      mockShowConfirm.mockResolvedValueOnce(false);
      await useWorktreeStore.getState().removeWorktree("feature", false);
      expect(worktreeService.removeWorktree).not.toHaveBeenCalled();
    });

    it("removes after confirmation and refreshes", async () => {
      vi.mocked(worktreeService.removeWorktree).mockResolvedValue(undefined);
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt]);

      await useWorktreeStore.getState().removeWorktree("feature", false);

      expect(worktreeService.removeWorktree).toHaveBeenCalledWith("feature", false);
      expect(mockShowSuccess).toHaveBeenCalled();
      expect(useWorktreeStore.getState().worktrees).toEqual([mainWt]);
    });

    it("offers force removal when backend refuses a still-valid tree", async () => {
      vi.mocked(worktreeService.removeWorktree)
        .mockRejectedValueOnce(new Error("Git error: Worktree is still valid on disk"))
        .mockResolvedValueOnce(undefined);
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt]);
      mockShowConfirm
        .mockResolvedValueOnce(true) // initial confirm
        .mockResolvedValueOnce(true); // force confirm

      await useWorktreeStore.getState().removeWorktree("feature", false);

      expect(worktreeService.removeWorktree).toHaveBeenNthCalledWith(2, "feature", true);
    });
  });

  describe("lock / unlock / move", () => {
    it("locks and refreshes", async () => {
      vi.mocked(worktreeService.lockWorktree).mockResolvedValue(undefined);
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt]);
      await useWorktreeStore.getState().lockWorktree("feature", "reason");
      expect(worktreeService.lockWorktree).toHaveBeenCalledWith("feature", "reason");
    });

    it("unlocks and refreshes", async () => {
      vi.mocked(worktreeService.unlockWorktree).mockResolvedValue(undefined);
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt]);
      await useWorktreeStore.getState().unlockWorktree("feature");
      expect(worktreeService.unlockWorktree).toHaveBeenCalledWith("feature");
    });

    it("moves and refreshes", async () => {
      vi.mocked(worktreeService.moveWorktree).mockResolvedValue(undefined);
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt]);
      await useWorktreeStore.getState().moveWorktree("feature", "/new");
      expect(worktreeService.moveWorktree).toHaveBeenCalledWith("feature", "/new");
    });
  });

  describe("dialog state", () => {
    it("opens the add dialog with a preset", () => {
      useWorktreeStore.getState().openAddDialog({ branch: "feature" });
      const s = useWorktreeStore.getState();
      expect(s.addDialogOpen).toBe(true);
      expect(s.addDialogPreset).toEqual({ branch: "feature" });
    });

    it("closes the add dialog and clears the preset", () => {
      useWorktreeStore.setState({ addDialogOpen: true, addDialogPreset: { branch: "x" } });
      useWorktreeStore.getState().closeAddDialog();
      const s = useWorktreeStore.getState();
      expect(s.addDialogOpen).toBe(false);
      expect(s.addDialogPreset).toBeNull();
    });
  });

  describe("pruneWorktrees", () => {
    it("does nothing when no prunable worktrees exist", async () => {
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt]);
      useWorktreeStore.setState({ worktrees: [mainWt] });
      await useWorktreeStore.getState().pruneWorktrees();
      expect(worktreeService.removeWorktree).not.toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith("No prunable worktrees.");
    });

    it("confirms and prunes all prunable worktrees", async () => {
      const prunable: WorktreeInfo = {
        ...linkedWt,
        is_prunable: true,
      };
      useWorktreeStore.setState({ worktrees: [mainWt, prunable] });
      vi.mocked(worktreeService.removeWorktree).mockResolvedValue(undefined);
      vi.mocked(worktreeService.listWorktrees).mockResolvedValue([mainWt]);
      mockShowConfirm.mockResolvedValueOnce(true);

      await useWorktreeStore.getState().pruneWorktrees();

      expect(mockShowConfirm).toHaveBeenCalled();
      expect(worktreeService.removeWorktree).toHaveBeenCalledWith("feature", true);
      expect(mockShowSuccess).toHaveBeenCalled();
    });

    it("aborts when the confirm dialog is cancelled", async () => {
      const prunable: WorktreeInfo = { ...linkedWt, is_prunable: true };
      useWorktreeStore.setState({ worktrees: [mainWt, prunable] });
      mockShowConfirm.mockResolvedValueOnce(false);

      await useWorktreeStore.getState().pruneWorktrees();

      expect(worktreeService.removeWorktree).not.toHaveBeenCalled();
    });
  });
});
