import { invoke } from "@tauri-apps/api/core";
import type { WorktreeInfo } from "../types";

export async function listWorktrees(): Promise<WorktreeInfo[]> {
  return invoke("list_worktrees");
}

export async function addWorktree(params: {
  name: string;
  path: string;
  branch?: string | null;
  newBranch?: string | null;
  commitHash?: string | null;
}): Promise<WorktreeInfo> {
  return invoke("add_worktree", {
    name: params.name,
    path: params.path,
    branch: params.branch ?? null,
    newBranch: params.newBranch ?? null,
    commitHash: params.commitHash ?? null,
  });
}

export async function removeWorktree(name: string, force: boolean): Promise<void> {
  await invoke("remove_worktree", { name, force });
}

export async function moveWorktree(name: string, newPath: string): Promise<void> {
  await invoke("move_worktree", { name, newPath });
}

export async function lockWorktree(name: string, reason?: string | null): Promise<void> {
  await invoke("lock_worktree", { name, reason: reason ?? null });
}

export async function unlockWorktree(name: string): Promise<void> {
  await invoke("unlock_worktree", { name });
}
