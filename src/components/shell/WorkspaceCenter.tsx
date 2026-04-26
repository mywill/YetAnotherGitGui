import { StatusView } from "../views/StatusView";
import { HistoryView } from "../views/HistoryView";
import { CurrentBranch } from "../sidebar/CurrentBranch";
import { BranchTagList } from "../sidebar/BranchTagList";
import { StashesView } from "./StashesView";
import { useSelectionStore } from "../../stores/selectionStore";

export const WorkspaceCenter = () => {
  const activeView = useSelectionStore((s) => s.activeView);

  return (
    <div
      id="workspace-center"
      className="workspace-center flex min-h-0 min-w-75 flex-1 flex-col overflow-hidden"
      role="tabpanel"
      aria-labelledby={`rail-tab-${activeView}`}
    >
      {activeView === "status" && <StatusView />}
      {activeView === "history" && <HistoryView />}
      {activeView === "branches" && (
        <div className="branches-view bg-bg-canvas flex flex-1 flex-col overflow-hidden">
          <CurrentBranch />
          <div className="flex-1 overflow-y-auto p-2">
            <BranchTagList />
          </div>
        </div>
      )}
      {activeView === "stashes" && <StashesView />}
    </div>
  );
};
