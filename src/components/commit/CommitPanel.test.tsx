import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommitPanel } from "./CommitPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import type { FileStatuses } from "../../types";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

describe("CommitPanel", () => {
  const mockCreateCommit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupStore(overrides: { fileStatuses?: FileStatuses | null } = {}) {
    const defaultState = {
      fileStatuses: overrides.fileStatuses ?? { staged: [], unstaged: [], untracked: [] },
      createCommit: mockCreateCommit,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useRepositoryStore).mockImplementation((selector: any) => {
      return selector(defaultState);
    });
  }

  it("renders commit panel with input and button", () => {
    setupStore();

    render(<CommitPanel />);

    expect(screen.getByPlaceholderText("Commit message...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /commit/i })).toBeInTheDocument();
    expect(screen.getByText("Ctrl+Enter to commit")).toBeInTheDocument();
  });

  it("disables commit button when message is empty", () => {
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const button = screen.getByRole("button", { name: /commit/i });
    expect(button).toBeDisabled();
  });

  it("disables commit button when no staged changes", () => {
    setupStore({
      fileStatuses: { staged: [], unstaged: [], untracked: [] },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "Test commit" } });

    const button = screen.getByRole("button", { name: /commit/i });
    expect(button).toBeDisabled();
  });

  it("enables commit button when message and staged changes exist", () => {
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "Test commit" } });

    const button = screen.getByRole("button", { name: /commit/i });
    expect(button).not.toBeDisabled();
  });

  it("calls createCommit when commit button is clicked", async () => {
    mockCreateCommit.mockResolvedValue(undefined);
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "Test commit message" } });

    const button = screen.getByRole("button", { name: /commit/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCreateCommit).toHaveBeenCalledWith("Test commit message");
    });
  });

  it("clears message after successful commit", async () => {
    mockCreateCommit.mockResolvedValue(undefined);
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Test commit" } });

    const button = screen.getByRole("button", { name: /commit/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(textarea.value).toBe("");
    });
  });

  it("triggers commit on Ctrl+Enter", async () => {
    mockCreateCommit.mockResolvedValue(undefined);
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "Test commit" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(mockCreateCommit).toHaveBeenCalledWith("Test commit");
    });
  });

  it("triggers commit on Meta+Enter (Mac)", async () => {
    mockCreateCommit.mockResolvedValue(undefined);
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "Test commit" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(mockCreateCommit).toHaveBeenCalledWith("Test commit");
    });
  });

  it("shows 'Committing...' while commit is in progress", async () => {
    let resolveCommit: (value?: unknown) => void;
    mockCreateCommit.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommit = resolve;
        })
    );
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "Test commit" } });

    const button = screen.getByRole("button", { name: /commit/i });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /committing/i })).toBeInTheDocument();
    expect(button).toBeDisabled();

    resolveCommit!();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^commit$/i })).toBeInTheDocument();
    });
  });

  it("trims whitespace from commit message", async () => {
    mockCreateCommit.mockResolvedValue(undefined);
    setupStore({
      fileStatuses: {
        staged: [{ path: "test.txt", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      },
    });

    render(<CommitPanel />);

    const textarea = screen.getByPlaceholderText("Commit message...");
    fireEvent.change(textarea, { target: { value: "  Test commit  " } });

    const button = screen.getByRole("button", { name: /commit/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCreateCommit).toHaveBeenCalledWith("Test commit");
    });
  });
});
