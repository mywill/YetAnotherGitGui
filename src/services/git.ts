import { invoke } from "@tauri-apps/api/core";
import type {
  RepositoryInfo,
  GraphCommit,
  CommitDetails,
  FileStatuses,
  FileDiff,
  BranchInfo,
  TagInfo,
  StashInfo,
  StashDetails,
} from "../types";

export async function getCurrentDir(): Promise<string> {
  return invoke("get_current_dir");
}

export async function openRepository(path: string): Promise<RepositoryInfo> {
  return invoke("open_repository", { path });
}

export async function getRepositoryInfo(): Promise<RepositoryInfo> {
  return invoke("get_repository_info");
}

export async function getCommitGraph(skip: number, limit: number): Promise<GraphCommit[]> {
  return invoke("get_commit_graph", { skip, limit });
}

export async function getCommitDetails(hash: string): Promise<CommitDetails> {
  return invoke("get_commit_details", { hash });
}

export async function listBranches(): Promise<BranchInfo[]> {
  return invoke("list_branches");
}

export async function listTags(): Promise<TagInfo[]> {
  return invoke("list_tags");
}

export async function checkoutCommit(hash: string): Promise<void> {
  return invoke("checkout_commit", { hash });
}

export async function checkoutBranch(branchName: string): Promise<void> {
  return invoke("checkout_branch", { branchName });
}

export async function getCommitFileDiff(hash: string, filePath: string): Promise<FileDiff> {
  return invoke("get_commit_file_diff", { hash, filePath });
}

export async function getFileStatuses(): Promise<FileStatuses> {
  return invoke("get_file_statuses");
}

export async function stageFile(path: string): Promise<void> {
  return invoke("stage_file", { path });
}

export async function unstageFile(path: string): Promise<void> {
  return invoke("unstage_file", { path });
}

export async function stageHunk(path: string, hunkIndex: number): Promise<void> {
  return invoke("stage_hunk", { path, hunkIndex });
}

export async function unstageHunk(path: string, hunkIndex: number): Promise<void> {
  return invoke("unstage_hunk", { path, hunkIndex });
}

export async function stageLines(
  path: string,
  hunkIndex: number,
  lineIndices: number[]
): Promise<void> {
  return invoke("stage_lines", { path, hunkIndex, lineIndices });
}

export async function discardHunk(
  path: string,
  hunkIndex: number,
  lineIndices?: number[]
): Promise<void> {
  return invoke("discard_hunk", { path, hunkIndex, lineIndices: lineIndices ?? null });
}

export async function getFileDiff(
  path: string,
  staged: boolean,
  isUntracked?: boolean
): Promise<FileDiff> {
  return invoke("get_file_diff", { path, staged, isUntracked });
}

export async function createCommit(message: string): Promise<string> {
  return invoke("create_commit", { message });
}

export async function revertFile(path: string): Promise<void> {
  return invoke("revert_file", { path });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export async function deleteBranch(branchName: string, isRemote: boolean): Promise<void> {
  return invoke("delete_branch", { branchName, isRemote });
}

export async function deleteTag(tagName: string): Promise<void> {
  return invoke("delete_tag", { tagName });
}

export async function listStashes(): Promise<StashInfo[]> {
  return invoke("list_stashes");
}

export async function getStashDetails(index: number): Promise<StashDetails> {
  return invoke("get_stash_details", { index });
}

export async function applyStash(index: number): Promise<void> {
  return invoke("apply_stash", { index });
}

export async function dropStash(index: number): Promise<void> {
  return invoke("drop_stash", { index });
}

export async function getStashFileDiff(index: number, filePath: string): Promise<FileDiff> {
  return invoke("get_stash_file_diff", { index, filePath });
}
