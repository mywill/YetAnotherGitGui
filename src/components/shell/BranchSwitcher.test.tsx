import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BranchSwitcher } from "./BranchSwitcher";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { validateBranchName } from "../../services/git";
import { mockStore } from "../../test/mockStores";
import type { BranchInfo } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));
vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));
vi.mock("../../services/git", () => ({
  validateBranchName: vi.fn(),
}));

const branches: BranchInfo[] = [
  { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
  { name: "feature/auth", is_remote: false, is_head: false, target_hash: "def" },
  { name: "feature/search", is_remote: false, is_head: false, target_hash: "ghi" },
  { name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" },
];

describe("BranchSwitcher", () => {
  let checkoutBranch: ReturnType<typeof vi.fn>;
  let createBranch: ReturnType<typeof vi.fn>;
  let showConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    checkoutBranch = vi.fn().mockResolvedValue(undefined);
    createBranch = vi.fn().mockResolvedValue(undefined);
    showConfirm = vi.fn().mockResolvedValue(true);
    mockStore(useRepositoryStore, { branches, checkoutBranch, createBranch });
    mockStore(useDialogStore, { showConfirm });
    vi.mocked(validateBranchName).mockResolvedValue({ ok: true });
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
    const trigger = screen.getByRole("button", { name: "Switch branch" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Branches" })).toBeInTheDocument();
    expect(screen.getByText("Switch branch")).toBeInTheDocument();
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
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Enter on current branch closes without checkout", () => {
    render(<BranchSwitcher branchName="main" isDetached={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    // Active index is 0 = HEAD
    const input = screen.getByLabelText("Filter branches");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(showConfirm).not.toHaveBeenCalled();
    expect(checkoutBranch).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  describe("create branch", () => {
    it("empty query: no create row, no warning, no validate call", () => {
      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));

      expect(screen.queryByText(/Create/)).not.toBeInTheDocument();
      expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
      expect(validateBranchName).not.toHaveBeenCalled();
    });

    it("typing a valid non-matching name shows the Create row", async () => {
      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
      fireEvent.change(screen.getByLabelText("Filter branches"), {
        target: { value: "feature/new" },
      });

      await waitFor(() => {
        expect(screen.getByText("Create ‘feature/new’")).toBeInTheDocument();
      });
      expect(validateBranchName).toHaveBeenCalledWith("feature/new");
    });

    it("typing a name that exactly matches an existing branch hides the Create row", async () => {
      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
      fireEvent.change(screen.getByLabelText("Filter branches"), {
        target: { value: "feature/auth" },
      });

      await waitFor(() => {
        expect(validateBranchName).toHaveBeenCalled();
      });

      expect(screen.getByText("feature/auth")).toBeInTheDocument();
      expect(screen.queryByText(/Create ‘feature\/auth’/)).not.toBeInTheDocument();
    });

    it("typing an invalid name hides the Create row and shows the warning", async () => {
      vi.mocked(validateBranchName).mockResolvedValue({
        ok: false,
        reason: "invalid branch name",
      });

      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
      fireEvent.change(screen.getByLabelText("Filter branches"), {
        target: { value: "bad name" },
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid branch name/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Create ‘bad name’/)).not.toBeInTheDocument();
    });

    it("clicking the Create row calls createBranch and closes the popover", async () => {
      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
      fireEvent.change(screen.getByLabelText("Filter branches"), {
        target: { value: "feature/new" },
      });

      await waitFor(() => {
        expect(screen.getByText("Create ‘feature/new’")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Create ‘feature/new’"));

      expect(createBranch).toHaveBeenCalledWith("feature/new");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("Enter when the Create row is active calls createBranch", async () => {
      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
      const input = screen.getByLabelText("Filter branches");
      // Type a name that doesn't match any existing branch — Create row becomes the only filtered row.
      fireEvent.change(input, { target: { value: "feature/new" } });

      await waitFor(() => {
        expect(screen.getByText("Create ‘feature/new’")).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: "Enter" });

      expect(createBranch).toHaveBeenCalledWith("feature/new");
    });

    it("popover still closes when createBranch rejects", async () => {
      createBranch.mockRejectedValue(new Error("boom"));

      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
      fireEvent.change(screen.getByLabelText("Filter branches"), {
        target: { value: "feature/new" },
      });

      await waitFor(() => {
        expect(screen.getByText("Create ‘feature/new’")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Create ‘feature/new’"));

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("validate is called once per distinct query value", async () => {
      render(<BranchSwitcher branchName="main" isDetached={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
      const input = screen.getByLabelText("Filter branches");

      fireEvent.change(input, { target: { value: "a" } });
      fireEvent.change(input, { target: { value: "ab" } });
      fireEvent.change(input, { target: { value: "abc" } });

      await waitFor(() => {
        expect(validateBranchName).toHaveBeenCalledTimes(3);
      });
      expect(validateBranchName).toHaveBeenNthCalledWith(1, "a");
      expect(validateBranchName).toHaveBeenNthCalledWith(2, "ab");
      expect(validateBranchName).toHaveBeenNthCalledWith(3, "abc");
    });
  });
});
