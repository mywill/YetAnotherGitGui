import { useState, useCallback } from "react";
import { CommitGraph } from "../graph/CommitGraph";
import { CommitDetailsPanel } from "../history/CommitDetailsPanel";
import { DetailsPanelEmpty } from "../common/DetailsPanelStates";
import { useRepositoryStore, useIsEmptyRepo } from "../../stores/repositoryStore";

export function HistoryView() {
  const commits = useRepositoryStore((s) => s.commits);
  const selectedCommitDetails = useRepositoryStore((s) => s.selectedCommitDetails);
  const commitDetailsLoading = useRepositoryStore((s) => s.commitDetailsLoading);
  const isEmptyRepo = useIsEmptyRepo();

  const [detailsWidth, setDetailsWidth] = useState(400);

  const handleResize = useCallback((delta: number) => {
    setDetailsWidth((w) => Math.max(300, Math.min(600, w - delta)));
  }, []);

  if (isEmptyRepo) {
    return (
      <div className="history-view flex min-h-0 flex-1 overflow-hidden">
        <DetailsPanelEmpty
          className="history-empty flex-1"
          label="No commits yet. Create your first commit in the Status view."
        />
      </div>
    );
  }

  return (
    <div className="history-view flex min-h-0 flex-1 overflow-hidden">
      <div className="history-graph bg-bg-primary min-h-0 min-w-100 flex-1 overflow-hidden">
        <CommitGraph commits={commits} />
      </div>
      <Resizer onResize={handleResize} />
      <div
        className="history-details border-border bg-bg-secondary max-w-150 min-w-75 overflow-hidden border-l"
        style={{ width: detailsWidth }}
      >
        <CommitDetailsPanel details={selectedCommitDetails} loading={commitDetailsLoading} />
      </div>
    </div>
  );
}

interface ResizerProps {
  onResize: (delta: number) => void;
}

function Resizer({ onResize }: ResizerProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;

      const handleMouseMove = (e: MouseEvent) => {
        onResize(e.clientX - startX);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <div
      className="history-resizer bg-border hover:bg-bg-selected w-1 shrink-0 cursor-col-resize transition-colors duration-150"
      onMouseDown={handleMouseDown}
    />
  );
}
