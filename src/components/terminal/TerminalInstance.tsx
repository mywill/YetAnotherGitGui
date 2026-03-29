import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import {
  spawnTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  onTerminalOutput,
  onTerminalExit,
} from "../../services/terminal";
import { useTerminalStore } from "../../stores/terminalStore";
import { useRepositoryStore } from "../../stores/repositoryStore";

export function TerminalInstance() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<number | null>(null);

  const repoPath = useRepositoryStore((s) => s.repositoryInfo?.path ?? null);
  const setSessionId = useTerminalStore((s) => s.setSessionId);
  const setConnected = useTerminalStore((s) => s.setConnected);

  useEffect(() => {
    if (!containerRef.current || !repoPath) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#cccccc",
        selectionBackground: "#063350",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Fit after a frame so the container has dimensions
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let disposed = false;

    async function init() {
      if (disposed || !repoPath) return;

      try {
        const id = await spawnTerminal(repoPath);
        if (disposed) {
          killTerminal(id);
          return;
        }
        sessionIdRef.current = id;
        setSessionId(id);
        setConnected(true);

        unlistenOutput = await onTerminalOutput((payload) => {
          if (payload.id === sessionIdRef.current && terminalRef.current) {
            terminalRef.current.write(payload.data);
          }
        });

        unlistenExit = await onTerminalExit((payload) => {
          if (payload.id === sessionIdRef.current) {
            setConnected(false);
            terminalRef.current?.write("\r\n[Process exited]\r\n");
          }
        });

        terminal.onData((data) => {
          if (sessionIdRef.current !== null) {
            writeTerminal(sessionIdRef.current, data);
          }
        });

        // Send initial size
        resizeTerminal(id, terminal.rows, terminal.cols);
      } catch {
        terminal.write("[Failed to start terminal]\r\n");
      }
    }

    init();

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        if (sessionIdRef.current !== null) {
          resizeTerminal(sessionIdRef.current, terminalRef.current.rows, terminalRef.current.cols);
        }
      }
    });
    observer.observe(containerRef.current);

    return () => {
      disposed = true;
      observer.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      if (sessionIdRef.current !== null) {
        killTerminal(sessionIdRef.current);
        sessionIdRef.current = null;
      }
      setSessionId(null);
      setConnected(false);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [repoPath, setSessionId, setConnected]);

  return <div ref={containerRef} className="terminal-container flex-1 overflow-hidden" />;
}
