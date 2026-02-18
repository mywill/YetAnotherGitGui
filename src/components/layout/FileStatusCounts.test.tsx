import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileStatusCounts } from "./FileStatusCounts";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";

describe("FileStatusCounts", () => {
  beforeEach(() => {
    useRepositoryStore.setState({
      fileStatuses: {
        staged: [{ path: "a.ts", status: "modified", is_staged: true }],
        unstaged: [
          { path: "b.ts", status: "modified", is_staged: false },
          { path: "c.ts", status: "deleted", is_staged: false },
        ],
        untracked: [{ path: "d.ts", status: "untracked", is_staged: false }],
      },
    });
  });

  it("renders staged count", () => {
    render(<FileStatusCounts />);
    expect(screen.getByText("1 Staged")).toBeInTheDocument();
  });

  it("renders unstaged count", () => {
    render(<FileStatusCounts />);
    expect(screen.getByText("2 Unstaged")).toBeInTheDocument();
  });

  it("renders untracked count", () => {
    render(<FileStatusCounts />);
    expect(screen.getByText("1 Untracked")).toBeInTheDocument();
  });

  it("renders zero counts when no file statuses", () => {
    useRepositoryStore.setState({ fileStatuses: null });
    render(<FileStatusCounts />);
    expect(screen.getByText("0 Staged")).toBeInTheDocument();
    expect(screen.getByText("0 Unstaged")).toBeInTheDocument();
    expect(screen.getByText("0 Untracked")).toBeInTheDocument();
  });

  it("switches to status view when clicked", () => {
    const setActiveView = vi.fn();
    useSelectionStore.setState({ setActiveView });
    render(<FileStatusCounts />);

    fireEvent.click(screen.getByText("1 Staged"));
    expect(setActiveView).toHaveBeenCalledWith("status");
  });

  it("renders all three badges", () => {
    render(<FileStatusCounts />);
    const badges = document.querySelectorAll(".status-badge");
    expect(badges).toHaveLength(3);
  });

  it("has correct CSS classes on badges", () => {
    render(<FileStatusCounts />);
    expect(document.querySelector(".status-badge.staged")).toBeInTheDocument();
    expect(document.querySelector(".status-badge.unstaged")).toBeInTheDocument();
    expect(document.querySelector(".status-badge.untracked")).toBeInTheDocument();
  });
});
