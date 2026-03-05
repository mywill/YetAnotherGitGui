import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";

export function FileStatusCounts() {
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const setActiveView = useSelectionStore((s) => s.setActiveView);

  const stagedCount = fileStatuses?.staged.length ?? 0;
  const unstagedCount = fileStatuses?.unstaged.length ?? 0;
  const untrackedCount = fileStatuses?.untracked.length ?? 0;
  const total = stagedCount + unstagedCount + untrackedCount;

  const handleClick = () => {
    setActiveView("status");
  };

  const stagedPct = total > 0 ? (stagedCount / total) * 100 : 0;
  const unstagedPct = total > 0 ? (unstagedCount / total) * 100 : 0;
  const untrackedPct = total > 0 ? (untrackedCount / total) * 100 : 0;

  return (
    <div
      className="file-status-counts app-region-no-drag flex cursor-pointer flex-col gap-0.5"
      onClick={handleClick}
    >
      {/* Proportional color bar */}
      <div className="status-bar bg-bg-hover flex h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-status-added transition-all duration-200"
          style={{ width: `${stagedPct}%` }}
        />
        <div
          className="bg-status-modified transition-all duration-200"
          style={{ width: `${unstagedPct}%` }}
        />
        <div
          className="bg-text-muted transition-all duration-200"
          style={{ width: `${untrackedPct}%` }}
        />
      </div>
      {/* Labels */}
      <div className="status-labels text-text-primary flex items-center gap-3 text-xs whitespace-nowrap">
        <span className="flex items-center gap-1">
          <span className="bg-status-added size-1.5 rounded-full" />
          <span>Staged {stagedCount}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-status-modified size-1.5 rounded-full" />
          <span>Unstaged {unstagedCount}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-text-muted size-1.5 rounded-full" />
          <span>Untracked {untrackedCount}</span>
        </span>
      </div>
    </div>
  );
}
