import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { TerminalInstance } from "./TerminalInstance";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { mockStore } from "../../test/mockStores";
import type { RepositoryInfo } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));
vi.mock("../../stores/terminalStore", () => ({
  useTerminalStore: vi.fn(),
}));

const spawnTerminal = vi.fn();
const writeTerminal = vi.fn();
const resizeTerminal = vi.fn();
const killTerminal = vi.fn();
const onTerminalOutput = vi.fn();
const onTerminalExit = vi.fn();

vi.mock("../../services/terminal", () => ({
  spawnTerminal: (...args: unknown[]) => spawnTerminal(...args),
  writeTerminal: (...args: unknown[]) => writeTerminal(...args),
  resizeTerminal: (...args: unknown[]) => resizeTerminal(...args),
  killTerminal: (...args: unknown[]) => killTerminal(...args),
  onTerminalOutput: (...args: unknown[]) => onTerminalOutput(...args),
  onTerminalExit: (...args: unknown[]) => onTerminalExit(...args),
}));

const terminalInstance = {
  loadAddon: vi.fn(),
  open: vi.fn(),
  write: vi.fn(),
  onData: vi.fn(),
  dispose: vi.fn(),
  rows: 24,
  cols: 80,
};

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    loadAddon = terminalInstance.loadAddon;
    open = terminalInstance.open;
    write = terminalInstance.write;
    onData = terminalInstance.onData;
    dispose = terminalInstance.dispose;
    rows = terminalInstance.rows;
    cols = terminalInstance.cols;
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: class {},
}));

function setRepoPath(path: string | null) {
  const info: RepositoryInfo | null = path
    ? {
        path,
        current_branch: null,
        is_detached: false,
        remotes: [],
        head_hash: null,
        repo_state: "clean",
      }
    : null;
  mockStore(useRepositoryStore, { repositoryInfo: info });
}

const setSessionId = vi.fn();
const setConnected = vi.fn();

describe("TerminalInstance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore(useTerminalStore, { setSessionId, setConnected });
    spawnTerminal.mockResolvedValue(42);
    onTerminalOutput.mockResolvedValue(() => {});
    onTerminalExit.mockResolvedValue(() => {});
    terminalInstance.loadAddon.mockClear();
    terminalInstance.open.mockClear();
    terminalInstance.write.mockClear();
    terminalInstance.onData.mockClear();
    terminalInstance.dispose.mockClear();
  });

  it("renders a terminal container div", () => {
    setRepoPath("/repo");
    const { container } = render(<TerminalInstance />);
    expect(container.querySelector(".terminal-container")).toBeInTheDocument();
  });

  it("does not spawn a terminal when repoPath is null", () => {
    setRepoPath(null);
    render(<TerminalInstance />);
    expect(spawnTerminal).not.toHaveBeenCalled();
  });

  it("spawns a terminal with the repo path and registers listeners", async () => {
    setRepoPath("/repo");
    render(<TerminalInstance />);
    await waitFor(() => {
      expect(spawnTerminal).toHaveBeenCalledWith("/repo");
    });
    await waitFor(() => {
      expect(setSessionId).toHaveBeenCalledWith(42);
      expect(setConnected).toHaveBeenCalledWith(true);
    });
    expect(onTerminalOutput).toHaveBeenCalled();
    expect(onTerminalExit).toHaveBeenCalled();
    expect(resizeTerminal).toHaveBeenCalledWith(42, 24, 80);
  });

  it("writes terminal output for matching session id", async () => {
    setRepoPath("/repo");
    let outputHandler: ((p: { id: number; data: string }) => void) | null = null;
    onTerminalOutput.mockImplementation(async (cb) => {
      outputHandler = cb;
      return () => {};
    });
    render(<TerminalInstance />);
    await waitFor(() => expect(outputHandler).not.toBeNull());
    outputHandler!({ id: 42, data: "hello" });
    expect(terminalInstance.write).toHaveBeenCalledWith("hello");
  });

  it("ignores terminal output for a different session id", async () => {
    setRepoPath("/repo");
    let outputHandler: ((p: { id: number; data: string }) => void) | null = null;
    onTerminalOutput.mockImplementation(async (cb) => {
      outputHandler = cb;
      return () => {};
    });
    render(<TerminalInstance />);
    await waitFor(() => expect(outputHandler).not.toBeNull());
    terminalInstance.write.mockClear();
    outputHandler!({ id: 999, data: "other" });
    expect(terminalInstance.write).not.toHaveBeenCalled();
  });

  it("marks session disconnected on exit event", async () => {
    setRepoPath("/repo");
    let exitHandler: ((p: { id: number }) => void) | null = null;
    onTerminalExit.mockImplementation(async (cb) => {
      exitHandler = cb;
      return () => {};
    });
    render(<TerminalInstance />);
    await waitFor(() => expect(exitHandler).not.toBeNull());
    setConnected.mockClear();
    exitHandler!({ id: 42 });
    expect(setConnected).toHaveBeenCalledWith(false);
    expect(terminalInstance.write).toHaveBeenCalledWith("\r\n[Process exited]\r\n");
  });

  it("forwards user input to writeTerminal", async () => {
    setRepoPath("/repo");
    let dataHandler: ((d: string) => void) | null = null;
    terminalInstance.onData.mockImplementation((cb) => {
      dataHandler = cb;
    });
    render(<TerminalInstance />);
    await waitFor(() => expect(dataHandler).not.toBeNull());
    dataHandler!("ls\n");
    expect(writeTerminal).toHaveBeenCalledWith(42, "ls\n");
  });

  it("writes a failure message when spawnTerminal rejects", async () => {
    setRepoPath("/repo");
    spawnTerminal.mockRejectedValueOnce(new Error("boom"));
    render(<TerminalInstance />);
    await waitFor(() => {
      expect(terminalInstance.write).toHaveBeenCalledWith("[Failed to start terminal]\r\n");
    });
  });

  it("kills the session and clears connected state on unmount", async () => {
    setRepoPath("/repo");
    const { unmount } = render(<TerminalInstance />);
    await waitFor(() => expect(setSessionId).toHaveBeenCalledWith(42));
    unmount();
    await waitFor(() => {
      expect(killTerminal).toHaveBeenCalledWith(42);
      expect(setConnected).toHaveBeenLastCalledWith(false);
      expect(setSessionId).toHaveBeenLastCalledWith(null);
      expect(terminalInstance.dispose).toHaveBeenCalled();
    });
  });

  it("kills a newly spawned session if disposed before init completes", async () => {
    setRepoPath("/repo");
    let resolveSpawn: (id: number) => void = () => {};
    spawnTerminal.mockImplementationOnce(() => new Promise<number>((r) => (resolveSpawn = r)));
    const { unmount } = render(<TerminalInstance />);
    unmount();
    resolveSpawn(99);
    await waitFor(() => {
      expect(killTerminal).toHaveBeenCalledWith(99);
    });
  });
});
