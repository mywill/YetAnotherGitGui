import { useState } from "react";
import clsx from "clsx";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { BranchItem } from "./BranchItem";
import { TagItem } from "./TagItem";
import { StashItem } from "./StashItem";

export function BranchTagList() {
  const branches = useRepositoryStore((s) => s.branches);
  const tags = useRepositoryStore((s) => s.tags);
  const stashes = useRepositoryStore((s) => s.stashes);

  const [localExpanded, setLocalExpanded] = useState(true);
  const [remoteExpanded, setRemoteExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [stashesExpanded, setStashesExpanded] = useState(true);

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  return (
    <div className="branch-tag-list flex flex-col">
      <CollapsibleSection
        title="Local Branches"
        count={localBranches.length}
        expanded={localExpanded}
        onToggle={() => setLocalExpanded(!localExpanded)}
      >
        {localBranches.map((branch) => (
          <BranchItem key={branch.name} branch={branch} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Remote Branches"
        count={remoteBranches.length}
        expanded={remoteExpanded}
        onToggle={() => setRemoteExpanded(!remoteExpanded)}
      >
        {remoteBranches.map((branch) => (
          <BranchItem key={branch.name} branch={branch} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Tags"
        count={tags.length}
        expanded={tagsExpanded}
        onToggle={() => setTagsExpanded(!tagsExpanded)}
      >
        {tags.map((tag) => (
          <TagItem key={tag.name} tag={tag} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Stashes"
        count={stashes.length}
        expanded={stashesExpanded}
        onToggle={() => setStashesExpanded(!stashesExpanded)}
      >
        {stashes.map((stash) => (
          <StashItem key={stash.index} stash={stash} />
        ))}
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
      <button
        className="section-header text-text-secondary hover:bg-bg-hover hover:text-text-primary flex w-full items-center border-none bg-transparent px-3 py-2 text-xs font-semibold tracking-wide uppercase transition-colors duration-150"
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
      </button>
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
