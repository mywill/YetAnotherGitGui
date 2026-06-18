import { useCallback, useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { StashItem } from "../sidebar/StashItem";
import { KeyboardList } from "../common/KeyboardList";
import { DetailsPanelEmpty, DetailsPanelLoading } from "../common/DetailsPanelStates";
import { SectionActionButton } from "../files/SectionHeader";
import { STASH_DAYS_OLD } from "../../stores/cleanupStore";
import { buildStashDropMessage } from "../../utils/dialogText";
import { runQuickCleanup } from "../../utils/cleanupActions";
import * as git from "../../services/git";
import type { StashInfo } from "../../types";

export const StashList = () => {
  const stashes = useRepositoryStore((s) => s.stashes);
  const refsLoading = useRepositoryStore((s) => s.refsLoading);
  const loadStashDetails = useRepositoryStore((s) => s.loadStashDetails);
  const loadStashes = useRepositoryStore((s) => s.loadStashes);
  const applyStash = useRepositoryStore((s) => s.applyStash);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const [running, setRunning] = useState(false);

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

  const handleDropOld = () =>
    runQuickCleanup<StashInfo>({
      fetchCandidates: () => git.listOldStashes(STASH_DAYS_OLD),
      emptyMessage: `No stashes older than ${STASH_DAYS_OLD} days.`,
      confirmTitle: (n) => (n === 1 ? "Drop stash" : "Drop stashes"),
      confirmMessage: (candidates) => buildStashDropMessage(candidates),
      confirmLabel: "Drop",
      itemNoun: { singular: "stash", plural: "stashes" },
      pastTenseVerb: "Dropped",
      failVerb: "drop",
      formatItemForDialog: (s) => `stash@{${s.index}} — ${s.message}`,
      runBulk: (candidates) => git.dropStashes(candidates.map((s) => s.index)),
      refresh: () => loadStashes(),
      mixedFailureFallbackView: "cleanup",
      setRunning,
      showConfirm,
      setActiveView,
    });

  return (
    <div className="stash-list-container flex flex-1 flex-col overflow-hidden">
      {stashes.length > 0 && (
        <div className="border-border flex items-center justify-end gap-2 border-b px-3 py-1.5">
          <SectionActionButton
            onClick={handleDropOld}
            title={`Find and drop stashes older than ${STASH_DAYS_OLD} days`}
            ariaLabel={`Drop stashes older than ${STASH_DAYS_OLD} days`}
            disabled={running}
          >
            <IconTrash size={12} stroke={2} aria-hidden />
            <span>{running ? "Dropping…" : `Drop stashes older than ${STASH_DAYS_OLD} days`}</span>
          </SectionActionButton>
        </div>
      )}
      {stashes.length === 0 ? (
        refsLoading ? (
          <DetailsPanelLoading className="stash-list-empty flex-1" label="Loading stashes..." />
        ) : (
          <DetailsPanelEmpty className="stash-list-empty flex-1" label="No stashes" />
        )
      ) : (
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
      )}
    </div>
  );
};
