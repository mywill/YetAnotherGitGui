import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { tauriMocks } from "./tauri-mocks";
import { switchToStatusView, switchToHistoryView } from "./helpers";

test.describe("Terminal Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("terminal panel is hidden by default", async ({ page }) => {
    await expect(page.locator(".terminal-panel")).not.toBeVisible();
  });

  test("terminal button in status bar toggles terminal panel", async ({ page }) => {
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

  test("terminal panel has header with label and close button", async ({ page }) => {
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
    await expect(page.locator('[aria-label="Resize terminal panel"]')).toBeVisible();
  });

  test("terminal mount/unmount cycle does not produce page errors", async ({ page }) => {
    const terminalButton = page.locator(".status-bar button", { hasText: "Terminal" });
    await terminalButton.click();
    await expect(page.locator(".terminal-panel")).toBeVisible();

    await switchToHistoryView(page);
    await switchToStatusView(page);

    await page.locator(".terminal-close").click();
    await expect(page.locator(".terminal-panel")).not.toBeVisible();
  });

  test.describe("Accessibility - axe-core", () => {
    test("terminal panel passes accessibility scan", async ({ page }) => {
      const terminalButton = page.locator(".status-bar button", {
        hasText: "Terminal",
      });
      await terminalButton.click();
      await expect(page.locator(".terminal-panel")).toBeVisible();

      // xterm.js renders the terminal contents to a <canvas>, so axe contrast
      // rules don't apply to the rendered text. Default ruleset is intentional
      // here — covers panel chrome (resize handle, header) without trying to
      // sample colors from the canvas. Not upgraded to AAA contrast for that
      // reason.
      const results = await new AxeBuilder({ page }).include(".terminal-panel").analyze();
      expect(results.violations).toEqual([]);
    });
  });
});
