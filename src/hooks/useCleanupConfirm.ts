import { useCallback } from "react";
import { useCleanupStore, type CleanupCategory } from "../stores/cleanupStore";
import { useDialogStore } from "../stores/dialogStore";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function useCleanupConfirm(
  category: CleanupCategory,
  buildDialog: (selectedCount: number, selected: Set<string>) => ConfirmOptions
): () => void {
  const data = useCleanupStore((s) => s[category]);
  const runCategory = useCleanupStore((s) => s.runCategory);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  return useCallback(() => {
    const selectedCount = data.selected.size;
    if (selectedCount === 0) return;
    const dialog = buildDialog(selectedCount, data.selected);
    confirmAndRun({ selectedCount, dialog, showConfirm, runCategory, category });
  }, [data.selected, runCategory, showConfirm, category, buildDialog]);
}

async function confirmAndRun(args: {
  selectedCount: number;
  dialog: ConfirmOptions;
  showConfirm: (cfg: ConfirmOptions) => Promise<boolean>;
  runCategory: (c: CleanupCategory) => Promise<void>;
  category: CleanupCategory;
}) {
  const confirmed = await args.showConfirm(args.dialog);
  if (confirmed) await args.runCategory(args.category);
}
