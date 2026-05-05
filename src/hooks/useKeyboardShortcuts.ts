import { useEffect } from "react";

export interface ShortcutHandler {
  /** Key value (e.g. "F5", "k", "`"). Compared case-insensitively. */
  key: string;
  /** Require Cmd (mac) or Ctrl (other). Default false. */
  mod?: boolean;
  /** Require Shift. Default false (also rejects shift if true is not set). */
  shift?: boolean;
  /** Require Alt. Default false. */
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  /** When true (default), shortcut is suppressed if focus is inside the terminal. */
  suppressInTerminal?: boolean;
}

const isInTerminal = () => Boolean(document.activeElement?.closest(".xterm"));

const matches = (e: KeyboardEvent, s: ShortcutHandler) => {
  if (e.key.toLowerCase() !== s.key.toLowerCase()) return false;
  const wantMod = !!s.mod;
  const hasMod = e.ctrlKey || e.metaKey;
  if (wantMod !== hasMod) return false;
  if (Boolean(s.shift) !== e.shiftKey) return false;
  if (Boolean(s.alt) !== e.altKey) return false;
  return true;
};

/**
 * Register multiple keyboard shortcuts in one effect.
 *
 * Pass a stable `shortcuts` array (e.g. memoized with `useMemo`) — the effect
 * re-subscribes whenever the array reference changes.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inTerminal = isInTerminal();
      for (const s of shortcuts) {
        if (s.suppressInTerminal !== false && inTerminal) continue;
        if (matches(e, s)) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}
