import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommitDetailsPanel } from "./CommitDetailsPanel";
import type { CommitDetails } from "../../types";

const mockCommitDetails: CommitDetails = {
  hash: "abc123def456789012345678901234567890abcd",
  message: "Add new feature\n\nThis is a detailed description of the commit.",
  author_name: "Test Author",
  author_email: "test@example.com",
  committer_name: "Test Committer",
  committer_email: "committer@example.com",
  timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  parent_hashes: ["parent123abc"],
  files_changed: [
    { path: "src/main.ts", status: "modified", old_path: undefined },
    { path: "src/new-file.ts", status: "added", old_path: undefined },
    { path: "src/old-file.ts", status: "deleted", old_path: undefined },
  ],
};

describe("CommitDetailsPanel", () => {
  it("shows empty state when no commit is selected", () => {
    render(<CommitDetailsPanel details={null} loading={false} />);

    expect(screen.getByText(/select a commit/i)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<CommitDetailsPanel details={null} loading={true} />);

    expect(screen.getByText(/loading commit details/i)).toBeInTheDocument();
  });

  it("displays commit hash", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("abc123def456")).toBeInTheDocument();
  });

  it("displays commit message", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText(/add new feature/i)).toBeInTheDocument();
  });

  it("displays author information", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText(/test author/i)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
  });

  it("displays relative date", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    // Should show something like "about 1 hour ago"
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it("displays parent hash", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("parent1")).toBeInTheDocument();
  });

  it("displays file count", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("3")).toBeInTheDocument(); // 3 files changed
  });

  it("displays file paths", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    expect(screen.getByText("src/new-file.ts")).toBeInTheDocument();
    expect(screen.getByText("src/old-file.ts")).toBeInTheDocument();
  });

  it("shows files changed header", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText(/files changed/i)).toBeInTheDocument();
  });

  it("handles commit with no parent (initial commit)", () => {
    const initialCommit = {
      ...mockCommitDetails,
      parent_hashes: [],
    };
    render(<CommitDetailsPanel details={initialCommit} loading={false} />);

    // Should not crash and should not show parent section
    expect(screen.queryByText(/parent/i)).not.toBeInTheDocument();
  });

  it("handles commit with multiple parents (merge commit)", () => {
    const mergeCommit = {
      ...mockCommitDetails,
      parent_hashes: ["parent1abc", "parent2def"],
    };
    render(<CommitDetailsPanel details={mergeCommit} loading={false} />);

    // Parent hashes are shown truncated to 7 chars
    expect(screen.getByText("parent1")).toBeInTheDocument();
    expect(screen.getByText("parent2")).toBeInTheDocument();
  });
});
