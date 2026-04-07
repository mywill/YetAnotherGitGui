import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tauriMocks } from "./tauri-mocks";
import { switchToStatusView, switchToHistoryView } from "./helpers";

/**
 * WCAG AA Color Contrast Tests for Interactive States
 *
 * These tests verify that all interactive component states (hover, selected,
 * focused, disabled) meet WCAG AA color contrast requirements (4.5:1 for
 * normal text, 3:1 for large text).
 *
 * Some tests are expected to fail — known contrast issues are documented
 * inline and will be fixed in a follow-up pass.
 */

/**
 * Scan a region for WCAG AA color-contrast violations.
 * Returns { violations, incomplete } so callers can assert on violations
 * and log incomplete results (e.g. color-mix backgrounds axe can't resolve).
 */
async function scanForContrastViolations(
  page: Page,
  selector?: string,
): Promise<{
  violations: Awaited<
    ReturnType<InstanceType<typeof AxeBuilder>["analyze"]>
  >["violations"];
  incomplete: Awaited<
    ReturnType<InstanceType<typeof AxeBuilder>["analyze"]>
  >["incomplete"];
}> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2aa"]);
  if (selector) {
    builder = builder.include(selector);
  }
  const results = await builder.analyze();

  const violations = results.violations.filter(
    (v) => v.id === "color-contrast",
  );
  const incomplete = results.incomplete.filter(
    (v) => v.id === "color-contrast",
  );

  if (incomplete.length > 0) {
    console.log(
      `[contrast] incomplete results for "${selector ?? "page"}":`,
      incomplete.map((i) => i.nodes.map((n) => n.html)).flat(),
    );
  }

  return { violations, incomplete };
}

// --- Test Suite ---

test.describe("Contrast - Interactive States", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  // ===== 1. ViewSwitcher =====
  test.describe("ViewSwitcher", () => {
    test("active tab has sufficient contrast", async ({ page }) => {
      const { violations } = await scanForContrastViolations(
        page,
        ".view-switcher",
      );
      expect(violations).toEqual([]);
    });

    test("inactive tab has sufficient contrast", async ({ page }) => {
      // Both tabs are visible by default — one active, one inactive
      const { violations } = await scanForContrastViolations(
        page,
        ".view-switcher",
      );
      expect(violations).toEqual([]);
    });

    test("hovered inactive tab has sufficient contrast", async ({ page }) => {
      // Find the inactive tab and hover it
      const inactiveTab = page.locator(".view-tab:not(.active)").first();
      await inactiveTab.hover();
      const { violations } = await scanForContrastViolations(
        page,
        ".view-switcher",
      );
      expect(violations).toEqual([]);
    });
  });

  // ===== 2. BranchItem =====
  test.describe("BranchItem", () => {
    test("current branch has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".branch-item.is-current", { timeout: 10000 });
      const { violations } = await scanForContrastViolations(
        page,
        ".branch-item.is-current",
      );
      expect(violations).toEqual([]);
    });

    test("current branch badge has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".branch-item.is-current", { timeout: 10000 });
      const badge = page.locator(
        ".branch-item.is-current .current-badge",
      );
      if ((await badge.count()) > 0) {
        const { violations } = await scanForContrastViolations(
          page,
          ".branch-item.is-current",
        );
        expect(violations).toEqual([]);
      }
    });

    test("remote branch has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".branch-item.is-remote", { timeout: 10000 });
      const { violations } = await scanForContrastViolations(
        page,
        ".branch-item.is-remote",
      );
      expect(violations).toEqual([]);
    });

    test("hovered branch item has sufficient contrast", async ({ page }) => {
      const branchItem = page.locator(".branch-item").first();
      await branchItem.hover();
      // Scan the sidebar section that contains branch items
      const { violations } = await scanForContrastViolations(
        page,
        ".branch-item",
      );
      expect(violations).toEqual([]);
    });
  });

  // ===== 3. TagItem =====
  test.describe("TagItem", () => {
    test("tag item has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".tag-item", { timeout: 10000 });
      const { violations } = await scanForContrastViolations(
        page,
        ".tag-item",
      );
      expect(violations).toEqual([]);
    });

    test("hovered tag item has sufficient contrast", async ({ page }) => {
      const tagItem = page.locator(".tag-item").first();
      await tagItem.hover();
      const { violations } = await scanForContrastViolations(
        page,
        ".tag-item",
      );
      expect(violations).toEqual([]);
    });

    test("annotated tag badge has sufficient contrast", async ({ page }) => {
      // The mock has an annotated tag (v1.0.0 with is_annotated: true)
      await page.waitForSelector(".annotated-badge", { timeout: 10000 });
      // HIGH RISK: bg-badge-tag (#ffb74d) + white text ≈ 1.8:1 — expected to FAIL
      const { violations } = await scanForContrastViolations(
        page,
        ".tag-item",
      );
      expect(violations).toEqual([]);
    });
  });

  // ===== 4. StashItem =====
  test.describe("StashItem", () => {
    test("stash item has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".stash-item", { timeout: 10000 });
      const { violations } = await scanForContrastViolations(
        page,
        ".stash-item",
      );
      expect(violations).toEqual([]);
    });

    test("hovered stash item has sufficient contrast", async ({ page }) => {
      const stashItem = page.locator(".stash-item").first();
      await stashItem.hover();
      const { violations } = await scanForContrastViolations(
        page,
        ".stash-item",
      );
      expect(violations).toEqual([]);
    });

    test("selected stash item has sufficient contrast", async ({ page }) => {
      const stashItem = page.locator(".stash-item").first();
      await stashItem.click();
      await page.waitForSelector(".stash-item.is-selected", { timeout: 5000 });
      const { violations } = await scanForContrastViolations(
        page,
        ".stash-item.is-selected",
      );
      expect(violations).toEqual([]);
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
      const { violations } = await scanForContrastViolations(
        page,
        ".staged-unstaged-panel",
      );
      expect(violations).toEqual([]);
    });

    test("hovered file item has sufficient contrast", async ({ page }) => {
      const fileItem = page
        .locator('[data-testid="file-item"]')
        .first();
      await fileItem.hover();
      const { violations } = await scanForContrastViolations(
        page,
        ".staged-unstaged-panel",
      );
      expect(violations).toEqual([]);
    });

    test("selected file item has sufficient contrast", async ({ page }) => {
      const fileItem = page
        .locator('[data-testid="file-item"]')
        .first();
      await fileItem.click();
      // Wait for selection state
      await page.waitForTimeout(200);
      const { violations } = await scanForContrastViolations(
        page,
        ".staged-unstaged-panel",
      );
      expect(violations).toEqual([]);
    });

    test("staged + selected file has sufficient contrast", async ({
      page,
    }) => {
      // Click the staged file item
      const stagedFile = page.locator('[data-testid="file-item"].staged');
      if ((await stagedFile.count()) > 0) {
        await stagedFile.first().click();
        await page.waitForTimeout(200);
        const { violations } = await scanForContrastViolations(
          page,
          ".staged-unstaged-panel",
        );
        expect(violations).toEqual([]);
      }
    });

    test("keyboard-focused file item has sufficient contrast", async ({
      page,
    }) => {
      // Tab into the file list and use arrow keys
      const listbox = page.locator('[role="listbox"]').first();
      await listbox.focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      const { violations } = await scanForContrastViolations(
        page,
        ".staged-unstaged-panel",
      );
      expect(violations).toEqual([]);
    });
  });

  // ===== 6. DiffHunk (Status View) =====
  test.describe("DiffHunk", () => {
    test.beforeEach(async ({ page }) => {
      await switchToStatusView(page);
      // Click a file to load its diff
      const fileItem = page
        .locator('[data-testid="file-item"]')
        .first();
      await fileItem.click();
      await page.waitForSelector(".diff-hunk", { timeout: 10000 });
    });

    test("addition lines have sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".diff-line.line-addition", {
        timeout: 5000,
      });
      const { violations } = await scanForContrastViolations(
        page,
        ".diff-hunk",
      );
      expect(violations).toEqual([]);
    });

    test("deletion lines have sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".diff-line.line-deletion", {
        timeout: 5000,
      });
      const { violations } = await scanForContrastViolations(
        page,
        ".diff-hunk",
      );
      expect(violations).toEqual([]);
    });

    test("selected addition line has sufficient contrast", async ({
      page,
    }) => {
      const addLine = page.locator(".diff-line.line-addition.selectable");
      if ((await addLine.count()) > 0) {
        await addLine.first().click();
        await page.waitForTimeout(200);
        const { violations } = await scanForContrastViolations(
          page,
          ".diff-hunk",
        );
        expect(violations).toEqual([]);
      }
    });

    test("selected deletion line has sufficient contrast", async ({
      page,
    }) => {
      const delLine = page.locator(".diff-line.line-deletion.selectable");
      if ((await delLine.count()) > 0) {
        await delLine.first().click();
        await page.waitForTimeout(200);
        const { violations } = await scanForContrastViolations(
          page,
          ".diff-hunk",
        );
        expect(violations).toEqual([]);
      }
    });

    test("hovered selectable line has sufficient contrast", async ({
      page,
    }) => {
      const selectable = page.locator(".diff-line.selectable").first();
      if ((await selectable.count()) > 0) {
        await selectable.hover();
        const { violations } = await scanForContrastViolations(
          page,
          ".diff-hunk",
        );
        expect(violations).toEqual([]);
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
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-graph",
      );
      expect(violations).toEqual([]);
    });

    test("hovered commit row has sufficient contrast", async ({ page }) => {
      const row = page.locator(".commit-row").first();
      await row.hover();
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-graph",
      );
      expect(violations).toEqual([]);
    });

    test("selected commit row has sufficient contrast", async ({ page }) => {
      // Click a non-HEAD commit
      const rows = page.locator(".commit-row");
      const count = await rows.count();
      if (count > 1) {
        await rows.nth(1).click();
        await page.waitForTimeout(200);
        const { violations } = await scanForContrastViolations(
          page,
          ".commit-graph",
        );
        expect(violations).toEqual([]);
      }
    });

    test("HEAD commit row has sufficient contrast", async ({ page }) => {
      await page.waitForSelector(".commit-row.is-head", { timeout: 10000 });
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-row.is-head",
      );
      expect(violations).toEqual([]);
    });

    test("HEAD + selected commit row has sufficient contrast", async ({
      page,
    }) => {
      const headRow = page.locator(".commit-row.is-head");
      if ((await headRow.count()) > 0) {
        await headRow.first().click();
        await page.waitForTimeout(200);
        const { violations } = await scanForContrastViolations(
          page,
          ".commit-row.is-head",
        );
        expect(violations).toEqual([]);
      }
    });

    test("ref badges have sufficient contrast", async ({ page }) => {
      // Ref badges (branch, tag, HEAD) are rendered inline
      await page.waitForSelector(".ref-badge", { timeout: 10000 });
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-graph",
      );
      expect(violations).toEqual([]);
    });

    test("keyboard-focused commit row has sufficient contrast", async ({
      page,
    }) => {
      const listbox = page.locator(".commit-graph [role='listbox']");
      if ((await listbox.count()) > 0) {
        await listbox.first().focus();
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        const { violations } = await scanForContrastViolations(
          page,
          ".commit-graph",
        );
        expect(violations).toEqual([]);
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
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-file-item",
      );
      expect(violations).toEqual([]);
    });

    test("hovered commit file item has sufficient contrast", async ({
      page,
    }) => {
      const fileItem = page.locator(".commit-file-item .file-header").first();
      await fileItem.hover();
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-file-item",
      );
      expect(violations).toEqual([]);
    });

    test("expanded commit file item has sufficient contrast", async ({
      page,
    }) => {
      // Click file header to expand
      const fileHeader = page.locator(".commit-file-item .file-header").first();
      await fileHeader.click();
      await page.waitForSelector(".commit-file-item.expanded", {
        timeout: 5000,
      });
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-file-item.expanded",
      );
      expect(violations).toEqual([]);
    });

    test("status badges have sufficient contrast", async ({ page }) => {
      const statusIcons = page.locator(".commit-file-item .status-icon");
      if ((await statusIcons.count()) > 0) {
        const { violations } = await scanForContrastViolations(
          page,
          ".commit-file-item",
        );
        expect(violations).toEqual([]);
      }
    });
  });

  // ===== 9. StashFileItem =====
  test.describe("StashFileItem", () => {
    test.beforeEach(async ({ page }) => {
      // Click a stash item to load stash details
      const stashItem = page.locator(".stash-item").first();
      await stashItem.click();
      await page.waitForSelector(".stash-file-item", { timeout: 10000 });
    });

    test("stash file item has sufficient contrast", async ({ page }) => {
      const { violations } = await scanForContrastViolations(
        page,
        ".stash-file-item",
      );
      expect(violations).toEqual([]);
    });

    test("expanded stash file item has sufficient contrast", async ({
      page,
    }) => {
      const fileHeader = page.locator(".stash-file-item .file-header").first();
      await fileHeader.click();
      await page.waitForSelector(".stash-file-item.expanded", {
        timeout: 5000,
      });
      const { violations } = await scanForContrastViolations(
        page,
        ".stash-file-item.expanded",
      );
      expect(violations).toEqual([]);
    });

    test("status badges have sufficient contrast", async ({ page }) => {
      const statusIcons = page.locator(".stash-file-item .status-icon");
      if ((await statusIcons.count()) > 0) {
        const { violations } = await scanForContrastViolations(
          page,
          ".stash-file-item",
        );
        expect(violations).toEqual([]);
      }
    });
  });

  // ===== 10. ContextMenu =====
  test.describe("ContextMenu", () => {
    test("context menu has sufficient contrast", async ({ page }) => {
      // Right-click a branch item to open the context menu
      const branchItem = page.locator(".branch-item").first();
      await branchItem.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      const { violations } = await scanForContrastViolations(
        page,
        '[role="menu"]',
      );
      expect(violations).toEqual([]);
    });

    test("focused menu item has sufficient contrast", async ({ page }) => {
      // Open context menu — first item auto-focuses
      const branchItem = page.locator(".branch-item").first();
      await branchItem.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      const { violations } = await scanForContrastViolations(
        page,
        '[role="menu"]',
      );
      expect(violations).toEqual([]);
    });

    test("keyboard-navigated menu item has sufficient contrast", async ({
      page,
    }) => {
      const branchItem = page.locator(".branch-item").first();
      await branchItem.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      // Navigate down in the menu
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(100);
      const { violations } = await scanForContrastViolations(
        page,
        '[role="menu"]',
      );
      expect(violations).toEqual([]);
    });

    test("disabled menu items have sufficient contrast", async ({ page }) => {
      // Right-click the current branch — some items should be disabled
      const currentBranch = page.locator(".branch-item.is-current").first();
      await currentBranch.click({ button: "right" });
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
      const disabledItems = page.locator('[role="menuitem"].disabled');
      if ((await disabledItems.count()) > 0) {
        const { violations } = await scanForContrastViolations(
          page,
          '[role="menu"]',
        );
        expect(violations).toEqual([]);
      }
    });
  });

  // ===== 11. YaggButton =====
  test.describe("YaggButton", () => {
    test("disabled commit button has sufficient contrast", async ({
      page,
    }) => {
      await switchToStatusView(page);
      const commitButton = page.locator(".commit-button");
      await expect(commitButton).toBeVisible({ timeout: 10000 });
      await expect(commitButton).toBeDisabled();
      // Disabled buttons use opacity-60 which may reduce contrast
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-panel",
      );
      expect(violations).toEqual([]);
    });

    test("focus-visible button has sufficient contrast", async ({ page }) => {
      await switchToStatusView(page);
      // Tab to the commit button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(200);
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-panel",
      );
      expect(violations).toEqual([]);
    });

    test("hovered primary button has sufficient contrast", async ({
      page,
    }) => {
      await switchToStatusView(page);
      // Fill commit message so button becomes enabled
      const textarea = page.locator(
        'textarea[placeholder="Commit message..."]',
      );
      await textarea.fill("Test commit");
      await page.waitForTimeout(200);
      const commitButton = page.locator(".commit-button");
      await commitButton.hover();
      const { violations } = await scanForContrastViolations(
        page,
        ".commit-panel",
      );
      expect(violations).toEqual([]);
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
      const { violations } = await scanForContrastViolations(
        page,
        ".diff-view-panel",
      );
      expect(violations).toEqual([]);
    });

    test("conflict resolution buttons have sufficient contrast", async ({
      page,
    }) => {
      const { violations } = await scanForContrastViolations(
        page,
        ".hunk-header",
      );
      expect(violations).toEqual([]);
    });

    test("hovered conflict resolution button has sufficient contrast", async ({
      page,
    }) => {
      const oursButton = page.locator(".hunk-actions button", {
        hasText: "Accept Ours",
      });
      await oursButton.hover();
      await page.waitForTimeout(200);
      const { violations } = await scanForContrastViolations(
        page,
        ".hunk-header",
      );
      expect(violations).toEqual([]);
    });
  });
});
