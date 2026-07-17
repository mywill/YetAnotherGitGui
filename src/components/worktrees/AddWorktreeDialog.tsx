import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { IconX } from "@tabler/icons-react";
import { useWorktreeStore } from "../../stores/worktreeStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { YaggButton } from "../common/YaggButton";
import { copyToClipboard } from "../../services/clipboard";

type Mode = "existing" | "new" | "detached";

function sanitizeName(input: string): string {
  return input
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function computeWorktreeName(
  mode: Mode,
  branch: string,
  newBranch: string,
  commitHash: string
): string {
  if (mode === "existing") return sanitizeName(branch);
  if (mode === "new") return sanitizeName(newBranch);
  return sanitizeName(commitHash ? `wt-${commitHash.slice(0, 7)}` : "wt-detached");
}

// fallow-ignore-next-line complexity
function canSubmitWorktree(
  mode: Mode,
  name: string,
  newBranch: string,
  branch: string,
  submitting: boolean
): boolean {
  return (
    !submitting &&
    name.trim().length > 0 &&
    (mode !== "new" || newBranch.trim().length > 0) &&
    (mode !== "existing" || branch.length > 0)
  );
}

export function AddWorktreeDialog() {
  const preset = useWorktreeStore((s) => s.addDialogPreset);
  const addWorktree = useWorktreeStore((s) => s.addWorktree);
  const closeAddDialog = useWorktreeStore((s) => s.closeAddDialog);
  const branches = useRepositoryStore((s) => s.branches);
  const repoPath = useRepositoryStore((s) => s.repositoryInfo?.path ?? "");
  const defaultParentDir = useSettingsStore((s) => s.worktreesDefaultParentDir);
  const setWorktreesDefaultParentDir = useSettingsStore((s) => s.setWorktreesDefaultParentDir);

  const localBranches = useMemo(
    () => branches.filter((b) => !b.is_remote).map((b) => b.name),
    [branches]
  );

  const initialMode: Mode = preset?.branch ? "existing" : "new";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [branch, setBranch] = useState(preset?.branch ?? localBranches[0] ?? "");
  const [newBranch, setNewBranch] = useState(preset?.branch ?? "");
  const [name, setName] = useState("");
  const [parentDir, setParentDir] = useState(
    defaultParentDir ?? defaultParentFromRepoPath(repoPath)
  );
  const [commitHash, setCommitHash] = useState(preset?.commitHash ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill the worktree name from the selected branch / new-branch name.
  useEffect(() => {
    setName(computeWorktreeName(mode, branch, newBranch, commitHash));
  }, [mode, branch, newBranch, commitHash]);

  const fullPath = parentDir ? `${parentDir}/${name}` : name;

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      defaultPath: parentDir || undefined,
      title: "Choose parent directory for the worktree",
    });
    if (selected) {
      setParentDir(selected);
      setWorktreesDefaultParentDir(selected);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !fullPath) return;
    setSubmitting(true);
    try {
      await addWorktree({
        name: name.trim(),
        path: fullPath,
        branch: mode === "existing" ? branch : null,
        newBranch: mode === "new" ? newBranch.trim() : null,
        commitHash: mode === "detached" ? commitHash.trim() || null : (preset?.commitHash ?? null),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAddDialog();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeAddDialog]);

  const canSubmit = canSubmitWorktree(mode, name, newBranch, branch, submitting);

  const copyPath = () => {
    void copyToClipboard(fullPath);
  };

  return createPortal(
    <div
      className="confirm-dialog-backdrop fixed inset-0 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAddDialog();
      }}
    >
      <div
        className="confirm-dialog border-border bg-bg-panel shadow-dialog max-w-lg min-w-96 rounded-lg border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-worktree-title"
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 id="add-worktree-title" className="text-text-primary text-base font-semibold">
            Add Worktree
          </h2>
          <button
            type="button"
            onClick={closeAddDialog}
            className="text-text-muted hover:text-text-primary cursor-pointer bg-transparent p-1"
            aria-label="Close"
          >
            <IconX size={16} stroke={1.75} aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 text-xs">
          {/* Mode selector */}
          <div className="flex gap-1">
            {(["existing", "new", "detached"] as const).map((m) => (
              <YaggButton
                key={m}
                variant={mode === m ? "primary" : "outline"}
                size="sm"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
              >
                {m === "existing" ? "Existing branch" : m === "new" ? "New branch" : "Detached"}
              </YaggButton>
            ))}
          </div>

          {mode === "existing" && (
            <Field label="Branch">
              <select
                className="font-inherit text-body bg-bg-well text-text-primary border-border focus-ring rounded border px-2 py-1"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                {localBranches.length === 0 && <option value="">(no local branches)</option>}
                {localBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {mode === "new" && (
            <Field label="New branch name">
              <input
                className="font-inherit text-body bg-bg-well text-text-primary border-border focus-ring rounded border px-2 py-1 font-mono"
                type="text"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder="e.g. feature/login"
                autoFocus
              />
            </Field>
          )}

          {mode === "detached" && (
            <Field label="Commit hash (optional — defaults to HEAD)">
              <input
                className="font-inherit text-body bg-bg-well text-text-primary border-border focus-ring rounded border px-2 py-1 font-mono"
                type="text"
                value={commitHash}
                onChange={(e) => setCommitHash(e.target.value)}
                placeholder="HEAD"
                autoFocus
              />
            </Field>
          )}

          <Field label="Worktree name">
            <input
              className="font-inherit text-body bg-bg-well text-text-primary border-border focus-ring rounded border px-2 py-1 font-mono"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Destination">
            <div className="flex items-center gap-2">
              <input
                className="font-inherit text-body bg-bg-well text-text-primary border-border focus-ring min-w-0 flex-1 rounded border px-2 py-1 font-mono"
                type="text"
                value={fullPath}
                readOnly
              />
              <YaggButton variant="outline" onClick={copyPath} title="Copy path">
                Copy
              </YaggButton>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="font-inherit text-body bg-bg-well text-text-primary border-border focus-ring min-w-0 flex-1 rounded border px-2 py-1 font-mono"
                type="text"
                value={parentDir}
                onChange={(e) => setParentDir(e.target.value)}
                aria-label="Parent directory"
              />
              <YaggButton variant="outline" onClick={handleBrowse}>
                Browse…
              </YaggButton>
            </div>
          </Field>

          {mode === "existing" && branch && localBranches.includes(branch) && (
            <p className="text-text-muted text-2xs italic">
              Note: a branch can only be checked out in one worktree at a time. If “{branch}” is
              currently checked out in the main repo, switch the main repo off it first.
            </p>
          )}
        </div>

        <div className="border-border flex justify-end gap-3 border-t px-4 py-4">
          <YaggButton variant="outline" onClick={closeAddDialog}>
            Cancel
          </YaggButton>
          <YaggButton variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create worktree"}
          </YaggButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted text-2xs font-medium tracking-wide uppercase">{label}</span>
      {children}
    </label>
  );
}

function defaultParentFromRepoPath(repoPath: string): string {
  // Default the parent dir to one level above the repo, so sibling worktrees
  // cluster naturally (matches the common `../<repo>-wt-<name>` convention).
  if (!repoPath) return "";
  const parts = repoPath.replace(/\/$/, "").split("/");
  parts.pop(); // drop the repo dir itself
  return parts.join("/") || "/";
}
