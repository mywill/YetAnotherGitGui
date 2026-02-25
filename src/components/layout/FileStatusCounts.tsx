import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";

export function FileStatusCounts() {
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const setActiveView = useSelectionStore((s) => s.setActiveView);

  const stagedCount = fileStatuses?.staged.length ?? 0;
  const unstagedCount = fileStatuses?.unstaged.length ?? 0;
  const untrackedCount = fileStatuses?.untracked.length ?? 0;

  const handleClick = () => {
    setActiveView("status");
  };

  return (
    <div
      className="file-status-counts app-region-no-drag flex cursor-pointer items-center gap-2"
      onClick={handleClick}
    >
      <span className="status-badge staged bg-bg-hover text-text-primary hover:bg-bg-selected inline-block rounded-full px-2.5 py-1 text-xs leading-none whitespace-nowrap transition-colors duration-150">
        <span className="status-dot bg-status-added mr-1 inline-block size-1.5 rounded-full align-middle" />
        {stagedCount} Staged
      </span>
      <span className="status-badge unstaged bg-bg-hover text-text-primary hover:bg-bg-selected inline-block rounded-full px-2.5 py-1 text-xs leading-none whitespace-nowrap transition-colors duration-150">
        <span className="status-dot bg-status-modified mr-1 inline-block size-1.5 rounded-full align-middle" />
        {unstagedCount} Unstaged
      </span>
      <span className="status-badge untracked bg-bg-hover text-text-primary hover:bg-bg-selected inline-block rounded-full px-2.5 py-1 text-xs leading-none whitespace-nowrap transition-colors duration-150">
        <span className="status-dot bg-bg-selected mr-1 inline-block size-1.5 rounded-full align-middle" />
        {untrackedCount} Untracked
      </span>
    </div>
  );
}
