import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlatform } from "./usePlatform";
import { getAppInfo } from "../services/system";

vi.mock("../services/system", () => ({
  getAppInfo: vi.fn(),
}));

// Reset the module-level cache between tests
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("usePlatform", () => {
  it("returns Ctrl as default modKey before platform is resolved", () => {
    vi.mocked(getAppInfo).mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => usePlatform());

    expect(result.current.modKey).toBe("Ctrl");
  });

  it("returns Ctrl for non-mac platforms", async () => {
    vi.mocked(getAppInfo).mockResolvedValue({
      version: "1.0.0",
      tauri_version: "2.0.0",
      platform: "linux",
      arch: "x86_64",
    });

    // Re-import to get fresh module state
    const { usePlatform: freshUsePlatform } = await import("./usePlatform");
    const { result } = renderHook(() => freshUsePlatform());

    await waitFor(() => {
      expect(result.current.modKey).toBe("Ctrl");
      expect(result.current.platform).toBe("linux");
    });
  });

  it("returns Cmd for macos platform", async () => {
    vi.mocked(getAppInfo).mockResolvedValue({
      version: "1.0.0",
      tauri_version: "2.0.0",
      platform: "macos",
      arch: "aarch64",
    });

    const { usePlatform: freshUsePlatform } = await import("./usePlatform");
    const { result } = renderHook(() => freshUsePlatform());

    await waitFor(() => {
      expect(result.current.modKey).toBe("Cmd");
      expect(result.current.platform).toBe("macos");
    });
  });

  it("falls back to Ctrl on error", async () => {
    vi.mocked(getAppInfo).mockRejectedValue(new Error("failed"));

    const { usePlatform: freshUsePlatform } = await import("./usePlatform");
    const { result } = renderHook(() => freshUsePlatform());

    await waitFor(() => {
      expect(result.current.modKey).toBe("Ctrl");
      expect(result.current.platform).toBe("unknown");
    });
  });
});
