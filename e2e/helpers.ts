import type { Page } from "@playwright/test";

/** Switch to the Status View tab and wait for it to load. */
export async function switchToStatusView(page: Page) {
  const statusTab = page.locator(".view-tab", { hasText: "Status" });
  await statusTab.click();
  await page.waitForSelector(".status-view", { timeout: 10000 });
}

/** Switch to the History View tab and wait for it to load. */
export async function switchToHistoryView(page: Page) {
  const historyTab = page.locator(".view-tab", { hasText: "History" });
  await historyTab.click();
  await page.waitForSelector(".history-view", { timeout: 10000 });
}
