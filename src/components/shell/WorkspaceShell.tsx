import { useCallback } from "react";
import { IconRail } from "./IconRail";
import { WorkspaceCenter } from "./WorkspaceCenter";
import { InspectorPanel } from "./InspectorPanel";
import { YaggResizer } from "../common/YaggResizer";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSelectionStore } from "../../stores/selectionStore";

const INSPECTOR_DEFAULT = 360;
const INSPECTOR_MIN = 180;
const INSPECTOR_MAX = 100000;

const VIEWS_WITH_INSPECTOR = new Set(["history"]);

export function WorkspaceShell() {
  const inspectorVisible = useSettingsStore((s) => s.inspectorVisible);
  const activeView = useSelectionStore((s) => s.activeView);
  const inspectorWidth = useSettingsStore(
    (s) => s.layoutSizes["workspace.inspector"] ?? INSPECTOR_DEFAULT
  );
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  const handleInspectorResize = useCallback(
    (next: number) => {
      setLayoutSize("workspace.inspector", next);
    },
    [setLayoutSize]
  );

  const showInspector = inspectorVisible && VIEWS_WITH_INSPECTOR.has(activeView);

  return (
    <div className="workspace-shell flex h-full w-full overflow-hidden">
      <IconRail />
      <WorkspaceCenter />
      {showInspector && (
        <>
          <YaggResizer
            orientation="vertical"
            size={inspectorWidth}
            onSizeChange={handleInspectorResize}
            min={INSPECTOR_MIN}
            max={INSPECTOR_MAX}
            defaultSize={INSPECTOR_DEFAULT}
            ariaLabel="Resize inspector panel"
            collapsible
            panelId="inspector-panel"
            panelSide="right"
          />
          <div
            id="inspector-panel"
            className="inspector-panel border-border bg-bg-panel flex min-w-0 flex-col overflow-hidden border-l"
            style={{ width: inspectorWidth > 0 ? inspectorWidth : 0 }}
          >
            {inspectorWidth > 0 && <InspectorPanel />}
          </div>
        </>
      )}
    </div>
  );
}
