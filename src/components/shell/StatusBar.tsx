import clsx from "clsx";
import { IconGitBranch, IconTerminal2 } from "@tabler/icons-react";
import { useRepositoryStore, useIsEmptyRepo } from "../../stores/repositoryStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { usePlatform } from "../../hooks/usePlatform";
import { YaggButton } from "../common/YaggButton";
import { BranchSwitcher } from "./BranchSwitcher";

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
      className="status-bar bg-bg-well border-border flex h-[22px] shrink-0 items-center justify-between border-t px-2 text-xs"
      role="status"
      aria-label="Status bar"
    >
      <div className="status-bar-left flex min-w-0 items-center gap-2">
        <IconGitBranch size={12} stroke={1.75} className="text-badge-branch shrink-0" aria-hidden />
        <BranchSwitcher branchName={branchName} isDetached={repositoryInfo.is_detached} />
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
            className="status-bar-counts text-text-muted flex items-center gap-2 font-mono"
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

        <YaggButton
          variant="ghost"
          className={clsx(
            "status-bar-terminal-toggle flex items-center gap-1 border-none px-1.5 py-0.5 text-xs",
            terminalIsOpen
              ? "bg-bg-selected text-text-primary"
              : "text-text-muted hover:bg-bg-hover hover:text-text-primary bg-transparent"
          )}
          onClick={toggleTerminal}
          title={`Terminal (${modKey}+\`)`}
          aria-label={`Toggle terminal (${modKey}+\`)`}
          aria-expanded={terminalIsOpen}
        >
          <IconTerminal2 size={12} stroke={1.75} className="shrink-0" aria-hidden />
          <span>Terminal</span>
        </YaggButton>
      </div>
    </footer>
  );
}
