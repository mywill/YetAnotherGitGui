import { ViewSwitcher } from "./ViewSwitcher";
import { CurrentBranch } from "./CurrentBranch";
import { BranchTagList } from "./BranchTagList";
import { CliInstall } from "./CliInstall";
import "./Sidebar.css";

export function Sidebar() {
  return (
    <div className="sidebar">
      <ViewSwitcher />
      <CurrentBranch />
      <div className="sidebar-scroll">
        <BranchTagList />
      </div>
      <CliInstall />
    </div>
  );
}
