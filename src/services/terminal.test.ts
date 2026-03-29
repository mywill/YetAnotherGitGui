import { describe, it, expect, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  spawnTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  onTerminalOutput,
  onTerminalExit,
} from "./terminal";

describe("terminal service", () => {
  it("spawnTerminal invokes spawn_terminal with cwd", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(1);
    const result = await spawnTerminal("/home/user/repo");
    expect(invoke).toHaveBeenCalledWith("spawn_terminal", {
      cwd: "/home/user/repo",
    });
    expect(result).toBe(1);
  });

  it("writeTerminal invokes write_terminal with sessionId and data", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await writeTerminal(1, "ls\n");
    expect(invoke).toHaveBeenCalledWith("write_terminal", {
      sessionId: 1,
      data: "ls\n",
    });
  });

  it("resizeTerminal invokes resize_terminal with dimensions", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await resizeTerminal(1, 24, 80);
    expect(invoke).toHaveBeenCalledWith("resize_terminal", {
      sessionId: 1,
      rows: 24,
      cols: 80,
    });
  });

  it("killTerminal invokes kill_terminal with sessionId", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await killTerminal(1);
    expect(invoke).toHaveBeenCalledWith("kill_terminal", { sessionId: 1 });
  });

  it("onTerminalOutput subscribes to terminal:output events", async () => {
    const callback = vi.fn();
    await onTerminalOutput(callback);
    expect(listen).toHaveBeenCalledWith("terminal:output", expect.any(Function));
  });

  it("onTerminalExit subscribes to terminal:exit events", async () => {
    const callback = vi.fn();
    await onTerminalExit(callback);
    expect(listen).toHaveBeenCalledWith("terminal:exit", expect.any(Function));
  });
});
