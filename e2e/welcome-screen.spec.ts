import { test, expect } from "@playwright/test";
import { tauriMocks } from "./tauri-mocks";

/**
 * E2E tests for the Welcome Screen
 *
 * These tests override the open_repository mock to simulate failure,
 * causing the app to show the welcome screen instead of the main app.
 */

const welcomeMocks = `
  // Store original mocks
  ${tauriMocks}

  // Override open_repository to simulate failure
  const originalInvoke = window.__TAURI_INTERNALS__.invoke;
  window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
    if (cmd === 'open_repository') {
      throw new Error('Git error: could not find repository from \\'/mock/repo/path\\'; class=Repository (6); code=NotFound (-3)');
    }
    return originalInvoke(cmd, args);
  };
  window.__TAURI__.core.invoke = window.__TAURI_INTERNALS__.invoke;
`;

test.describe("Welcome Screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(welcomeMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("displays welcome screen when repository fails to open", async ({
    page,
  }) => {
    await expect(page.locator(".welcome-screen")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows friendly error message without git2 internals", async ({
    page,
  }) => {
    await expect(page.locator(".welcome-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".welcome-error")).toContainText(
      "No git repository found at",
    );
    // Should NOT contain raw git2 class/code noise
    await expect(page.locator(".welcome-error")).not.toContainText(
      "class=Repository",
    );
  });

  test("displays Open a Repository card", async ({ page }) => {
    await expect(page.getByText("Open a Repository")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Select a Git repository to open"),
    ).toBeVisible();
  });

  test("shows path input with pre-filled path", async ({ page }) => {
    const input = page.locator('input[aria-label="Repository path"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    // The mock provides /mock/repo/path as the CWD
    await expect(input).toHaveValue("/mock/repo/path");
  });

  test("has Browse and Open buttons", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Browse..." }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: "Open" })).toBeVisible();
  });

  test("renders app header with title", async ({ page }) => {
    await expect(page.locator(".app-header")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".app-title")).toHaveText(
      "Yet Another Git Gui",
    );
  });

  test("renders settings menu in header", async ({ page }) => {
    await expect(page.locator(".app-header")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".settings-menu")).toBeVisible();
  });

  test("About is accessible through settings menu", async ({ page }) => {
    await expect(page.locator(".settings-menu")).toBeVisible({
      timeout: 10000,
    });
    // Click the settings gear button to open the dropdown
    await page.locator(".settings-menu button").first().click();
    await expect(page.getByText("About")).toBeVisible();
  });
});
