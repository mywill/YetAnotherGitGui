import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyToClipboard } from "./clipboard";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}));

describe("copyToClipboard", () => {
  let mockWriteText: ReturnType<typeof vi.fn>;
  let mockNavigatorClipboard: { writeText: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    const clipboardModule = await import("@tauri-apps/plugin-clipboard-manager");
    mockWriteText = vi.mocked(clipboardModule.writeText);

    mockNavigatorClipboard = {
      writeText: vi.fn(),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockNavigatorClipboard,
      writable: true,
      configurable: true,
    });
  });

  it("uses Tauri clipboard when available", async () => {
    mockWriteText.mockResolvedValue(undefined);

    await copyToClipboard("test text");

    expect(mockWriteText).toHaveBeenCalledWith("test text");
    expect(mockNavigatorClipboard.writeText).not.toHaveBeenCalled();
  });

  it("falls back to browser clipboard when Tauri fails", async () => {
    mockWriteText.mockRejectedValue(new Error("Tauri not available"));
    mockNavigatorClipboard.writeText.mockResolvedValue(undefined);

    await copyToClipboard("fallback text");

    expect(mockWriteText).toHaveBeenCalledWith("fallback text");
    expect(mockNavigatorClipboard.writeText).toHaveBeenCalledWith("fallback text");
  });

  it("handles both clipboard methods failing silently", async () => {
    mockWriteText.mockRejectedValue(new Error("Tauri not available"));
    mockNavigatorClipboard.writeText.mockRejectedValue(new Error("Browser clipboard failed"));

    // Should not throw
    await expect(copyToClipboard("test")).resolves.toBeUndefined();
  });

  it("handles missing navigator.clipboard", async () => {
    mockWriteText.mockRejectedValue(new Error("Tauri not available"));

    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // Should not throw
    await expect(copyToClipboard("test")).resolves.toBeUndefined();
  });

  it("copies empty string", async () => {
    mockWriteText.mockResolvedValue(undefined);

    await copyToClipboard("");

    expect(mockWriteText).toHaveBeenCalledWith("");
  });

  it("copies multiline text", async () => {
    mockWriteText.mockResolvedValue(undefined);

    const multilineText = "line 1\nline 2\nline 3";
    await copyToClipboard(multilineText);

    expect(mockWriteText).toHaveBeenCalledWith(multilineText);
  });

  it("copies text with special characters", async () => {
    mockWriteText.mockResolvedValue(undefined);

    const specialText = "Hello <script>alert('xss')</script> & \"quotes\" 'apostrophes'";
    await copyToClipboard(specialText);

    expect(mockWriteText).toHaveBeenCalledWith(specialText);
  });
});
