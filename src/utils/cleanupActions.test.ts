import { describe, it, expect, vi, beforeEach } from "vitest";
import { runQuickCleanup } from "./cleanupActions";

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
    }),
  },
}));

interface Item {
  name: string;
}

function makeSpec(overrides: Partial<Parameters<typeof runQuickCleanup<Item>>[0]> = {}) {
  return {
    fetchCandidates: vi.fn().mockResolvedValue([{ name: "a" }, { name: "b" }]),
    emptyMessage: "Nothing to clean.",
    confirmTitle: (n: number) => `Title ${n}`,
    confirmMessage: (_items: Item[], list: string) => `Msg\n${list}`,
    confirmLabel: "Delete",
    itemNoun: { singular: "branch", plural: "branches" },
    pastTenseVerb: "Deleted",
    failVerb: "delete",
    formatItemForDialog: (i: Item) => i.name,
    runBulk: vi.fn().mockResolvedValue([
      { item: "a", success: true, error: null },
      { item: "b", success: true, error: null },
    ]),
    refresh: vi.fn().mockResolvedValue(undefined),
    setRunning: vi.fn(),
    showConfirm: vi.fn().mockResolvedValue(true),
    setActiveView: vi.fn(),
    ...overrides,
  };
}

describe("runQuickCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts the empty message when no candidates are returned and does not call the bulk op", async () => {
    const spec = makeSpec({ fetchCandidates: vi.fn().mockResolvedValue([]) });
    await runQuickCleanup(spec);
    expect(mockShowSuccess).toHaveBeenCalledWith("Nothing to clean.");
    expect(spec.runBulk).not.toHaveBeenCalled();
    expect(spec.refresh).not.toHaveBeenCalled();
  });

  it("aborts when the user cancels the confirm dialog", async () => {
    const spec = makeSpec({ showConfirm: vi.fn().mockResolvedValue(false) });
    await runQuickCleanup(spec);
    expect(spec.runBulk).not.toHaveBeenCalled();
    expect(spec.refresh).not.toHaveBeenCalled();
  });

  it("on all-success: shows pastTense success and refreshes", async () => {
    const spec = makeSpec();
    await runQuickCleanup(spec);
    expect(mockShowSuccess).toHaveBeenCalledWith("Deleted 2 branches.");
    expect(spec.refresh).toHaveBeenCalled();
  });

  it("singular noun used for count == 1", async () => {
    const spec = makeSpec({
      fetchCandidates: vi.fn().mockResolvedValue([{ name: "x" }]),
      runBulk: vi.fn().mockResolvedValue([{ item: "x", success: true, error: null }]),
    });
    await runQuickCleanup(spec);
    expect(mockShowSuccess).toHaveBeenCalledWith("Deleted 1 branch.");
  });

  it("on all-failure: surfaces the first error and does not jump views", async () => {
    const spec = makeSpec({
      runBulk: vi.fn().mockResolvedValue([
        { item: "a", success: false, error: "nope" },
        { item: "b", success: false, error: "also nope" },
      ]),
      mixedFailureFallbackView: "cleanup",
    });
    await runQuickCleanup(spec);
    expect(mockShowError).toHaveBeenCalledWith("Failed to delete: nope");
    expect(spec.setActiveView).not.toHaveBeenCalled();
  });

  it("on mixed results: shows the mixed toast and jumps to fallback view when configured", async () => {
    const spec = makeSpec({
      runBulk: vi.fn().mockResolvedValue([
        { item: "a", success: true, error: null },
        { item: "b", success: false, error: "boom" },
      ]),
      mixedFailureFallbackView: "cleanup",
    });
    await runQuickCleanup(spec);
    expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/Deleted 1, failed 1/));
    expect(spec.setActiveView).toHaveBeenCalledWith("cleanup");
  });

  it("on mixed results without fallback view configured: stays put", async () => {
    const spec = makeSpec({
      runBulk: vi.fn().mockResolvedValue([
        { item: "a", success: true, error: null },
        { item: "b", success: false, error: "boom" },
      ]),
      mixedFailureFallbackView: undefined,
    });
    await runQuickCleanup(spec);
    expect(spec.setActiveView).not.toHaveBeenCalled();
  });

  it("setRunning toggles around the operation, even on thrown errors", async () => {
    const spec = makeSpec({
      fetchCandidates: vi.fn().mockRejectedValue(new Error("network down")),
    });
    await runQuickCleanup(spec);
    expect(spec.setRunning).toHaveBeenNthCalledWith(1, true);
    expect(spec.setRunning).toHaveBeenLastCalledWith(false);
    expect(mockShowError).toHaveBeenCalled();
  });
});
