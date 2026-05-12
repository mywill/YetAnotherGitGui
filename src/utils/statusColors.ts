export interface StatusColor {
  color: string;
  bg: string;
}

const mix = (cssVar: string): string =>
  `color-mix(in srgb, var(${cssVar}) var(--badge-bg-mix), transparent)`;

export const STATUS_COLORS: Record<string, StatusColor> = {
  modified: { color: "var(--color-status-modified)", bg: mix("--color-status-modified") },
  added: { color: "var(--color-status-added)", bg: mix("--color-status-added") },
  deleted: { color: "var(--color-status-deleted)", bg: mix("--color-status-deleted") },
  renamed: { color: "var(--color-badge-branch)", bg: mix("--color-badge-branch") },
  copied: { color: "var(--color-badge-remote)", bg: mix("--color-badge-remote") },
  untracked: { color: "var(--color-status-untracked)", bg: mix("--color-status-untracked") },
  conflicted: { color: "var(--color-status-conflicted)", bg: mix("--color-status-conflicted") },
};

export const STATUS_LETTERS: Record<string, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  untracked: "?",
  conflicted: "!",
};

export const getStatusLetter = (status: string): string => STATUS_LETTERS[status] ?? "?";
