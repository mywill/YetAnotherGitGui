# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ MANDATORY: Coverage Stats in Every Response

**BEFORE saying a task is complete, you MUST:**
0. Run TypeScript type check (`npx tsc --noEmit`)
1. Run all tests (frontend, E2E, Rust)
2. Run coverage commands
3. **PRINT THE FULL COVERAGE TABLES IN YOUR RESPONSE TO THE USER**

If you do not print the coverage tables, the task is NOT complete.

---

## Important Rules for Claude

1. **Always run, fix and add new appropriate tests before finishing a task:**
   ```bash
   pnpm test && pnpm test:e2e
   ```
   ```bash
   cd src-tauri && cargo test
   ```

2. **Always run tests and print FULL coverage after ANY code change:**

   **CRITICAL: After every code change, you MUST run all tests and print the complete coverage tables FOR EACH FILE in your response to the user.**

   **Frontend (run these commands):**
   ```bash
   pnpm test:coverage --run    # Unit tests with coverage
   pnpm test:e2e               # E2E tests
   ```

   **You MUST print the COMPLETE frontend coverage table showing EVERY file:**
   ```
   Frontend Coverage (per file):
   File                      | % Stmts | % Branch | % Funcs | % Lines |
   --------------------------|---------|----------|---------|---------|
   All files                 |   XX.XX |    XX.XX |   XX.XX |   XX.XX |
   src/components/...        |   XX.XX |    XX.XX |   XX.XX |   XX.XX |
   [... every single file ...]

   Tests: X passed, X failed
   E2E: X passed
   ```

   **Backend (run these commands):**
   ```bash
   source ~/.cargo/env && cd src-tauri && cargo test
   source ~/.cargo/env && cd src-tauri && cargo llvm-cov --summary-only
   ```

   **You MUST print the COMPLETE Rust coverage table showing EVERY file:**
   ```
   Rust Coverage (per file):
   Filename                  | Regions | Functions | Lines   | Branches |
   --------------------------|---------|-----------|---------|----------|
   commands/branches.rs      |  XX.XX% |    XX.XX% |  XX.XX% |   XX.XX% |
   [... every single file ...]
   TOTAL                     |  XX.XX% |    XX.XX% |  XX.XX% |   XX.XX% |

   Tests: X passed, X failed
   ```

   **If tools are missing, install them:**
   ```bash
   source ~/.cargo/env && cargo install cargo-llvm-cov   # if llvm-cov not found
   ```

   **IMPORTANT:**
   - You must actually run these commands - do not just state the results without running them.
   - Always print the complete coverage percentages FOR EACH FILE, not abbreviated summaries.
   - This applies to EVERY code change, not just at the end of a task.
   - Do NOT truncate or abbreviate the coverage tables - show every file.
   - **The coverage tables MUST be shown IN YOUR RESPONSE TO THE USER - not just run silently.**
   - A task is NOT complete until you have printed the coverage stats for the user to see.

3. **Explicitly request missing tools/dependencies:** If a command fails due to missing system packages, browsers, or other dependencies, clearly state what is needed so the user can install them.

4. **Always ensure E2E test environment is set up:** Before running E2E tests, ensure Playwright browsers are installed. If they are missing, run:
   ```bash
   npx playwright install
   ```
   Do NOT ask the user to do this - just run it yourself.

5. **Always run linters before finishing a task:**
   ```bash
   pnpm lint && pnpm format:check
   pnpm lint:rust
   ```

6. **Always run TypeScript type check before finishing a task:**
   ```bash
   npx tsc --noEmit
   ```
   This catches type errors that Vite/esbuild skip during development. The CI build uses full `tsc` compilation, so type errors will fail the build if not caught locally.

7. **Do not run git commands unless explicitly asked:** The user will handle all git operations (staging, committing, pushing). Focus on code changes and let the user manage version control.

8. **Visually validate UI changes:** Whenever you modify CSS, layout, or any visual component, you MUST take a screenshot to verify it looks correct before considering the task done. Use Playwright to render the app with Tauri mocks and capture screenshots.

   **How to take a visual validation screenshot:**

   1. Start a Vite dev server on a free port (run in background):
      ```bash
      pnpm vite --port 5199 &
      ```

   2. Run a Playwright script to inject Tauri mocks and screenshot the page:
      ```bash
      node --input-type=module -e "
      import { chromium } from './node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs';
      import { readFileSync } from 'fs';
      import { fileURLToPath } from 'url';

      const tauriMocksModule = await import('./e2e/tauri-mocks.ts');
      // Extract the mock script string (it's the tauriMocks export)
      const mockScript = tauriMocksModule.tauriMocks;

      const browser = await chromium.launch();
      const page = await browser.newPage();

      // Inject Tauri mocks BEFORE navigating
      await page.addInitScript(mockScript);

      await page.goto('http://localhost:5199');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Take full-page screenshot
      await page.screenshot({ path: '/tmp/ui-validation.png', fullPage: true });

      // Take a zoomed-in screenshot of a specific area (e.g., header buttons)
      // const element = await page.locator('.header-right');
      // await element.screenshot({ path: '/tmp/ui-header.png', scale: 'css' });

      await browser.close();
      "
      ```

   3. View the screenshot using the Read tool on the image path (e.g., `/tmp/ui-validation.png`).

   4. If the UI looks wrong, fix the CSS/layout and re-screenshot until it looks correct.

   5. Kill the dev server when done:
      ```bash
      pkill -f "vite.*5199" || true
      ```

   **Tips:**
   - Use `page.setViewportSize({ width: 1280, height: 720 })` to test specific viewport sizes.
   - For detailed inspection, use `scale: 'css'` option and take element-level screenshots at higher scale factors with `page.setViewportSize()` or device scale.
   - The Tauri mocks in `e2e/tauri-mocks.ts` provide all the mock data (repo info, commits, file statuses, etc.) needed to render the full app without a Tauri backend.
   - The Playwright import path may need updating if the Playwright version changes — check `node_modules/.pnpm/playwright@*/` for the current version.
   - Always clean up the background Vite server to avoid file watcher exhaustion (ENOSPC errors).

## Project Overview

Yet Another Git Gui (CLI: `yagg`) is a Git GUI application built with Tauri 2.0. It provides a visual interface for Git operations including commit graph visualization, staging/unstaging files and hunks, viewing diffs, and creating commits.

## Development Commands

```bash
# Development (starts both Vite dev server and Tauri)
pnpm tauri dev

# Build for production
pnpm tauri build

# Run Rust tests
cd src-tauri && cargo test

# Type check TypeScript
npx tsc --noEmit
```

## Architecture

### Frontend (React + TypeScript)
- **Entry**: `src/main.tsx` → `src/App.tsx`
- **State Management**: Zustand stores in `src/stores/`
  - `repositoryStore.ts` - Main store for repo state, commits, file statuses, diffs
  - `selectionStore.ts` - UI selection state (view mode, selected commit/file)
  - `dialogStore.ts` - Confirmation dialog state
  - `notificationStore.ts` - Stacking notification toasts (errors auto-dismiss 10s, success 3s)
- **Tauri IPC**: All git operations go through `src/services/git.ts` which invokes Rust commands
- **Components**: `src/components/` organized by feature:
  - `graph/` - Commit graph visualization
  - `files/` - File list and staging panels
  - `diff/` - Diff viewer with hunk/line selection
  - `commit/` - Commit message input
  - `layout/` - Main layout components
  - `sidebar/` - View switcher, branch/tag lists, current branch display
  - `common/` - Shared UI components (dialogs, context menus)
  - `history/` - Commit details panel
  - `views/` - Main view containers (HistoryView, StatusView)

### Backend (Rust + Tauri)
- **Entry**: `src-tauri/src/lib.rs` registers all Tauri commands
- **Commands**: `src-tauri/src/commands/` - Tauri command handlers (repository, commits, branches, staging, diff, commit)
- **Git Operations**: `src-tauri/src/git/` - Core git logic using `git2` crate (repository, commit, graph, diff, staging)
- **State**: `src-tauri/src/state/mod.rs` - App state with repository handle
- **Errors**: `src-tauri/src/error.rs` - Error types using `thiserror`

### IPC Flow
Frontend components → Zustand actions → `git.ts` invoke() → Tauri commands → git module → git2

## Key Dependencies
- **Frontend**: React 18, Zustand, react-window (virtualization), Tailwind CSS v4, clsx
- **Backend**: Tauri 2.0, git2, serde, chrono, parking_lot

## Styling

- **Tailwind CSS v4** with CSS-based config (no `tailwind.config.js`)
- Custom theme tokens defined in `@theme` block in `src/styles/index.css`
- Key token categories: backgrounds, text, borders, status colors, branch colors, toast colors
- Toast colors (`--color-toast-success`, `--color-toast-error`) are WCAG AA compliant with white text
- `prettier-plugin-tailwindcss` auto-sorts classes
- When adding new colors, prefer adding to the `@theme` block rather than inline values

## CLI Usage
The app accepts an optional path argument: `yagg [path]` to open a specific repository.

## Testing

### Commands
```bash
# Frontend unit tests (Vitest)
pnpm test                    # Run all tests
pnpm test:ui                 # Visual test runner
pnpm test:coverage           # Run with coverage report

# Rust unit tests
cd src-tauri && cargo test   # Run all Rust tests

# E2E tests (Playwright) - uses mocked Tauri APIs
pnpm test:e2e:install        # First-time: install browsers
pnpm test:e2e                # Run E2E tests (starts Vite server automatically)
pnpm test:e2e:ui             # Run with interactive UI
```

### Test Patterns
- Frontend tests use Vitest + React Testing Library
- Component tests are co-located with components (e.g., `CommitPanel.test.tsx`)
- Tauri APIs are mocked in `src/test/setup.ts`
- Rust tests use `tempfile` for temporary git repos
- E2E tests are in `e2e/` directory with Tauri mocks in `e2e/tauri-mocks.ts`
- Zustand stores can be accessed in E2E tests via dynamic import: `await page.evaluate(async () => { const mod = await import('/src/stores/notificationStore.ts'); mod.useNotificationStore.getState().showError('test'); })`

See `TESTING.md` for comprehensive testing documentation.

## Accessibility

- E2E tests use `@axe-core/playwright` for WCAG 2 AA compliance scanning
- axe-core tests are in `e2e/app.spec.ts` under the "Accessibility - axe-core" describe block
- **Critical pattern**: axe-core only scans elements visible in the DOM at scan time. Transient UI (notifications, tooltips, dialogs) must be triggered before scanning.
- Example: notification toast contrast test triggers toasts via `page.evaluate(() => import('/src/stores/notificationStore.ts'))` before running axe
- When adding new UI with custom colors, add a corresponding axe-core E2E test
