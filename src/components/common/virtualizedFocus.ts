import { createContext, useContext } from "react";

export interface VirtualizedFocusContextValue {
  focusedIndex: number;
}

export const VirtualizedFocusContext = createContext<VirtualizedFocusContextValue>({
  focusedIndex: -1,
});

export function useVirtualizedFocus() {
  return useContext(VirtualizedFocusContext);
}
