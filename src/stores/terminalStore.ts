import { create } from "zustand";

interface TerminalState {
  isOpen: boolean;
  sessionId: number | null;
  panelHeight: number;
  isConnected: boolean;

  toggleTerminal: () => void;
  openTerminal: () => void;
  closeTerminal: () => void;
  setSessionId: (id: number | null) => void;
  setPanelHeight: (height: number) => void;
  setConnected: (connected: boolean) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  sessionId: null,
  panelHeight: 200,
  isConnected: false,

  toggleTerminal: () => set((s) => ({ isOpen: !s.isOpen })),
  openTerminal: () => set({ isOpen: true }),
  closeTerminal: () => set({ isOpen: false }),
  setSessionId: (id) => set({ sessionId: id }),
  setPanelHeight: (height) => set({ panelHeight: Math.max(100, Math.min(600, height)) }),
  setConnected: (connected) => set({ isConnected: connected }),
}));
