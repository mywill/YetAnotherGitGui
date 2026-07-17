import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import * as worktree from "./worktree";
import type { WorktreeInfo } from "../types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mainWt: WorktreeInfo = {
  name: "main",
  path: "/repo",
  is_main: true,
  branch: "main",
  head_hash: "abc",
  is_valid: true,
  is_locked: false,
  lock_reason: null,
  is_prunable: false,
  dirty_count: 0,
  ahead: null,
  behind: null,
  last_commit_summary: null,
  last_commit_author: null,
  last_commit_time: null,
};

describe("worktree service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listWorktrees invokes list_worktrees", async () => {
    vi.mocked(invoke).mockResolvedValue([mainWt]);
    const result = await worktree.listWorktrees();
    expect(invoke).toHaveBeenCalledWith("list_worktrees");
    expect(result).toEqual([mainWt]);
  });

  it("addWorktree maps camelCase args to snake_case command params", async () => {
    vi.mocked(invoke).mockResolvedValue(mainWt);
    await worktree.addWorktree({
      name: "wt",
      path: "/p",
      branch: "main",
      newBranch: "feature",
      commitHash: "abc123",
    });
    expect(invoke).toHaveBeenCalledWith("add_worktree", {
      name: "wt",
      path: "/p",
      branch: "main",
      newBranch: "feature",
      commitHash: "abc123",
    });
  });

  it("addWorktree defaults omitted options to null", async () => {
    vi.mocked(invoke).mockResolvedValue(mainWt);
    await worktree.addWorktree({ name: "wt", path: "/p" });
    expect(invoke).toHaveBeenCalledWith("add_worktree", {
      name: "wt",
      path: "/p",
      branch: null,
      newBranch: null,
      commitHash: null,
    });
  });

  it("removeWorktree passes name and force", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await worktree.removeWorktree("wt", true);
    expect(invoke).toHaveBeenCalledWith("remove_worktree", { name: "wt", force: true });
  });

  it("moveWorktree passes name and newPath", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await worktree.moveWorktree("wt", "/new");
    expect(invoke).toHaveBeenCalledWith("move_worktree", { name: "wt", newPath: "/new" });
  });

  it("lockWorktree defaults reason to null", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await worktree.lockWorktree("wt");
    expect(invoke).toHaveBeenCalledWith("lock_worktree", { name: "wt", reason: null });
  });

  it("unlockWorktree passes name only", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await worktree.unlockWorktree("wt");
    expect(invoke).toHaveBeenCalledWith("unlock_worktree", { name: "wt" });
  });
});
