import { useState, useCallback } from "react";
import clsx from "clsx";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { YaggButton } from "../common/YaggButton";
import { KeyboardList } from "../common/KeyboardList";
import { BranchItem } from "./BranchItem";
import { TagItem } from "./TagItem";
import { StashItem } from "./StashItem";

export function BranchTagList() {
  const branches = useRepositoryStore((s) => s.branches);
  const tags = useRepositoryStore((s) => s.tags);
  const stashes = useRepositoryStore((s) => s.stashes);
  const checkoutBranch = useRepositoryStore((s) => s.checkoutBranch);
  const checkoutCommit = useRepositoryStore((s) => s.checkoutCommit);
  const loadStashDetails = useRepositoryStore((s) => s.loadStashDetails);
  const applyStash = useRepositoryStore((s) => s.applyStash);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const [localExpanded, setLocalExpanded] = useState(true);
  const [remoteExpanded, setRemoteExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [stashesExpanded, setStashesExpanded] = useState(true);

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const handleBranchActivate = useCallback(
    (branchList: typeof branches) => async (index: number) => {
      const branch = branchList[index];
      if (!branch) return;
      if (branch.target_hash) {
        selectAndScrollToCommit(branch.target_hash);
      }
      // Also offer checkout (skip if already HEAD)
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
    [selectAndScrollToCommit, checkoutBranch, showConfirm]
  );

  const handleBranchSecondaryActivate = useCallback(
    (branchList: typeof branches) => async (index: number) => {
      const branch = branchList[index];
      if (!branch || branch.is_head) return;
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

  const handleTagActivate = useCallback(
    async (index: number) => {
      const tag = tags[index];
      if (!tag) return;
      if (tag.target_hash) {
        selectAndScrollToCommit(tag.target_hash);
      }
      const confirmed = await showConfirm({
        title: "Checkout Tag",
        message: `Checkout tag "${tag.name}"? This will put you in detached HEAD state.`,
        confirmLabel: "Checkout",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        checkoutCommit(tag.target_hash);
      }
    },
    [tags, selectAndScrollToCommit, checkoutCommit, showConfirm]
  );

  const handleTagSecondaryActivate = useCallback(
    async (index: number) => {
      const tag = tags[index];
      if (!tag) return;
      const confirmed = await showConfirm({
        title: "Checkout Tag",
        message: `Checkout tag "${tag.name}"? This will put you in detached HEAD state.`,
        confirmLabel: "Checkout",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        checkoutCommit(tag.target_hash);
      }
    },
    [tags, checkoutCommit, showConfirm]
  );

  const handleStashActivate = useCallback(
    (index: number) => {
      const stash = stashes[index];
      if (stash) {
        loadStashDetails(stash.index);
        setActiveView("status");
      }
    },
    [stashes, loadStashDetails, setActiveView]
  );

  const handleStashSecondaryActivate = useCallback(
    async (index: number) => {
      const stash = stashes[index];
      if (!stash) return;
      const stashName = `stash@{${stash.index}}`;
      const confirmed = await showConfirm({
        title: "Apply Stash",
        message: `Apply "${stashName}"? This will restore the stashed changes to your working directory.`,
        confirmLabel: "Apply",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        applyStash(stash.index);
      }
    },
    [stashes, applyStash, showConfirm]
  );

  return (
    <div className="branch-tag-list flex flex-col">
      <CollapsibleSection
        title="Local Branches"
        count={localBranches.length}
        expanded={localExpanded}
        onToggle={() => setLocalExpanded(!localExpanded)}
      >
        <KeyboardList
          aria-label="Local Branches"
          onActivate={handleBranchActivate(localBranches)}
          onSecondaryActivate={handleBranchSecondaryActivate(localBranches)}
        >
          {localBranches.map((branch, i) => (
            <KeyboardList.Item key={branch.name} index={i}>
              <BranchItem branch={branch} />
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      </CollapsibleSection>

      <CollapsibleSection
        title="Remote Branches"
        count={remoteBranches.length}
        expanded={remoteExpanded}
        onToggle={() => setRemoteExpanded(!remoteExpanded)}
      >
        <KeyboardList
          aria-label="Remote Branches"
          onActivate={handleBranchActivate(remoteBranches)}
          onSecondaryActivate={handleBranchSecondaryActivate(remoteBranches)}
        >
          {remoteBranches.map((branch, i) => (
            <KeyboardList.Item key={branch.name} index={i}>
              <BranchItem branch={branch} />
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      </CollapsibleSection>

      <CollapsibleSection
        title="Tags"
        count={tags.length}
        expanded={tagsExpanded}
        onToggle={() => setTagsExpanded(!tagsExpanded)}
      >
        <KeyboardList
          aria-label="Tags"
          onActivate={handleTagActivate}
          onSecondaryActivate={handleTagSecondaryActivate}
        >
          {tags.map((tag, i) => (
            <KeyboardList.Item key={tag.name} index={i}>
              <TagItem tag={tag} />
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      </CollapsibleSection>

      <CollapsibleSection
        title="Stashes"
        count={stashes.length}
        expanded={stashesExpanded}
        onToggle={() => setStashesExpanded(!stashesExpanded)}
      >
        <KeyboardList
          aria-label="Stashes"
          onActivate={handleStashActivate}
          onSecondaryActivate={handleStashSecondaryActivate}
        >
          {stashes.map((stash, i) => (
            <KeyboardList.Item key={stash.index} index={i}>
              <StashItem stash={stash} />
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      </CollapsibleSection>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="collapsible-section border-border border-b">
      <YaggButton
        variant="menu-item"
        className="section-header text-text-secondary hover:text-text-primary px-3 py-2 text-xs font-semibold tracking-wide uppercase"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span
          className={clsx(
            "expand-icon mr-1 flex size-4 items-center justify-center transition-transform duration-150",
            expanded && "expanded rotate-90"
          )}
        >
          <ChevronIcon />
        </span>
        <span className="section-title flex-1 text-left">{title}</span>
        <span className="section-count bg-bg-tertiary text-2xs rounded-full px-1.5 py-px font-normal">
          {count}
        </span>
      </YaggButton>
      {expanded && <div className="section-content pb-1">{children}</div>}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M4.5 2L8.5 6L4.5 10V2Z" />
    </svg>
  );
}
