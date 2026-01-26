import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewSwitcher } from "./ViewSwitcher";
import { useSelectionStore } from "../../stores/selectionStore";

describe("ViewSwitcher", () => {
  beforeEach(() => {
    // Reset store state
    useSelectionStore.setState({ activeView: "status" });
  });

  it("renders History and Status tabs", () => {
    render(<ViewSwitcher />);

    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /status/i })).toBeInTheDocument();
  });

  it("shows Status tab as active by default", () => {
    render(<ViewSwitcher />);

    const historyTab = screen.getByRole("tab", { name: /history/i });
    const statusTab = screen.getByRole("tab", { name: /status/i });

    expect(historyTab).toHaveAttribute("aria-selected", "false");
    expect(statusTab).toHaveAttribute("aria-selected", "true");
  });

  it("switches to History view when History tab is clicked", () => {
    render(<ViewSwitcher />);

    const historyTab = screen.getByRole("tab", { name: /history/i });
    fireEvent.click(historyTab);

    expect(useSelectionStore.getState().activeView).toBe("history");
  });

  it("switches back to Status view when Status tab is clicked", () => {
    useSelectionStore.setState({ activeView: "history" });
    render(<ViewSwitcher />);

    const statusTab = screen.getByRole("tab", { name: /status/i });
    fireEvent.click(statusTab);

    expect(useSelectionStore.getState().activeView).toBe("status");
  });

  it("updates active state when view changes", () => {
    useSelectionStore.setState({ activeView: "history" });
    render(<ViewSwitcher />);

    const historyTab = screen.getByRole("tab", { name: /history/i });
    const statusTab = screen.getByRole("tab", { name: /status/i });

    expect(historyTab).toHaveAttribute("aria-selected", "true");
    expect(statusTab).toHaveAttribute("aria-selected", "false");
  });

  it("has proper tablist role for accessibility", () => {
    render(<ViewSwitcher />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
