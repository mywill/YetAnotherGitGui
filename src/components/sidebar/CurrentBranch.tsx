import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import { IconGitBranch, IconSearch } from "@tabler/icons-react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useBranchFilterStore } from "../../stores/branchFilterStore";

export function CurrentBranch() {
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const query = useBranchFilterStore((s) => s.query);
  const setQuery = useBranchFilterStore((s) => s.setQuery);
  const clear = useBranchFilterStore((s) => s.clear);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear filter on unmount so it doesn't leak across view switches.
  useEffect(() => () => clear(), [clear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (query) {
          clear();
        } else {
          (e.currentTarget as HTMLInputElement).blur();
        }
      }
    },
    [clear, query]
  );

  if (!repositoryInfo) {
    return null;
  }

  const branchName = repositoryInfo.is_detached
    ? "HEAD detached"
    : repositoryInfo.current_branch || "No branch";

  const repoState = repositoryInfo.repo_state;
  const STATE_LABELS: Record<string, string> = {
    merge: "MERGING",
    rebase: "REBASING",
    "cherry-pick": "CHERRY‑PICKING",
    revert: "REVERTING",
    bisect: "BISECTING",
  };
  const stateLabel = repoState && repoState !== "clean" ? (STATE_LABELS[repoState] ?? null) : null;

  return (
    <div className="current-branch border-border bg-bg-well text-text-primary flex items-center gap-2 border-b px-3 py-2">
      <BranchIcon />
      <span
        className="branch-name min-w-0 shrink truncate font-mono font-medium"
        title={branchName}
      >
        {branchName}
      </span>
      {stateLabel && (
        <span className="repo-state-label text-warning bg-warning-bg text-2xs shrink-0 rounded px-1.5 py-0.5 font-bold">
          {stateLabel}
        </span>
      )}
      <div className="branch-filter-wrap relative flex min-w-0 flex-1 items-center pr-1">
        <span
          className="text-text-muted pointer-events-none absolute left-1.5 inline-flex size-3 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter branches & tags"
          aria-label="Filter branches and tags"
          className={clsx(
            "branch-filter-input text-2xs border-border bg-bg-canvas/60 hover:bg-bg-canvas focus:border-text-muted w-full min-w-0 rounded !border !py-0.5 !pr-5 !pl-6 font-mono transition-colors duration-150 focus:outline-none"
          )}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear filter"
            className="text-text-muted hover:text-text-primary absolute right-0.5 inline-flex size-4 items-center justify-center rounded focus-visible:outline-none"
            tabIndex={-1}
          >
            {"×"}
          </button>
        )}
      </div>
    </div>
  );
}

function BranchIcon() {
  return (
    <IconGitBranch size={14} stroke={1.75} className="text-badge-branch shrink-0" aria-hidden />
  );
}

function SearchIcon() {
  return <IconSearch size={10} stroke={1.8} aria-hidden />;
}
