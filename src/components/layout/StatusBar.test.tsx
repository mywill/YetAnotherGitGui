import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusBar } from "./StatusBar";
import { useRepositoryStore, useIsEmptyRepo } from "../../stores/repositoryStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { mockStore } from "../../test/mockStores";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
  useIsEmptyRepo: vi.fn(() => false),
}));

vi.mock("../../stores/terminalStore", () => ({
  useTerminalStore: vi.fn(),
}));

vi.mock("../../hooks/usePlatform", () => ({
  usePlatform: vi.fn(() => ({ modKey: "Ctrl", platform: "linux" })),
}));

const defaultRepoInfo = {
  path: "/test/repo",
  current_branch: "main",
  is_detached: false,
  remotes: ["origin"],
  head_hash: "abc1234567890",
  repo_state: "clean",
};

const defaultFileStatuses = {
  staged: [{ path: "a.ts", status: "modified", is_staged: true }],
  unstaged: [
    { path: "b.ts", status: "modified", is_staged: false },
    { path: "c.ts", status: "modified", is_staged: false },
  ],
  untracked: [{ path: "d.ts", status: "untracked", is_staged: false }],
};

const mockToggleTerminal = vi.fn();

function setup(
  overrides: {
    repoInfo?: typeof defaultRepoInfo | null;
    fileStatuses?: typeof defaultFileStatuses | null;
    terminalOpen?: boolean;
    isEmptyRepo?: boolean;
  } = {}
) {
  const {
    repoInfo = defaultRepoInfo,
    fileStatuses = defaultFileStatuses,
    terminalOpen = false,
    isEmptyRepo = false,
  } = overrides;

  vi.mocked(useIsEmptyRepo).mockReturnValue(isEmptyRepo);

  mockStore(useRepositoryStore, {
    repositoryInfo: repoInfo,
    fileStatuses,
  });

  mockStore(useTerminalStore, {
    isOpen: terminalOpen,
    toggleTerminal: mockToggleTerminal,
  });
}

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it("renders status bar footer", () => {
    const { container } = render(<StatusBar />);
    expect(container.querySelector("footer.status-bar")).toBeInTheDocument();
  });

  it("returns null when no repository info", () => {
    setup({ repoInfo: null });
    const { container } = render(<StatusBar />);
    expect(container.querySelector("footer")).not.toBeInTheDocument();
  });

  it("shows branch name", () => {
    render(<StatusBar />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("shows HEAD detached when detached", () => {
    setup({
      repoInfo: {
        ...defaultRepoInfo,
        is_detached: true,
        current_branch: null,
      },
    });
    render(<StatusBar />);
    expect(screen.getByText("HEAD detached")).toBeInTheDocument();
  });

  it("shows short hash in detached state", () => {
    setup({
      repoInfo: {
        ...defaultRepoInfo,
        is_detached: true,
        current_branch: null,
        head_hash: "abc1234567890",
      },
    });
    render(<StatusBar />);
    expect(screen.getByText("abc1234")).toBeInTheDocument();
  });

  it("shows New repository for empty repos", () => {
    setup({
      repoInfo: { ...defaultRepoInfo, current_branch: null, head_hash: null },
      isEmptyRepo: true,
    });
    render(<StatusBar />);
    expect(screen.getByText("New repository")).toBeInTheDocument();
  });

  it("shows No branch when no branch and not empty", () => {
    setup({
      repoInfo: { ...defaultRepoInfo, current_branch: null },
    });
    render(<StatusBar />);
    expect(screen.getByText("No branch")).toBeInTheDocument();
  });

  it("shows repo state badge when not clean", () => {
    setup({
      repoInfo: { ...defaultRepoInfo, repo_state: "merge" },
    });
    render(<StatusBar />);
    expect(screen.getByText("MERGING")).toBeInTheDocument();
  });

  it("does not show repo state badge when clean", () => {
    render(<StatusBar />);
    expect(screen.queryByText("MERGING")).not.toBeInTheDocument();
  });

  it("shows file status counts", () => {
    const { container } = render(<StatusBar />);
    const counts = container.querySelector(".status-bar-counts");
    expect(counts).toBeInTheDocument();
    expect(counts).toHaveAttribute("aria-label", "1 staged, 2 unstaged, 1 untracked");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("hides file counts when all zero", () => {
    setup({
      fileStatuses: { staged: [], unstaged: [], untracked: [] },
    });
    const { container } = render(<StatusBar />);
    expect(container.querySelector(".status-bar-counts")).not.toBeInTheDocument();
  });

  it("terminal toggle button is present", () => {
    render(<StatusBar />);
    expect(screen.getByRole("button", { name: /Toggle terminal/ })).toBeInTheDocument();
  });

  it("clicking terminal toggle calls toggleTerminal", async () => {
    render(<StatusBar />);
    await userEvent.click(screen.getByRole("button", { name: /Toggle terminal/ }));
    expect(mockToggleTerminal).toHaveBeenCalledTimes(1);
  });

  it("terminal toggle has active state when open", () => {
    setup({ terminalOpen: true });
    const { container } = render(<StatusBar />);
    const toggle = container.querySelector(".status-bar-terminal-toggle");
    expect(toggle?.className).toContain("bg-bg-selected");
  });

  it("terminal toggle has aria-expanded", () => {
    setup({ terminalOpen: true });
    render(<StatusBar />);
    expect(screen.getByRole("button", { name: /Toggle terminal/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("has role=status and aria-label", () => {
    render(<StatusBar />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Status bar");
  });
});
