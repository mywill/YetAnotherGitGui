# Testing Guide for Yet Another Git Gui

This document describes the testing infrastructure and patterns used in Yet Another Git Gui.

## Overview

Yet Another Git Gui uses a comprehensive testing stack:

- **Frontend Unit Tests**: Vitest + React Testing Library
- **Rust Unit Tests**: Built-in Rust test framework with tempfile
- **E2E Tests**: Playwright

## Running Tests

### Frontend Unit Tests

```bash
# Run all frontend tests
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test --watch

# Run tests with UI (visual test runner)
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage
```

### Rust Unit Tests

```bash
# Run all Rust tests
cd src-tauri && cargo test

# Run tests with output
cd src-tauri && cargo test -- --nocapture

# Run a specific test
cd src-tauri && cargo test test_name

# Run tests in a specific module
cd src-tauri && cargo test git::repository::tests
```

### E2E Tests

E2E tests use Playwright with mocked Tauri APIs. The tests run against the Vite dev server with Tauri IPC calls mocked in the browser, allowing the app to function without the actual Tauri runtime.

**First-time setup** - Install Playwright browsers (required once):
```bash
pnpm test:e2e:install
```

**Running E2E tests**:
```bash
# Run all E2E tests (starts Vite dev server automatically)
pnpm test:e2e

# Run with interactive UI
pnpm test:e2e:ui

# Run with headed browser (visible)
npx playwright test --headed

# View test report
npx playwright show-report
```

The tests automatically:
1. Start the Vite dev server on port 1420
2. Inject Tauri API mocks before each test
3. Run tests against the mocked app

## Writing Tests

### Frontend Component Tests

Component tests are located next to the component files with a `.test.tsx` extension.

**Pattern for testing components that use Zustand stores:**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyComponent } from "./MyComponent";
import { useMyStore } from "../../stores/myStore";

// Mock the store
vi.mock("../../stores/myStore", () => ({
  useMyStore: vi.fn(),
}));

describe("MyComponent", () => {
  const mockAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up store mock
    vi.mocked(useMyStore).mockImplementation((selector) => {
      const state = {
        someData: [],
        someAction: mockAction,
      };
      return typeof selector === "function" ? selector(state) : state;
    });
  });

  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });

  it("calls action on button click", () => {
    render(<MyComponent />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockAction).toHaveBeenCalled();
  });
});
```

### Frontend Store Tests

Store tests verify Zustand store behavior, including async actions.

**Pattern for testing stores:**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMyStore } from "./myStore";
import * as api from "../services/api";

vi.mock("../services/api");

describe("myStore", () => {
  beforeEach(() => {
    // Reset store state
    useMyStore.setState({ /* initial state */ });
    vi.clearAllMocks();
  });

  it("updates state on action", async () => {
    vi.mocked(api.fetchData).mockResolvedValue({ data: "test" });

    const { fetchData } = useMyStore.getState();
    await fetchData();

    expect(useMyStore.getState().data).toBe("test");
  });
});
```

### Mocking Tauri APIs

Tauri API mocks are configured in `src/test/setup.ts`. The following are pre-mocked:

- `@tauri-apps/api/core` - `invoke` function
- `@tauri-apps/plugin-cli` - `getMatches` function
- `@tauri-apps/plugin-clipboard-manager` - `writeText`, `readText` functions
- `window.confirm` and `window.alert`

**To mock a specific Tauri command:**

```ts
import { invoke } from "@tauri-apps/api/core";

vi.mocked(invoke).mockImplementation(async (cmd: string) => {
  if (cmd === "my_command") {
    return { result: "data" };
  }
  throw new Error(`Unhandled command: ${cmd}`);
});
```

### Rust Unit Tests

Rust tests are written as inline `#[cfg(test)]` modules within source files.

**Pattern for testing git operations:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_repo() -> (TempDir, Repository) {
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();

        // Configure git user
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    #[test]
    fn test_my_function() {
        let (temp_dir, repo) = create_test_repo();

        // Create files, make commits, etc.
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "content").unwrap();

        // Test your function
        let result = my_function(&repo, "test.txt");
        assert!(result.is_ok());
    }
}
```

### E2E Tests

E2E tests use Playwright with Tauri API mocks injected before each test.

**Pattern for E2E tests:**

```ts
import { test, expect } from "@playwright/test";
import { tauriMocks } from "./tauri-mocks";

test.describe("Feature", () => {
  test.beforeEach(async ({ page }) => {
    // Inject mocks BEFORE navigating to the page
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("does something", async ({ page }) => {
    // Interact with the page
    await page.click("button");

    // Assert results
    await expect(page.locator(".result")).toBeVisible();
  });
});
```

The `tauriMocks` in `e2e/tauri-mocks.ts` provides mock implementations for:
- All Tauri `invoke()` commands (git operations, file operations, etc.)
- Tauri plugin commands (CLI, clipboard)
- Callback handling (`transformCallback`, `unregisterCallback`)

### Accessibility Testing with axe-core

The E2E tests include automated accessibility scans using [@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright). These tests check for:
- WCAG 2.0/2.1 Level A and AA compliance
- Color contrast violations
- Missing form labels
- Keyboard accessibility issues

Example accessibility test:
```ts
import AxeBuilder from "@axe-core/playwright";

test("should not have accessibility issues", async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

## Test File Locations

```
src/
├── App.test.tsx
├── components/
│   ├── commit/
│   │   └── CommitPanel.test.tsx
│   ├── common/
│   │   ├── ConfirmDialog.test.tsx
│   │   └── ContextMenu.test.tsx
│   ├── diff/
│   │   ├── DiffHunk.test.tsx
│   │   └── DiffViewPanel.test.tsx
│   ├── files/
│   │   ├── FileChangesPanel.test.tsx
│   │   ├── FileItem.test.tsx
│   │   ├── StagedUnstagedPanel.test.tsx
│   │   └── UntrackedPanel.test.tsx
│   ├── graph/
│   │   ├── BranchLines.test.tsx
│   │   ├── ColumnResizer.test.tsx
│   │   ├── CommitGraph.test.tsx
│   │   └── CommitRow.test.tsx
│   ├── history/
│   │   ├── CommitDetailsPanel.test.tsx
│   │   ├── CommitFileDiff.test.tsx
│   │   └── CommitFileItem.test.tsx
│   ├── layout/
│   │   ├── AppLayout.test.tsx
│   │   └── MainLayout.test.tsx
│   ├── sidebar/
│   │   ├── BranchItem.test.tsx
│   │   ├── BranchTagList.test.tsx
│   │   ├── CliInstall.test.tsx
│   │   ├── CurrentBranch.test.tsx
│   │   ├── Sidebar.test.tsx
│   │   ├── StashDetailsPanel.test.tsx
│   │   ├── StashItem.test.tsx
│   │   ├── TagItem.test.tsx
│   │   └── ViewSwitcher.test.tsx
│   └── views/
│       ├── HistoryView.test.tsx
│       └── StatusView.test.tsx
├── hooks/
│   └── useCliArgs.test.ts
├── services/
│   ├── clipboard.test.ts
│   ├── git.test.ts
│   └── system.test.ts
├── stores/
│   ├── dialogStore.test.ts
│   ├── repositoryStore.test.ts
│   └── selectionStore.test.ts
└── test/
    └── setup.ts

src-tauri/src/
├── commands/
│   ├── branches.rs      # includes #[cfg(test)] mod tests
│   ├── commit.rs        # includes #[cfg(test)] mod tests
│   ├── commits.rs       # includes #[cfg(test)] mod tests
│   ├── diff.rs          # includes #[cfg(test)] mod tests
│   ├── repository.rs    # includes #[cfg(test)] mod tests
│   ├── staging.rs       # includes #[cfg(test)] mod tests
│   ├── stash.rs         # includes #[cfg(test)] mod tests
│   └── system.rs        # includes #[cfg(test)] mod tests
├── git/
│   ├── commit.rs        # includes #[cfg(test)] mod tests
│   ├── diff.rs          # includes #[cfg(test)] mod tests
│   ├── graph.rs         # includes #[cfg(test)] mod tests
│   ├── repository.rs    # includes #[cfg(test)] mod tests
│   ├── staging.rs       # includes #[cfg(test)] mod tests
│   └── stash.rs         # includes #[cfg(test)] mod tests
├── error.rs             # includes #[cfg(test)] mod tests
└── state/
    └── mod.rs           # includes #[cfg(test)] mod tests

e2e/
├── app.spec.ts          # E2E test specifications (75 tests)
└── tauri-mocks.ts       # Tauri API mocks for browser testing
```

## CI/CD Considerations

For continuous integration:

1. **Frontend tests** can run without any special setup:
   ```bash
   pnpm install --frozen-lockfile
   pnpm test
   ```

2. **Rust tests** require Rust toolchain:
   ```bash
   cd src-tauri
   cargo test
   ```

3. **E2E tests** require:
   - Playwright browsers installed: `pnpm test:e2e:install`
   - The Vite dev server (started automatically by Playwright)

Example GitHub Actions workflow:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  rust-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd src-tauri && cargo test

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:e2e:install
      - run: pnpm test:e2e
```

## Coverage

Generate coverage reports:

```bash
# Frontend coverage
pnpm test:coverage

# View HTML report
open coverage/index.html

# Rust coverage (requires cargo-llvm-cov)
# Install: cargo install cargo-llvm-cov
cd src-tauri && cargo llvm-cov

# Rust coverage summary only
cd src-tauri && cargo llvm-cov --summary-only

# Rust coverage HTML report
cd src-tauri && cargo llvm-cov --html
open target/llvm-cov/html/index.html
```

### Current Coverage Targets

| Layer | Lines | Functions |
|-------|-------|-----------|
| Frontend | > 90% | > 75% |
| Rust | > 85% | > 80% |

Coverage configuration is in `vitest.config.ts` for frontend and uses default settings for Rust.
