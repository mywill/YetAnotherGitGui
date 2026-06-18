import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCliArgs } from "./useCliArgs";
import { getMatches } from "@tauri-apps/plugin-cli";
import { getCurrentDir } from "../services/git";

// Mock dependencies
vi.mock("@tauri-apps/plugin-cli");
vi.mock("../services/git");

describe("useCliArgs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns loading true initially", () => {
    vi.mocked(getMatches).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useCliArgs());

    expect(result.current.loading).toBe(true);
    expect(result.current.repoPath).toBeNull();
  });

  it("uses CLI path argument when provided", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: "/custom/repo/path", occurrences: 1 },
      },
      subcommand: null,
    });

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/custom/repo/path");
  });

  it("falls back to current directory when no CLI path", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {},
      subcommand: null,
    });
    vi.mocked(getCurrentDir).mockResolvedValue("/current/working/dir");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/current/working/dir");
    expect(getCurrentDir).toHaveBeenCalled();
  });

  it("falls back to current directory when path arg is empty", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: "", occurrences: 0 },
      },
      subcommand: null,
    });
    vi.mocked(getCurrentDir).mockResolvedValue("/current/dir");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/current/dir");
  });

  it("falls back to current directory when getMatches fails", async () => {
    vi.mocked(getMatches).mockRejectedValue(new Error("CLI parsing failed"));
    vi.mocked(getCurrentDir).mockResolvedValue("/fallback/dir");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/fallback/dir");
  });

  it("falls back to '.' when both getMatches and getCurrentDir fail", async () => {
    vi.mocked(getMatches).mockRejectedValue(new Error("CLI failed"));
    vi.mocked(getCurrentDir).mockRejectedValue(new Error("getCurrentDir failed"));

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe(".");
  });

  it("ignores non-string path values", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: 123 as unknown as string, occurrences: 1 },
      },
      subcommand: null,
    });
    vi.mocked(getCurrentDir).mockResolvedValue("/default/path");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/default/path");
  });

  it("sets loading to false after resolution", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: "/repo", occurrences: 1 },
      },
      subcommand: null,
    });

    const { result } = renderHook(() => useCliArgs());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("resolves '../.' relative CLI arg against cwd to absolute path", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: "../.", occurrences: 1 },
      },
      subcommand: null,
    });
    vi.mocked(getCurrentDir).mockResolvedValue("/home/user/Code/repo/myGitTool");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/home/user/Code/repo");
  });

  it("resolves '../..' relative CLI arg chain against cwd", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: "../../other", occurrences: 1 },
      },
      subcommand: null,
    });
    vi.mocked(getCurrentDir).mockResolvedValue("/a/b/c/d");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/a/b/other");
  });

  it("resolves './subdir' relative CLI arg against cwd", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: "./subdir", occurrences: 1 },
      },
      subcommand: null,
    });
    vi.mocked(getCurrentDir).mockResolvedValue("/home/user");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repoPath).toBe("/home/user/subdir");
  });

  it("calls getCurrentDir when CLI arg is relative", async () => {
    vi.mocked(getMatches).mockResolvedValue({
      args: {
        path: { value: "../repo", occurrences: 1 },
      },
      subcommand: null,
    });
    vi.mocked(getCurrentDir).mockResolvedValue("/home/user");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getCurrentDir).toHaveBeenCalled();
    expect(result.current.repoPath).toBe("/home/repo");
  });

  it("sets loading to false even when falling back due to error", async () => {
    vi.mocked(getMatches).mockRejectedValue(new Error("Error"));
    vi.mocked(getCurrentDir).mockResolvedValue("/dir");

    const { result } = renderHook(() => useCliArgs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
