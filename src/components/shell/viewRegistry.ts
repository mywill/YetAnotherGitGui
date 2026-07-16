import type { ComponentType } from "react";
import type { Icon } from "@tabler/icons-react";
import {
  IconFileDiff,
  IconHistory,
  IconGitBranch,
  IconStack2,
  IconBrush,
  IconTrees,
} from "@tabler/icons-react";
import type { ViewType } from "../../stores/selectionStore";
import { StatusView } from "../views/StatusView";
import { HistoryView } from "../views/HistoryView";
import { BranchesView } from "../views/BranchesView";
import { StashesView } from "./StashesView";
import { CleanupView } from "../views/CleanupView";
import { WorktreesView } from "../worktrees/WorktreesView";

export interface ViewDef {
  id: ViewType;
  label: string;
  icon: Icon;
  component: ComponentType;
  shortcut?: string;
}

export const VIEWS: ViewDef[] = [
  { id: "status", label: "Working Copy", icon: IconFileDiff, component: StatusView },
  { id: "history", label: "History", icon: IconHistory, component: HistoryView, shortcut: "⌘/⌃L" },
  { id: "branches", label: "Branches & Tags", icon: IconGitBranch, component: BranchesView },
  { id: "stashes", label: "Stashes", icon: IconStack2, component: StashesView },
  { id: "worktrees", label: "Worktrees", icon: IconTrees, component: WorktreesView },
  { id: "cleanup", label: "Cleanup", icon: IconBrush, component: CleanupView },
];

const VIEW_BY_ID = new Map(VIEWS.map((v) => [v.id, v]));

export const getView = (id: ViewType): ViewDef | undefined => VIEW_BY_ID.get(id);
