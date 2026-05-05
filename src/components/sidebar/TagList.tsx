import { useCallback } from "react";
import type { TagInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { TagItem } from "./TagItem";
import { CollapsibleFilteredSection } from "./CollapsibleFilteredSection";

const SECTION_KEY_TAGS = "sidebar.tags";

interface TagListProps {
  filterQuery: string;
}

export function TagList({ filterQuery }: TagListProps) {
  const tags = useRepositoryStore((s) => s.tags);
  const checkoutCommit = useRepositoryStore((s) => s.checkoutCommit);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const expanded = useSettingsStore((s) => s.sectionExpanded[SECTION_KEY_TAGS] ?? false);
  const setSectionExpanded = useSettingsStore((s) => s.setSectionExpanded);

  const checkoutWithConfirm = useCallback(
    async (tag: TagInfo) => {
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
    [checkoutCommit, showConfirm]
  );

  const handleActivate = useCallback(
    async (tag: TagInfo) => {
      if (tag.target_hash) selectAndScrollToCommit(tag.target_hash);
      await checkoutWithConfirm(tag);
    },
    [selectAndScrollToCommit, checkoutWithConfirm]
  );

  const renderTag = useCallback((t: TagInfo) => <TagItem tag={t} />, []);

  return (
    <CollapsibleFilteredSection<TagInfo>
      title="Tags"
      items={tags}
      expanded={expanded}
      onToggle={() => setSectionExpanded(SECTION_KEY_TAGS, !expanded)}
      filterQuery={filterQuery}
      listAriaLabel="Tags"
      onActivate={handleActivate}
      onSecondaryActivate={checkoutWithConfirm}
      renderItem={renderTag}
      emptyLabel="No tags"
    />
  );
}
