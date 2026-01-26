import { useState } from "react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { BranchItem } from "./BranchItem";
import { TagItem } from "./TagItem";
import { StashItem } from "./StashItem";
import "./BranchTagList.css";

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
    <div className="branch-tag-list">
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
    <div className="collapsible-section">
      <button className="section-header" onClick={onToggle} aria-expanded={expanded}>
        <span className={`expand-icon ${expanded ? "expanded" : ""}`}>
          <ChevronIcon />
        </span>
        <span className="section-title">{title}</span>
        <span className="section-count">{count}</span>
      </button>
      {expanded && <div className="section-content">{children}</div>}
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
