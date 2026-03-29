import { useRepositoryStore, useIsEmptyRepo } from "../../stores/repositoryStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { usePlatform } from "../../hooks/usePlatform";

const STATE_LABELS: Record<string, string> = {
  merge: "MERGING",
  rebase: "REBASING",
  "cherry-pick": "CHERRY\u2011PICKING",
  revert: "REVERTING",
  bisect: "BISECTING",
};

export function StatusBar() {
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const isEmptyRepo = useIsEmptyRepo();
  const terminalIsOpen = useTerminalStore((s) => s.isOpen);
  const toggleTerminal = useTerminalStore((s) => s.toggleTerminal);
  const { modKey } = usePlatform();

  if (!repositoryInfo) return null;

  const branchName = repositoryInfo.is_detached
    ? "HEAD detached"
    : repositoryInfo.current_branch || (isEmptyRepo ? "New repository" : "No branch");
  const shortHash =
    repositoryInfo.is_detached && repositoryInfo.head_hash
      ? repositoryInfo.head_hash.slice(0, 7)
      : null;
  const repoState = repositoryInfo.repo_state;
  const stateLabel = repoState && repoState !== "clean" ? (STATE_LABELS[repoState] ?? null) : null;

  const stagedCount = fileStatuses?.staged.length ?? 0;
  const unstagedCount = fileStatuses?.unstaged.length ?? 0;
  const untrackedCount = fileStatuses?.untracked.length ?? 0;
  const hasChanges = stagedCount + unstagedCount + untrackedCount > 0;

  return (
    <footer
      className="status-bar bg-bg-tertiary border-border flex h-[22px] shrink-0 items-center justify-between border-t px-2 text-xs"
      role="status"
      aria-label="Status bar"
    >
      <div className="status-bar-left flex min-w-0 items-center gap-2">
        <BranchIcon />
        <span className="branch-indicator text-text-secondary truncate" title={branchName}>
          {branchName}
        </span>
        {shortHash && <span className="text-text-muted font-mono text-[10px]">{shortHash}</span>}
        {stateLabel && (
          <span className="repo-state-badge text-warning bg-warning-bg rounded px-1 py-px text-[10px] font-bold">
            {stateLabel}
          </span>
        )}
      </div>

      <div className="status-bar-right flex items-center gap-3">
        {hasChanges && (
          <div
            className="status-bar-counts text-text-muted flex items-center gap-2"
            aria-label={`${stagedCount} staged, ${unstagedCount} unstaged, ${untrackedCount} untracked`}
          >
            {stagedCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="bg-status-added size-1.5 rounded-full" />
                <span>{stagedCount}</span>
              </span>
            )}
            {unstagedCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="bg-status-modified size-1.5 rounded-full" />
                <span>{unstagedCount}</span>
              </span>
            )}
            {untrackedCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="bg-text-muted size-1.5 rounded-full" />
                <span>{untrackedCount}</span>
              </span>
            )}
          </div>
        )}

        <button
          className={`status-bar-terminal-toggle flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
            terminalIsOpen
              ? "bg-bg-selected text-text-primary"
              : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
          }`}
          onClick={toggleTerminal}
          title={`Terminal (${modKey}+\`)`}
          aria-label={`Toggle terminal (${modKey}+\`)`}
          aria-expanded={terminalIsOpen}
        >
          <TerminalIcon />
          <span>Terminal</span>
        </button>
      </div>
    </footer>
  );
}

function BranchIcon() {
  return (
    <svg
      className="text-badge-branch shrink-0"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm7 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM5 8v2.5a.5.5 0 0 0 .5.5h5.5V13h-5a1.5 1.5 0 0 1-1.5-1.5V8h.5z" />
      <path d="M11 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm1 2.5V10h-1V7.5h1z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="shrink-0" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9zM3.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9z" />
      <path d="M5.146 5.146a.5.5 0 0 1 .708 0L8.207 7.5 5.854 9.854a.5.5 0 1 1-.708-.708L7.293 7.5 5.146 5.354a.5.5 0 0 1 0-.708zM8.5 10h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1z" />
    </svg>
  );
}
