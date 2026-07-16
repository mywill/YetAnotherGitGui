import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IconRail } from "./IconRail";
import { useSelectionStore } from "../../stores/selectionStore";
import { useSettingsStore } from "../../stores/settingsStore";

describe("IconRail", () => {
  beforeEach(() => {
    useSelectionStore.setState({ activeView: "status" });
    // Enable every toggleable tab so the "all tabs" assertions hold.
    useSettingsStore.setState({
      enabledTabs: { cleanup: true, worktrees: true },
    });
  });

  it("renders a tablist navigation", () => {
    render(<IconRail />);

    expect(screen.getByRole("tablist", { name: "Navigation" })).toBeInTheDocument();
  });

  it("renders six tab buttons when all tabs are enabled", () => {
    render(<IconRail />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
  });

  it("renders tabs with correct aria-labels", () => {
    render(<IconRail />);

    expect(screen.getByRole("tab", { name: "Working Copy" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Branches & Tags" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Stashes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Worktrees" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cleanup" })).toBeInTheDocument();
  });

  it("hides the Worktrees tab when disabled in settings", () => {
    useSettingsStore.setState({
      enabledTabs: { cleanup: true, worktrees: false },
    });
    render(<IconRail />);

    expect(screen.queryByRole("tab", { name: "Worktrees" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  it("hides the Cleanup tab when disabled in settings", () => {
    useSettingsStore.setState({
      enabledTabs: { cleanup: false, worktrees: true },
    });
    render(<IconRail />);

    expect(screen.queryByRole("tab", { name: "Cleanup" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  it("marks the active tab with aria-selected=true", () => {
    render(<IconRail />);

    const statusTab = screen.getByRole("tab", { name: "Working Copy" });
    expect(statusTab).toHaveAttribute("aria-selected", "true");

    const historyTab = screen.getByRole("tab", { name: "History" });
    expect(historyTab).toHaveAttribute("aria-selected", "false");
  });

  it("switches active view when a tab is clicked", () => {
    render(<IconRail />);

    fireEvent.click(screen.getByRole("tab", { name: "History" }));

    expect(useSelectionStore.getState().activeView).toBe("history");
  });

  it("switches to branches view", () => {
    render(<IconRail />);

    fireEvent.click(screen.getByRole("tab", { name: "Branches & Tags" }));

    expect(useSelectionStore.getState().activeView).toBe("branches");
  });

  it("switches to stashes view", () => {
    render(<IconRail />);

    fireEvent.click(screen.getByRole("tab", { name: "Stashes" }));

    expect(useSelectionStore.getState().activeView).toBe("stashes");
  });

  it("shows active marker on selected tab", () => {
    useSelectionStore.setState({ activeView: "history" });
    render(<IconRail />);

    const historyTab = screen.getByRole("tab", { name: "History" });
    const marker = historyTab.querySelector(".bg-accent-magenta");
    expect(marker).toBeInTheDocument();

    const statusTab = screen.getByRole("tab", { name: "Working Copy" });
    const noMarker = statusTab.querySelector(".bg-accent-magenta");
    expect(noMarker).not.toBeInTheDocument();
  });

  it("has icon-rail CSS class on root", () => {
    const { container } = render(<IconRail />);

    expect(container.querySelector(".icon-rail")).toBeInTheDocument();
  });
});
