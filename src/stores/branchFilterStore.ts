import { create } from "zustand";

interface BranchFilterState {
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
}

export const useBranchFilterStore = create<BranchFilterState>((set) => ({
  query: "",
  setQuery: (q) => set({ query: q }),
  clear: () => set({ query: "" }),
}));
