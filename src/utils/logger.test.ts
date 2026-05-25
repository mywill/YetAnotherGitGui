import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { logError, logInfo, logDebug } from "./logger";

describe("frontend logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it.each([
    ["error", logError],
    ["info", logInfo],
    ["debug", logDebug],
  ] as const)(
    "%s forwards a single log_from_frontend invoke with the expected payload",
    (level, fn) => {
      fn("yagg::fe::test", `${level} message`);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith("log_from_frontend", {
        level,
        target: "yagg::fe::test",
        message: `${level} message`,
      });
    }
  );

  it("swallows invoke rejections so the UI never breaks", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("ipc down"));
    // The logger's `.catch()` must absorb the rejection — assert no synchronous
    // throw, then drain a microtask so any escaped rejection would surface.
    expect(() => logError("yagg::fe::ui", "msg")).not.toThrow();
    await Promise.resolve();
  });
});
