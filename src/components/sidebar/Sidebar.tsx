import { ViewSwitcher } from "./ViewSwitcher";
import { CurrentBranch } from "./CurrentBranch";
import { BranchTagList } from "./BranchTagList";
import { CliInstall } from "./CliInstall";

export function Sidebar() {
  return (
    <div className="sidebar flex h-full flex-col overflow-hidden">
      <ViewSwitcher />
      <CurrentBranch />
      <div className="sidebar-scroll flex-1 overflow-x-hidden overflow-y-auto">
        <BranchTagList />
      </div>
      <CliInstall />
    </div>
  );
}
