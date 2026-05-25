import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BranchesView } from "./BranchesView";
import { runQuickCleanup } from "../../utils/cleanupActions";

vi.mock("../sidebar/CurrentBranch", () => ({
  CurrentBranch: () => <div data-testid="current-branch-stub" />,
}));

vi.mock("../sidebar/BranchTagList", () => ({
  BranchTagList: () => <div data-testid="branch-tag-list-stub" />,
}));

vi.mock("../../utils/cleanupActions", () => ({
  runQuickCleanup: vi.fn(),
}));

vi.mock("../../services/git", () => ({
  listGoneBranches: vi.fn().mockResolvedValue([]),
  deleteBranches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(() => ({ showConfirm: vi.fn() })),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(() => ({ setActiveView: vi.fn() })),
}));

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(() => ({ loadBranchesAndTags: vi.fn() })),
}));

describe("BranchesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the current-branch summary", () => {
    render(<BranchesView />);
    expect(screen.getByTestId("current-branch-stub")).toBeInTheDocument();
  });

  it("renders the branch+tag list inside a scrollable region", () => {
    const { container } = render(<BranchesView />);
    expect(screen.getByTestId("branch-tag-list-stub")).toBeInTheDocument();

    const scroller = container.querySelector(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect(scroller?.contains(screen.getByTestId("branch-tag-list-stub"))).toBe(true);
  });

  it("uses the canvas surface and overflow-hidden flex column layout", () => {
    const { container } = render(<BranchesView />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("bg-bg-canvas");
    expect(root.className).toContain("flex");
    expect(root.className).toContain("flex-col");
    expect(root.className).toContain("overflow-hidden");
  });

  it("clicking Prune branches triggers runQuickCleanup", () => {
    render(<BranchesView />);
    const pruneButton = screen.getByRole("button", { name: "Prune branches" });
    fireEvent.click(pruneButton);
    expect(runQuickCleanup).toHaveBeenCalledTimes(1);
  });

  it("shows Pruning… and disables button while running", async () => {
    vi.mocked(runQuickCleanup).mockImplementation(({ setRunning }) => {
      setRunning(true);
      return Promise.resolve();
    });
    render(<BranchesView />);
    const pruneButton = screen.getByRole("button", { name: "Prune branches" });
    fireEvent.click(pruneButton);
    await vi.waitFor(() => {
      const btn = screen.getByRole("button", { name: "Prune branches" });
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent("Pruning…");
    });
  });
});
