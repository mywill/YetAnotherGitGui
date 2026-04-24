import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BranchSwitcher } from "./BranchSwitcher";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { mockStore } from "../../test/mockStores";
import type { BranchInfo } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));
vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

const branches: BranchInfo[] = [
  { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
  { name: "feature/auth", is_remote: false, is_head: false, target_hash: "def" },
  { name: "feature/search", is_remote: false, is_head: false, target_hash: "ghi" },
  { name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" },
];

describe("BranchSwitcher", () => {
  let checkoutBranch: ReturnType<typeof vi.fn>;
  let showConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    checkoutBranch = vi.fn().mockResolvedValue(undefined);
    showConfirm = vi.fn().mockResolvedValue(true);
    mockStore(useRepositoryStore, { branches, checkoutBranch });
    mockStore(useDialogStore, { showConfirm });
  });

  it("renders the branch name on the trigger", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    const trigger = screen.getByRole("button", { name: "Switch branch" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("main");
  });

  it("is disabled when detached", () => {
    render(<BranchSwitcher branchName="HEAD detached" isDetached={true} />);
    const trigger = screen.getByRole("button", { name: "Switch branch" });
    expect(trigger).toBeDisabled();
  });

  it("opens popover with 'Switch branch' header on click", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    const dialog = screen.getByRole("dialog", { name: "Switch branch" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Switch branch");
  });

  it("lists local branches only, with HEAD first", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3); // no remote
    expect(options[0]).toHaveTextContent("main");
    expect(options[0]).toHaveAttribute("aria-current", "true");
  });

  it("filters branches by query", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    const input = screen.getByLabelText("Filter branches");
    fireEvent.change(input, { target: { value: "auth" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("feature/auth");
  });

  it("shows 'No branches match' when filter has no results", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    const input = screen.getByLabelText("Filter branches");
    fireEvent.change(input, { target: { value: "zzznope" } });
    expect(screen.getByText("No branches match")).toBeInTheDocument();
  });

  it("arrow keys + Enter trigger checkout confirmation", async () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    const input = screen.getByLabelText("Filter branches");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    // microtask to flush the async confirm
    await Promise.resolve();
    await Promise.resolve();
    expect(showConfirm).toHaveBeenCalled();
    // checkoutBranch is only called after confirm resolves true
    await Promise.resolve();
    expect(checkoutBranch).toHaveBeenCalledWith("feature/auth");
  });

  it("Escape closes the popover", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    const input = screen.getByLabelText("Filter branches");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Enter on current branch closes without checkout", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    // Active index is 0 = HEAD
    const input = screen.getByLabelText("Filter branches");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(showConfirm).not.toHaveBeenCalled();
    expect(checkoutBranch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
