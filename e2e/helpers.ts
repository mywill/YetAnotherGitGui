import type { Page } from "@playwright/test";

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
