import { invoke } from "@tauri-apps/api/core";
import type {
  RepositoryInfo,
  GraphCommit,
  CommitDetails,
  FileStatuses,
  FileDiff,
  DiffHunk,
  BranchInfo,
  TagInfo,
  StashInfo,
  StashDetails,
  BulkResult,
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

export async function getAllCommitGraph(): Promise<GraphCommit[]> {
  return invoke("get_all_commit_graph");
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

export async function createBranch(name: string): Promise<void> {
  return invoke("create_branch_and_checkout", { branchName: name });
}

export async function validateBranchName(
  name: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await invoke("validate_branch_name", { name });
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  }
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

export async function stageFiles(paths: string[]): Promise<void> {
  return invoke("stage_files", { paths });
}

export async function unstageFiles(paths: string[]): Promise<void> {
  return invoke("unstage_files", { paths });
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
  isUntracked?: boolean,
  isConflicted?: boolean
): Promise<FileDiff> {
  return invoke("get_file_diff", { path, staged, isUntracked, isConflicted });
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

export async function deleteFiles(paths: string[]): Promise<void> {
  return invoke("delete_files", { paths });
}

export async function resolveConflict(path: string, strategy: string): Promise<void> {
  return invoke("resolve_conflict", { path, strategy });
}

export async function abortOperation(): Promise<void> {
  return invoke("abort_operation");
}

export async function continueOperation(): Promise<string> {
  return invoke("continue_operation");
}

export async function revertCommit(hash: string): Promise<void> {
  return invoke("revert_commit", { hash });
}

export async function revertCommitFile(hash: string, path: string): Promise<void> {
  return invoke("revert_commit_file", { hash, path });
}

export async function revertCommitFileLines(
  hash: string,
  path: string,
  hunkIndex: number,
  lineIndices: number[]
): Promise<void> {
  return invoke("revert_commit_file_lines", { hash, path, hunkIndex, lineIndices });
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

export async function getDiffHunk(
  path: string,
  staged: boolean,
  hunkIndex: number,
  isUntracked?: boolean,
  isConflicted?: boolean
): Promise<DiffHunk> {
  return invoke("get_diff_hunk", { path, staged, hunkIndex, isUntracked, isConflicted });
}

export async function getCommitDiffHunk(
  hash: string,
  filePath: string,
  hunkIndex: number
): Promise<DiffHunk> {
  return invoke("get_commit_diff_hunk", { hash, filePath, hunkIndex });
}

export async function listGoneBranches(): Promise<BranchInfo[]> {
  return invoke("list_gone_branches");
}

export async function listMergedBranches(): Promise<BranchInfo[]> {
  return invoke("list_merged_branches");
}

export async function deleteBranches(names: string[]): Promise<BulkResult[]> {
  return invoke("delete_branches", { names });
}

export async function pruneRemote(remote: string): Promise<string[]> {
  return invoke("prune_remote", { remote });
}

export async function listOldStashes(daysOld: number): Promise<StashInfo[]> {
  return invoke("list_old_stashes", { daysOld });
}

export async function dropStashes(indices: number[]): Promise<BulkResult[]> {
  return invoke("drop_stashes", { indices });
}

export async function listUntrackedFiles(): Promise<string[]> {
  return invoke("list_untracked_files");
}

export async function cleanUntrackedFiles(paths: string[]): Promise<BulkResult[]> {
  return invoke("clean_untracked_files", { paths });
}
