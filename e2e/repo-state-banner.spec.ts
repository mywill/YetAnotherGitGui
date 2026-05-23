import { test, expect } from "@playwright/test";
import { tauriMocks } from "./tauri-mocks";

test.describe("RepoStateBanner abort/continue", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
  });

  test("shows Abort + Continue buttons for rebase state", async ({ page }) => {
    await page.addInitScript(() => {
      window.__MOCK_REPO_STATE__ = "rebase";
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const banner = page.getByRole("status").filter({ hasText: "Rebase in progress" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: "Abort" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("disables Continue when conflicts remain", async ({ page }) => {
    // The default mock data includes one conflicted file (conflict-file.ts).
    await page.addInitScript(() => {
      window.__MOCK_REPO_STATE__ = "cherry-pick";
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const banner = page.getByRole("status").filter({ hasText: "Cherry-pick in progress" });
    const continueBtn = banner.getByRole("button", { name: "Continue" });
    await expect(continueBtn).toBeDisabled();
    await expect(continueBtn).toHaveAttribute("title", "Resolve all conflicts first");
  });

  test("Abort opens confirm dialog and clears state on confirm", async ({ page }) => {
    await page.addInitScript(() => {
      window.__MOCK_REPO_STATE__ = "revert";
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const banner = page.getByRole("status").filter({ hasText: "Revert in progress" });
    await banner.getByRole("button", { name: "Abort" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Abort revert?");
    await dialog.getByRole("button", { name: "Abort" }).click();

    // The mock flips repo_state back to clean. The banner disappears once the
    // store refresh completes.
    await expect(banner).toBeHidden();
  });

  test("merge state shows the CLI hint and no buttons", async ({ page }) => {
    await page.addInitScript(() => {
      window.__MOCK_REPO_STATE__ = "merge";
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const banner = page.getByRole("status").filter({ hasText: "Merge in progress" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("git merge --abort");
    await expect(banner.getByRole("button", { name: "Abort" })).toHaveCount(0);
    await expect(banner.getByRole("button", { name: "Continue" })).toHaveCount(0);
  });
});
