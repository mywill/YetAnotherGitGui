export async function withRequestId<T>(
  requestId: number,
  getCurrentId: () => number,
  op: () => Promise<T>,
  onResult: (result: T) => void,
  onError?: (err: unknown) => void
): Promise<void> {
  try {
    const result = await op();
    if (requestId !== getCurrentId()) return;
    onResult(result);
  } catch (err) {
    if (requestId !== getCurrentId()) return;
    if (onError) onError(err);
  }
}
