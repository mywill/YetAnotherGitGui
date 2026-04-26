import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tauriMocks } from "./tauri-mocks";
import {
  switchToStatusView,
  switchToHistoryView,
  switchToBranchesView,
  switchToStashesView,
  expandBranchSection,
} from "./helpers";
import { assertContrastClean } from "./contrast-helper";

/**
 * E2E tests for Yet Another Git Gui
 *
 * These tests run against the Vite dev server with Tauri APIs mocked.
 * The mocks are injected before the page loads, allowing the app to run
 * in the browser without the actual Tauri runtime.
 *
 * The app now has two views:
 * - Status View (default): Shows file changes + diff view + commit panel
 * - History View: Shows commit graph + commit details
 *
 * To run: npm run test:e2e
 */

test.describe("Yet Another Git Gui Application", () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mocks BEFORE navigating to the page
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    // Wait for app to initialize with mocked data
    await page.waitForLoadState("networkidle");
  });

  test("app loads and displays main layout", async ({ page }) => {
    // Check that the app container is present
    await expect(page.locator(".app")).toBeVisible({ timeout: 10000 });
    // Check header is present
    await expect(page.locator(".app-header")).toBeVisible();
    await expect(page.locator(".app-title")).toHaveText("Yet Another Git Gui");
  });

  test("displays commit panel in status view", async ({ page }) => {
    // Switch to Status View first
    await switchToStatusView(page);

    // Look for commit panel elements
    const commitPanel = page.locator(".commit-panel");
    await expect(commitPanel).toBeVisible({ timeout: 10000 });

    // Check for commit message input
    const textarea = page.locator('textarea[placeholder="Commit message..."]');
    await expect(textarea).toBeVisible();

    // Check for commit button
    const commitButton = page.locator(".commit-button");
    await expect(commitButton).toBeVisible();
  });

  test("displays file changes panel in status view", async ({ page }) => {
    // Switch to Status View first
    await switchToStatusView(page);

    // Look for file changes sections - use exact text matching
    await expect(page.getByText("Staged", { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Unstaged", { exact: true })).toBeVisible();
    await expect(page.getByText("Untracked", { exact: true })).toBeVisible();
  });

  test("commit button is disabled when no staged files or no message", async ({ page }) => {
    // Switch to Status View first
    await switchToStatusView(page);

    // The commit button should be disabled initially (no message entered)
    const commitButton = page.locator(".commit-button");
    await expect(commitButton).toBeVisible({ timeout: 10000 });
    await expect(commitButton).toBeDisabled();
  });

  test("can type in commit message", async ({ page }) => {
    // Switch to Status View first
    await switchToStatusView(page);

    const textarea = page.locator('textarea[placeholder="Commit message..."]');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill("Test commit message");
    await expect(textarea).toHaveValue("Test commit message");
  });

  test("keyboard shortcut hint is displayed", async ({ page }) => {
    // Switch to Status View first
    await switchToStatusView(page);

    // Check for keyboard shortcut hint in commit panel
    await expect(page.locator(".commit-hint")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".commit-hint")).toHaveText("Cmd+Enter to commit");
  });

  test("displays repository info in header", async ({ page }) => {
    // Check for repo path display
    await expect(page.locator(".repo-path")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".repo-path")).toHaveText("/mock/repo/path");

    // Check for branch indicator in status bar
    await expect(page.locator(".status-bar .branch-indicator")).toBeVisible();
    await expect(page.locator(".status-bar .branch-indicator")).toHaveText("main");
  });

  test("refresh button is present", async ({ page }) => {
    const refreshButton = page.getByRole("button", { name: "Refresh" });
    await expect(refreshButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("File Staging Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Switch to Status View for all staging tests
    await switchToStatusView(page);
  });

  test("displays file counts in section headers", async ({ page }) => {
    // Use exact match for Staged section (not matching Unstaged)
    const stagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Staged", { exact: true }) });
    const stagedCount = stagedSection.locator(".section-count");
    await expect(stagedCount).toBeVisible({ timeout: 10000 });
    // Mock data has 1 staged file
    await expect(stagedCount).toHaveText("1");

    const unstagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Unstaged", { exact: true }) });
    const unstagedCount = unstagedSection.locator(".section-count");
    // Mock data has 4 unstaged files (3 modified + 1 conflicted)
    await expect(unstagedCount).toHaveText("4");

    const untrackedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Untracked", { exact: true }) });
    const untrackedCount = untrackedSection.locator(".section-count");
    // Mock data has 2 untracked files
    await expect(untrackedCount).toHaveText("2");
  });

  test("Stage All button appears when there are unstaged files", async ({ page }) => {
    // Mock data has unstaged files, so Stage All should be visible in Unstaged section
    const unstagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Unstaged", { exact: true }) });
    await expect(unstagedSection).toBeVisible({ timeout: 10000 });

    const stageAllButton = unstagedSection.locator("button", {
      hasText: "Stage All",
    });
    await expect(stageAllButton).toBeVisible();
  });

  test("Unstage All button appears when there are staged files", async ({ page }) => {
    // Use exact match for Staged section
    const stagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Staged", { exact: true }) });
    await expect(stagedSection).toBeVisible({ timeout: 10000 });

    const unstageAllButton = stagedSection.locator("button", {
      hasText: "Unstage All",
    });
    await expect(unstageAllButton).toBeVisible();
  });

  test("displays mock file items", async ({ page }) => {
    // Check that mock files are displayed - use exact file name matching
    await expect(
      page.locator(".file-item").filter({ hasText: /^M\s*staged-file\.ts$/ })
    ).toBeVisible({ timeout: 10000 });

    // Mock data has 3 unstaged files: unstaged-file1.ts, unstaged-file2.ts, unstaged-file3.ts
    await expect(
      page.locator(".file-item").filter({ hasText: /unstaged-file1\.ts/ })
    ).toBeVisible();

    // Mock data has 2 untracked files: new-file1.ts, new-file2.ts
    await expect(page.locator(".file-item").filter({ hasText: /new-file1\.ts/ })).toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Switch to Status View for accessibility tests on commit/file panels
    await switchToStatusView(page);
  });

  test("commit button has accessible name", async ({ page }) => {
    const commitButton = page.locator(".commit-button");
    await expect(commitButton).toBeVisible({ timeout: 10000 });

    // Button should have text content
    const text = await commitButton.textContent();
    expect(text?.toLowerCase()).toContain("commit");
  });

  test("textarea has placeholder text", async ({ page }) => {
    const textarea = page.locator("textarea.commit-message-input");
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await expect(textarea).toHaveAttribute("placeholder", "Commit message...");
  });
});

test.describe("Commit Graph", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Switch to History View since Status is now the default
    await switchToHistoryView(page);
  });

  test("displays commit graph container", async ({ page }) => {
    // The commit graph container should be visible
    const commitGraph = page.locator(".commit-graph");
    await expect(commitGraph).toBeVisible({ timeout: 10000 });
  });

  test("displays commit graph header with column names", async ({ page }) => {
    // Header should be visible with all column names
    const header = page.locator(".commit-graph-header");
    await expect(header).toBeVisible({ timeout: 10000 });
    await expect(header.getByText("Graph")).toBeVisible();
    await expect(header.getByText("Message")).toBeVisible();
    await expect(header.getByText("Author")).toBeVisible();
    await expect(header.getByText("Date")).toBeVisible();
  });

  test("renders commit rows from mock data", async ({ page }) => {
    // Commit rows should be rendered
    const commitRows = page.locator(".commit-row");
    await expect(commitRows.first()).toBeVisible({ timeout: 10000 });

    // Count should match mock (5 commits in mock data)
    await expect(commitRows).toHaveCount(5);
  });

  test("displays commit message in commit row", async ({ page }) => {
    // Should show the mock commit message in the first commit row
    await expect(page.locator(".commit-row .commit-message").first()).toHaveText("Initial commit", {
      timeout: 10000,
    });
  });

  test("displays commit author in commit row", async ({ page }) => {
    // Should show author name from mock in the first commit row
    await expect(page.locator(".commit-row").first().getByText("Test User")).toBeVisible({
      timeout: 10000,
    });
  });

  test("commit row is clickable and selectable", async ({ page }) => {
    const commitRow = page.locator(".commit-row").first();
    await expect(commitRow).toBeVisible({ timeout: 10000 });

    // Click the commit row
    await commitRow.click();

    // Should be marked selected via aria (HEAD rows keep is-head styling
    // instead of the .selected class so the HEAD indicator is never overridden)
    await expect(commitRow).toHaveAttribute("aria-selected", "true");
  });

  test("displays HEAD badge on current commit", async ({ page }) => {
    // HEAD badge should be visible
    await expect(page.locator(".head-badge")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".head-badge")).toHaveText("HEAD");
  });

  test("displays branch ref badge", async ({ page }) => {
    // Main branch badge should be visible (from mock refs)
    await expect(page.locator(".ref-badge").getByText("main")).toBeVisible({
      timeout: 10000,
    });
  });

  test("every visible commit has a graph node circle", async ({ page }) => {
    // Every commit row should have a circle SVG element for the node
    const commitRows = page.locator(".commit-row");
    await expect(commitRows.first()).toBeVisible({ timeout: 10000 });

    const count = await commitRows.count();
    for (let i = 0; i < count; i++) {
      const graphCol = commitRows.nth(i).locator(".graph-col");
      const circle = graphCol.locator("svg circle");
      await expect(circle).toBeVisible();
    }
  });

  test("graph lines are continuous across rows", async ({ page }) => {
    // With the mock data that includes branches and merges,
    // verify that SVG line/path elements exist in commit rows
    const commitRows = page.locator(".commit-row");
    await expect(commitRows.first()).toBeVisible({ timeout: 10000 });

    // The merge commit (2nd row) should have line elements
    const mergeRow = commitRows.nth(1);
    const graphCol = mergeRow.locator(".graph-col");
    const svg = graphCol.locator("svg");
    await expect(svg).toBeVisible();

    // Should have path element for merge curve
    const mergePath = svg.locator("path");
    await expect(mergePath).toBeVisible();

    // Verify that SVG elements (lines or paths) are rendered in graph columns
    // across multiple rows, confirming graph continuity
    const fourthRow = commitRows.nth(3);
    const fourthGraphCol = fourthRow.locator(".graph-col");
    const fourthSvg = fourthGraphCol.locator("svg");
    // The 4th row has pass-through and from-above lines - check SVG has child elements
    const svgChildCount = await fourthSvg.locator("line, path").count();
    expect(svgChildCount).toBeGreaterThan(0);
  });

  test("graph column renders branch lines SVG", async ({ page }) => {
    // Graph column should have SVG for branch lines
    const graphCol = page.locator(".graph-col").first();
    await expect(graphCol).toBeVisible({ timeout: 10000 });

    // Should contain an SVG element
    const svg = graphCol.locator("svg");
    await expect(svg).toBeVisible();
  });

  test("displays commit details panel when commit is selected", async ({ page }) => {
    // Click a commit
    const commitRow = page.locator(".commit-row").first();
    await commitRow.click();

    // Commit details panel should show the commit info
    const detailsPanel = page.locator(".commit-details-panel");
    await expect(detailsPanel).toBeVisible({ timeout: 10000 });

    // Should show commit hash
    await expect(detailsPanel.locator(".hash")).toBeVisible();
  });
});

test.describe("Accessibility - axe-core", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Wait for UI to fully render
    await page.waitForSelector(".app", { timeout: 10000 });
  });

  test("should not have any automatically detectable accessibility issues", async ({ page }) => {
    // Broad rule sweep (focus order, alt text, roles, etc.). Contrast is
    // covered separately by assertContrastClean below so AAA also runs.
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log("Accessibility violations:");
      accessibilityScanResults.violations.forEach((violation) => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Help: ${violation.helpUrl}`);
        violation.nodes.forEach((node) => {
          console.log(`  Element: ${node.html}`);
        });
      });
    }

    expect(accessibilityScanResults.violations).toEqual([]);

    await assertContrastClean(page);
  });

  test("commit panel should pass color contrast checks", async ({ page }) => {
    await switchToStatusView(page);
    await assertContrastClean(page, ".commit-panel");
  });

  test("file changes panel should pass color contrast checks", async ({ page }) => {
    await switchToStatusView(page);
    await assertContrastClean(page, ".staged-unstaged-panel");
  });

  test("commit graph should pass color contrast checks", async ({ page }) => {
    await switchToHistoryView(page);
    await assertContrastClean(page, ".commit-graph");
  });

  test("buttons should be keyboard accessible", async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).withTags(["wcag2a"]).analyze();

    const keyboardViolations = accessibilityScanResults.violations.filter(
      (v) =>
        v.id === "button-name" || v.id === "focus-order-semantics" || v.id === "focusable-no-name"
    );
    expect(keyboardViolations).toEqual([]);
  });

  test("notification toasts should pass color contrast checks", async ({ page }) => {
    // Trigger notifications via the Zustand store so toast nodes mount in the
    // DOM before axe scans them.
    await page.evaluate(async () => {
      const mod = await import("/src/stores/notificationStore.ts");
      mod.useNotificationStore.getState().showSuccess("Test success");
      mod.useNotificationStore.getState().showError("Test error");
    });
    await page.waitForSelector(".notification-toast", { timeout: 5000 });
    await assertContrastClean(page, ".notification-toast");
  });

  test("form elements should have labels", async ({ page }) => {
    // Switch to Status View to test form elements (commit message textarea)
    await switchToStatusView(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const labelViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === "label" || v.id === "label-title-only"
    );
    expect(labelViolations).toEqual([]);
  });

  test("light mode should pass overall color contrast checks", async ({ page }) => {
    await page.evaluate(async () => {
      const mod = await import("/src/stores/settingsStore.ts");
      mod.useSettingsStore.getState().setTheme("light");
    });
    await page.waitForTimeout(200);
    await assertContrastClean(page);
  });

  test("light mode commit graph should pass color contrast checks", async ({ page }) => {
    await switchToHistoryView(page);
    await page.evaluate(async () => {
      const mod = await import("/src/stores/settingsStore.ts");
      mod.useSettingsStore.getState().setTheme("light");
    });
    await page.waitForTimeout(200);
    await assertContrastClean(page, ".commit-graph");
  });
});

test.describe("View Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("switches between Status and History views", async ({ page }) => {
    // Start in Status view (default)
    await expect(page.locator(".status-view")).toBeVisible({ timeout: 10000 });

    // Switch to History view
    await switchToHistoryView(page);
    await expect(page.locator(".history-view")).toBeVisible();
    await expect(page.locator(".status-view")).not.toBeVisible();

    // Switch back to Status view
    await switchToStatusView(page);
    await expect(page.locator(".status-view")).toBeVisible();
    await expect(page.locator(".history-view")).not.toBeVisible();
  });

  test("view tabs show correct active state", async ({ page }) => {
    // Status tab (Working Copy) should be active initially
    const statusTab = page.locator('button[role="tab"][aria-label="Working Copy"]');
    const historyTab = page.locator('button[role="tab"][aria-label="History"]');

    await expect(statusTab).toHaveAttribute("aria-selected", "true");
    await expect(historyTab).toHaveAttribute("aria-selected", "false");

    // Switch to history
    await historyTab.click();
    await expect(historyTab).toHaveAttribute("aria-selected", "true");
    await expect(statusTab).toHaveAttribute("aria-selected", "false");
  });
});

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("F5 refreshes repository", async ({ page }) => {
    // Wait for app to load
    await expect(page.locator(".app")).toBeVisible({ timeout: 10000 });

    // Press F5
    await page.keyboard.press("F5");

    // App should still be visible (refresh completed)
    await expect(page.locator(".app")).toBeVisible();
  });

  test("Ctrl+R refreshes repository", async ({ page }) => {
    // Wait for app to load
    await expect(page.locator(".app")).toBeVisible({ timeout: 10000 });

    // Press Ctrl+R
    await page.keyboard.press("Control+r");

    // App should still be visible (refresh completed)
    await expect(page.locator(".app")).toBeVisible();
  });
});

test.describe("Branches & Tags", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToBranchesView(page);
  });

  test("displays current branch", async ({ page }) => {
    const currentBranch = page.locator(".current-branch");
    await expect(currentBranch).toBeVisible({ timeout: 10000 });
    await expect(currentBranch).toContainText("main");
  });

  test("displays branch list sections", async ({ page }) => {
    await expect(page.locator(".branch-tag-list")).toBeVisible({
      timeout: 10000,
    });

    // Check sections are present
    await expect(page.getByText("Local Branches")).toBeVisible();
    await expect(page.getByText("Remote Branches")).toBeVisible();
    await expect(page.getByText("Tags")).toBeVisible();
  });

  test("branch sections can be expanded and collapsed", async ({ page }) => {
    await expect(page.locator(".branch-tag-list")).toBeVisible({
      timeout: 10000,
    });

    const toggle = page.getByRole("button", { name: "Toggle Local Branches" });

    // Starts collapsed
    await expect(toggle.locator(".expand-icon")).not.toHaveClass(/expanded/);

    // Expand
    await toggle.click();
    await expect(toggle.locator(".expand-icon")).toHaveClass(/expanded/);

    // Collapse again
    await toggle.click();
    await expect(toggle.locator(".expand-icon")).not.toHaveClass(/expanded/);
  });

  test("shows branch items in Local Branches section when expanded", async ({ page }) => {
    await expect(page.locator(".branch-tag-list")).toBeVisible({
      timeout: 10000,
    });
    await expandBranchSection(page, "Local Branches");

    // Mock data includes main and feature/test branches
    await expect(page.locator(".branch-item[title='main']")).toBeVisible();
    await expect(page.locator(".branch-item[title='feature/test']")).toBeVisible();
  });

  test("shows tag items in Tags section when expanded", async ({ page }) => {
    await expect(page.locator(".branch-tag-list")).toBeVisible({
      timeout: 10000,
    });
    await expandBranchSection(page, "Tags");

    // Mock data includes v1.0.0 and v0.9.0 tags
    await expect(page.locator(".tag-item").filter({ hasText: "v1.0.0" })).toBeVisible();
    await expect(page.locator(".tag-item").filter({ hasText: "v0.9.0" })).toBeVisible();
  });
});

test.describe("Commit Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("commit button enables when message is entered and files are staged", async ({ page }) => {
    const commitButton = page.locator(".commit-button");
    const textarea = page.locator('textarea[placeholder="Commit message..."]');

    // Initially disabled
    await expect(commitButton).toBeDisabled();

    // Enter commit message
    await textarea.fill("Test commit message");

    // Button should be enabled now (mock data has staged files)
    await expect(commitButton).toBeEnabled();
  });

  test("commit message input clears after successful commit", async ({ page }) => {
    const textarea = page.locator('textarea[placeholder="Commit message..."]');

    // Enter commit message
    await textarea.fill("Test commit message");
    await expect(textarea).toHaveValue("Test commit message");

    // Click commit
    const commitButton = page.locator(".commit-button");
    await commitButton.click();

    // Textarea should be cleared after commit
    await expect(textarea).toHaveValue("");
  });
});

test.describe("Context Menus", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("commit row shows context menu on right click", async ({ page }) => {
    await switchToHistoryView(page);

    const commitRow = page.locator(".commit-row").first();
    await expect(commitRow).toBeVisible({ timeout: 10000 });

    // Right-click to show context menu
    await commitRow.click({ button: "right" });

    // Context menu should appear
    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Should have copy hash option
    await expect(contextMenu.getByText("Copy commit hash")).toBeVisible();

    // Should have checkout option
    await expect(contextMenu.getByText("Checkout commit")).toBeVisible();
  });

  test("context menu closes on outside click", async ({ page }) => {
    await switchToHistoryView(page);

    const commitRow = page.locator(".commit-row").first();
    await commitRow.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Click outside the context menu
    await page.locator(".app-header").click();

    // Context menu should close
    await expect(contextMenu).not.toBeVisible();
  });

  test("context menu closes on Escape", async ({ page }) => {
    await switchToHistoryView(page);

    const commitRow = page.locator(".commit-row").first();
    await commitRow.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Context menu should close
    await expect(contextMenu).not.toBeVisible();
  });
});

test.describe("Stash Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStashesView(page);
  });

  test("clicking stash shows stash details", async ({ page }) => {
    // Click on stash item
    const stashItem = page.locator(".stash-item").first();
    await stashItem.click();

    // Stash details panel should show in inspector
    const stashDetails = page.locator(".stash-details-panel");
    await expect(stashDetails).toBeVisible({ timeout: 10000 });
  });

  test("stash shows context menu on right click", async ({ page }) => {
    const stashItem = page.locator(".stash-item").first();
    await stashItem.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Should have Apply and Delete options
    await expect(contextMenu.getByText("Apply")).toBeVisible();
    await expect(contextMenu.getByText("Delete")).toBeVisible();
  });
});

test.describe("Branch Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToBranchesView(page);
    await expandBranchSection(page, "Local Branches");
  });

  test("branch shows context menu on right click", async ({ page }) => {
    // Find a non-head branch (feature/test)
    const branchItem = page.locator(".branch-item").filter({ hasText: "feature/test" });
    await branchItem.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Should have checkout and delete options
    await expect(contextMenu.getByText("Checkout")).toBeVisible();
    await expect(contextMenu.getByText("Delete")).toBeVisible();
  });

  test("double-click on branch checks it out", async ({ page }) => {
    const branchItem = page.locator(".branch-item").filter({ hasText: "feature/test" });
    await branchItem.dblclick();

    // Should trigger checkout (in mock, this would succeed silently)
    // We can verify the app is still responsive after the action
    await expect(page.locator(".app")).toBeVisible();
  });
});

test.describe("Tag Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToBranchesView(page);
    await expandBranchSection(page, "Tags");
  });

  test("tag shows context menu on right click", async ({ page }) => {
    const tagItem = page.locator(".tag-item").filter({ hasText: "v1.0.0" });
    await tagItem.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Should have checkout and delete options
    await expect(contextMenu.getByText("Checkout")).toBeVisible();
    await expect(contextMenu.getByText("Delete")).toBeVisible();
  });
});

test.describe("Scroll-to-commit on tag click", () => {
  // Override the default mocks with a 100-commit history so scrolling is
  // meaningful, and pin v1.0.0 near the bottom (row 80). Proves that clicking
  // a tag both switches to history view AND moves the viewport.
  const largeRepoMock = `
    const ORIG_INVOKE = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      if (cmd === 'get_all_commit_graph' || cmd === 'get_commit_graph') {
        const out = [];
        for (let i = 0; i < 100; i++) {
          out.push({
            hash: 'h' + String(i).padStart(15, '0'),
            short_hash: 'h' + String(i).padStart(6, '0'),
            message: 'Commit #' + i,
            author_name: 'Test',
            author_email: 't@e.com',
            timestamp: Date.now() / 1000 - i * 3600,
            parent_hashes: i < 99 ? ['h' + String(i + 1).padStart(15, '0')] : [],
            column: 0,
            lines: [{ from_column: 0, to_column: 0, is_merge: false, line_type: i === 0 || i === 99 ? 'from_above' : 'pass_through' }],
            refs: i === 0 ? [{ name: 'main', ref_type: 'branch', is_head: true }]
                 : i === 80 ? [{ name: 'v1.0.0', ref_type: 'tag', is_head: false }]
                 : [],
            is_tip: i === 0,
          });
        }
        return out;
      }
      if (cmd === 'list_tags') {
        return [{ name: 'v1.0.0', target_hash: 'h' + String(80).padStart(15, '0'), is_annotated: true, message: 'Release 1.0' }];
      }
      if (cmd === 'list_branches') {
        return [{ name: 'main', is_remote: false, is_head: true, target_hash: 'h' + String(0).padStart(15, '0') }];
      }
      return ORIG_INVOKE(cmd, args);
    };
  `;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.addInitScript(largeRepoMock);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("clicking a tag scrolls the commit graph so the tagged commit is visible", async ({
    page,
  }) => {
    // Start on Branches view, expand Tags.
    await switchToBranchesView(page);
    await expandBranchSection(page, "Tags");

    // Click v1.0.0 — wired to selectAndScrollToCommit(tag.target_hash).
    await page.locator(".tag-item").filter({ hasText: "v1.0.0" }).click();

    // View must flip to history.
    await expect(page.locator(".history-view")).toBeVisible({ timeout: 5000 });

    // The tagged commit's row (index 80) must appear in the DOM — react-window
    // only renders rows near the current scroll offset, so finding "Commit #80"
    // proves the list scrolled.
    await expect(page.locator(".commit-row").filter({ hasText: "Commit #80" })).toBeVisible({
      timeout: 5000,
    });

    // And "Commit #0" (the top of the list) must NOT be visible — guarantees
    // the scroll actually moved the viewport rather than the content extending
    // so far that both are on screen.
    await expect(page.locator(".commit-row").filter({ hasText: /^Commit #0Test/ })).toHaveCount(0);

    // The scroll container's scrollTop should be non-zero (belt-and-suspenders).
    const scrollTop = await page.evaluate(() => {
      const graph = document.querySelector(".commit-graph");
      if (!graph) return 0;
      const candidates = Array.from(graph.querySelectorAll("*")) as HTMLElement[];
      const scroller = candidates.find((el) => {
        const s = getComputedStyle(el);
        return (
          (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight
        );
      });
      return scroller?.scrollTop ?? 0;
    });
    expect(scrollTop).toBeGreaterThan(0);
  });
});

test.describe("Diff Viewing", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("clicking on a file shows diff panel", async ({ page }) => {
    // Click on an unstaged file
    const fileItem = page.locator(".file-item").first();
    await expect(fileItem).toBeVisible({ timeout: 10000 });
    await fileItem.click();

    // Diff panel should appear with content
    const diffPanel = page.locator(".diff-view-panel");
    await expect(diffPanel).toBeVisible({ timeout: 10000 });
  });

  test("diff panel shows file path in header", async ({ page }) => {
    const fileItem = page.locator(".file-item").first();
    await fileItem.click();

    const diffPanel = page.locator(".diff-view-panel");
    await expect(diffPanel).toBeVisible({ timeout: 10000 });

    // Should show the file path in header
    await expect(diffPanel.locator(".diff-header")).toBeVisible();
  });

  test("diff panel shows hunks when file has changes", async ({ page }) => {
    const fileItem = page.locator(".file-item").first();
    await fileItem.click();

    const diffPanel = page.locator(".diff-view-panel");
    await expect(diffPanel).toBeVisible({ timeout: 10000 });

    // Should show at least one hunk (mock data has hunks)
    const hunks = diffPanel.locator(".diff-hunk");
    await expect(hunks.first()).toBeVisible();
  });
});

test.describe("File Context Menus", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("file item shows context menu on right click", async ({ page }) => {
    // Find any file item with context menu support
    const fileItem = page.locator(".file-item").first();
    await expect(fileItem).toBeVisible({ timeout: 10000 });
    await fileItem.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();
  });

  test("untracked file shows delete option in context menu", async ({ page }) => {
    // Find the untracked file (in untracked panel with ? status icon)
    const untrackedFile = page.locator(".file-item").filter({ hasText: "?" }).first();
    await expect(untrackedFile).toBeVisible({ timeout: 10000 });
    await untrackedFile.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.getByText("Delete file")).toBeVisible();
  });

  test("file context menu shows Copy submenu with path options", async ({ page }) => {
    const fileItem = page.locator(".file-item").first();
    await expect(fileItem).toBeVisible({ timeout: 10000 });
    await fileItem.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Copy item should be visible
    const copyItem = contextMenu.locator(".context-menu-item.has-submenu", { hasText: "Copy" });
    await expect(copyItem).toBeVisible();

    // Hover to open submenu
    await copyItem.hover();

    // Submenu options should appear
    const submenu = copyItem.locator(".context-submenu");
    await expect(submenu).toBeVisible();
    await expect(submenu.getByText("Relative path")).toBeVisible();
    await expect(submenu.getByText("Absolute path")).toBeVisible();
    await expect(submenu.getByText("File name")).toBeVisible();
  });

  test("right-click does not select or load diff for any file", async ({ page }) => {
    // Verify no file is selected and no diff panel before right-click
    await expect(page.locator(".file-item.selected")).toHaveCount(0);

    // Right-click a file (use second file to avoid default-first-item edge cases)
    const fileItems = page.locator(".file-item");
    await expect(fileItems.first()).toBeVisible({ timeout: 10000 });
    const target = (await fileItems.count()) > 1 ? fileItems.nth(1) : fileItems.first();
    await target.click({ button: "right" });

    // Context menu should appear
    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    // Hover over each context menu item (the real bug trigger)
    const menuItems = contextMenu.locator(".context-menu-item");
    const menuCount = await menuItems.count();
    for (let i = 0; i < menuCount; i++) {
      await menuItems.nth(i).hover();
      await page.waitForTimeout(100);
    }

    // No file should be selected after right-click + hovering menu items
    await expect(page.locator(".file-item.selected")).toHaveCount(0);
  });

  test("clicking Copy submenu item closes the context menu", async ({ page }) => {
    const fileItem = page.locator(".file-item").first();
    await expect(fileItem).toBeVisible({ timeout: 10000 });
    await fileItem.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();

    const copyItem = contextMenu.locator(".context-menu-item.has-submenu", { hasText: "Copy" });
    await copyItem.hover();

    const submenu = copyItem.locator(".context-submenu");
    await expect(submenu).toBeVisible();

    // Click "File name" in submenu
    await submenu.getByText("File name").click();

    // Context menu should close
    await expect(contextMenu).not.toBeVisible();
  });
});

test.describe("Batch Delete", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("Delete Selected button appears when multiple untracked files are selected", async ({
    page,
  }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "new-file1.ts" });
    const file2 = page.locator(".file-item").filter({ hasText: "new-file2.ts" });
    await expect(file1).toBeVisible({ timeout: 10000 });

    await file1.click();
    await file2.click({ modifiers: ["ControlOrMeta"] });

    const untrackedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Untracked", { exact: true }) });
    await expect(untrackedSection.locator("button", { hasText: "Delete Selected" })).toBeVisible();
  });

  test("Delete Selected button appears when multiple unstaged files are selected", async ({
    page,
  }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "unstaged-file1.ts" });
    const file2 = page.locator(".file-item").filter({ hasText: "unstaged-file2.ts" });
    await expect(file1).toBeVisible({ timeout: 10000 });

    await file1.click();
    await file2.click({ modifiers: ["ControlOrMeta"] });

    const unstagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Unstaged", { exact: true }) });
    await expect(unstagedSection.locator("button", { hasText: "Delete Selected" })).toBeVisible();
  });

  test("right-click on a multi-selected untracked file shows batch delete entry", async ({
    page,
  }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "new-file1.ts" });
    const file2 = page.locator(".file-item").filter({ hasText: "new-file2.ts" });
    await expect(file1).toBeVisible({ timeout: 10000 });

    await file1.click();
    await file2.click({ modifiers: ["ControlOrMeta"] });
    await file1.click({ button: "right" });

    const contextMenu = page.locator(".context-menu");
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.getByText("Delete 2 files")).toBeVisible();
  });

  test("Delete Selected confirmation lists every selected path", async ({ page }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "new-file1.ts" });
    const file2 = page.locator(".file-item").filter({ hasText: "new-file2.ts" });
    await expect(file1).toBeVisible({ timeout: 10000 });

    await file1.click();
    await file2.click({ modifiers: ["ControlOrMeta"] });

    const untrackedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Untracked", { exact: true }) });
    await untrackedSection.locator("button", { hasText: "Delete Selected" }).click();

    const dialogBody = page.locator(".confirm-dialog-body");
    await expect(dialogBody).toBeVisible();
    await expect(dialogBody).toContainText("Delete 2 files?");
    await expect(dialogBody).toContainText("new-file1.ts");
    await expect(dialogBody).toContainText("new-file2.ts");

    // Cancel cleans up
    await page.locator(".dialog-btn.cancel").click();
  });

  test("Delete key returns focus to the list after the dialog closes", async ({ page }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "new-file1.ts" });
    await expect(file1).toBeVisible({ timeout: 10000 });
    await file1.click();

    // Press Delete to invoke the keyboard delete path on the listbox
    await page.keyboard.press("Delete");

    const dialog = page.locator(".confirm-dialog");
    await expect(dialog).toBeVisible();

    // Cancel — the listbox in the untracked panel should regain focus
    await page.locator(".dialog-btn.cancel").click();
    await expect(dialog).not.toBeVisible();

    const listFocused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (
        el?.getAttribute("role") === "listbox" &&
        el.getAttribute("aria-label") === "Untracked files"
      );
    });
    expect(listFocused).toBe(true);
  });
});

test.describe("Commit Details", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToHistoryView(page);
  });

  test("commit details shows author information", async ({ page }) => {
    const commitRow = page.locator(".commit-row").first();
    await commitRow.click();

    const detailsPanel = page.locator(".commit-details-panel");
    await expect(detailsPanel).toBeVisible({ timeout: 10000 });

    // Should show author
    await expect(detailsPanel).toContainText("Test User");
  });

  test("commit details shows commit message", async ({ page }) => {
    const commitRow = page.locator(".commit-row").first();
    await commitRow.click();

    const detailsPanel = page.locator(".commit-details-panel");
    await expect(detailsPanel).toBeVisible({ timeout: 10000 });

    // Should show message
    await expect(detailsPanel).toContainText("Initial commit");
  });

  test("commit details shows files changed", async ({ page }) => {
    const commitRow = page.locator(".commit-row").first();
    await commitRow.click();

    const detailsPanel = page.locator(".commit-details-panel");
    await expect(detailsPanel).toBeVisible({ timeout: 10000 });

    // Should show files changed section
    await expect(detailsPanel.getByText("Files Changed")).toBeVisible();
  });

  test("clicking file in commit details expands diff", async ({ page }) => {
    const commitRow = page.locator(".commit-row").first();
    await commitRow.click();

    const detailsPanel = page.locator(".commit-details-panel");
    await expect(detailsPanel).toBeVisible({ timeout: 10000 });

    // Find and click a file item
    const fileItem = detailsPanel.locator(".commit-file-item").first();
    if ((await fileItem.count()) > 0) {
      await fileItem.click();
      // Should expand to show diff
      await expect(detailsPanel.locator(".commit-file-diff")).toBeVisible();
    }
  });
});

test.describe("Keyboard Commit Shortcut", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("Ctrl+Enter commits when message is entered and files are staged", async ({ page }) => {
    const textarea = page.locator('textarea[placeholder="Commit message..."]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Enter commit message
    await textarea.fill("Test commit via keyboard");

    // Focus textarea and press Ctrl+Enter
    await textarea.focus();
    await page.keyboard.press("Control+Enter");

    // Textarea should be cleared after successful commit
    await expect(textarea).toHaveValue("");
  });
});

test.describe("Hunk Staging", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("diff hunk shows stage/unstage button", async ({ page }) => {
    // Click on any file to show diff
    const fileItem = page.locator(".file-item").first();
    await fileItem.click();

    const diffPanel = page.locator(".diff-view-panel");
    await expect(diffPanel).toBeVisible({ timeout: 10000 });

    // Hunk should have a stage or unstage button
    const hunk = diffPanel.locator(".diff-hunk").first();
    await expect(hunk).toBeVisible();

    // Should have either Stage Hunk or Unstage Hunk button
    const hunkButton = hunk.locator("button").first();
    await expect(hunkButton).toBeVisible();
  });
});

test.describe("File Staging Checkbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("file items have stage checkbox", async ({ page }) => {
    // Find any file item
    const fileItem = page.locator(".file-item").first();
    await expect(fileItem).toBeVisible({ timeout: 10000 });

    // Should have stage checkbox
    const checkbox = fileItem.locator(".stage-checkbox");
    await expect(checkbox).toBeVisible();
  });

  test("stage checkbox can be toggled", async ({ page }) => {
    // Find any file item
    const fileItem = page.locator(".file-item").first();
    await expect(fileItem).toBeVisible({ timeout: 10000 });

    // Get the checkbox
    const checkbox = fileItem.locator(".stage-checkbox");
    await expect(checkbox).toBeVisible();

    // Click the checkbox to toggle
    await checkbox.click();

    // App should still be responsive (the action was triggered)
    await expect(page.locator(".app")).toBeVisible();
  });
});

test.describe("Stash Details Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStashesView(page);
  });

  test("stash details shows stash name", async ({ page }) => {
    const stashItem = page.locator(".stash-item").first();
    await stashItem.click();

    const stashDetails = page.locator(".stash-details-panel");
    await expect(stashDetails).toBeVisible({ timeout: 10000 });

    // Should show stash name
    await expect(stashDetails.locator(".stash-name")).toBeVisible();
  });

  test("stash details shows branch info", async ({ page }) => {
    const stashItem = page.locator(".stash-item").first();
    await stashItem.click();

    const stashDetails = page.locator(".stash-details-panel");
    await expect(stashDetails).toBeVisible({ timeout: 10000 });

    // Should show branch label
    await expect(stashDetails.getByText("Branch")).toBeVisible();
  });

  test("stash details shows files changed section", async ({ page }) => {
    const stashItem = page.locator(".stash-item").first();
    await stashItem.click();

    const stashDetails = page.locator(".stash-details-panel");
    await expect(stashDetails).toBeVisible({ timeout: 10000 });

    // Should show files changed section header
    await expect(stashDetails.getByText("Files changed")).toBeVisible();
  });
});

test.describe("Commit Workflow - Diff Clearing", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("diff panel clears after successful commit", async ({ page }) => {
    // Click a staged file to show diff
    const stagedFile = page.locator(".file-item").filter({ hasText: "staged-file.ts" });
    await stagedFile.click();

    // Verify diff panel shows content (not the empty state)
    const diffPanel = page.locator(".diff-view-panel");
    await expect(diffPanel).toBeVisible({ timeout: 10000 });
    await expect(diffPanel.locator(".diff-header")).toBeVisible();

    // Enter commit message and commit
    const textarea = page.locator('textarea[placeholder="Commit message..."]');
    await textarea.fill("Test commit");
    await page.locator(".commit-button").click();

    // Verify diff panel shows empty state
    await expect(page.getByText("Select a file to view its diff")).toBeVisible();
  });
});

test.describe("Multi-Select Files", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("Ctrl+click toggles file selection", async ({ page }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "unstaged-file1.ts" });
    const file2 = page.locator(".file-item").filter({ hasText: "unstaged-file2.ts" });

    // Click first file
    await file1.click();
    await expect(file1).toHaveClass(/selected/);

    // Ctrl+click second file
    await file2.click({ modifiers: ["Control"] });
    await expect(file1).toHaveClass(/selected/);
    await expect(file2).toHaveClass(/selected/);
  });

  test("Shift+click selects range of files", async ({ page }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "unstaged-file1.ts" });
    const file3 = page.locator(".file-item").filter({ hasText: "unstaged-file3.ts" });

    // Click first file
    await file1.click();

    // Shift+click third file
    await file3.click({ modifiers: ["Shift"] });

    // All three should be selected
    await expect(page.locator(".file-item.selected")).toHaveCount(3);
  });

  test("selection actions appear in header when files are selected", async ({ page }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "unstaged-file1.ts" });

    // Click a file to select it
    await file1.click();

    // Selection buttons should appear in the section header
    const unstagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Unstaged", { exact: true }) });
    await expect(unstagedSection.locator("button", { hasText: "Stage Selected" })).toBeVisible();
    await expect(unstagedSection.getByRole("button", { name: "Clear selection" })).toBeVisible();
  });

  test("Clear button clears selection", async ({ page }) => {
    const file1 = page.locator(".file-item").filter({ hasText: "unstaged-file1.ts" });

    // Click a file to select it
    await file1.click();
    await expect(file1).toHaveClass(/selected/);

    // Click Clear button in the header
    const unstagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Unstaged", { exact: true }) });
    await unstagedSection.getByRole("button", { name: "Clear selection" }).click();

    // File should no longer be selected
    await expect(file1).not.toHaveClass(/selected/);
    // Clear button should no longer be visible since no selection
    await expect(
      unstagedSection.getByRole("button", { name: "Clear selection" })
    ).not.toBeVisible();
  });
});

test.describe("Stage All Button - All Files", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("shows correct file counts in section headers", async ({ page }) => {
    // Mock has 4 unstaged files (3 modified + 1 conflicted) and 2 untracked files
    const unstagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Unstaged", { exact: true }) });
    const untrackedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Untracked", { exact: true }) });

    await expect(unstagedSection.locator(".section-count")).toHaveText("4");
    await expect(untrackedSection.locator(".section-count")).toHaveText("2");
  });

  test("Stage All button is present in Unstaged section", async ({ page }) => {
    const unstagedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Unstaged", { exact: true }) });

    await expect(unstagedSection.locator("button", { hasText: "Stage All" })).toBeVisible();
  });

  test("Stage All button is present in Untracked section", async ({ page }) => {
    const untrackedSection = page
      .locator(".section-header")
      .filter({ has: page.getByText("Untracked", { exact: true }) });

    await expect(untrackedSection.locator("button", { hasText: "Stage All" })).toBeVisible();
  });
});

test.describe("Settings Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("settings gear button is visible in header", async ({ page }) => {
    await expect(page.locator(".settings-menu-button")).toBeVisible({
      timeout: 10000,
    });
  });

  test("clicking gear opens dropdown menu", async ({ page }) => {
    await page.locator(".settings-menu-button").click();

    await expect(page.locator(".settings-menu-dropdown")).toBeVisible();
  });

  test("dropdown has About menu item", async ({ page }) => {
    await page.locator(".settings-menu-button").click();

    await expect(page.locator(".settings-menu-item", { hasText: "About" })).toBeVisible();
  });

  test("dropdown shows Uninstall CLI Tool when CLI is installed", async ({ page }) => {
    // Default mock has check_cli_installed returning true
    await page.locator(".settings-menu-button").click();

    await expect(
      page.locator(".settings-menu-item", { hasText: "Uninstall CLI Tool" })
    ).toBeVisible();
  });

  test("dropdown closes when clicking outside", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await expect(page.locator(".settings-menu-dropdown")).toBeVisible();

    // Click outside the menu
    await page.locator(".app-header .app-title").click();

    await expect(page.locator(".settings-menu-dropdown")).not.toBeVisible();
  });

  test("dropdown closes on Escape key", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await expect(page.locator(".settings-menu-dropdown")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator(".settings-menu-dropdown")).not.toBeVisible();
  });

  test("clicking gear button again closes dropdown", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await expect(page.locator(".settings-menu-dropdown")).toBeVisible();

    await page.locator(".settings-menu-button").click();
    await expect(page.locator(".settings-menu-dropdown")).not.toBeVisible();
  });
});

test.describe("Settings Menu - About Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("clicking About opens the About dialog", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "About" }).click();

    await expect(page.getByText("About Yet Another Git Gui")).toBeVisible();
  });

  test("About dialog shows app version", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "About" }).click();

    await expect(page.getByText("1.2.0")).toBeVisible();
  });

  test("About dialog shows platform info", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "About" }).click();

    await expect(page.getByText("Version")).toBeVisible();
    await expect(page.getByText("Tauri")).toBeVisible();
    await expect(page.getByText("Platform")).toBeVisible();
    await expect(page.getByText("Architecture")).toBeVisible();
  });

  test("About dialog closes when Close button is clicked", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "About" }).click();

    await expect(page.getByText("About Yet Another Git Gui")).toBeVisible();

    await page.locator(".dialog-btn.confirm", { hasText: "Close" }).click();

    await expect(page.getByText("About Yet Another Git Gui")).not.toBeVisible();
  });

  test("About dialog closes on Escape key", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "About" }).click();

    await expect(page.getByText("About Yet Another Git Gui")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByText("About Yet Another Git Gui")).not.toBeVisible();
  });
});

test.describe("Settings Menu - CLI Uninstall", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("clicking Uninstall CLI Tool shows confirmation dialog", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "Uninstall CLI Tool" }).click();

    // Confirm dialog should appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Uninstall CLI Tool")).toBeVisible();
    await expect(page.getByRole("button", { name: "Uninstall" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("cancelling uninstall closes dialog without action", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "Uninstall CLI Tool" }).click();

    await page.locator(".dialog-btn.cancel").click();

    // Dialog should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});

test.describe("Settings Menu - CLI Install (not installed)", () => {
  test.beforeEach(async ({ page }) => {
    // Override mock to simulate CLI not installed
    await page.addInitScript(`
      window.__MOCK_CLI_INSTALLED__ = false;
    `);
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("shows Install CLI Tool when CLI is not installed", async ({ page }) => {
    await page.locator(".settings-menu-button").click();

    await expect(
      page.locator(".settings-menu-item", { hasText: "Install CLI Tool" })
    ).toBeVisible();
  });

  test("clicking Install CLI Tool shows confirmation dialog with details", async ({ page }) => {
    await page.locator(".settings-menu-button").click();
    await page.locator(".settings-menu-item", { hasText: "Install CLI Tool" }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/\/usr\/local\/bin/)).toBeVisible();
    await expect(page.getByText(/administrator password/)).toBeVisible();
  });
});

test.describe("Empty State Centering", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchToStatusView(page);
  });

  test("empty section uses flexbox centering", async ({ page }) => {
    // The Staged section has only 1 file, so we can check the empty section CSS
    // by looking at what styles are applied to empty-section class
    const emptySection = page.locator(".empty-section").first();

    // If there's an empty section visible, check its styles
    if ((await emptySection.count()) > 0) {
      const display = await emptySection.evaluate((el) => window.getComputedStyle(el).display);
      const alignItems = await emptySection.evaluate(
        (el) => window.getComputedStyle(el).alignItems
      );
      const justifyContent = await emptySection.evaluate(
        (el) => window.getComputedStyle(el).justifyContent
      );

      expect(display).toBe("flex");
      expect(alignItems).toBe("center");
      expect(justifyContent).toBe("center");
    }
  });
});

test.describe("Repo State Banner", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(`window.__MOCK_REPO_STATE__ = 'merge';`);
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("shows banner when repo is in merge state", async ({ page }) => {
    const banner = page.locator(".repo-state-banner");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText("Merge in progress");
    await expect(banner).toContainText("git merge --abort");
  });

  test("banner has accessible role and aria-live", async ({ page }) => {
    const banner = page.locator(".repo-state-banner");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toHaveAttribute("role", "status");
    await expect(banner).toHaveAttribute("aria-live", "polite");
  });

  test("branches view shows state label when repo is in merge state", async ({ page }) => {
    await switchToBranchesView(page);
    const stateLabel = page.locator(".repo-state-label");
    await expect(stateLabel).toBeVisible({ timeout: 10000 });
    await expect(stateLabel).toContainText("MERGING");
  });
});

test.describe("Repo State Banner - Clean State", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("does not show banner when repo is clean", async ({ page }) => {
    await expect(page.locator(".app")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".repo-state-banner")).not.toBeVisible();
  });
});

test.describe("Repo State Banner - Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(`window.__MOCK_REPO_STATE__ = 'merge';`);
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("repo state banner passes WCAG color contrast checks", async ({ page }) => {
    await expect(page.locator(".repo-state-banner")).toBeVisible({
      timeout: 10000,
    });
    await assertContrastClean(page, ".repo-state-banner");
  });
});

test.describe("Empty Repository", () => {
  test.beforeEach(async ({ page }) => {
    // Set the empty repo flag before injecting mocks
    await page.addInitScript(`window.__MOCK_EMPTY_REPO__ = true;`);
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("shows 'New repository' badge in status bar", async ({ page }) => {
    await expect(page.locator(".app")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".status-bar .branch-indicator")).toContainText("New repository");
  });

  test("shows empty state message in history view", async ({ page }) => {
    await expect(page.locator(".app")).toBeVisible({ timeout: 10000 });
    await switchToHistoryView(page);

    await expect(
      page.getByText("No commits yet. Create your first commit in the Status view.")
    ).toBeVisible({ timeout: 5000 });
  });

  test("does not show commit graph in history view", async ({ page }) => {
    await expect(page.locator(".app")).toBeVisible({ timeout: 10000 });
    await switchToHistoryView(page);

    await expect(page.locator(".history-graph")).not.toBeVisible();
  });
});
