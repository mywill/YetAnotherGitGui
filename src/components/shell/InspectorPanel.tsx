import { CommitDetailsPanel } from "../history/CommitDetailsPanel";
import { DetailsPanelEmpty } from "../common/DetailsPanelStates";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";

export function InspectorPanel() {
  const activeView = useSelectionStore((s) => s.activeView);
  const selectedCommitDetails = useRepositoryStore((s) => s.selectedCommitDetails);
  const commitDetailsLoading = useRepositoryStore((s) => s.commitDetailsLoading);

  if (activeView === "history") {
    return <CommitDetailsPanel details={selectedCommitDetails} loading={commitDetailsLoading} />;
  }

  return <DetailsPanelEmpty className="inspector-empty" label="No details to show" />;
}
