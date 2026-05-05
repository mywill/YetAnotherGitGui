import { CurrentBranch } from "../sidebar/CurrentBranch";
import { BranchTagList } from "../sidebar/BranchTagList";

export const BranchesView = () => {
  return (
    <div className="branches-view bg-bg-canvas flex flex-1 flex-col overflow-hidden">
      <CurrentBranch />
      <div className="flex-1 overflow-y-auto p-2">
        <BranchTagList />
      </div>
    </div>
  );
};
