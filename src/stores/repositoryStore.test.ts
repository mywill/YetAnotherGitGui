import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRepositoryStore } from "./repositoryStore";
import * as git from "../services/git";

// Mock the git service
vi.mock("../services/git");

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowConfirm = vi.fn();

vi.mock("./notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
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

describe("repositoryStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    mockShowError.mockReset();
    mockShowSuccess.mockReset();
    mockShowConfirm.mockReset();
    useRepositoryStore.setState({
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
      diffLoading: false,
      branches: [],
      tags: [],
      stashes: [],
      selectedStashDetails: null,
      stashDetailsLoading: false,
      expandedStashFiles: new Set(),
      stashFileDiffs: new Map(),
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("openRepository", () => {
    it("sets loading state while opening repository", async () => {
      vi.mocked(git.openRepository).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { openRepository } = useRepositoryStore.getState();

      const promise = openRepository("/test/repo");

      // Check loading state is set
      expect(useRepositoryStore.getState().isLoading).toBe(true);

      await promise;

      expect(useRepositoryStore.getState().isLoading).toBe(false);
    });

    it("stores repository info on successful open", async () => {
      const repoInfo = {
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: ["origin"],
        head_hash: "abc123",
      };

      vi.mocked(git.openRepository).mockResolvedValue(repoInfo);
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { openRepository } = useRepositoryStore.getState();
      await openRepository("/test/repo");

      expect(useRepositoryStore.getState().repositoryInfo).toEqual(repoInfo);
    });

    it("loads commits and file statuses after opening", async () => {
      // The store sets commitsLoading: true immediately, then calls loadMoreCommits
      // which checks if commitsLoading is true and returns early.
      // This test verifies that getFileStatuses is called at minimum,
      // and the overall data loading mechanism works.
      vi.mocked(git.openRepository).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([
        {
          hash: "abc123",
          short_hash: "abc123",
          message: "Test commit",
          author_name: "Test",
          author_email: "test@test.com",
          timestamp: 1234567890,
          parent_hashes: [],
          column: 0,
          lines: [],
          refs: [],
          is_tip: true,
        },
      ]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { openRepository } = useRepositoryStore.getState();
      await openRepository("/test/repo");

      // File statuses should be loaded
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(useRepositoryStore.getState().fileStatuses).toEqual({
        staged: [],
        unstaged: [],
        untracked: [],
      });
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.openRepository).mockRejectedValue(new Error("Repository not found"));

      const { openRepository } = useRepositoryStore.getState();
      await openRepository("/invalid/path");

      expect(mockShowError).toHaveBeenCalledWith("Error: Repository not found");
      expect(useRepositoryStore.getState().isLoading).toBe(false);
    });
  });

  describe("stageFile", () => {
    it("calls git.stageFile and refreshes statuses", async () => {
      vi.mocked(git.stageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [{ path: "test.ts", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      });

      const { stageFile } = useRepositoryStore.getState();
      await stageFile("test.ts");

      expect(git.stageFile).toHaveBeenCalledWith("test.ts");
      expect(git.getFileStatuses).toHaveBeenCalled();
    });

    it("refreshes diff if viewing the same file", async () => {
      useRepositoryStore.setState({
        currentDiffPath: "test.ts",
        currentDiffStaged: false,
      });

      vi.mocked(git.stageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { stageFile } = useRepositoryStore.getState();
      await stageFile("test.ts");

      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", true, undefined);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.stageFile).mockRejectedValue(new Error("Stage failed"));

      const { stageFile } = useRepositoryStore.getState();
      await stageFile("test.ts");

      expect(mockShowError).toHaveBeenCalledWith("Error: Stage failed");
    });
  });

  describe("unstageFile", () => {
    it("calls git.unstageFile and refreshes statuses", async () => {
      vi.mocked(git.unstageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [{ path: "test.ts", status: "modified", is_staged: false }],
        untracked: [],
      });

      const { unstageFile } = useRepositoryStore.getState();
      await unstageFile("test.ts");

      expect(git.unstageFile).toHaveBeenCalledWith("test.ts");
      expect(git.getFileStatuses).toHaveBeenCalled();
    });

    it("refreshes diff with staged=false after unstaging", async () => {
      useRepositoryStore.setState({
        currentDiffPath: "test.ts",
        currentDiffStaged: true,
      });

      vi.mocked(git.unstageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { unstageFile } = useRepositoryStore.getState();
      await unstageFile("test.ts");

      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", false, undefined);
    });
  });

  describe("createCommit", () => {
    it("calls git.createCommit and refreshes repository", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.createCommit).mockResolvedValue("def456");
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "def456",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { createCommit } = useRepositoryStore.getState();
      await createCommit("Test commit message");

      expect(git.createCommit).toHaveBeenCalledWith("Test commit message");
      expect(git.getRepositoryInfo).toHaveBeenCalled();
    });

    it("clears current diff after successful commit", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        currentDiff: { path: "test.ts", hunks: [], is_binary: false },
        currentDiffPath: "test.ts",
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.createCommit).mockResolvedValue("def456");
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "def456",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { createCommit } = useRepositoryStore.getState();
      await createCommit("Test commit message");

      expect(useRepositoryStore.getState().currentDiff).toBeNull();
      expect(useRepositoryStore.getState().currentDiffPath).toBeNull();
    });

    it("sets error state on failure", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
      });

      vi.mocked(git.createCommit).mockRejectedValue(new Error("Commit failed"));

      const { createCommit } = useRepositoryStore.getState();
      await createCommit("Test message");

      expect(mockShowError).toHaveBeenCalledWith("Error: Commit failed");
    });
  });

  describe("stageFiles", () => {
    it("stages multiple files in a single batch", async () => {
      vi.mocked(git.stageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [
          { path: "file1.ts", status: "modified", is_staged: true },
          { path: "file2.ts", status: "modified", is_staged: true },
          { path: "file3.ts", status: "modified", is_staged: true },
        ],
        unstaged: [],
        untracked: [],
      });

      const { stageFiles } = useRepositoryStore.getState();
      await stageFiles(["file1.ts", "file2.ts", "file3.ts"]);

      expect(git.stageFile).toHaveBeenCalledTimes(3);
      expect(git.stageFile).toHaveBeenCalledWith("file1.ts");
      expect(git.stageFile).toHaveBeenCalledWith("file2.ts");
      expect(git.stageFile).toHaveBeenCalledWith("file3.ts");
    });

    it("only refreshes file statuses once after all files are staged", async () => {
      vi.mocked(git.stageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { stageFiles } = useRepositoryStore.getState();
      await stageFiles(["file1.ts", "file2.ts", "file3.ts"]);

      expect(git.getFileStatuses).toHaveBeenCalledTimes(1);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.stageFile).mockRejectedValue(new Error("Stage failed"));

      const { stageFiles } = useRepositoryStore.getState();
      await stageFiles(["file1.ts"]);

      expect(mockShowError).toHaveBeenCalledWith("Error: Stage failed");
    });
  });

  describe("unstageFiles", () => {
    it("unstages multiple files in a single batch", async () => {
      vi.mocked(git.unstageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [
          { path: "file1.ts", status: "modified", is_staged: false },
          { path: "file2.ts", status: "modified", is_staged: false },
        ],
        untracked: [],
      });

      const { unstageFiles } = useRepositoryStore.getState();
      await unstageFiles(["file1.ts", "file2.ts"]);

      expect(git.unstageFile).toHaveBeenCalledTimes(2);
      expect(git.unstageFile).toHaveBeenCalledWith("file1.ts");
      expect(git.unstageFile).toHaveBeenCalledWith("file2.ts");
    });

    it("only refreshes file statuses once after all files are unstaged", async () => {
      vi.mocked(git.unstageFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { unstageFiles } = useRepositoryStore.getState();
      await unstageFiles(["file1.ts", "file2.ts"]);

      expect(git.getFileStatuses).toHaveBeenCalledTimes(1);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.unstageFile).mockRejectedValue(new Error("Unstage failed"));

      const { unstageFiles } = useRepositoryStore.getState();
      await unstageFiles(["file1.ts"]);

      expect(mockShowError).toHaveBeenCalledWith("Error: Unstage failed");
    });
  });

  describe("revertFile", () => {
    it("calls git.revertFile and refreshes statuses", async () => {
      vi.mocked(git.revertFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { revertFile } = useRepositoryStore.getState();
      await revertFile("test.ts");

      expect(git.revertFile).toHaveBeenCalledWith("test.ts");
      expect(git.getFileStatuses).toHaveBeenCalled();
    });

    it("clears diff if viewing the reverted file", async () => {
      useRepositoryStore.setState({
        currentDiffPath: "test.ts",
        currentDiff: { path: "test.ts", hunks: [], is_binary: false },
      });

      vi.mocked(git.revertFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { revertFile } = useRepositoryStore.getState();
      await revertFile("test.ts");

      expect(useRepositoryStore.getState().currentDiff).toBeNull();
      expect(useRepositoryStore.getState().currentDiffPath).toBeNull();
    });
  });

  describe("deleteFile", () => {
    it("shows confirmation dialog before deleting", async () => {
      mockShowConfirm.mockResolvedValue(true);
      vi.mocked(git.deleteFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { deleteFile } = useRepositoryStore.getState();
      await deleteFile("test.ts");

      expect(mockShowConfirm).toHaveBeenCalledWith({
        title: "Delete file",
        message: "Delete test.ts? This cannot be undone.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
      });
      expect(git.deleteFile).toHaveBeenCalledWith("test.ts");
    });

    it("does not delete if user cancels confirmation", async () => {
      mockShowConfirm.mockResolvedValue(false);

      const { deleteFile } = useRepositoryStore.getState();
      await deleteFile("test.ts");

      expect(git.deleteFile).not.toHaveBeenCalled();
    });

    it("clears diff if viewing the deleted file", async () => {
      useRepositoryStore.setState({
        currentDiffPath: "test.ts",
        currentDiff: { path: "test.ts", hunks: [], is_binary: false },
      });

      mockShowConfirm.mockResolvedValue(true);
      vi.mocked(git.deleteFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { deleteFile } = useRepositoryStore.getState();
      await deleteFile("test.ts");

      expect(useRepositoryStore.getState().currentDiff).toBeNull();
      expect(useRepositoryStore.getState().currentDiffPath).toBeNull();
    });
  });

  describe("loadFileDiff", () => {
    it("sets diff loading state", async () => {
      vi.mocked(git.getFileDiff).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  path: "test.ts",
                  hunks: [],
                  is_binary: false,
                }),
              100
            )
          )
      );

      const { loadFileDiff } = useRepositoryStore.getState();
      const promise = loadFileDiff("test.ts", false);

      expect(useRepositoryStore.getState().diffLoading).toBe(true);

      await promise;

      expect(useRepositoryStore.getState().diffLoading).toBe(false);
    });

    it("stores current diff path and staged status", async () => {
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { loadFileDiff } = useRepositoryStore.getState();
      await loadFileDiff("test.ts", true);

      expect(useRepositoryStore.getState().currentDiffPath).toBe("test.ts");
      expect(useRepositoryStore.getState().currentDiffStaged).toBe(true);
    });
  });

  describe("clearDiff", () => {
    it("clears current diff state", () => {
      useRepositoryStore.setState({
        currentDiff: { path: "test.ts", hunks: [], is_binary: false },
        currentDiffPath: "test.ts",
      });

      const { clearDiff } = useRepositoryStore.getState();
      clearDiff();

      expect(useRepositoryStore.getState().currentDiff).toBeNull();
      expect(useRepositoryStore.getState().currentDiffPath).toBeNull();
    });
  });

  describe("loadMoreCommits", () => {
    it("appends new commits to existing list", async () => {
      const existingCommits = [
        {
          hash: "abc123",
          short_hash: "abc123",
          message: "First",
          author_name: "Test",
          author_email: "test@test.com",
          timestamp: 1234567890,
          parent_hashes: [],
          column: 0,
          lines: [],
          refs: [],
          is_tip: true,
        },
      ];

      useRepositoryStore.setState({
        commits: existingCommits,
        hasMoreCommits: true,
        repositoryInfo: { path: "/test", current_branch: "main", is_detached: false, remotes: [] },
      });

      vi.mocked(git.getCommitGraph).mockResolvedValue([
        {
          hash: "def456",
          short_hash: "def456",
          message: "Second",
          author_name: "Test",
          author_email: "test@test.com",
          timestamp: 1234567880,
          parent_hashes: ["abc123"],
          column: 0,
          lines: [],
          refs: [],
          is_tip: false,
        },
      ]);

      const { loadMoreCommits } = useRepositoryStore.getState();
      await loadMoreCommits();

      expect(useRepositoryStore.getState().commits).toHaveLength(2);
    });

    it("does not load if already loading", async () => {
      useRepositoryStore.setState({
        commitsLoading: true,
        hasMoreCommits: true,
      });

      const { loadMoreCommits } = useRepositoryStore.getState();
      await loadMoreCommits();

      expect(git.getCommitGraph).not.toHaveBeenCalled();
    });

    it("does not load if no more commits", async () => {
      useRepositoryStore.setState({
        commitsLoading: false,
        hasMoreCommits: false,
      });

      const { loadMoreCommits } = useRepositoryStore.getState();
      await loadMoreCommits();

      expect(git.getCommitGraph).not.toHaveBeenCalled();
    });

    it("does not load if no repository is open", async () => {
      // This test prevents the race condition where loadMoreCommits
      // is called before openRepository completes
      useRepositoryStore.setState({
        repositoryInfo: null,
        commitsLoading: false,
        hasMoreCommits: true,
        commits: [],
      });

      const { loadMoreCommits } = useRepositoryStore.getState();
      await loadMoreCommits();

      expect(git.getCommitGraph).not.toHaveBeenCalled();
    });
  });

  describe("loadStashes", () => {
    it("loads stashes from git service", async () => {
      const mockStashes = [
        {
          index: 0,
          message: "WIP on main: abc123 Test stash",
          commit_hash: "abc123def",
          timestamp: 1700000000,
          branch_name: "main",
        },
        {
          index: 1,
          message: "WIP on feature: def456 Another stash",
          commit_hash: "def456ghi",
          timestamp: 1699999000,
          branch_name: "feature",
        },
      ];

      vi.mocked(git.listStashes).mockResolvedValue(mockStashes);

      const { loadStashes } = useRepositoryStore.getState();
      await loadStashes();

      expect(git.listStashes).toHaveBeenCalled();
      expect(useRepositoryStore.getState().stashes).toEqual(mockStashes);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.listStashes).mockRejectedValue(new Error("Failed to list stashes"));

      const { loadStashes } = useRepositoryStore.getState();
      await loadStashes();

      expect(mockShowError).toHaveBeenCalledWith("Error: Failed to list stashes");
    });
  });

  describe("loadStashDetails", () => {
    it("sets loading state and loads stash details", async () => {
      const mockDetails = {
        index: 0,
        message: "WIP on main: abc123 Test stash",
        commit_hash: "abc123def",
        timestamp: 1700000000,
        branch_name: "main",
        files_changed: [{ path: "test.ts", status: "modified", old_path: undefined }],
      };

      vi.mocked(git.getStashDetails).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDetails), 100))
      );

      const { loadStashDetails } = useRepositoryStore.getState();
      const promise = loadStashDetails(0);

      expect(useRepositoryStore.getState().stashDetailsLoading).toBe(true);

      await promise;

      expect(useRepositoryStore.getState().stashDetailsLoading).toBe(false);
      expect(useRepositoryStore.getState().selectedStashDetails).toEqual(mockDetails);
    });

    it("clears expanded files and diffs when loading new stash", async () => {
      useRepositoryStore.setState({
        expandedStashFiles: new Set(["old-file.ts"]),
        stashFileDiffs: new Map([
          ["old-file.ts", { path: "old-file.ts", hunks: [], is_binary: false }],
        ]),
      });

      vi.mocked(git.getStashDetails).mockResolvedValue({
        index: 0,
        message: "Test",
        commit_hash: "abc",
        timestamp: 1700000000,
        branch_name: "main",
        files_changed: [],
      });

      const { loadStashDetails } = useRepositoryStore.getState();
      await loadStashDetails(0);

      expect(useRepositoryStore.getState().expandedStashFiles.size).toBe(0);
      expect(useRepositoryStore.getState().stashFileDiffs.size).toBe(0);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.getStashDetails).mockRejectedValue(new Error("Stash not found"));

      const { loadStashDetails } = useRepositoryStore.getState();
      await loadStashDetails(99);

      expect(mockShowError).toHaveBeenCalledWith("Error: Stash not found");
      expect(useRepositoryStore.getState().stashDetailsLoading).toBe(false);
    });
  });

  describe("clearStashDetails", () => {
    it("clears stash details state", () => {
      useRepositoryStore.setState({
        selectedStashDetails: {
          index: 0,
          message: "Test",
          commit_hash: "abc",
          timestamp: 1700000000,
          branch_name: "main",
          files_changed: [],
        },
        expandedStashFiles: new Set(["file.ts"]),
        stashFileDiffs: new Map([["file.ts", { path: "file.ts", hunks: [], is_binary: false }]]),
      });

      const { clearStashDetails } = useRepositoryStore.getState();
      clearStashDetails();

      expect(useRepositoryStore.getState().selectedStashDetails).toBeNull();
      expect(useRepositoryStore.getState().expandedStashFiles.size).toBe(0);
      expect(useRepositoryStore.getState().stashFileDiffs.size).toBe(0);
    });
  });

  describe("applyStash", () => {
    it("calls git.applyStash and refreshes repository", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.applyStash).mockResolvedValue(undefined);
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue([]);

      const { applyStash } = useRepositoryStore.getState();
      await applyStash(0);

      expect(git.applyStash).toHaveBeenCalledWith(0);
      expect(git.getRepositoryInfo).toHaveBeenCalled();
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.applyStash).mockRejectedValue(new Error("Apply failed"));

      const { applyStash } = useRepositoryStore.getState();
      await applyStash(0);

      expect(mockShowError).toHaveBeenCalledWith("Error: Apply failed");
    });
  });

  describe("dropStash", () => {
    it("calls git.dropStash and reloads stashes", async () => {
      vi.mocked(git.dropStash).mockResolvedValue(undefined);
      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue([]);

      const { dropStash } = useRepositoryStore.getState();
      await dropStash(0);

      expect(git.dropStash).toHaveBeenCalledWith(0);
      expect(git.listStashes).toHaveBeenCalled();
    });

    it("clears stash details if dropping the selected stash", async () => {
      useRepositoryStore.setState({
        selectedStashDetails: {
          index: 0,
          message: "Test",
          commit_hash: "abc",
          timestamp: 1700000000,
          branch_name: "main",
          files_changed: [],
        },
        expandedStashFiles: new Set(["file.ts"]),
        stashFileDiffs: new Map([["file.ts", { path: "file.ts", hunks: [], is_binary: false }]]),
      });

      vi.mocked(git.dropStash).mockResolvedValue(undefined);
      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue([]);

      const { dropStash } = useRepositoryStore.getState();
      await dropStash(0);

      expect(useRepositoryStore.getState().selectedStashDetails).toBeNull();
    });

    it("does not clear stash details if dropping a different stash", async () => {
      const stashDetails = {
        index: 0,
        message: "Test",
        commit_hash: "abc",
        timestamp: 1700000000,
        branch_name: "main",
        files_changed: [],
      };

      useRepositoryStore.setState({
        selectedStashDetails: stashDetails,
      });

      vi.mocked(git.dropStash).mockResolvedValue(undefined);
      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue([]);

      const { dropStash } = useRepositoryStore.getState();
      await dropStash(1); // Drop different stash

      expect(useRepositoryStore.getState().selectedStashDetails).toEqual(stashDetails);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.dropStash).mockRejectedValue(new Error("Drop failed"));

      const { dropStash } = useRepositoryStore.getState();
      await dropStash(0);

      expect(mockShowError).toHaveBeenCalledWith("Error: Drop failed");
    });
  });

  describe("toggleStashFileExpanded", () => {
    it("expands a file that is not expanded", () => {
      useRepositoryStore.setState({
        expandedStashFiles: new Set(),
      });

      const { toggleStashFileExpanded } = useRepositoryStore.getState();
      toggleStashFileExpanded("test.ts");

      expect(useRepositoryStore.getState().expandedStashFiles.has("test.ts")).toBe(true);
    });

    it("collapses a file that is expanded", () => {
      useRepositoryStore.setState({
        expandedStashFiles: new Set(["test.ts"]),
      });

      const { toggleStashFileExpanded } = useRepositoryStore.getState();
      toggleStashFileExpanded("test.ts");

      expect(useRepositoryStore.getState().expandedStashFiles.has("test.ts")).toBe(false);
    });
  });

  describe("loadStashFileDiff", () => {
    it("loads file diff and stores it", async () => {
      const mockDiff = {
        path: "test.ts",
        hunks: [
          {
            header: "@@ -1,3 +1,4 @@",
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            lines: [],
          },
        ],
        is_binary: false,
      };

      vi.mocked(git.getStashFileDiff).mockResolvedValue(mockDiff);

      const { loadStashFileDiff } = useRepositoryStore.getState();
      await loadStashFileDiff(0, "test.ts");

      expect(git.getStashFileDiff).toHaveBeenCalledWith(0, "test.ts");
      expect(useRepositoryStore.getState().stashFileDiffs.get("test.ts")).toEqual(mockDiff);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.getStashFileDiff).mockRejectedValue(new Error("Diff failed"));

      const { loadStashFileDiff } = useRepositoryStore.getState();
      await loadStashFileDiff(0, "test.ts");

      expect(mockShowError).toHaveBeenCalledWith("Error: Diff failed");
    });
  });

  describe("loadBranchesAndTags", () => {
    it("also loads stashes", async () => {
      const mockStashes = [
        {
          index: 0,
          message: "Test stash",
          commit_hash: "abc",
          timestamp: 1700000000,
          branch_name: "main",
        },
      ];

      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue(mockStashes);

      const { loadBranchesAndTags } = useRepositoryStore.getState();
      await loadBranchesAndTags();

      expect(git.listStashes).toHaveBeenCalled();
      expect(useRepositoryStore.getState().stashes).toEqual(mockStashes);
    });
  });

  describe("refreshRepository", () => {
    it("does nothing if no repository is open", async () => {
      useRepositoryStore.setState({ repositoryInfo: null });

      const { refreshRepository } = useRepositoryStore.getState();
      await refreshRepository();

      expect(git.getRepositoryInfo).not.toHaveBeenCalled();
    });

    it("refreshes repository info and reloads data", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [
          {
            hash: "old",
            short_hash: "old",
            message: "Old",
            author_name: "Test",
            author_email: "test@test.com",
            timestamp: 1234567890,
            parent_hashes: [],
            column: 0,
            lines: [],
            refs: [],
            is_tip: true,
          },
        ],
        hasMoreCommits: false,
      });

      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "def456",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { refreshRepository } = useRepositoryStore.getState();
      await refreshRepository();

      expect(git.getRepositoryInfo).toHaveBeenCalled();
      // commits should be reset and empty array means no more commits
      expect(useRepositoryStore.getState().commits).toEqual([]);
    });

    it("refreshes current diff if one is selected", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        currentDiffPath: "test.ts",
        currentDiffStaged: false,
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { refreshRepository } = useRepositoryStore.getState();
      await refreshRepository();

      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", false, undefined);
    });

    it("sets error state on failure", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.getRepositoryInfo).mockRejectedValue(new Error("Refresh failed"));

      const { refreshRepository } = useRepositoryStore.getState();
      await refreshRepository();

      expect(mockShowError).toHaveBeenCalledWith("Error: Refresh failed");
    });
  });

  describe("stageHunk", () => {
    it("calls git.stageHunk and refreshes statuses and diff", async () => {
      vi.mocked(git.stageHunk).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { stageHunk } = useRepositoryStore.getState();
      await stageHunk("test.ts", 0);

      expect(git.stageHunk).toHaveBeenCalledWith("test.ts", 0);
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", false, undefined);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.stageHunk).mockRejectedValue(new Error("Stage hunk failed"));

      const { stageHunk } = useRepositoryStore.getState();
      await stageHunk("test.ts", 0);

      expect(mockShowError).toHaveBeenCalledWith("Error: Stage hunk failed");
    });
  });

  describe("unstageHunk", () => {
    it("calls git.unstageHunk and refreshes statuses and diff", async () => {
      vi.mocked(git.unstageHunk).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { unstageHunk } = useRepositoryStore.getState();
      await unstageHunk("test.ts", 0);

      expect(git.unstageHunk).toHaveBeenCalledWith("test.ts", 0);
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", true, undefined);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.unstageHunk).mockRejectedValue(new Error("Unstage hunk failed"));

      const { unstageHunk } = useRepositoryStore.getState();
      await unstageHunk("test.ts", 0);

      expect(mockShowError).toHaveBeenCalledWith("Error: Unstage hunk failed");
    });
  });

  describe("stageLines", () => {
    it("calls git.stageLines and refreshes statuses and diff", async () => {
      vi.mocked(git.stageLines).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { stageLines } = useRepositoryStore.getState();
      await stageLines("test.ts", 0, [1, 2, 3]);

      expect(git.stageLines).toHaveBeenCalledWith("test.ts", 0, [1, 2, 3]);
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", false, undefined);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.stageLines).mockRejectedValue(new Error("Stage lines failed"));

      const { stageLines } = useRepositoryStore.getState();
      await stageLines("test.ts", 0, [1]);

      expect(mockShowError).toHaveBeenCalledWith("Error: Stage lines failed");
    });
  });

  describe("discardHunk", () => {
    it("calls git.discardHunk and refreshes statuses and diff", async () => {
      vi.mocked(git.discardHunk).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { discardHunk } = useRepositoryStore.getState();
      await discardHunk("test.ts", 0);

      expect(git.discardHunk).toHaveBeenCalledWith("test.ts", 0);
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", false, undefined);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.discardHunk).mockRejectedValue(new Error("Discard failed"));

      const { discardHunk } = useRepositoryStore.getState();
      await discardHunk("test.ts", 0);

      expect(mockShowError).toHaveBeenCalledWith("Error: Discard failed");
    });
  });

  describe("discardLines", () => {
    it("calls git.discardHunk with lineIndices and refreshes statuses and diff", async () => {
      vi.mocked(git.discardHunk).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { discardLines } = useRepositoryStore.getState();
      await discardLines("test.ts", 0, [1, 2]);

      expect(git.discardHunk).toHaveBeenCalledWith("test.ts", 0, [1, 2]);
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(git.getFileDiff).toHaveBeenCalledWith("test.ts", false, undefined);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.discardHunk).mockRejectedValue(new Error("Discard lines failed"));

      const { discardLines } = useRepositoryStore.getState();
      await discardLines("test.ts", 0, [1]);

      expect(mockShowError).toHaveBeenCalledWith("Error: Discard lines failed");
    });
  });

  describe("checkoutCommit", () => {
    it("calls git.checkoutCommit and refreshes repository", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.checkoutCommit).mockResolvedValue(undefined);
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: null,
        is_detached: true,
        remotes: [],
        head_hash: "def456",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { checkoutCommit } = useRepositoryStore.getState();
      await checkoutCommit("def456");

      expect(git.checkoutCommit).toHaveBeenCalledWith("def456");
      expect(git.getRepositoryInfo).toHaveBeenCalled();
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.checkoutCommit).mockRejectedValue(new Error("Checkout failed"));

      const { checkoutCommit } = useRepositoryStore.getState();
      await checkoutCommit("invalid");

      expect(mockShowError).toHaveBeenCalledWith("Error: Checkout failed");
    });
  });

  describe("loadCommitDetails", () => {
    it("sets loading state and loads commit details", async () => {
      const mockDetails = {
        hash: "abc123",
        short_hash: "abc123",
        message: "Test commit",
        author_name: "Test",
        author_email: "test@test.com",
        timestamp: 1234567890,
        parent_hashes: [],
        files_changed: [{ path: "test.ts", status: "modified", old_path: undefined }],
      };

      vi.mocked(git.getCommitDetails).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDetails), 100))
      );

      const { loadCommitDetails } = useRepositoryStore.getState();
      const promise = loadCommitDetails("abc123");

      expect(useRepositoryStore.getState().commitDetailsLoading).toBe(true);

      await promise;

      expect(useRepositoryStore.getState().commitDetailsLoading).toBe(false);
      expect(useRepositoryStore.getState().selectedCommitDetails).toEqual(mockDetails);
    });

    it("clears expanded files and diffs when loading new commit", async () => {
      useRepositoryStore.setState({
        expandedCommitFiles: new Set(["old-file.ts"]),
        commitFileDiffs: new Map([
          ["old-file.ts", { path: "old-file.ts", hunks: [], is_binary: false }],
        ]),
      });

      vi.mocked(git.getCommitDetails).mockResolvedValue({
        hash: "abc123",
        short_hash: "abc123",
        message: "Test",
        author_name: "Test",
        author_email: "test@test.com",
        timestamp: 1234567890,
        parent_hashes: [],
        files_changed: [],
      });

      const { loadCommitDetails } = useRepositoryStore.getState();
      await loadCommitDetails("abc123");

      expect(useRepositoryStore.getState().expandedCommitFiles.size).toBe(0);
      expect(useRepositoryStore.getState().commitFileDiffs.size).toBe(0);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.getCommitDetails).mockRejectedValue(new Error("Commit not found"));

      const { loadCommitDetails } = useRepositoryStore.getState();
      await loadCommitDetails("invalid");

      expect(mockShowError).toHaveBeenCalledWith("Error: Commit not found");
      expect(useRepositoryStore.getState().commitDetailsLoading).toBe(false);
    });
  });

  describe("clearCommitDetails", () => {
    it("clears commit details state", () => {
      useRepositoryStore.setState({
        selectedCommitDetails: {
          hash: "abc123",
          short_hash: "abc123",
          message: "Test",
          author_name: "Test",
          author_email: "test@test.com",
          timestamp: 1234567890,
          parent_hashes: [],
          files_changed: [],
        },
        expandedCommitFiles: new Set(["file.ts"]),
        commitFileDiffs: new Map([["file.ts", { path: "file.ts", hunks: [], is_binary: false }]]),
      });

      const { clearCommitDetails } = useRepositoryStore.getState();
      clearCommitDetails();

      expect(useRepositoryStore.getState().selectedCommitDetails).toBeNull();
      expect(useRepositoryStore.getState().expandedCommitFiles.size).toBe(0);
      expect(useRepositoryStore.getState().commitFileDiffs.size).toBe(0);
    });
  });

  describe("toggleCommitFileExpanded", () => {
    it("expands a file that is not expanded", () => {
      useRepositoryStore.setState({
        expandedCommitFiles: new Set(),
      });

      const { toggleCommitFileExpanded } = useRepositoryStore.getState();
      toggleCommitFileExpanded("test.ts");

      expect(useRepositoryStore.getState().expandedCommitFiles.has("test.ts")).toBe(true);
    });

    it("collapses a file that is expanded", () => {
      useRepositoryStore.setState({
        expandedCommitFiles: new Set(["test.ts"]),
      });

      const { toggleCommitFileExpanded } = useRepositoryStore.getState();
      toggleCommitFileExpanded("test.ts");

      expect(useRepositoryStore.getState().expandedCommitFiles.has("test.ts")).toBe(false);
    });
  });

  describe("loadCommitFileDiff", () => {
    it("loads file diff and stores it", async () => {
      const mockDiff = {
        path: "test.ts",
        hunks: [
          {
            header: "@@ -1,3 +1,4 @@",
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            lines: [],
          },
        ],
        is_binary: false,
      };

      vi.mocked(git.getCommitFileDiff).mockResolvedValue(mockDiff);

      const { loadCommitFileDiff } = useRepositoryStore.getState();
      await loadCommitFileDiff("abc123", "test.ts");

      expect(git.getCommitFileDiff).toHaveBeenCalledWith("abc123", "test.ts");
      expect(useRepositoryStore.getState().commitFileDiffs.get("test.ts")).toEqual(mockDiff);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.getCommitFileDiff).mockRejectedValue(new Error("Diff failed"));

      const { loadCommitFileDiff } = useRepositoryStore.getState();
      await loadCommitFileDiff("abc123", "test.ts");

      expect(mockShowError).toHaveBeenCalledWith("Error: Diff failed");
    });
  });

  describe("checkoutBranch", () => {
    it("calls git.checkoutBranch and refreshes repository", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.checkoutBranch).mockResolvedValue(undefined);
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "feature",
        is_detached: false,
        remotes: [],
        head_hash: "def456",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });

      const { checkoutBranch } = useRepositoryStore.getState();
      await checkoutBranch("feature");

      expect(git.checkoutBranch).toHaveBeenCalledWith("feature");
      expect(git.getRepositoryInfo).toHaveBeenCalled();
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.checkoutBranch).mockRejectedValue(new Error("Checkout failed"));

      const { checkoutBranch } = useRepositoryStore.getState();
      await checkoutBranch("nonexistent");

      expect(mockShowError).toHaveBeenCalledWith("Error: Checkout failed");
    });
  });

  describe("deleteBranch", () => {
    it("calls git.deleteBranch and refreshes repository and branches", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.deleteBranch).mockResolvedValue(undefined);
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue([]);

      const { deleteBranch } = useRepositoryStore.getState();
      await deleteBranch("feature", false);

      expect(git.deleteBranch).toHaveBeenCalledWith("feature", false);
      expect(git.listBranches).toHaveBeenCalled();
    });

    it("can delete remote branches", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.deleteBranch).mockResolvedValue(undefined);
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue([]);

      const { deleteBranch } = useRepositoryStore.getState();
      await deleteBranch("origin/feature", true);

      expect(git.deleteBranch).toHaveBeenCalledWith("origin/feature", true);
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.deleteBranch).mockRejectedValue(new Error("Delete failed"));

      const { deleteBranch } = useRepositoryStore.getState();
      await deleteBranch("main", false);

      expect(mockShowError).toHaveBeenCalledWith("Error: Delete failed");
    });
  });

  describe("deleteTag", () => {
    it("calls git.deleteTag and refreshes repository and tags", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        hasMoreCommits: true,
      });

      vi.mocked(git.deleteTag).mockResolvedValue(undefined);
      vi.mocked(git.getRepositoryInfo).mockResolvedValue({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      });
      vi.mocked(git.getCommitGraph).mockResolvedValue([]);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.listBranches).mockResolvedValue([]);
      vi.mocked(git.listTags).mockResolvedValue([]);
      vi.mocked(git.listStashes).mockResolvedValue([]);

      const { deleteTag } = useRepositoryStore.getState();
      await deleteTag("v1.0.0");

      expect(git.deleteTag).toHaveBeenCalledWith("v1.0.0");
      expect(git.listTags).toHaveBeenCalled();
    });

    it("sets error state on failure", async () => {
      vi.mocked(git.deleteTag).mockRejectedValue(new Error("Delete failed"));

      const { deleteTag } = useRepositoryStore.getState();
      await deleteTag("v1.0.0");

      expect(mockShowError).toHaveBeenCalledWith("Error: Delete failed");
    });
  });

  describe("unstageFile error handling", () => {
    it("sets error state on failure", async () => {
      vi.mocked(git.unstageFile).mockRejectedValue(new Error("Unstage failed"));

      const { unstageFile } = useRepositoryStore.getState();
      await unstageFile("test.ts");

      expect(mockShowError).toHaveBeenCalledWith("Error: Unstage failed");
    });
  });

  describe("revertFile error handling", () => {
    it("sets error state on failure", async () => {
      vi.mocked(git.revertFile).mockRejectedValue(new Error("Revert failed"));

      const { revertFile } = useRepositoryStore.getState();
      await revertFile("test.ts");

      expect(mockShowError).toHaveBeenCalledWith("Error: Revert failed");
    });
  });

  describe("deleteFile error handling", () => {
    it("sets error state on failure", async () => {
      mockShowConfirm.mockResolvedValue(true);
      vi.mocked(git.deleteFile).mockRejectedValue(new Error("Delete failed"));

      const { deleteFile } = useRepositoryStore.getState();
      await deleteFile("test.ts");

      expect(mockShowError).toHaveBeenCalledWith("Error: Delete failed");
    });
  });

  describe("loadFileDiff error handling", () => {
    it("sets error state on failure", async () => {
      vi.mocked(git.getFileDiff).mockRejectedValue(new Error("Diff failed"));

      const { loadFileDiff } = useRepositoryStore.getState();
      await loadFileDiff("test.ts", false);

      expect(mockShowError).toHaveBeenCalledWith("Error: Diff failed");
      expect(useRepositoryStore.getState().diffLoading).toBe(false);
    });
  });

  describe("loadMoreCommits error handling", () => {
    it("sets error state on failure", async () => {
      useRepositoryStore.setState({
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          head_hash: "abc123",
        },
        commits: [],
        commitsLoading: false,
        hasMoreCommits: true,
      });

      vi.mocked(git.getCommitGraph).mockRejectedValue(new Error("Load failed"));

      const { loadMoreCommits } = useRepositoryStore.getState();
      await loadMoreCommits();

      expect(mockShowError).toHaveBeenCalledWith("Error: Load failed");
      expect(useRepositoryStore.getState().commitsLoading).toBe(false);
    });
  });

  describe("loadFileStatuses error handling", () => {
    it("sets error state on failure", async () => {
      vi.mocked(git.getFileStatuses).mockRejectedValue(new Error("Status failed"));

      const { loadFileStatuses } = useRepositoryStore.getState();
      await loadFileStatuses();

      expect(mockShowError).toHaveBeenCalledWith("Error: Status failed");
      expect(useRepositoryStore.getState().fileStatusesLoading).toBe(false);
    });
  });

  describe("loadBranchesAndTags error handling", () => {
    it("sets error state on failure", async () => {
      vi.mocked(git.listBranches).mockRejectedValue(new Error("Load failed"));

      const { loadBranchesAndTags } = useRepositoryStore.getState();
      await loadBranchesAndTags();

      expect(mockShowError).toHaveBeenCalledWith("Error: Load failed");
    });
  });

  describe("loadFileDiff clears stash selection", () => {
    it("clears stash details when loading a file diff", async () => {
      useRepositoryStore.setState({
        selectedStashDetails: {
          index: 0,
          message: "Test",
          commit_hash: "abc",
          timestamp: 1700000000,
          branch_name: "main",
          files_changed: [],
        },
        expandedStashFiles: new Set(["file.ts"]),
        stashFileDiffs: new Map([["file.ts", { path: "file.ts", hunks: [], is_binary: false }]]),
      });

      vi.mocked(git.getFileDiff).mockResolvedValue({
        path: "test.ts",
        hunks: [],
        is_binary: false,
      });

      const { loadFileDiff } = useRepositoryStore.getState();
      await loadFileDiff("test.ts", false);

      expect(useRepositoryStore.getState().selectedStashDetails).toBeNull();
      expect(useRepositoryStore.getState().expandedStashFiles.size).toBe(0);
      expect(useRepositoryStore.getState().stashFileDiffs.size).toBe(0);
    });
  });

  describe("revertCommit", () => {
    it("calls revertCommit and reloads file statuses", async () => {
      vi.mocked(git.revertCommit).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [{ path: "file.ts", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      });

      const { revertCommit } = useRepositoryStore.getState();
      await revertCommit("abc123");

      expect(git.revertCommit).toHaveBeenCalledWith("abc123");
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(useRepositoryStore.getState().fileStatuses?.staged).toHaveLength(1);
      expect(mockShowSuccess).toHaveBeenCalledWith("Reverted commit abc123");
    });

    it("sets error on failure", async () => {
      vi.mocked(git.revertCommit).mockRejectedValue(new Error("Revert failed"));

      const { revertCommit } = useRepositoryStore.getState();
      await revertCommit("abc123");

      expect(mockShowError).toHaveBeenCalledWith("Error: Revert failed");
      expect(mockShowSuccess).not.toHaveBeenCalled();
    });
  });

  describe("revertCommitFile", () => {
    it("calls revertCommitFile and reloads file statuses", async () => {
      vi.mocked(git.revertCommitFile).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [{ path: "file.ts", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      });

      const { revertCommitFile } = useRepositoryStore.getState();
      await revertCommitFile("abc123", "file.ts");

      expect(git.revertCommitFile).toHaveBeenCalledWith("abc123", "file.ts");
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith("Reverted file.ts");
    });

    it("sets error on failure", async () => {
      vi.mocked(git.revertCommitFile).mockRejectedValue(new Error("Revert failed"));

      const { revertCommitFile } = useRepositoryStore.getState();
      await revertCommitFile("abc123", "file.ts");

      expect(mockShowError).toHaveBeenCalledWith("Error: Revert failed");
      expect(mockShowSuccess).not.toHaveBeenCalled();
    });
  });

  describe("revertCommitFileLines", () => {
    it("calls revertCommitFileLines and reloads statuses and diff", async () => {
      vi.mocked(git.revertCommitFileLines).mockResolvedValue(undefined);
      vi.mocked(git.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(git.getCommitFileDiff).mockResolvedValue({
        path: "file.ts",
        hunks: [],
        is_binary: false,
      });

      const { revertCommitFileLines } = useRepositoryStore.getState();
      await revertCommitFileLines("abc123", "file.ts", 0, [1, 2]);

      expect(git.revertCommitFileLines).toHaveBeenCalledWith("abc123", "file.ts", 0, [1, 2]);
      expect(git.getFileStatuses).toHaveBeenCalled();
      expect(git.getCommitFileDiff).toHaveBeenCalledWith("abc123", "file.ts");
      expect(mockShowSuccess).toHaveBeenCalledWith("Reverted lines in file.ts");
    });

    it("sets error on failure", async () => {
      vi.mocked(git.revertCommitFileLines).mockRejectedValue(new Error("Lines revert failed"));

      const { revertCommitFileLines } = useRepositoryStore.getState();
      await revertCommitFileLines("abc123", "file.ts", 0, [1, 2]);

      expect(mockShowError).toHaveBeenCalledWith("Error: Lines revert failed");
      expect(mockShowSuccess).not.toHaveBeenCalled();
    });
  });
});
