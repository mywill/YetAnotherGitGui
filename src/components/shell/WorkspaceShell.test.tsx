import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceShell } from "./WorkspaceShell";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSelectionStore } from "../../stores/selectionStore";

vi.mock("./IconRail", () => ({
  IconRail: () => <nav data-testid="icon-rail">IconRail</nav>,
}));

vi.mock("./WorkspaceCenter", () => ({
  WorkspaceCenter: () => <div data-testid="workspace-center">WorkspaceCenter</div>,
}));

vi.mock("./InspectorPanel", () => ({
  InspectorPanel: () => <div data-testid="inspector-panel-content">InspectorPanel</div>,
}));

vi.mock("../common/YaggResizer", () => ({
  YaggResizer: (props: { ariaLabel: string }) => (
    <div data-testid="yagg-resizer" aria-label={props.ariaLabel}>
      Resizer
    </div>
  ),
}));

describe("WorkspaceShell", () => {
  beforeEach(() => {
    useSettingsStore.setState({ inspectorVisible: true });
    useSelectionStore.setState({ activeView: "history" });
  });

  it("renders icon rail", () => {
    render(<WorkspaceShell />);

    expect(screen.getByTestId("icon-rail")).toBeInTheDocument();
  });

  it("renders workspace center", () => {
    render(<WorkspaceShell />);

    expect(screen.getByTestId("workspace-center")).toBeInTheDocument();
  });

  it("renders inspector panel for history view", () => {
    render(<WorkspaceShell />);

    expect(screen.getByTestId("inspector-panel-content")).toBeInTheDocument();
  });

  it("hides inspector panel for stashes view (details render inline in WorkspaceCenter)", () => {
    useSelectionStore.setState({ activeView: "stashes" });

    render(<WorkspaceShell />);

    expect(screen.queryByTestId("inspector-panel-content")).not.toBeInTheDocument();
  });

  it("renders resizer for inspector panel", () => {
    render(<WorkspaceShell />);

    expect(screen.getByTestId("yagg-resizer")).toBeInTheDocument();
  });

  it("hides inspector panel when inspectorVisible is false", () => {
    useSettingsStore.setState({ inspectorVisible: false });

    render(<WorkspaceShell />);

    expect(screen.queryByTestId("inspector-panel-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("yagg-resizer")).not.toBeInTheDocument();
  });

  it("hides inspector panel for status view", () => {
    useSelectionStore.setState({ activeView: "status" });

    render(<WorkspaceShell />);

    expect(screen.queryByTestId("inspector-panel-content")).not.toBeInTheDocument();
  });

  it("hides inspector panel for branches view", () => {
    useSelectionStore.setState({ activeView: "branches" });

    render(<WorkspaceShell />);

    expect(screen.queryByTestId("inspector-panel-content")).not.toBeInTheDocument();
  });

  it("has workspace-shell CSS class on root", () => {
    const { container } = render(<WorkspaceShell />);

    expect(container.querySelector(".workspace-shell")).toBeInTheDocument();
  });

  it("has inspector-panel CSS class on inspector container", () => {
    const { container } = render(<WorkspaceShell />);

    expect(container.querySelector(".inspector-panel")).toBeInTheDocument();
  });
});
