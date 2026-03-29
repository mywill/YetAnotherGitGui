import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tauriMocks } from "./tauri-mocks";

test.describe("Terminal Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("terminal panel is hidden by default", async ({ page }) => {
    await expect(page.locator(".terminal-panel")).not.toBeVisible();
  });

  test("terminal button in status bar toggles terminal panel", async ({
    page,
  }) => {
    // Click the Terminal button in the header
    const terminalButton = page.locator(".status-bar button", {
      hasText: "Terminal",
    });
    await terminalButton.click();
    await expect(page.locator(".terminal-panel")).toBeVisible();
    await expect(page.locator(".terminal-header")).toBeVisible();

    // Click again to hide
    await terminalButton.click();
    await expect(page.locator(".terminal-panel")).not.toBeVisible();
  });

  test("terminal panel has header with label and close button", async ({
    page,
  }) => {
    const terminalButton = page.locator(".status-bar button", {
      hasText: "Terminal",
    });
    await terminalButton.click();

    await expect(page.locator(".terminal-header")).toContainText("Terminal");
    await expect(page.locator(".terminal-close")).toBeVisible();
  });

  test("close button hides terminal panel", async ({ page }) => {
    const terminalButton = page.locator(".status-bar button", {
      hasText: "Terminal",
    });
    await terminalButton.click();
    await expect(page.locator(".terminal-panel")).toBeVisible();

    await page.locator(".terminal-close").click();
    await expect(page.locator(".terminal-panel")).not.toBeVisible();
  });

  test("Ctrl+` toggles terminal panel", async ({ page }) => {
    await page.keyboard.press("Control+`");
    await expect(page.locator(".terminal-panel")).toBeVisible();

    await page.keyboard.press("Control+`");
    await expect(page.locator(".terminal-panel")).not.toBeVisible();
  });

  test("terminal panel has resizer", async ({ page }) => {
    const terminalButton = page.locator(".status-bar button", {
      hasText: "Terminal",
    });
    await terminalButton.click();
    await expect(page.locator(".terminal-resizer")).toBeVisible();
  });

  test.describe("Accessibility - axe-core", () => {
    test("terminal panel passes accessibility scan", async ({ page }) => {
      const terminalButton = page.locator(".status-bar button", {
        hasText: "Terminal",
      });
      await terminalButton.click();
      await expect(page.locator(".terminal-panel")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include(".terminal-panel")
        .analyze();
      expect(results.violations).toEqual([]);
    });
  });
});
