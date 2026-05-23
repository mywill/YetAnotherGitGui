import { IconAlertTriangle } from "@tabler/icons-react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { YaggButton } from "./YaggButton";

const STATE_CONFIG: Record<string, { label: string; hint: string }> = {
  merge: { label: "Merge in progress", hint: "git merge --abort" },
  rebase: { label: "Rebase in progress", hint: "git rebase --abort" },
  "cherry-pick": {
    label: "Cherry-pick in progress",
    hint: "git cherry-pick --abort",
  },
  revert: { label: "Revert in progress", hint: "git revert --abort" },
  bisect: { label: "Bisect in progress", hint: "git bisect reset" },
};

const ACTIONABLE_STATES = new Set(["rebase", "cherry-pick", "revert"]);

const ABORT_LABELS: Record<string, string> = {
  rebase: "Abort rebase?",
  "cherry-pick": "Abort cherry-pick?",
  revert: "Abort revert?",
};

export function RepoStateBanner() {
  const repoState = useRepositoryStore((s) => s.repositoryInfo?.repo_state);
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const abortOperation = useRepositoryStore((s) => s.abortOperation);
  const continueOperation = useRepositoryStore((s) => s.continueOperation);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  if (!repoState || repoState === "clean") {
    return null;
  }

  const config = STATE_CONFIG[repoState];
  if (!config) {
    return null;
  }

  const conflictCount = fileStatuses?.unstaged.filter((f) => f.status === "conflicted").length ?? 0;
  const isActionable = ACTIONABLE_STATES.has(repoState);
  const canContinue = isActionable && conflictCount === 0;

  const handleAbort = async () => {
    const confirmed = await showConfirm({
      title: ABORT_LABELS[repoState] ?? "Abort?",
      message:
        "This discards any in-progress conflict resolution and resets the working tree to HEAD. This cannot be undone.",
      confirmLabel: "Abort",
    });
    if (confirmed) {
      await abortOperation();
    }
  };

  const handleContinue = () => continueOperation();

  return (
    <div
      className="repo-state-banner bg-warning-bg text-warning-text flex items-center gap-2 px-3 py-1.5 text-xs"
      role="status"
      aria-live="polite"
    >
      <IconAlertTriangle size={14} stroke={2} className="text-warning shrink-0" aria-hidden />
      <span className="font-semibold">{config.label}</span>
      {conflictCount > 0 && (
        <span className="text-warning-text/90">
          — {conflictCount} conflicted file{conflictCount > 1 ? "s" : ""}
        </span>
      )}
      {isActionable ? (
        <div className="ml-auto flex items-center gap-1">
          <YaggButton
            className="bg-bg-panel hover:bg-bg-hover rounded px-2 py-0.5 text-xs"
            onClick={handleAbort}
          >
            Abort
          </YaggButton>
          <YaggButton
            className="bg-bg-panel hover:bg-bg-hover rounded px-2 py-0.5 text-xs"
            disabled={!canContinue}
            onClick={handleContinue}
            title={canContinue ? undefined : "Resolve all conflicts first"}
          >
            Continue
          </YaggButton>
        </div>
      ) : (
        <span className="text-warning-text/70">
          — resolve or run{" "}
          <code className="bg-warning-bg rounded px-1 font-mono brightness-125">{config.hint}</code>
        </span>
      )}
    </div>
  );
}
