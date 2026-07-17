import { formatDistanceToNow } from "date-fns";

export function formatTimeAgo(secondsSinceEpoch: number | null): string | null {
  if (secondsSinceEpoch == null) return null;
  try {
    return formatDistanceToNow(new Date(secondsSinceEpoch * 1000), { addSuffix: true });
  } catch {
    return null;
  }
}
