/**
 * Clean up raw git2 error messages for user-friendly display.
 * Strips "Git error: " prefix and "; class=...; code=..." suffix.
 * Extracts path from "could not find repository at '...'" pattern.
 *
 * Pure formatter — does not log. The error layering relies on a single
 * frontend log site in `notificationStore.showError`; logging here would
 * double-log every notification path (raw + cleaned).
 */
export function cleanErrorMessage(raw: string): string {
  let msg = raw;

  // Strip "Git error: " prefix
  if (msg.startsWith("Git error: ")) {
    msg = msg.slice("Git error: ".length);
  }

  // Strip "; class=...; code=..." suffix
  msg = msg.replace(/;\s*class=.*$/i, "");

  // Extract path from "could not find repository at '...'" or similar
  const repoMatch = msg.match(/could not find repository (?:from|at) '([^']+)'/i);
  if (repoMatch) {
    return `No git repository found at\n${repoMatch[1]}`;
  }

  return msg.trim();
}
