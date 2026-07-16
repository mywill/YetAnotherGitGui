import { create } from "zustand";

interface TerminalState {
  isOpen: boolean;
  sessionId: number | null;
  panelHeight: number;
  isConnected: boolean;
  /** Optional CWD override for the spawned terminal. When null, the terminal
   * spawns in the open repository's working directory. Used by "Open in
   * Terminal" from a worktree row. */
  cwd: string | null;

  toggleTerminal: () => void;
  openTerminal: () => void;
  closeTerminal: () => void;
  setSessionId: (id: number | null) => void;
  setPanelHeight: (height: number) => void;
  setConnected: (connected: boolean) => void;
  setCwd: (cwd: string | null) => void;
  openInCwd: (cwd: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  sessionId: null,
  panelHeight: 200,
  isConnected: false,
  cwd: null,

  toggleTerminal: () => set((s) => ({ isOpen: !s.isOpen, cwd: !s.isOpen ? s.cwd : null })),
  openTerminal: () => set({ isOpen: true }),
  closeTerminal: () => set({ isOpen: false, cwd: null }),
  setSessionId: (id) => set({ sessionId: id }),
  setPanelHeight: (height) => set({ panelHeight: Math.max(60, height) }),
  setConnected: (connected) => set({ isConnected: connected }),
  setCwd: (cwd) => set({ cwd }),
  openInCwd: (cwd) => set({ cwd, isOpen: true }),
}));
