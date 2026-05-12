import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BranchesView } from "./BranchesView";

vi.mock("../sidebar/CurrentBranch", () => ({
  CurrentBranch: () => <div data-testid="current-branch-stub" />,
}));

vi.mock("../sidebar/BranchTagList", () => ({
  BranchTagList: () => <div data-testid="branch-tag-list-stub" />,
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
});
