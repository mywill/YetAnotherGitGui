import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { installCli, checkCliInstalled } from "./system";

// The mock is already set up in test/setup.ts
describe("system service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("installCli", () => {
    it("invokes install_cli command", async () => {
      vi.mocked(invoke).mockResolvedValue("/usr/local/bin/yagg");

      const result = await installCli();

      expect(invoke).toHaveBeenCalledWith("install_cli");
      expect(result).toBe("/usr/local/bin/yagg");
    });

    it("returns installation path on success", async () => {
      vi.mocked(invoke).mockResolvedValue("/opt/bin/yagg");

      const result = await installCli();

      expect(result).toBe("/opt/bin/yagg");
    });

    it("propagates errors from invoke", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Permission denied"));

      await expect(installCli()).rejects.toThrow("Permission denied");
    });
  });

  describe("checkCliInstalled", () => {
    it("invokes check_cli_installed command", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await checkCliInstalled();

      expect(invoke).toHaveBeenCalledWith("check_cli_installed");
      expect(result).toBe(true);
    });

    it("returns true when CLI is installed", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await checkCliInstalled();

      expect(result).toBe(true);
    });

    it("returns false when CLI is not installed", async () => {
      vi.mocked(invoke).mockResolvedValue(false);

      const result = await checkCliInstalled();

      expect(result).toBe(false);
    });

    it("propagates errors from invoke", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Not on macOS"));

      await expect(checkCliInstalled()).rejects.toThrow("Not on macOS");
    });
  });
});
