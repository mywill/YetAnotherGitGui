import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { openLogDir, setDebugLoggingEnabled } from "./logging";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("logging service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("openLogDir invokes open_log_dir", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await openLogDir();
    expect(invoke).toHaveBeenCalledWith("open_log_dir");
  });

  it("setDebugLoggingEnabled invokes set_debug_logging_enabled", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await setDebugLoggingEnabled(false);
    expect(invoke).toHaveBeenCalledWith("set_debug_logging_enabled", { enabled: false });
  });
});
