import { vi } from "vitest";

/**
 * Sets up a mock implementation for a Zustand store that uses the selector pattern.
 * The store must already be mocked via vi.mock() at the top of the test file.
 *
 * @example
 * // At top of test file (hoisted):
 * vi.mock("../../stores/repositoryStore", () => ({ useRepositoryStore: vi.fn() }));
 *
 * // In beforeEach or individual test:
 * mockStore(useRepositoryStore, { commits: [], isLoading: false });
 */
export function mockStore(
  mockedHook: ReturnType<typeof vi.fn> | unknown,
  state: Record<string, unknown>
): void {
  const mock = mockedHook as ReturnType<typeof vi.fn>;
  mock.mockImplementation((selector: (s: Record<string, unknown>) => unknown) => selector(state));
}
