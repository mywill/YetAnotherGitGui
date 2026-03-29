import { useCallback } from "react";
import { useTerminalStore } from "../../stores/terminalStore";
import { TerminalResizer } from "./TerminalResizer";
import { TerminalInstance } from "./TerminalInstance";

export function TerminalPanel() {
  const panelHeight = useTerminalStore((s) => s.panelHeight);
  const setPanelHeight = useTerminalStore((s) => s.setPanelHeight);
  const closeTerminal = useTerminalStore((s) => s.closeTerminal);

  const handleResize = useCallback(
    (delta: number) => {
      setPanelHeight(panelHeight + delta);
    },
    [panelHeight, setPanelHeight]
  );

  return (
    <div
      className="terminal-panel border-border flex shrink-0 flex-col border-t"
      style={{ height: panelHeight }}
    >
      <TerminalResizer onResize={handleResize} />
      <div className="terminal-header bg-bg-tertiary flex h-7 shrink-0 items-center justify-between px-3">
        <span className="text-text-secondary text-xs">Terminal</span>
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
  );
}
