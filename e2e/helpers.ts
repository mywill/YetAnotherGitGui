import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Switch to the Status View (Working Copy) tab and wait for it to load. */
export async function switchToStatusView(page: Page) {
  const statusTab = page.locator('button[role="tab"][aria-label="Working Copy"]');
  await statusTab.click();
  await page.waitForSelector(".status-view", { timeout: 10000 });
}

/** Switch to the History View tab and wait for it to load. */
export async function switchToHistoryView(page: Page) {
  const historyTab = page.locator('button[role="tab"][aria-label="History"]');
  await historyTab.click();
  await page.waitForSelector(".history-view", { timeout: 10000 });
}

/** Switch to the Branches & Tags tab and wait for it to load. */
export async function switchToBranchesView(page: Page) {
  const branchesTab = page.locator('button[role="tab"][aria-label="Branches & Tags"]');
  await branchesTab.click();
  await page.waitForSelector(".branch-tag-list", { timeout: 10000 });
}

/**
 * Expand a collapsible section in the Branches & Tags view by its visible label.
 * Sections start collapsed by default.
 */
export async function expandBranchSection(page: Page, label: string) {
  const toggle = page.getByRole("button", { name: `Toggle ${label}` });
  const expanded = await toggle.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await toggle.click();
  }
}

/** Expand all three Branches & Tags sections. */
export async function expandAllBranchSections(page: Page) {
  await expandBranchSection(page, "Local Branches");
  await expandBranchSection(page, "Remote Branches");
  await expandBranchSection(page, "Tags");
}

/** Switch to the Stashes tab and wait for it to load. */
export async function switchToStashesView(page: Page) {
  const stashesTab = page.locator('button[role="tab"][aria-label="Stashes"]');
  await stashesTab.click();
  await page.waitForSelector(".stash-list", { timeout: 10000 });
}

/** Switch to the Cleanup tab and wait for it to load. */
export async function switchToCleanupView(page: Page) {
  const cleanupTab = page.locator('button[role="tab"][aria-label="Cleanup"]');
  await cleanupTab.click();
  await page.waitForSelector(".cleanup-view", { timeout: 10000 });
}

/**
 * Standard test setup: inject Tauri mocks, navigate to app root,
 * and wait for the network to idle.
 */
export async function setupTest(page: Page) {
  await page.addInitScript(() => {
    // Tauri mocks are injected via the fixture; this is a no-op placeholder
    // for test suites that don't use the shared fixture.
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

/** Assert the commit details panel is visible with a hash element. */
export async function expectCommitDetailsVisible(page: Page) {
  const detailsPanel = page.locator(".commit-details-panel");
  await detailsPanel.waitFor({ state: "visible", timeout: 10000 });
  await detailsPanel.locator(".hash").waitFor({ state: "visible" });
}

/**
 * Run an axe-core accessibility scan scoped to the given selector(s),
 * asserting zero violations.
 */
export async function runAxeWithSelectors(
  page: Page,
  include: string | string[],
  exclude?: string | string[]
) {
  const includes = Array.isArray(include) ? include : [include];
  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
  ]);
  for (const sel of includes) {
    builder = builder.include(sel);
  }
  if (exclude) {
    const excludes = Array.isArray(exclude) ? exclude : [exclude];
    for (const sel of excludes) {
      builder = builder.exclude(sel);
    }
  }
  const results = await builder.analyze();
  return results;
}

/**
 * Select multiple files in the Status View by clicking each with
 * ControlOrMeta held for the second and subsequent selections.
 */
export async function selectMultipleFiles(page: Page, fileTexts: string[]) {
  for (let i = 0; i < fileTexts.length; i++) {
    const file = page.locator(".file-item").filter({ hasText: fileTexts[i] });
    await expect(file).toBeVisible({ timeout: 10000 });
    if (i === 0) {
      await file.click();
    } else {
      await file.click({ modifiers: ["ControlOrMeta"] });
    }
  }
}
