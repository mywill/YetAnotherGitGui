import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import "./FileStatusCounts.css";

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
    <div className="file-status-counts" onClick={handleClick}>
      <span className="status-badge staged">
        <span className="status-dot" />
        {stagedCount} Staged
      </span>
      <span className="status-badge unstaged">
        <span className="status-dot" />
        {unstagedCount} Unstaged
      </span>
      <span className="status-badge untracked">
        <span className="status-dot" />
        {untrackedCount} Untracked
      </span>
    </div>
  );
}
