export interface RepositoryInfo {
  path: string;
  current_branch: string | null;
  is_detached: boolean;
  remotes: string[];
  head_hash: string | null;
}

export interface CommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parent_hashes: string[];
}

export interface GraphCommit extends CommitInfo {
  column: number;
  lines: GraphLine[];
  refs: RefInfo[];
  is_tip: boolean;
}

export interface GraphLine {
  from_column: number;
  to_column: number;
  is_merge: boolean;
  line_type: "to_parent" | "from_above" | "pass_through";
}

export interface RefInfo {
  name: string;
  ref_type: "branch" | "remotebranch" | "tag";
  is_head: boolean;
}

export interface CommitFileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  old_path?: string;
}

export interface CommitDetails {
  hash: string;
  message: string;
  author_name: string;
  author_email: string;
  committer_name: string;
  committer_email: string;
  timestamp: number;
  parent_hashes: string[];
  files_changed: CommitFileChange[];
}

export interface FileStatus {
  path: string;
  status: FileStatusType;
  is_staged: boolean;
}

export type FileStatusType =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted";

export interface FileStatuses {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
  is_binary: boolean;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  content: string;
  line_type: "context" | "addition" | "deletion" | "header";
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface BranchInfo {
  name: string;
  is_remote: boolean;
  is_head: boolean;
  target_hash: string;
}

export interface TagInfo {
  name: string;
  target_hash: string;
  is_annotated: boolean;
  message?: string;
}

export interface StashInfo {
  index: number;
  message: string;
  commit_hash: string;
  timestamp: number;
  branch_name: string;
}

export interface StashDetails {
  index: number;
  message: string;
  commit_hash: string;
  timestamp: number;
  branch_name: string;
  files_changed: CommitFileChange[];
}
