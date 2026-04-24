import { useCallback } from "react";
import { useTerminalStore } from "../../stores/terminalStore";
import { YaggResizer } from "../common/YaggResizer";
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
          <button
            className="terminal-close text-text-muted hover:text-text-primary cursor-pointer text-xs"
            onClick={closeTerminal}
            aria-label="Close terminal"
          >
            ✕
          </button>
        </div>
        <TerminalInstance />
      </div>
    </>
  );
}
