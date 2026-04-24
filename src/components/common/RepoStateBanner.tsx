import { IconAlertTriangle } from "@tabler/icons-react";
import { useRepositoryStore } from "../../stores/repositoryStore";

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

export function RepoStateBanner() {
  const repoState = useRepositoryStore((s) => s.repositoryInfo?.repo_state);
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);

  if (!repoState || repoState === "clean") {
    return null;
  }

  const config = STATE_CONFIG[repoState];
  if (!config) {
    return null;
  }

  const conflictCount = fileStatuses?.unstaged.filter((f) => f.status === "conflicted").length ?? 0;

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
      <span className="text-warning-text/70">
        — resolve or run{" "}
        <code className="bg-warning-bg rounded px-1 font-mono brightness-125">{config.hint}</code>
      </span>
    </div>
  );
}
