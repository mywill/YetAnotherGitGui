import type { ContextMenuItem } from "../common/ContextMenu";
import type { RefInfo } from "../../types";

const buildBranchMenuItems = (
  refs: RefInfo[],
  onCopyRefName: (name: string) => () => void
): ContextMenuItem[] => {
  const branches = refs.filter((r) => r.ref_type !== "tag");
  if (branches.length === 0) return [];
  if (branches.length === 1) {
    return [{ label: "Copy branch name", onClick: onCopyRefName(branches[0].name) }];
  }
  return [
    {
      label: "Copy branch name",
      children: branches.map((r) => ({
        label: r.name,
        onClick: onCopyRefName(r.name),
      })),
    },
  ];
};

const buildTagMenuItems = (
  refs: RefInfo[],
  onCopyRefName: (name: string) => () => void
): ContextMenuItem[] => {
  const tags = refs.filter((r) => r.ref_type === "tag");
  if (tags.length === 0) return [];
  if (tags.length === 1) {
    return [{ label: "Copy tag name", onClick: onCopyRefName(tags[0].name) }];
  }
  return [
    {
      label: "Copy tag name",
      children: tags.map((r) => ({
        label: r.name,
        onClick: onCopyRefName(r.name),
      })),
    },
  ];
};

export const buildRefMenuItems = (
  refs: RefInfo[],
  onCopyRefName: (name: string) => () => void
): ContextMenuItem[] => {
  return [...buildBranchMenuItems(refs, onCopyRefName), ...buildTagMenuItems(refs, onCopyRefName)];
};
