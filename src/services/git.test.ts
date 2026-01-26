import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import * as git from "./git";

// The mock is already set up in test/setup.ts
describe("git service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentDir", () => {
    it("invokes get_current_dir command", async () => {
      vi.mocked(invoke).mockResolvedValue("/test/path");

      const result = await git.getCurrentDir();

      expect(invoke).toHaveBeenCalledWith("get_current_dir");
      expect(result).toBe("/test/path");
    });
  });

  describe("openRepository", () => {
    it("invokes open_repository command with path", async () => {
      const mockRepoInfo = {
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123",
      };
      vi.mocked(invoke).mockResolvedValue(mockRepoInfo);

      const result = await git.openRepository("/test/repo");

      expect(invoke).toHaveBeenCalledWith("open_repository", { path: "/test/repo" });
      expect(result).toEqual(mockRepoInfo);
    });
  });

  describe("getRepositoryInfo", () => {
    it("invokes get_repository_info command", async () => {
      const mockRepoInfo = {
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: ["origin"],
        head_hash: "abc123",
      };
      vi.mocked(invoke).mockResolvedValue(mockRepoInfo);

      const result = await git.getRepositoryInfo();

      expect(invoke).toHaveBeenCalledWith("get_repository_info");
      expect(result).toEqual(mockRepoInfo);
    });
  });

  describe("getCommitGraph", () => {
    it("invokes get_commit_graph command with skip and limit", async () => {
      const mockCommits = [
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
      ];
      vi.mocked(invoke).mockResolvedValue(mockCommits);

      const result = await git.getCommitGraph(0, 50);

      expect(invoke).toHaveBeenCalledWith("get_commit_graph", { skip: 0, limit: 50 });
      expect(result).toEqual(mockCommits);
    });
  });

  describe("getCommitDetails", () => {
    it("invokes get_commit_details command with hash", async () => {
      const mockDetails = {
        hash: "abc123",
        message: "Test commit",
        author_name: "Test",
        author_email: "test@test.com",
        committer_name: "Test",
        committer_email: "test@test.com",
        timestamp: 1234567890,
        parent_hashes: [],
        files_changed: [],
      };
      vi.mocked(invoke).mockResolvedValue(mockDetails);

      const result = await git.getCommitDetails("abc123");

      expect(invoke).toHaveBeenCalledWith("get_commit_details", { hash: "abc123" });
      expect(result).toEqual(mockDetails);
    });
  });

  describe("listBranches", () => {
    it("invokes list_branches command", async () => {
      const mockBranches = [
        { name: "main", is_remote: false, is_head: true, target_hash: "abc123" },
        { name: "origin/main", is_remote: true, is_head: false, target_hash: "abc123" },
      ];
      vi.mocked(invoke).mockResolvedValue(mockBranches);

      const result = await git.listBranches();

      expect(invoke).toHaveBeenCalledWith("list_branches");
      expect(result).toEqual(mockBranches);
    });
  });

  describe("listTags", () => {
    it("invokes list_tags command", async () => {
      const mockTags = [
        { name: "v1.0.0", target_hash: "abc123", is_annotated: true, message: "Release 1.0" },
      ];
      vi.mocked(invoke).mockResolvedValue(mockTags);

      const result = await git.listTags();

      expect(invoke).toHaveBeenCalledWith("list_tags");
      expect(result).toEqual(mockTags);
    });
  });

  describe("checkoutCommit", () => {
    it("invokes checkout_commit command with hash", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.checkoutCommit("abc123");

      expect(invoke).toHaveBeenCalledWith("checkout_commit", { hash: "abc123" });
    });
  });

  describe("checkoutBranch", () => {
    it("invokes checkout_branch command with branchName", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.checkoutBranch("feature");

      expect(invoke).toHaveBeenCalledWith("checkout_branch", { branchName: "feature" });
    });
  });

  describe("getCommitFileDiff", () => {
    it("invokes get_commit_file_diff command with hash and filePath", async () => {
      const mockDiff = {
        path: "test.ts",
        hunks: [],
        is_binary: false,
      };
      vi.mocked(invoke).mockResolvedValue(mockDiff);

      const result = await git.getCommitFileDiff("abc123", "test.ts");

      expect(invoke).toHaveBeenCalledWith("get_commit_file_diff", {
        hash: "abc123",
        filePath: "test.ts",
      });
      expect(result).toEqual(mockDiff);
    });
  });

  describe("getFileStatuses", () => {
    it("invokes get_file_statuses command", async () => {
      const mockStatuses = {
        staged: [],
        unstaged: [],
        untracked: [],
      };
      vi.mocked(invoke).mockResolvedValue(mockStatuses);

      const result = await git.getFileStatuses();

      expect(invoke).toHaveBeenCalledWith("get_file_statuses");
      expect(result).toEqual(mockStatuses);
    });
  });

  describe("stageFile", () => {
    it("invokes stage_file command with path", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.stageFile("test.ts");

      expect(invoke).toHaveBeenCalledWith("stage_file", { path: "test.ts" });
    });
  });

  describe("unstageFile", () => {
    it("invokes unstage_file command with path", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.unstageFile("test.ts");

      expect(invoke).toHaveBeenCalledWith("unstage_file", { path: "test.ts" });
    });
  });

  describe("stageHunk", () => {
    it("invokes stage_hunk command with path and hunkIndex", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.stageHunk("test.ts", 0);

      expect(invoke).toHaveBeenCalledWith("stage_hunk", { path: "test.ts", hunkIndex: 0 });
    });
  });

  describe("unstageHunk", () => {
    it("invokes unstage_hunk command with path and hunkIndex", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.unstageHunk("test.ts", 1);

      expect(invoke).toHaveBeenCalledWith("unstage_hunk", { path: "test.ts", hunkIndex: 1 });
    });
  });

  describe("stageLines", () => {
    it("invokes stage_lines command with path, hunkIndex, and lineIndices", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.stageLines("test.ts", 0, [1, 2, 3]);

      expect(invoke).toHaveBeenCalledWith("stage_lines", {
        path: "test.ts",
        hunkIndex: 0,
        lineIndices: [1, 2, 3],
      });
    });
  });

  describe("getFileDiff", () => {
    it("invokes get_file_diff command with path and staged", async () => {
      const mockDiff = {
        path: "test.ts",
        hunks: [],
        is_binary: false,
      };
      vi.mocked(invoke).mockResolvedValue(mockDiff);

      const result = await git.getFileDiff("test.ts", true);

      expect(invoke).toHaveBeenCalledWith("get_file_diff", {
        path: "test.ts",
        staged: true,
        isUntracked: undefined,
      });
      expect(result).toEqual(mockDiff);
    });

    it("invokes get_file_diff command with isUntracked flag", async () => {
      const mockDiff = {
        path: "new.ts",
        hunks: [],
        is_binary: false,
      };
      vi.mocked(invoke).mockResolvedValue(mockDiff);

      const result = await git.getFileDiff("new.ts", false, true);

      expect(invoke).toHaveBeenCalledWith("get_file_diff", {
        path: "new.ts",
        staged: false,
        isUntracked: true,
      });
      expect(result).toEqual(mockDiff);
    });
  });

  describe("createCommit", () => {
    it("invokes create_commit command with message", async () => {
      vi.mocked(invoke).mockResolvedValue("newcommithash");

      const result = await git.createCommit("Test commit message");

      expect(invoke).toHaveBeenCalledWith("create_commit", { message: "Test commit message" });
      expect(result).toBe("newcommithash");
    });
  });

  describe("revertFile", () => {
    it("invokes revert_file command with path", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.revertFile("test.ts");

      expect(invoke).toHaveBeenCalledWith("revert_file", { path: "test.ts" });
    });
  });

  describe("deleteFile", () => {
    it("invokes delete_file command with path", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.deleteFile("test.ts");

      expect(invoke).toHaveBeenCalledWith("delete_file", { path: "test.ts" });
    });
  });

  describe("deleteBranch", () => {
    it("invokes delete_branch command with branchName and isRemote", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.deleteBranch("feature", false);

      expect(invoke).toHaveBeenCalledWith("delete_branch", {
        branchName: "feature",
        isRemote: false,
      });
    });

    it("invokes delete_branch for remote branch", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.deleteBranch("origin/feature", true);

      expect(invoke).toHaveBeenCalledWith("delete_branch", {
        branchName: "origin/feature",
        isRemote: true,
      });
    });
  });

  describe("deleteTag", () => {
    it("invokes delete_tag command with tagName", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.deleteTag("v1.0.0");

      expect(invoke).toHaveBeenCalledWith("delete_tag", { tagName: "v1.0.0" });
    });
  });

  describe("listStashes", () => {
    it("invokes list_stashes command", async () => {
      const mockStashes = [
        {
          index: 0,
          message: "WIP on main",
          commit_hash: "abc123",
          timestamp: 1234567890,
          branch_name: "main",
        },
      ];
      vi.mocked(invoke).mockResolvedValue(mockStashes);

      const result = await git.listStashes();

      expect(invoke).toHaveBeenCalledWith("list_stashes");
      expect(result).toEqual(mockStashes);
    });
  });

  describe("getStashDetails", () => {
    it("invokes get_stash_details command with index", async () => {
      const mockDetails = {
        index: 0,
        message: "WIP on main",
        commit_hash: "abc123",
        timestamp: 1234567890,
        branch_name: "main",
        files_changed: [],
      };
      vi.mocked(invoke).mockResolvedValue(mockDetails);

      const result = await git.getStashDetails(0);

      expect(invoke).toHaveBeenCalledWith("get_stash_details", { index: 0 });
      expect(result).toEqual(mockDetails);
    });
  });

  describe("applyStash", () => {
    it("invokes apply_stash command with index", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.applyStash(0);

      expect(invoke).toHaveBeenCalledWith("apply_stash", { index: 0 });
    });
  });

  describe("dropStash", () => {
    it("invokes drop_stash command with index", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await git.dropStash(1);

      expect(invoke).toHaveBeenCalledWith("drop_stash", { index: 1 });
    });
  });

  describe("getStashFileDiff", () => {
    it("invokes get_stash_file_diff command with index and filePath", async () => {
      const mockDiff = {
        path: "test.ts",
        hunks: [],
        is_binary: false,
      };
      vi.mocked(invoke).mockResolvedValue(mockDiff);

      const result = await git.getStashFileDiff(0, "test.ts");

      expect(invoke).toHaveBeenCalledWith("get_stash_file_diff", { index: 0, filePath: "test.ts" });
      expect(result).toEqual(mockDiff);
    });
  });
});
