import clsx from "clsx";
import { useSelectionStore } from "../../stores/selectionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { VIEWS } from "./viewRegistry";

const ICON_SIZE_BY_DENSITY = { compact: 16, comfortable: 18, spacious: 20 } as const;

export const IconRail = () => {
  const activeView = useSelectionStore((s) => s.activeView);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const density = useSettingsStore((s) => s.density);
  const iconSize = ICON_SIZE_BY_DENSITY[density];

  return (
    <nav
      className="icon-rail bg-bg-rail border-border w-rail gap-card-y pt-card-y flex shrink-0 flex-col items-center border-r"
      role="tablist"
      aria-label="Navigation"
    >
      {VIEWS.map(({ id, label, icon: Icon, shortcut }) => (
        <button
          key={id}
          id={`rail-tab-${id}`}
          role="tab"
          aria-selected={activeView === id}
          aria-controls="workspace-center"
          aria-label={label}
          title={shortcut ? `${label} (${shortcut})` : label}
          className={clsx(
            "rail-item size-nav-btn relative flex cursor-pointer items-center justify-center rounded-md transition-colors duration-100",
            "hover:bg-bg-hover focus-ring",
            activeView === id ? "text-text-primary" : "text-text-muted"
          )}
          onClick={() => setActiveView(id)}
        >
          {activeView === id && (
            <span className="bg-accent-magenta absolute top-1 bottom-1 left-0 w-0.5 rounded-r" />
          )}
          <Icon size={iconSize} stroke={1.75} aria-hidden />
        </button>
      ))}
    </nav>
  );
};
