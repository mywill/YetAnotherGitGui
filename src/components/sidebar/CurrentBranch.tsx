import { useRepositoryStore } from "../../stores/repositoryStore";

export function CurrentBranch() {
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);

  if (!repositoryInfo) {
    return null;
  }

  const branchName = repositoryInfo.is_detached
    ? "HEAD detached"
    : repositoryInfo.current_branch || "No branch";

  return (
    <div className="current-branch border-border bg-bg-tertiary text-text-primary flex items-center gap-2 border-b px-3 py-2">
      <BranchIcon />
      <span className="branch-name truncate font-medium" title={branchName}>
        {branchName}
      </span>
    </div>
  );
}

function BranchIcon() {
  return (
    <svg
      className="text-badge-branch shrink-0"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm7 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM5 8v2.5a.5.5 0 0 0 .5.5h5.5V13h-5a1.5 1.5 0 0 1-1.5-1.5V8h.5z" />
      <path d="M11 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm1 2.5V10h-1V7.5h1z" />
    </svg>
  );
}
