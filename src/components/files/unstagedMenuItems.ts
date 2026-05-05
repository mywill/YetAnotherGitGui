import type { ContextMenuItem } from "../common/ContextMenu";

export type ConflictResolution = "ours" | "theirs" | "both";

interface UnstagedHandlers {
  stageFile: (path: string) => void;
  revertFile: (path: string) => void;
  deleteFile: (path: string) => void;
  deleteFiles: (paths: string[]) => void;
  resolveConflict: (path: string, choice: ConflictResolution) => void;
}

export function getConflictMenuItems(
  filePath: string,
  handlers: Pick<UnstagedHandlers, "stageFile" | "resolveConflict">
): ContextMenuItem[] {
  return [
    { label: "Accept Ours", onClick: () => handlers.resolveConflict(filePath, "ours") },
    { label: "Accept Theirs", onClick: () => handlers.resolveConflict(filePath, "theirs") },
    { label: "Accept Both", onClick: () => handlers.resolveConflict(filePath, "both") },
    { label: "Mark Resolved (stage)", onClick: () => handlers.stageFile(filePath) },
  ];
}

export function getUnstagedFileMenuItems(
  filePath: string,
  selectedPaths: string[],
  handlers: Pick<UnstagedHandlers, "revertFile" | "deleteFile" | "deleteFiles">
): ContextMenuItem[] {
  const isMultiSelected = selectedPaths.length > 1 && selectedPaths.includes(filePath);
  if (isMultiSelected) {
    return [
      { label: "Discard changes", onClick: () => handlers.revertFile(filePath) },
      {
        label: `Delete ${selectedPaths.length} files`,
        onClick: () => handlers.deleteFiles(selectedPaths),
      },
    ];
  }
  return [
    { label: "Discard changes", onClick: () => handlers.revertFile(filePath) },
    { label: "Delete file", onClick: () => handlers.deleteFile(filePath) },
  ];
}
