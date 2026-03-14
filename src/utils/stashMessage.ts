/**
 * Clean stash message by stripping git-generated prefixes.
 * Handles "WIP on branch: hash message" and "On branch: message" formats.
 */
export function cleanStashMessage(message: string): string {
  let msg = message;
  if (msg.startsWith("WIP on ")) {
    const colonIndex = msg.indexOf(": ");
    if (colonIndex !== -1) {
      const afterColon = msg.substring(colonIndex + 2);
      const spaceIndex = afterColon.indexOf(" ");
      if (spaceIndex !== -1) {
        msg = afterColon.substring(spaceIndex + 1);
      } else {
        msg = afterColon;
      }
    }
  } else if (msg.startsWith("On ")) {
    const colonIndex = msg.indexOf(": ");
    if (colonIndex !== -1) {
      msg = msg.substring(colonIndex + 2);
    }
  }
  return msg;
}
