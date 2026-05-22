import type { BulkResult } from "../types";
import type { ViewType } from "../stores/selectionStore";
import { useNotificationStore } from "../stores/notificationStore";
import { cleanErrorMessage } from "./errorMessages";
import { formatList } from "./dialogText";

type ShowConfirm = (opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) => Promise<boolean>;

type SetActiveView = (view: ViewType) => void;

export interface QuickCleanupSpec<T> {
  /** Fetch the live list of candidate items for this quick action. */
  fetchCandidates: () => Promise<T[]>;
  /** Toast shown when the candidate list is empty. */
  emptyMessage: string;
  /** Compute dialog title from the candidate count (e.g. singular vs plural). */
  confirmTitle: (count: number) => string;
  /**
   * Build the body of the confirm dialog. Receives the candidates so callers
   * can render rich previews; helper passes a pre-formatted bullet list as a
   * convenience for the simple "names only" case.
   */
  confirmMessage: (candidates: T[], bulletList: string) => string;
  /** Label for the confirm button (e.g. "Delete" or "Drop"). */
  confirmLabel: string;
  /** Singular/plural pair for the "Deleted N branch(es)" success toast. */
  itemNoun: { singular: string; plural: string };
  /** Verb to use in toasts ("Deleted", "Dropped"). */
  pastTenseVerb: string;
  /** Short verb for the failure toast ("delete", "drop"). */
  failVerb: string;
  /** Project each candidate to a string for the default bullet list. */
  formatItemForDialog: (item: T) => string;
  /** Run the bulk backend call. */
  runBulk: (candidates: T[]) => Promise<BulkResult[]>;
  /** Refresh whatever sidebar/store data this op affected. */
  refresh: () => Promise<void>;
  /**
   * On mixed success/failure, optionally jump to this view so the user can see
   * the per-item failure list. Omit to stay put.
   */
  mixedFailureFallbackView?: ViewType;
  setRunning: (v: boolean) => void;
  showConfirm: ShowConfirm;
  setActiveView: SetActiveView;
}

/**
 * Shared driver for the "find candidates → confirm → bulk run → toast →
 * refresh" pattern used by the Stashes and Branches quick-action buttons.
 *
 * Centralizes the three result branches (all-success / all-fail / mixed)
 * plus the "jump to Cleanup view" escape hatch when the simple toast can't
 * communicate per-item failures.
 */
export async function runQuickCleanup<T>(spec: QuickCleanupSpec<T>): Promise<void> {
  const {
    fetchCandidates,
    emptyMessage,
    confirmTitle,
    confirmMessage,
    confirmLabel,
    itemNoun,
    pastTenseVerb,
    failVerb,
    formatItemForDialog,
    runBulk,
    refresh,
    mixedFailureFallbackView,
    setRunning,
    showConfirm,
    setActiveView,
  } = spec;

  const notif = useNotificationStore.getState();
  setRunning(true);
  try {
    const candidates = await fetchCandidates();
    if (candidates.length === 0) {
      notif.showSuccess(emptyMessage);
      return;
    }
    const bullets = formatList(candidates.map(formatItemForDialog));
    const confirmed = await showConfirm({
      title: confirmTitle(candidates.length),
      message: confirmMessage(candidates, bullets),
      confirmLabel,
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    const results = await runBulk(candidates);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;
    const noun = (n: number) => (n === 1 ? itemNoun.singular : itemNoun.plural);

    if (failed === 0) {
      notif.showSuccess(`${pastTenseVerb} ${succeeded} ${noun(succeeded)}.`);
    } else if (succeeded === 0) {
      const firstErr = results.find((r) => !r.success)?.error ?? "Unknown error";
      notif.showError(`Failed to ${failVerb}: ${firstErr}`);
    } else {
      notif.showError(
        `${pastTenseVerb} ${succeeded}, failed ${failed}. Open the Cleanup view for details.`
      );
      if (mixedFailureFallbackView) {
        setActiveView(mixedFailureFallbackView);
      }
    }
    await refresh();
  } catch (err) {
    notif.showError(cleanErrorMessage(String(err)));
  } finally {
    setRunning(false);
  }
}
