import { test, expect } from "./fixtures";
import { tauriMocks } from "./tauri-mocks";
import {
  switchToStatusView,
  switchToHistoryView,
  switchToBranchesView,
  switchToStashesView,
  expandAllBranchSections,
} from "./helpers";
import { assertContrastClean } from "./contrast-helper";

/**
 * WCAG AA Color Contrast Tests for Interactive States.
 *
 * Each `assertContrastClean` call runs the axe `color-contrast` rule (4.5:1
 * normal text, 3:1 large text) and asserts zero violations. AAA was evaluated
 * separately and produced 21 unique failures across brand-critical tokens
 * (commit button magenta, toast green/red, muted text); those are tracked but
 * not enforced.
 */

// --- Test Suite ---

test.describe("Contrast - Interactive States", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  // ===== 1. IconRail =====
  test.describe("IconRail", () => {
    test("active tab has sufficient contrast", async ({ page }) => {
      await assertContrastClean(page, ".icon-rail");
    });

    test("inactive tab has sufficient contrast", async ({ page }) => {
      // All rail items are visible — one active, rest inactive
      await assertContrastClean(page, ".icon-rail");
    });

    test("hovered inactive tab has sufficient contrast", async ({ page }) => {
      // Find an inactive rail item and hover it
      const inactiveTab = page.locator('.rail-item[aria-selected="false"]').first();
      await inactiveTab.hover();
      await assertContrastClean(page, ".icon-rail");
    });
  });

  // ===== 2. BranchItem =====
  test.describe("BranchItem", () => {
    test.beforeEach(async ({ page }) => {
      await switchToBranchesView(page);
      await expandAllBranchSections(page);
    });

    test("current branch has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".branch-item.is-current", { timeout: 10000 });
      await assertContrastClean(page, ".branch-item.is-current");
    });

    test("current branch badge has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".branch-item.is-current", { timeout: 10000 });
      const badge = page.locator(".branch-item.is-current .current-badge");
      if ((await badge.count()) > 0) {
        await assertContrastClean(page, ".branch-item.is-current");
      }
    });

    test("remote branch has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".branch-item.is-remote", { timeout: 10000 });
      await assertContrastClean(page, ".branch-item.is-remote");
    });

    test("hovered branch item has sufficient contrast", async ({ page }) => {
      const branchItem = page.locator(".branch-item").first();
      await branchItem.hover();
      // Scan the sidebar section that contains branch items
      await assertContrastClean(page, ".branch-item");
    });
  });

  // ===== 3. TagItem =====
  test.describe("TagItem", () => {
    test.beforeEach(async ({ page }) => {
      await switchToBranchesView(page);
      await expandAllBranchSections(page);
    });

    test("tag item has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".tag-item", { timeout: 10000 });
      await assertContrastClean(page, ".tag-item");
    });

    test("hovered tag item has sufficient contrast", async ({ page }) => {
      const tagItem = page.locator(".tag-item").first();
      await tagItem.hover();
      await assertContrastClean(page, ".tag-item");
    });

    test("annotated tag badge has sufficient contrast", async ({ page }) => {
      // Mock has v1.0.0 with is_annotated: true. Diagnostic showed axe puts
      // single-letter "A" pills in `incomplete` ("Element content is too
      // short") — historically swallowed; helper now asserts on incomplete.
      await page.waitForSelector(".annotated-badge", { timeout: 10000 });
      await assertContrastClean(page, ".tag-item");
    });
  });

  // ===== 4. StashItem =====
  test.describe("StashItem", () => {
    test.beforeEach(async ({ page }) => {
      await switchToStashesView(page);
    });

    test("stash item has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".stash-item", { timeout: 10000 });
      await assertContrastClean(page, ".stash-item");
    });

    test("hovered stash item has sufficient contrast", async ({ page }) => {
      const stashItem = page.locator(".stash-item").first();
      await stashItem.hover();
      await assertContrastClean(page, ".stash-item");
    });

    test("selected stash item has sufficient contrast", async ({ page }) => {
      const stashItem = page.locator(".stash-item").first();
      await stashItem.click();
      await page.waitForSelector(".stash-item.is-selected", { timeout: 5000 });
      await assertContrastClean(page, ".stash-item.is-selected");
    });
  });

  // ===== 5. FileItem (Status View) =====
  test.describe("FileItem", () => {
    test.beforeEach(async ({ page }) => {
      await switchToStatusView(page);
    });

    test("staged file has sufficient contrast", async ({ page }) => {
      await page.waitForSelector('[data-testid="file-item"]', {
        timeout: 10000,
      });
      await assertContrastClean(page, ".status-left");
    });

    test("hovered file item has sufficient contrast", async ({ page }) => {
      const fileItem = page.locator('[data-testid="file-item"]').first();
      await fileItem.hover();
      await assertContrastClean(page, ".status-left");
    });

    test("selected file item has sufficient contrast", async ({ page }) => {
      const fileItem = page.locator('[data-testid="file-item"]').first();
      await fileItem.click();
      // Wait for selection state
      await page.waitForTimeout(200);
      await assertContrastClean(page, ".status-left");
    });

    test("staged + selected file has sufficient contrast", async ({ page }) => {
      // Click the staged file item
      const stagedFile = page.locator('[data-testid="file-item"].staged');
      if ((await stagedFile.count()) > 0) {
        await stagedFile.first().click();
        await page.waitForTimeout(200);
        await assertContrastClean(page, ".status-left");
      }
    });

    test("keyboard-focused file item has sufficient contrast", async ({ page }) => {
      // Tab into the file list and use arrow keys
      const listbox = page.locator('[role="listbox"]').first();
      await listbox.focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await assertContrastClean(page, ".status-left");
    });
  });

  // ===== 6. DiffHunk (Status View) =====
  test.describe("DiffHunk", () => {
    test.beforeEach(async ({ page }) => {
      await switchToStatusView(page);
      // Click a file to load its diff
      const fileItem = page.locator('[data-testid="file-item"]').first();
      await fileItem.click();
      await page.waitForSelector(".diff-hunk", { timeout: 10000 });
    });

    test("addition lines have sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".diff-line.line-addition", {
        timeout: 5000,
      });
      await assertContrastClean(page, ".diff-hunk");
    });

    test("deletion lines have sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".diff-line.line-deletion", {
        timeout: 5000,
      });
      await assertContrastClean(page, ".diff-hunk");
    });

    test("selected addition line has sufficient contrast", async ({ page }) => {
      const addLine = page.locator(".diff-line.line-addition.selectable");
      if ((await addLine.count()) > 0) {
        await addLine.first().click();
        await page.waitForTimeout(200);
        await assertContrastClean(page, ".diff-hunk");
      }
    });

    test("selected deletion line has sufficient contrast", async ({ page }) => {
      const delLine = page.locator(".diff-line.line-deletion.selectable");
      if ((await delLine.count()) > 0) {
        await delLine.first().click();
        await page.waitForTimeout(200);
        await assertContrastClean(page, ".diff-hunk");
      }
    });

    test("hovered selectable line has sufficient contrast", async ({ page }) => {
      const selectable = page.locator(".diff-line.selectable").first();
      if ((await selectable.count()) > 0) {
        await selectable.hover();
        await assertContrastClean(page, ".diff-hunk");
      }
    });
  });

  // ===== 7. CommitRow (History View) =====
  test.describe("CommitRow", () => {
    test.beforeEach(async ({ page }) => {
      await switchToHistoryView(page);
    });

    test("commit row has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".commit-row", { timeout: 10000 });
      await assertContrastClean(page, ".commit-graph");
    });

    test("hovered commit row has sufficient contrast", async ({ page }) => {
      const row = page.locator(".commit-row").first();
      await row.hover();
      await assertContrastClean(page, ".commit-graph");
    });

    test("selected commit row has sufficient contrast", async ({ page }) => {
      // Click a non-HEAD commit
      const rows = page.locator(".commit-row");
      const count = await rows.count();
      if (count > 1) {
        await rows.nth(1).click();
        await page.waitForTimeout(200);
        await assertContrastClean(page, ".commit-graph");
      }
    });

    test("HEAD commit row has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".commit-row.is-head", { timeout: 10000 });
      await assertContrastClean(page, ".commit-row.is-head");
    });

    test("HEAD + selected commit row has sufficient contrast", async ({ page }) => {
      const headRow = page.locator(".commit-row.is-head");
      if ((await headRow.count()) > 0) {
        await headRow.first().click();
        await page.waitForTimeout(200);
        await assertContrastClean(page, ".commit-row.is-head");
      }
    });

    test("ref badges have sufficient contrast", async ({ page }) => {
      // Ref badges (branch, tag, HEAD) are rendered inline
      await page.waitForSelector(".ref-badge", { timeout: 10000 });
      await assertContrastClean(page, ".commit-graph");
    });

    test("keyboard-focused commit row has sufficient contrast", async ({ page }) => {
      const listbox = page.locator(".commit-graph [role='listbox']");
      if ((await listbox.count()) > 0) {
        await listbox.first().focus();
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await assertContrastClean(page, ".commit-graph");
      }
    });
  });

  // ===== 8. CommitFileItem (History View) =====
  test.describe("CommitFileItem", () => {
    test.beforeEach(async ({ page }) => {
      await switchToHistoryView(page);
      // Click a commit to load its details
      const commitRow = page.locator(".commit-row").first();
      await commitRow.click();
      await page.waitForSelector(".commit-file-item", { timeout: 10000 });
    });

    test("commit file item has sufficient contrast", async ({ page }) => {
      await assertContrastClean(page, ".commit-file-item");
    });

    test("hovered commit file item has sufficient contrast", async ({ page }) => {
      const fileItem = page.locator(".commit-file-item .file-header").first();
      await fileItem.hover();
      await assertContrastClean(page, ".commit-file-item");
    });

    test("expanded commit file item has sufficient contrast", async ({ page }) => {
      // Click file header to expand
      const fileHeader = page.locator(".commit-file-item .file-header").first();
      await fileHeader.click();
      await page.waitForSelector(".commit-file-item.expanded", {
        timeout: 5000,
      });
      await assertContrastClean(page, ".commit-file-item.expanded");
    });

    test("status badges have sufficient contrast", async ({ page }) => {
      const statusIcons = page.locator(".commit-file-item .status-icon");
      if ((await statusIcons.count()) > 0) {
        await assertContrastClean(page, ".commit-file-item");
      }
    });
  });

  // ===== 9. StashFileItem =====
  test.describe("StashFileItem", () => {
    test.beforeEach(async ({ page }) => {
      await switchToStashesView(page);
      // Click a stash item to load stash details
      const stashItem = page.locator(".stash-item").first();
      await stashItem.click();
      await page.waitForSelector(".stash-file-item", { timeout: 10000 });
    });

    test("stash file item has sufficient contrast", async ({ page }) => {
      await assertContrastClean(page, ".stash-file-item");
    });

    test("expanded stash file item has sufficient contrast", async ({ page }) => {
      const fileHeader = page.locator(".stash-file-item .file-header").first();
      await fileHeader.click();
      await page.waitForSelector(".stash-file-item.expanded", {
        timeout: 5000,
      });
      await assertContrastClean(page, ".stash-file-item.expanded");
    });

    test("status badges have sufficient contrast", async ({ page }) => {
      const statusIcons = page.locator(".stash-file-item .status-icon");
      if ((await statusIcons.count()) > 0) {
        await assertContrastClean(page, ".stash-file-item");
      }
    });
  });

  // ===== 10. ContextMenu =====
  test.describe("ContextMenu", () => {
    test.beforeEach(async ({ page }) => {
      await switchToBranchesView(page);
      await expandAllBranchSections(page);
    });

    test("context menu has sufficient contrast", async ({ page }) => {
      // Right-click a branch item to open the context menu
      const branchItem = page.locator(".branch-item").first();
      await branchItem.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      await assertContrastClean(page, '[role="menu"]');
    });

    test("focused menu item has sufficient contrast", async ({ page }) => {
      // Open context menu — first item auto-focuses
      const branchItem = page.locator(".branch-item").first();
      await branchItem.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      await assertContrastClean(page, '[role="menu"]');
    });

    test("keyboard-navigated menu item has sufficient contrast", async ({ page }) => {
      const branchItem = page.locator(".branch-item").first();
      await branchItem.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      // Navigate down in the menu
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(100);
      await assertContrastClean(page, '[role="menu"]');
    });

    test("disabled menu items have sufficient contrast", async ({ page }) => {
      // Right-click the current branch — some items should be disabled
      const currentBranch = page.locator(".branch-item.is-current").first();
      await currentBranch.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      const disabledItems = page.locator('[role="menuitem"].disabled');
      if ((await disabledItems.count()) > 0) {
        await assertContrastClean(page, '[role="menu"]');
      }
    });
  });

  // ===== 11. YaggButton =====
  test.describe("YaggButton", () => {
    test("disabled commit button has sufficient contrast", async ({ page }) => {
      await switchToStatusView(page);
      const commitButton = page.locator(".commit-button");
      await expect(commitButton).toBeVisible({ timeout: 10000 });
      await expect(commitButton).toBeDisabled();
      // Disabled buttons use opacity-60 which may reduce contrast
      await assertContrastClean(page, ".commit-panel");
    });

    test("focus-visible button has sufficient contrast", async ({ page }) => {
      await switchToStatusView(page);
      // Tab to the commit button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(200);
      await assertContrastClean(page, ".commit-panel");
    });

    test("hovered primary button has sufficient contrast", async ({ page }) => {
      await switchToStatusView(page);
      // Fill commit message so button becomes enabled
      const textarea = page.locator('textarea[placeholder="Commit message..."]');
      await textarea.fill("Test commit");
      await page.waitForTimeout(200);
      const commitButton = page.locator(".commit-button");
      await commitButton.hover();
      await assertContrastClean(page, ".commit-panel");
    });
  });

  // ===== 10. Conflict Diff View =====
  test.describe("Conflict Diff View", () => {
    test.beforeEach(async ({ page }) => {
      await switchToStatusView(page);
      // Click the conflicted file to load the conflict diff
      const conflictFile = page.locator(".file-item", {
        hasText: "conflict-file.ts",
      });
      await conflictFile.click();
      await page.waitForSelector(".diff-view-panel", { timeout: 10000 });
    });

    test("conflict diff lines have sufficient contrast", async ({ page }) => {
      await assertContrastClean(page, ".diff-view-panel");
    });

    test("conflict resolution buttons have sufficient contrast", async ({ page }) => {
      await assertContrastClean(page, ".hunk-header");
    });

    test("hovered conflict resolution button has sufficient contrast", async ({ page }) => {
      const oursButton = page.locator(".hunk-actions button", {
        hasText: "Accept Ours",
      });
      await oursButton.hover();
      await page.waitForTimeout(200);
      await assertContrastClean(page, ".hunk-header");
    });
  });

  // ===== Round 2 — Combined-state coverage =====
  // The new active-row CSS uses --color-bg-selected-hover. Verify primary text
  // on that background passes WCAG AA in every listbox that uses it, and cover
  // hover+selected combos, toast colors, and muted text on tinted backgrounds.
  test.describe("Combined states (selected + focused / hovered / tinted)", () => {
    test("history files: keyboard-focused active row has sufficient contrast", async ({ page }) => {
      await switchToHistoryView(page);
      await page.waitForSelector(".commit-row", { timeout: 10000 });
      // Selecting a commit triggers the files-changed listbox to render.
      await page.locator(".commit-row").first().click();
      await page.waitForSelector('[role="listbox"][aria-label="Files changed"]', {
        timeout: 10000,
      });
      const filesList = page.locator('[role="listbox"][aria-label="Files changed"]');
      await filesList.evaluate((el) => (el as HTMLElement).focus());
      await page.waitForTimeout(150);
      await assertContrastClean(
        page,
        '[role="listbox"][aria-label="Files changed"] [aria-selected="true"]'
      );
    });

    test("branches list: keyboard-focused active branch has sufficient contrast", async ({
      page,
    }) => {
      await switchToBranchesView(page);
      await expandAllBranchSections(page);
      const list = page.locator('[role="listbox"][aria-label="Local Branches"]');
      await list.evaluate((el) => (el as HTMLElement).focus());
      await page.waitForTimeout(150);
      await assertContrastClean(
        page,
        '[role="listbox"][aria-label="Local Branches"] [aria-selected="true"]'
      );
    });

    test("tags list: keyboard-focused active tag has sufficient contrast", async ({ page }) => {
      await switchToBranchesView(page);
      await expandAllBranchSections(page);
      const list = page.locator('[role="listbox"][aria-label="Tags"]');
      await list.evaluate((el) => (el as HTMLElement).focus());
      await page.waitForTimeout(150);
      await assertContrastClean(page, '[role="listbox"][aria-label="Tags"] [aria-selected="true"]');
    });

    test("stashes list: keyboard-focused active stash has sufficient contrast", async ({
      page,
    }) => {
      await switchToStashesView(page);
      await page.waitForSelector(".stash-item", { timeout: 10000 });
      const list = page.locator('[role="listbox"]').first();
      await list.evaluate((el) => (el as HTMLElement).focus());
      await page.waitForTimeout(150);
      await assertContrastClean(page, '[role="listbox"] [aria-selected="true"]');
    });

    test("staged file list: hover + selected file has sufficient contrast", async ({ page }) => {
      await switchToStatusView(page);
      const file = page.locator(".file-item").filter({ hasText: "unstaged-file1.ts" }).first();
      await file.click();
      await file.hover();
      await page.waitForTimeout(150);
      await assertContrastClean(page, ".file-item.selected");
    });

    test("toast: success notification has sufficient contrast (white on green)", async ({
      page,
    }) => {
      await page.evaluate(async () => {
        const mod = await import("/src/stores/notificationStore.ts");
        mod.useNotificationStore.getState().showSuccess("Operation completed");
      });
      await page.waitForSelector(".notification-toast-success", { timeout: 5000 });
      await assertContrastClean(page, ".notification-toast-success");
    });

    test("toast: error notification has sufficient contrast (white on red)", async ({ page }) => {
      await page.evaluate(async () => {
        const mod = await import("/src/stores/notificationStore.ts");
        mod.useNotificationStore.getState().showError("Something went wrong");
      });
      await page.waitForSelector(".notification-toast-error", { timeout: 5000 });
      await assertContrastClean(page, ".notification-toast-error");
    });

    test("current branch row: muted secondary text on cyan-tinted background passes contrast", async ({
      page,
    }) => {
      await switchToBranchesView(page);
      await expandAllBranchSections(page);
      await page.waitForSelector(".branch-item.is-current", { timeout: 10000 });
      await assertContrastClean(page, ".branch-item.is-current");
    });

    test("repo state banner: warning text on warning background passes contrast", async ({
      page,
    }) => {
      // Force the repo into a non-clean state via the mock so the banner renders.
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        w.__YAGG_FORCE_REPO_STATE__ = "merge";
      });
      // The banner only renders when repo_state !== "clean". Mocks default to
      // clean; verify the warning tokens themselves via a synthetic element so
      // axe can resolve the colors even without the real banner rendered.
      // Diagnostic showed that scoping `.include(".synthetic-warning")` puts
      // the rule into `inapplicable` (axe needs more DOM context). Wrap the
      // text in a child <span> and scan the wrapper so contrast applies.
      await page.evaluate(() => {
        const el = document.createElement("div");
        el.className = "synthetic-warning bg-warning-bg rounded px-2 py-1";
        const inner = document.createElement("span");
        inner.className = "text-warning-text";
        inner.textContent = "Merge in progress — resolve or run git merge --abort";
        el.appendChild(inner);
        document.body.appendChild(el);
      });
      await assertContrastClean(page, ".synthetic-warning");
    });
  });
});

// ===== Light Mode Contrast Tests =====
test.describe("Contrast - Light Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Switch to light mode via settings store
    await page.evaluate(async () => {
      const mod = await import("/src/stores/settingsStore.ts");
      mod.useSettingsStore.getState().setTheme("light");
    });
    await page.waitForTimeout(200);
  });

  test("status view passes contrast checks in light mode", async ({ page }) => {
    await switchToStatusView(page);
    await assertContrastClean(page);
  });

  test("history view passes contrast checks in light mode", async ({ page }) => {
    await switchToHistoryView(page);
    await page.waitForSelector(".commit-row", { timeout: 10000 });
    await assertContrastClean(page, ".commit-graph");
  });

  test("branches view passes contrast checks in light mode", async ({ page }) => {
    await switchToBranchesView(page);
    await expandAllBranchSections(page);
    await page.waitForSelector(".branch-item", { timeout: 10000 });
    await assertContrastClean(page, ".branch-tag-list");
  });

  test("stashes view passes contrast checks in light mode", async ({ page }) => {
    await switchToStashesView(page);
    await page.waitForSelector(".stash-item", { timeout: 10000 });
    await assertContrastClean(page, ".stash-list");
  });

  test("diff view passes contrast checks in light mode", async ({ page }) => {
    await switchToStatusView(page);
    const fileItem = page.locator(".file-item").first();
    await fileItem.click();
    await page.waitForSelector(".diff-view-panel", { timeout: 10000 });
    await assertContrastClean(page, ".diff-view-panel");
  });

  test("icon rail passes contrast checks in light mode", async ({ page }) => {
    await assertContrastClean(page, ".icon-rail");
  });

  test("commit panel passes contrast checks in light mode", async ({ page }) => {
    await switchToStatusView(page);
    await assertContrastClean(page, ".commit-panel");
  });
});
