import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { tauriMocks } from "./tauri-mocks";
import { switchToWorktreesView } from "./helpers";

test.describe("Worktrees view", () => {
  test.beforeEach(async ({ page }) => {
    // Worktrees tab is off by default; opt it on for these tests.
    await page.addInitScript(
      `window.__MOCK_SETTINGS__ = ${JSON.stringify(
        JSON.stringify({ enabledTabs: { worktrees: true } })
      )};`
    );
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders the worktrees tab and dashboard", async ({ page }) => {
    await switchToWorktreesView(page);

    await expect(page.locator(".worktrees-view")).toBeVisible();
    // Both the main worktree and the linked "feature-worktree" appear.
    await expect(page.getByText("main").first()).toBeVisible();
    await expect(page.getByText("feature-worktree")).toBeVisible();
  });

  test("shows dirty count and ahead/behind for the linked worktree", async ({ page }) => {
    await switchToWorktreesView(page);

    // The mocked linked worktree has dirty_count=2, ahead=3, behind=1.
    await expect(page.getByText("↑3")).toBeVisible();
    await expect(page.getByText("↓1")).toBeVisible();
    await expect(page.getByText("2").first()).toBeVisible();
  });

  test("opens the add-worktree dialog", async ({ page }) => {
    await switchToWorktreesView(page);

    await page.getByRole("button", { name: "Add worktree" }).click();
    await expect(page.getByText("Add Worktree")).toBeVisible();
    await expect(page.getByRole("button", { name: "Existing branch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New branch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Detached" })).toBeVisible();
  });

  test("axe-core accessibility scan of the worktrees view", async ({ page }) => {
    await switchToWorktreesView(page);
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .include(".worktrees-view")
      .analyze();
    expect(results.violations.length).toBe(0);
  });
});
