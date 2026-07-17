import { useSelectionStore } from "../../stores/selectionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { getView, isViewEnabled } from "./viewRegistry";

export const WorkspaceCenter = () => {
  const activeView = useSelectionStore((s) => s.activeView);
  const enabledTabs = useSettingsStore((s) => s.enabledTabs);

  // If the active view's tab has been disabled in settings, fall back to the
  // Working Copy view rather than rendering a hidden/disabled component.
  const effectiveView = isViewEnabled(activeView, enabledTabs) ? activeView : "status";
  const view = getView(effectiveView);
  const ViewComponent = view?.component;

  return (
    <div
      id="workspace-center"
      className="workspace-center flex min-h-0 min-w-75 flex-1 flex-col overflow-hidden"
      role="tabpanel"
      aria-labelledby={`rail-tab-${effectiveView}`}
    >
      {ViewComponent && <ViewComponent />}
    </div>
  );
};
