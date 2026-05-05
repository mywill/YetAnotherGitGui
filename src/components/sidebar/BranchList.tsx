import { useCallback, useMemo } from "react";
import type { BranchInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { BranchItem } from "./BranchItem";
import { CollapsibleFilteredSection } from "./CollapsibleFilteredSection";

const SECTION_KEY_LOCAL = "sidebar.branches.local";
const SECTION_KEY_REMOTE = "sidebar.branches.remote";

interface BranchListProps {
  filterQuery: string;
}

export function BranchList({ filterQuery }: BranchListProps) {
  const branches = useRepositoryStore((s) => s.branches);
  const checkoutBranch = useRepositoryStore((s) => s.checkoutBranch);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const localExpanded = useSettingsStore((s) => s.sectionExpanded[SECTION_KEY_LOCAL] ?? false);
  const remoteExpanded = useSettingsStore((s) => s.sectionExpanded[SECTION_KEY_REMOTE] ?? false);
  const setSectionExpanded = useSettingsStore((s) => s.setSectionExpanded);

  const allLocals = useMemo(() => branches.filter((b) => !b.is_remote), [branches]);
  const allRemotes = useMemo(() => branches.filter((b) => b.is_remote), [branches]);

  const checkoutWithConfirm = useCallback(
    async (branch: BranchInfo) => {
      if (branch.is_head) return;
      if (branch.is_remote) {
        await showConfirm({
          title: "Remote Branch",
          message: `To checkout remote branch "${branch.name}", create a local tracking branch first.`,
          confirmLabel: "OK",
          cancelLabel: "Cancel",
        });
        return;
      }
      const confirmed = await showConfirm({
        title: "Switch Branch",
        message: `Switch to branch "${branch.name}"?`,
        confirmLabel: "Switch",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        checkoutBranch(branch.name);
      }
    },
    [checkoutBranch, showConfirm]
  );

  // Enter: scroll to the branch's commit and prompt to switch.
  const handleActivate = useCallback(
    async (branch: BranchInfo) => {
      if (branch.target_hash) selectAndScrollToCommit(branch.target_hash);
      await checkoutWithConfirm(branch);
    },
    [selectAndScrollToCommit, checkoutWithConfirm]
  );

  // Space: prompt to switch without scrolling the graph.
  const renderBranch = useCallback((b: BranchInfo) => <BranchItem branch={b} />, []);

  return (
    <>
      <CollapsibleFilteredSection<BranchInfo>
        title="Local Branches"
        items={allLocals}
        expanded={localExpanded}
        onToggle={() => setSectionExpanded(SECTION_KEY_LOCAL, !localExpanded)}
        filterQuery={filterQuery}
        listAriaLabel="Local Branches"
        onActivate={handleActivate}
        onSecondaryActivate={checkoutWithConfirm}
        renderItem={renderBranch}
        emptyLabel="No local branches"
      />
      <CollapsibleFilteredSection<BranchInfo>
        title="Remote Branches"
        items={allRemotes}
        expanded={remoteExpanded}
        onToggle={() => setSectionExpanded(SECTION_KEY_REMOTE, !remoteExpanded)}
        filterQuery={filterQuery}
        listAriaLabel="Remote Branches"
        onActivate={handleActivate}
        onSecondaryActivate={checkoutWithConfirm}
        renderItem={renderBranch}
        emptyLabel="No remote branches"
      />
    </>
  );
}
