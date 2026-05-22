import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { CurrentBranch } from "../sidebar/CurrentBranch";
import { BranchTagList } from "../sidebar/BranchTagList";
import { SectionActionButton } from "../files/SectionHeader";
import { useDialogStore } from "../../stores/dialogStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import * as git from "../../services/git";
import { runQuickCleanup } from "../../utils/cleanupActions";
import type { BranchInfo } from "../../types";

export const BranchesView = () => {
  const [running, setRunning] = useState(false);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const loadBranchesAndTags = useRepositoryStore((s) => s.loadBranchesAndTags);

  const handleQuickGone = () =>
    runQuickCleanup<BranchInfo>({
      fetchCandidates: () => git.listGoneBranches(),
      emptyMessage: "No local branches have a deleted remote.",
      confirmTitle: () => "Delete branches with deleted remote",
      confirmMessage: (candidates, list) =>
        `Delete ${candidates.length} local branch${candidates.length === 1 ? "" : "es"} whose remote branch was deleted on the server? This cannot be undone.\n\n${list}`,
      confirmLabel: "Delete",
      itemNoun: { singular: "branch", plural: "branches" },
      pastTenseVerb: "Deleted",
      failVerb: "delete",
      formatItemForDialog: (b) => b.name,
      runBulk: (candidates) => git.deleteBranches(candidates.map((b) => b.name)),
      refresh: () => loadBranchesAndTags(),
      mixedFailureFallbackView: "cleanup",
      setRunning,
      showConfirm,
      setActiveView,
    });

  return (
    <div className="branches-view bg-bg-canvas flex flex-1 flex-col overflow-hidden">
      <CurrentBranch />
      <div className="border-border flex items-center justify-end gap-2 border-b px-3 py-1.5">
        <SectionActionButton
          onClick={handleQuickGone}
          title="Delete branches with no remote"
          ariaLabel="Prune branches"
          disabled={running}
        >
          <IconTrash size={12} stroke={2} aria-hidden />
          <span>{running ? "Pruning…" : "Prune branches"}</span>
        </SectionActionButton>
      </div>
      <div className="p-list-pad flex-1 overflow-y-auto">
        <BranchTagList />
      </div>
    </div>
  );
};
