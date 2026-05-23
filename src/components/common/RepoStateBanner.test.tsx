import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RepoStateBanner } from "./RepoStateBanner";
import type { RepositoryInfo, FileStatuses } from "../../types";

let mockRepositoryInfo: RepositoryInfo | null = null;
let mockFileStatuses: FileStatuses | null = null;
const mockAbortOperation = vi.fn(async () => {});
const mockContinueOperation = vi.fn(async () => {});
const mockShowConfirm = vi.fn(async () => true);

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      repositoryInfo: mockRepositoryInfo,
      fileStatuses: mockFileStatuses,
      abortOperation: mockAbortOperation,
      continueOperation: mockContinueOperation,
    }),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ showConfirm: mockShowConfirm }),
}));

const makeRepoInfo = (repo_state: string): RepositoryInfo => ({
  path: "/test/repo",
  current_branch: "main",
  is_detached: false,
  remotes: ["origin"],
  head_hash: "abc123",
  repo_state,
});

const makeFileStatuses = (conflictedPaths: string[] = []): FileStatuses => ({
  staged: [],
  unstaged: conflictedPaths.map((path) => ({
    path,
    status: "conflicted" as const,
    is_staged: false,
  })),
  untracked: [],
});

describe("RepoStateBanner", () => {
  beforeEach(() => {
    mockRepositoryInfo = null;
    mockFileStatuses = null;
    mockAbortOperation.mockClear();
    mockContinueOperation.mockClear();
    mockShowConfirm.mockClear();
    mockShowConfirm.mockResolvedValue(true);
  });

  it("renders nothing when repositoryInfo is null", () => {
    const { container } = render(<RepoStateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when repo_state is clean", () => {
    mockRepositoryInfo = makeRepoInfo("clean");
    const { container } = render(<RepoStateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders merge banner with CLI hint and no buttons", () => {
    mockRepositoryInfo = makeRepoInfo("merge");
    render(<RepoStateBanner />);
    expect(screen.getByText("Merge in progress")).toBeInTheDocument();
    expect(screen.getByText("git merge --abort")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /abort/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
  });

  it("renders bisect banner with CLI hint and no buttons", () => {
    mockRepositoryInfo = makeRepoInfo("bisect");
    render(<RepoStateBanner />);
    expect(screen.getByText("Bisect in progress")).toBeInTheDocument();
    expect(screen.getByText("git bisect reset")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /abort/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
  });

  it("renders rebase banner with Abort and Continue buttons", () => {
    mockRepositoryInfo = makeRepoInfo("rebase");
    render(<RepoStateBanner />);
    expect(screen.getByText("Rebase in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    // CLI hint is replaced by the buttons
    expect(screen.queryByText("git rebase --abort")).toBeNull();
  });

  it("renders cherry-pick banner with Abort and Continue buttons", () => {
    mockRepositoryInfo = makeRepoInfo("cherry-pick");
    render(<RepoStateBanner />);
    expect(screen.getByText("Cherry-pick in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("renders revert banner with Abort and Continue buttons", () => {
    mockRepositoryInfo = makeRepoInfo("revert");
    render(<RepoStateBanner />);
    expect(screen.getByText("Revert in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("disables Continue when conflicts remain", () => {
    mockRepositoryInfo = makeRepoInfo("rebase");
    mockFileStatuses = makeFileStatuses(["a.ts", "b.ts"]);
    render(<RepoStateBanner />);
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    expect(continueBtn).toBeDisabled();
    expect(continueBtn).toHaveAttribute("title", "Resolve all conflicts first");
    expect(screen.getByText("— 2 conflicted files")).toBeInTheDocument();
  });

  it("enables Continue when no conflicts remain", () => {
    mockRepositoryInfo = makeRepoInfo("rebase");
    mockFileStatuses = makeFileStatuses([]);
    render(<RepoStateBanner />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("calls abortOperation after user confirms in the dialog", async () => {
    mockRepositoryInfo = makeRepoInfo("rebase");
    mockShowConfirm.mockResolvedValue(true);
    render(<RepoStateBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Abort" }));

    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
    const confirmArgs = mockShowConfirm.mock.calls[0][0] as {
      title: string;
      confirmLabel: string;
    };
    expect(confirmArgs.title).toBe("Abort rebase?");
    expect(confirmArgs.confirmLabel).toBe("Abort");
    await waitFor(() => expect(mockAbortOperation).toHaveBeenCalledTimes(1));
  });

  it("does not call abortOperation when user cancels the dialog", async () => {
    mockRepositoryInfo = makeRepoInfo("cherry-pick");
    mockShowConfirm.mockResolvedValue(false);
    render(<RepoStateBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Abort" }));

    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
    expect(mockAbortOperation).not.toHaveBeenCalled();
  });

  it("calls continueOperation directly without confirmation", () => {
    mockRepositoryInfo = makeRepoInfo("revert");
    mockFileStatuses = makeFileStatuses([]);
    render(<RepoStateBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(mockShowConfirm).not.toHaveBeenCalled();
    expect(mockContinueOperation).toHaveBeenCalledTimes(1);
  });

  it("has correct ARIA role and live region", () => {
    mockRepositoryInfo = makeRepoInfo("merge");
    render(<RepoStateBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("renders nothing for unknown state", () => {
    mockRepositoryInfo = makeRepoInfo("unknown-state");
    const { container } = render(<RepoStateBanner />);
    expect(container.firstChild).toBeNull();
  });
});
