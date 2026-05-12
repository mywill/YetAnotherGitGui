import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { readSettings, writeSettings } from "./settings";

describe("settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("readSettings", () => {
    it("invokes read_settings and parses JSON", async () => {
      vi.mocked(invoke).mockResolvedValue('{"density":"compact","theme":"dark"}');

      const result = await readSettings();

      expect(invoke).toHaveBeenCalledWith("read_settings");
      expect(result).toEqual({ density: "compact", theme: "dark" });
    });

    it("returns empty object when JSON parse fails", async () => {
      vi.mocked(invoke).mockResolvedValue("not valid json");

      const result = await readSettings();

      expect(result).toEqual({});
    });

    it("handles empty stored object", async () => {
      vi.mocked(invoke).mockResolvedValue("{}");

      const result = await readSettings();

      expect(result).toEqual({});
    });

    it("preserves layoutSizes and sectionExpanded dictionaries", async () => {
      vi.mocked(invoke).mockResolvedValue(
        '{"layoutSizes":{"left":280,"right":340},"sectionExpanded":{"branches":true,"tags":false}}'
      );

      const result = await readSettings();

      expect(result.layoutSizes).toEqual({ left: 280, right: 340 });
      expect(result.sectionExpanded).toEqual({ branches: true, tags: false });
    });
  });

  describe("writeSettings", () => {
    it("invokes write_settings with stringified JSON payload", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await writeSettings({ density: "spacious", textSize: "large" });

      expect(invoke).toHaveBeenCalledWith("write_settings", {
        data: JSON.stringify({ density: "spacious", textSize: "large" }),
      });
    });

    it("serializes empty settings object", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await writeSettings({});

      expect(invoke).toHaveBeenCalledWith("write_settings", { data: "{}" });
    });

    it("propagates invocation errors to the caller", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("disk full"));

      await expect(writeSettings({ theme: "light" })).rejects.toThrow("disk full");
    });
  });
});
