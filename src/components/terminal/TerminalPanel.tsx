import { useCallback } from "react";
import { IconX } from "@tabler/icons-react";
import { useTerminalStore } from "../../stores/terminalStore";
import { YaggResizer } from "../common/YaggResizer";
import { YaggButton } from "../common/YaggButton";
import { TerminalInstance } from "./TerminalInstance";

const TERMINAL_DEFAULT = 200;
const TERMINAL_MIN = 60;
const TERMINAL_MAX = 100000;

export function TerminalPanel() {
  const panelHeight = useTerminalStore((s) => s.panelHeight);
  const setPanelHeight = useTerminalStore((s) => s.setPanelHeight);
  const closeTerminal = useTerminalStore((s) => s.closeTerminal);

  const handleResize = useCallback(
    (next: number) => {
      setPanelHeight(next);
    },
    [setPanelHeight]
  );

  return (
    <>
      <YaggResizer
        orientation="horizontal"
        size={panelHeight}
        onSizeChange={handleResize}
        min={TERMINAL_MIN}
        max={TERMINAL_MAX}
        defaultSize={TERMINAL_DEFAULT}
        ariaLabel="Resize terminal panel"
        panelId="terminal-panel"
        panelSide="down"
      />
      <div
        id="terminal-panel"
        className="terminal-panel border-border flex shrink-0 flex-col border-t"
        style={{ height: panelHeight }}
      >
        <div className="terminal-header bg-bg-well flex h-7 shrink-0 items-center justify-between px-3">
          <span className="text-text-muted text-xs">Terminal</span>
          <YaggButton
            variant="ghost"
            className="terminal-close border-none bg-transparent p-1"
            onClick={closeTerminal}
            aria-label="Close terminal"
          >
            <IconX size={12} stroke={2} aria-hidden />
          </YaggButton>
        </div>
        <TerminalInstance />
      </div>
    </>
  );
}
