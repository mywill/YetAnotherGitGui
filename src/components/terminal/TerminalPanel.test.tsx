import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TerminalPanel } from "./TerminalPanel";
import { useTerminalStore } from "../../stores/terminalStore";

// Mock TerminalInstance since it requires xterm.js DOM APIs
vi.mock("./TerminalInstance", () => ({
  TerminalInstance: () => <div data-testid="terminal-instance" />,
}));

describe("TerminalPanel", () => {
  beforeEach(() => {
    useTerminalStore.setState({
      isOpen: true,
      sessionId: null,
      panelHeight: 200,
      isConnected: false,
    });
  });

  it("renders with header and close button", () => {
    render(<TerminalPanel />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByLabelText("Close terminal")).toBeInTheDocument();
  });

  it("renders terminal instance", () => {
    render(<TerminalPanel />);
    expect(screen.getByTestId("terminal-instance")).toBeInTheDocument();
  });

  it("close button calls closeTerminal", async () => {
    render(<TerminalPanel />);
    const closeButton = screen.getByLabelText("Close terminal");
    await userEvent.click(closeButton);
    expect(useTerminalStore.getState().isOpen).toBe(false);
  });

  it("applies panel height from store", () => {
    useTerminalStore.setState({ panelHeight: 300 });
    const { container } = render(<TerminalPanel />);
    const panel = container.querySelector(".terminal-panel");
    expect(panel).toHaveStyle({ height: "300px" });
  });

  it("has a resizer element", () => {
    const { container } = render(<TerminalPanel />);
    expect(container.querySelector(".terminal-resizer")).toBeInTheDocument();
  });
});
