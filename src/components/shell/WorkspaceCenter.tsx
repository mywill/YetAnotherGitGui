import { useSelectionStore } from "../../stores/selectionStore";
import { getView } from "./viewRegistry";

export const WorkspaceCenter = () => {
  const activeView = useSelectionStore((s) => s.activeView);
  const view = getView(activeView);
  const ViewComponent = view?.component;

  return (
    <div
      id="workspace-center"
      className="workspace-center flex min-h-0 min-w-75 flex-1 flex-col overflow-hidden"
      role="tabpanel"
      aria-labelledby={`rail-tab-${activeView}`}
    >
      {ViewComponent && <ViewComponent />}
    </div>
  );
};
