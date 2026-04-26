import clsx from "clsx";
import { IconFileDiff, IconHistory, IconGitBranch, IconStack2 } from "@tabler/icons-react";
import { useSelectionStore } from "../../stores/selectionStore";
import type { ViewType } from "../../stores/selectionStore";

const RAIL_ITEMS: { id: ViewType; label: string; shortcut: string }[] = [
  { id: "status", label: "Working Copy", shortcut: "" },
  { id: "history", label: "History", shortcut: "⌘/⌃L" },
  { id: "branches", label: "Branches & Tags", shortcut: "" },
  { id: "stashes", label: "Stashes", shortcut: "" },
];

export const IconRail = () => {
  const activeView = useSelectionStore((s) => s.activeView);
  const setActiveView = useSelectionStore((s) => s.setActiveView);

  return (
    <nav
      className="icon-rail bg-bg-panel border-border w-rail flex shrink-0 flex-col items-center border-r pt-2"
      role="tablist"
      aria-label="Navigation"
    >
      {RAIL_ITEMS.map((item) => (
        <button
          key={item.id}
          id={`rail-tab-${item.id}`}
          role="tab"
          aria-selected={activeView === item.id}
          aria-controls="workspace-center"
          aria-label={item.label}
          title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
          className={clsx(
            "rail-item relative flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-100",
            "hover:bg-bg-hover focus-ring",
            activeView === item.id ? "text-text-primary" : "text-text-muted"
          )}
          onClick={() => setActiveView(item.id)}
        >
          {activeView === item.id && (
            <span className="bg-accent-magenta absolute top-1 bottom-1 left-0 w-0.5 rounded-r" />
          )}
          <RailIcon id={item.id} />
        </button>
      ))}
    </nav>
  );
};

const RailIcon = ({ id }: { id: ViewType }) => {
  const props = { size: 16, stroke: 1.75, "aria-hidden": true } as const;
  switch (id) {
    case "status":
      return <IconFileDiff {...props} />;
    case "history":
      return <IconHistory {...props} />;
    case "branches":
      return <IconGitBranch {...props} />;
    case "stashes":
      return <IconStack2 {...props} />;
  }
};
