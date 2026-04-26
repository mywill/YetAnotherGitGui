import { useCallback } from "react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { StashItem } from "../sidebar/StashItem";
import { KeyboardList } from "../common/KeyboardList";
import { DetailsPanelEmpty } from "../common/DetailsPanelStates";

export const StashList = () => {
  const stashes = useRepositoryStore((s) => s.stashes);
  const loadStashDetails = useRepositoryStore((s) => s.loadStashDetails);
  const applyStash = useRepositoryStore((s) => s.applyStash);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const handleActivate = useCallback(
    (index: number) => {
      const stash = stashes[index];
      if (stash) {
        loadStashDetails(stash.index);
      }
    },
    [stashes, loadStashDetails]
  );

  const handleSecondaryActivate = useCallback(
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

  if (stashes.length === 0) {
    return <DetailsPanelEmpty className="stash-list-empty flex-1" label="No stashes" />;
  }

  return (
    <div className="stash-list bg-bg-canvas flex-1 overflow-y-auto">
      <KeyboardList
        aria-label="Stashes"
        onActivate={handleActivate}
        onSecondaryActivate={handleSecondaryActivate}
      >
        {stashes.map((stash, i) => (
          <KeyboardList.Item key={stash.index} index={i}>
            <StashItem stash={stash} />
          </KeyboardList.Item>
        ))}
      </KeyboardList>
    </div>
  );
};
