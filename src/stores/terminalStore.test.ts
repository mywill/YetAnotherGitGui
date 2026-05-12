import { describe, it, expect, beforeEach } from "vitest";
import { useTerminalStore } from "./terminalStore";

describe("terminalStore", () => {
  beforeEach(() => {
    useTerminalStore.setState({
      isOpen: false,
      sessionId: null,
      panelHeight: 200,
      isConnected: false,
    });
  });

  it("should have correct initial state", () => {
    const state = useTerminalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.sessionId).toBeNull();
    expect(state.panelHeight).toBe(200);
    expect(state.isConnected).toBe(false);
  });

  it("toggleTerminal should toggle isOpen", () => {
    useTerminalStore.getState().toggleTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(true);

    useTerminalStore.getState().toggleTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(false);
  });

  it("openTerminal should set isOpen to true", () => {
    useTerminalStore.getState().openTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(true);
  });

  it("closeTerminal should set isOpen to false", () => {
    useTerminalStore.setState({ isOpen: true });
    useTerminalStore.getState().closeTerminal();
    expect(useTerminalStore.getState().isOpen).toBe(false);
  });

  it("setSessionId should update sessionId", () => {
    useTerminalStore.getState().setSessionId(42);
    expect(useTerminalStore.getState().sessionId).toBe(42);

    useTerminalStore.getState().setSessionId(null);
    expect(useTerminalStore.getState().sessionId).toBeNull();
  });

  it("setPanelHeight enforces a minimum but no maximum", () => {
    useTerminalStore.getState().setPanelHeight(300);
    expect(useTerminalStore.getState().panelHeight).toBe(300);

    useTerminalStore.getState().setPanelHeight(10);
    expect(useTerminalStore.getState().panelHeight).toBe(60);

    useTerminalStore.getState().setPanelHeight(5000);
    expect(useTerminalStore.getState().panelHeight).toBe(5000);
  });

  it("setConnected should update isConnected", () => {
    useTerminalStore.getState().setConnected(true);
    expect(useTerminalStore.getState().isConnected).toBe(true);

    useTerminalStore.getState().setConnected(false);
    expect(useTerminalStore.getState().isConnected).toBe(false);
  });
});
