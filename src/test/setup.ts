import { vi, beforeAll, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

// Mock Tauri API core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock Tauri CLI plugin
vi.mock("@tauri-apps/plugin-cli", () => ({
  getMatches: vi.fn().mockResolvedValue({
    args: {},
    subcommand: null,
  }),
}));

// Mock Tauri clipboard plugin
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

// Mock window.confirm and window.alert
beforeAll(() => {
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );
  vi.stubGlobal("alert", vi.fn());
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Helper to get the mocked invoke function
export async function getMockedInvoke() {
  const { invoke } = await import("@tauri-apps/api/core");
  return vi.mocked(invoke);
}

// Helper to mock a specific Tauri command
export async function mockTauriCommand<T>(command: string, response: T) {
  const { invoke } = await import("@tauri-apps/api/core");
  vi.mocked(invoke).mockImplementation(async (cmd: string) => {
    if (cmd === command) {
      return response;
    }
    throw new Error(`Unhandled command: ${cmd}`);
  });
}

// Helper to mock multiple Tauri commands
export async function mockTauriCommands(commands: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  vi.mocked(invoke).mockImplementation(async (cmd: string) => {
    if (cmd in commands) {
      return commands[cmd];
    }
    throw new Error(`Unhandled command: ${cmd}`);
  });
}
