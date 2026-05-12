import { IconRail } from "./IconRail";
import { WorkspaceCenter } from "./WorkspaceCenter";

export const WorkspaceShell = () => {
  return (
    <div className="workspace-shell flex h-full w-full overflow-hidden">
      <IconRail />
      <WorkspaceCenter />
    </div>
  );
};
