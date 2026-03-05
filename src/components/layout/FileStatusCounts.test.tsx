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
    expect(screen.getByText("Staged 1")).toBeInTheDocument();
  });

  it("renders unstaged count", () => {
    render(<FileStatusCounts />);
    expect(screen.getByText("Unstaged 2")).toBeInTheDocument();
  });

  it("renders untracked count", () => {
    render(<FileStatusCounts />);
    expect(screen.getByText("Untracked 1")).toBeInTheDocument();
  });

  it("renders zero counts when no file statuses", () => {
    useRepositoryStore.setState({ fileStatuses: null });
    render(<FileStatusCounts />);
    expect(screen.getByText("Staged 0")).toBeInTheDocument();
    expect(screen.getByText("Unstaged 0")).toBeInTheDocument();
    expect(screen.getByText("Untracked 0")).toBeInTheDocument();
  });

  it("switches to status view when clicked", () => {
    const setActiveView = vi.fn();
    useSelectionStore.setState({ setActiveView });
    render(<FileStatusCounts />);

    fireEvent.click(screen.getByText("Staged 1"));
    expect(setActiveView).toHaveBeenCalledWith("status");
  });

  it("renders proportional bar segments with correct widths", () => {
    render(<FileStatusCounts />);
    const bar = document.querySelector(".status-bar");
    expect(bar).toBeInTheDocument();

    const segments = bar!.children;
    expect(segments).toHaveLength(3);

    // 1 staged out of 4 total = 25%
    expect((segments[0] as HTMLElement).style.width).toBe("25%");
    // 2 unstaged out of 4 total = 50%
    expect((segments[1] as HTMLElement).style.width).toBe("50%");
    // 1 untracked out of 4 total = 25%
    expect((segments[2] as HTMLElement).style.width).toBe("25%");
  });

  it("renders empty bar when all counts are zero", () => {
    useRepositoryStore.setState({ fileStatuses: null });
    render(<FileStatusCounts />);
    const bar = document.querySelector(".status-bar");
    const segments = bar!.children;

    expect((segments[0] as HTMLElement).style.width).toBe("0%");
    expect((segments[1] as HTMLElement).style.width).toBe("0%");
    expect((segments[2] as HTMLElement).style.width).toBe("0%");
  });

  it("renders single-category as full-width segment", () => {
    useRepositoryStore.setState({
      fileStatuses: {
        staged: [
          { path: "a.ts", status: "modified", is_staged: true },
          { path: "b.ts", status: "modified", is_staged: true },
        ],
        unstaged: [],
        untracked: [],
      },
    });
    render(<FileStatusCounts />);
    const bar = document.querySelector(".status-bar");
    const segments = bar!.children;

    expect((segments[0] as HTMLElement).style.width).toBe("100%");
    expect((segments[1] as HTMLElement).style.width).toBe("0%");
    expect((segments[2] as HTMLElement).style.width).toBe("0%");
  });

  it("renders status labels row", () => {
    render(<FileStatusCounts />);
    expect(document.querySelector(".status-labels")).toBeInTheDocument();
  });
});
