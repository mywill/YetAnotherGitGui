import { create } from "zustand";

export type FilterCategory =
  | "all"
  | "commits"
  | "branches"
  | "tags"
  | "authors"
  | "files"
  | "stashes";

interface CommandPaletteState {
  isOpen: boolean;
  activeFilter: FilterCategory;

  open: () => void;
  close: () => void;
  toggleFilter: (filter: FilterCategory) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  isOpen: false,
  activeFilter: "all",

  open: () => set({ isOpen: true, activeFilter: "all" }),
  close: () => set({ isOpen: false, activeFilter: "all" }),
  toggleFilter: (filter) => {
    const current = get().activeFilter;
    set({ activeFilter: current === filter ? "all" : filter });
  },
}));
