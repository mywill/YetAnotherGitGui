import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StashDetailsPanel } from "./StashDetailsPanel";
import type { StashDetails } from "../../types";

const mockStashDetails: StashDetails = {
  index: 0,
  message: "WIP on main: abc123 Test stash message",
  commit_hash: "abc123def456789012345678901234567890abcd",
  timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  branch_name: "main",
  files_changed: [
    { path: "src/main.ts", status: "modified", old_path: undefined },
    { path: "src/new-file.ts", status: "added", old_path: undefined },
    { path: "src/old-file.ts", status: "deleted", old_path: undefined },
  ],
};

describe("StashDetailsPanel", () => {
  it("shows empty state when no stash is selected", () => {
    render(<StashDetailsPanel details={null} loading={false} />);

    expect(screen.getByText(/select a stash/i)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<StashDetailsPanel details={null} loading={true} />);

    expect(screen.getByText(/loading stash details/i)).toBeInTheDocument();
  });

  it("displays stash name", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    expect(screen.getByText("stash@{0}")).toBeInTheDocument();
  });

  it("displays cleaned stash message", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    expect(screen.getByText("Test stash message")).toBeInTheDocument();
  });

  it("displays branch name", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("displays relative date", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    // Should show something like "about 1 hour ago"
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it("displays commit hash truncated", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    expect(screen.getByText("abc123def456")).toBeInTheDocument();
  });

  it("displays file count", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    expect(screen.getByText("3")).toBeInTheDocument(); // 3 files changed
  });

  it("displays file paths", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    expect(screen.getByText("src/new-file.ts")).toBeInTheDocument();
    expect(screen.getByText("src/old-file.ts")).toBeInTheDocument();
  });

  it("shows files changed header", () => {
    render(<StashDetailsPanel details={mockStashDetails} loading={false} />);

    expect(screen.getByText(/files changed/i)).toBeInTheDocument();
  });

  it("handles stash with no branch name", () => {
    const stashWithoutBranch = {
      ...mockStashDetails,
      branch_name: "",
    };
    render(<StashDetailsPanel details={stashWithoutBranch} loading={false} />);

    // Should not crash and should not show branch label row
    expect(screen.queryByText(/Branch/)).not.toBeInTheDocument();
  });

  it("handles stash with On prefix message", () => {
    const stashWithOnPrefix = {
      ...mockStashDetails,
      message: "On main: Custom stash message",
    };
    render(<StashDetailsPanel details={stashWithOnPrefix} loading={false} />);

    expect(screen.getByText("Custom stash message")).toBeInTheDocument();
  });

  it("handles stash with plain message", () => {
    const stashWithPlainMsg = {
      ...mockStashDetails,
      message: "Plain stash message",
    };
    render(<StashDetailsPanel details={stashWithPlainMsg} loading={false} />);

    expect(screen.getByText("Plain stash message")).toBeInTheDocument();
  });

  it("handles stash with no files changed", () => {
    const stashNoFiles = {
      ...mockStashDetails,
      files_changed: [],
    };
    render(<StashDetailsPanel details={stashNoFiles} loading={false} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("displays correct stash index for different indexes", () => {
    const stashIndex5 = {
      ...mockStashDetails,
      index: 5,
    };
    render(<StashDetailsPanel details={stashIndex5} loading={false} />);

    expect(screen.getByText("stash@{5}")).toBeInTheDocument();
  });
});
