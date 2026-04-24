import { CommitGraph } from "../graph/CommitGraph";
import { DetailsPanelEmpty } from "../common/DetailsPanelStates";
import { useRepositoryStore, useIsEmptyRepo } from "../../stores/repositoryStore";

export function HistoryView() {
  const commits = useRepositoryStore((s) => s.commits);
  const isEmptyRepo = useIsEmptyRepo();

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
      <div className="history-graph bg-bg-canvas min-h-0 min-w-100 flex-1 overflow-hidden">
        <CommitGraph commits={commits} />
      </div>
    </div>
  );
}
