# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ MANDATORY: Before declaring a task complete

Run these in order, then **paste the full per-file coverage tables in your response** — running them silently or faking their running is the failure mode this rule exists to prevent:

1. **TypeScript type check** — `npx tsc --noEmit` (catches errors Vite/esbuild skip; CI uses full `tsc`).
2. **Linters** — `pnpm lint && pnpm format:check` and `pnpm lint:rust`.
3. **Frontend audit (advisory)** — `pnpm fallow:audit` (diff vs `origin/main`). Surfaces dead code, duplication, complexity hotspots, PR risk. Report findings to the user; don't block on them while the rollout is advisory. Once the baseline is clean, treat any new high-severity finding as a failure and fix it before continuing.
4. **Frontend tests + coverage** — `pnpm test:coverage --run` then `pnpm test:e2e`. If Playwright browsers are missing, run `npx playwright install` yourself — don't ask the user.
5. **Rust tests + coverage** — `source ~/.cargo/env && cd src-tauri && cargo test` then `cargo llvm-cov --summary-only`. If `llvm-cov` is missing: `cargo install cargo-llvm-cov`.
6. **Visual validation** — if you touched CSS/layout/visual components, take a screenshot (procedure in rule 3 below).

Paste the **complete** per-file tables, not summaries — every file, no truncation:

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

```
Rust Coverage (per file):
Filename                  | Regions | Functions | Lines   | Branches |
--------------------------|---------|-----------|---------|----------|
commands/branches.rs      |  XX.XX% |    XX.XX% |  XX.XX% |   XX.XX% |
[... every single file ...]
TOTAL                     |  XX.XX% |    XX.XX% |  XX.XX% |   XX.XX% |

Tests: X passed, X failed
```

A task is **not complete** until those tables are in your response to the user.

---

## Other rules

1. **Request missing tools/dependencies explicitly:** If a command fails due to missing system packages or other dependencies, clearly state what is needed so the user can install them.

2. **Do not run git commands unless explicitly asked:** The user handles all git operations (staging, committing, pushing). Focus on code changes.

3. **Visually validate UI changes:** Whenever you modify CSS, layout, or any visual component, you MUST take a screenshot to verify it looks correct before considering the task done. Use Playwright to render the app with Tauri mocks and capture screenshots.

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

# Run all checks (lint, type check, tests)
pnpm check

# Run Rust tests
cd src-tauri && cargo test

# Type check TypeScript
npx tsc --noEmit

# Static-analysis audit (dead code, duplication, complexity, PR risk)
pnpm fallow           # full report
pnpm fallow:audit     # diff-only vs origin/main
pnpm fallow:watch     # live-watch alongside pnpm dev
pnpm fallow:health    # health score readout

# One-time on fresh clone: install the pre-commit hook (runs fallow:audit)
pnpm simple-git-hooks
```

## Architecture

### Frontend (React + TypeScript)
- **Entry**: `src/main.tsx` → `src/App.tsx`
- **State Management**: Zustand stores in `src/stores/`
  - `repositoryStore.ts` - Main store for repo state, commits, file statuses, diffs
  - `selectionStore.ts` - UI selection state (view mode, selected commit/file)
  - `dialogStore.ts` - Confirmation dialog state
  - `notificationStore.ts` - Stacking notification toasts (errors auto-dismiss 10s, success 3s)
  - `commandPaletteStore.ts` - Command palette open/close state and search query
  - `settingsStore.ts` - Application settings (density, etc.)
  - `terminalStore.ts` - Terminal session state
  - `branchFilterStore.ts` - Branch/tag filter UI state
- **Tauri IPC**: `src/services/` contains Tauri IPC wrappers:
  - `git.ts` - All git operations (invokes Rust commands)
  - `clipboard.ts` - Clipboard read/write via Tauri plugin
  - `system.ts` - System commands (CLI install, app info, updates)
  - `settings.ts` - Settings persistence
  - `terminal.ts` - Terminal process / PTY communication
- **Components**: `src/components/` organized by feature:
  - `graph/` - Commit graph visualization
  - `files/` - File list and staging panels
  - `diff/` - Diff viewer with hunk/line selection
  - `commit/` - Commit message input
  - `layout/` - Main layout components
  - `sidebar/` - View switcher, branch/tag lists, stash list, current branch display
  - `common/` - Shared UI components (dialogs, context menus, command palette)
  - `history/` - Commit details panel
  - `views/` - Main view containers (HistoryView, StatusView)
  - `shell/` - UI redesign workspace shell (WorkspaceShell, WorkspaceCenter, IconRail, InspectorPanel)
  - `terminal/` - Terminal panel (xterm.js): TerminalPanel, TerminalInstance

### Backend (Rust + Tauri)
- **Entry**: `src-tauri/src/lib.rs` registers all Tauri commands
- **Commands**: `src-tauri/src/commands/` - Tauri command handlers (repository, commits, branches, staging, diff, commit, stash, system, settings, terminal)
- **Git Operations**: `src-tauri/src/git/` - Core git logic using `git2` crate (repository, commit, graph, diff, staging, stash)
- **Terminal**: `src-tauri/src/terminal/` - Shell/PTY integration backing the terminal panel
- **State**: `src-tauri/src/state/mod.rs` - App state with repository handle
- **Errors**: `src-tauri/src/error.rs` - Error types using `thiserror`
- **Crash Handler**: `src-tauri/src/crash_handler.rs` - Panic hook for crash log files
- **Update Logger**: `src-tauri/src/update_logger.rs` - Auto-update event logging
- **Test Utilities**: `src-tauri/src/test_utils.rs` - Shared test helpers (create_test_repo, etc.)

### Hooks
- `src/hooks/useContextMenu.ts` - Context menu positioning and lifecycle
- `src/hooks/useCliArgs.ts` - CLI argument parsing via Tauri plugin
- `src/hooks/useCommandPaletteSearch.ts` - Search/filter logic for command palette
- `src/hooks/usePlatform.ts` - Platform detection (macOS/Linux)

### IPC Flow
Frontend components → Zustand actions → `git.ts` invoke() → Tauri commands → git module → git2

## Key Dependencies
- **Frontend**: React 19, Zustand, react-window (virtualization), Tailwind CSS v4, clsx, date-fns
- **Backend**: Tauri 2.0, git2, serde, serde_json, chrono, parking_lot, dirs

## Styling

- **Tailwind CSS v4** with CSS-based config (no `tailwind.config.js`)
- Custom theme tokens defined in `@theme` block in `src/styles/index.css`
- Key token categories: backgrounds, text, borders, status colors, branch colors, toast colors, density spacing
- Toast colors (`--color-toast-success`, `--color-toast-error`) are WCAG AA compliant with white text
- **Density system**: `--spacing-row`, `--spacing-card-y/x`, `--spacing-section-gap`, `--spacing-rail` feed Tailwind's `--spacing-*` namespace; `[data-density="comfortable"|"spacious"]` selectors override the compact defaults
- **xterm styling**: `src/styles/index.css` imports `@xterm/xterm/css/xterm.css` for the terminal panel
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
- E2E tests are in `e2e/` directory with Tauri mocks in `e2e/tauri-mocks.ts` and shared helpers in `e2e/helpers.ts`
- Zustand stores can be accessed in E2E tests via dynamic import: `await page.evaluate(async () => { const mod = await import('/src/stores/notificationStore.ts'); mod.useNotificationStore.getState().showError('test'); })`

See `TESTING.md` for comprehensive testing documentation.

## Accessibility

- E2E tests use `@axe-core/playwright` for WCAG 2 AA compliance scanning
- axe-core tests are in `e2e/app.spec.ts` under the "Accessibility - axe-core" describe block
- **Critical pattern**: axe-core only scans elements visible in the DOM at scan time. Transient UI (notifications, tooltips, dialogs) must be triggered before scanning.
- Example: notification toast contrast test triggers toasts via `page.evaluate(() => import('/src/stores/notificationStore.ts'))` before running axe
- When adding new UI with custom colors, add a corresponding axe-core E2E test
