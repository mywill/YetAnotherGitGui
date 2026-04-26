import { test } from "@playwright/test";
import { tauriMocks } from "./tauri-mocks";
import { switchToBranchesView, expandAllBranchSections } from "./helpers";
import { assertManualContrast } from "./contrast-helper";

/**
 * Regression tests for previously-broken WCAG AA color-contrast cases. Each
 * pin guards a token combination that axe alone cannot reliably detect:
 *
 *   1. Annotated tag "A" badge: axe explicitly skips short text ("Element
 *      content is too short to determine if it is actual text content"). Once
 *      `--color-badge-tag-text` was introduced (`#0a0a0c` dark / `#ffffff`
 *      light) the badge passes; this test pins that.
 *
 *   2. `text-warning` on `bg-warning-bg` (light): the original `#a8770d` on
 *      `#fef3c7` was 3.6:1. Light `--color-warning` was darkened to `#7c5c08`
 *      to clear AA. axe lands the synthetic-include scope in `inapplicable`,
 *      so this uses manual contrast.
 *
 *   3. `text-text-muted` on `bg-bg-hover` (light): the original `#6a6a70` on
 *      `#e8e8ec` was 4.40:1, just below AA. Light `--color-text-muted` was
 *      darkened to `#5e5e64`. axe's hover observation is unreliable, so this
 *      uses a synthetic element + manual contrast.
 *
 * All three use `assertManualContrast` because axe either drops the elements
 * into `inapplicable` or refuses to score them. Manual contrast reads computed
 * style and applies the WCAG 2.1 luminance formula directly.
 */
test.describe("Contrast regressions (token-pair guards)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("annotated tag badge passes AA in dark mode", async ({ page }) => {
    await switchToBranchesView(page);
    await expandAllBranchSections(page);
    await page.waitForSelector(".annotated-badge", { timeout: 10000 });
    await assertManualContrast(page, ".annotated-badge");
  });

  test("text-warning on bg-warning-bg passes AA in light mode", async ({ page }) => {
    await page.evaluate(async () => {
      const mod = await import("/src/stores/settingsStore.ts");
      mod.useSettingsStore.getState().setTheme("light");
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "synthetic-warning-pair bg-warning-bg rounded px-2 py-1";
      const inner = document.createElement("span");
      inner.className = "text-warning text-xs";
      inner.textContent = "MERGE";
      el.appendChild(inner);
      document.body.appendChild(el);
    });
    await page.waitForSelector(".synthetic-warning-pair > span", { timeout: 5000 });
    await assertManualContrast(page, ".synthetic-warning-pair > span");
  });

  test("text-text-muted on bg-bg-hover passes AA in light mode", async ({ page }) => {
    await page.evaluate(async () => {
      const mod = await import("/src/stores/settingsStore.ts");
      mod.useSettingsStore.getState().setTheme("light");
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "synthetic-hover-row bg-bg-hover px-2 py-1";
      const inner = document.createElement("span");
      inner.className = "text-text-muted text-xs";
      inner.textContent = "Muted text on hovered row";
      el.appendChild(inner);
      document.body.appendChild(el);
    });
    await page.waitForSelector(".synthetic-hover-row > span", { timeout: 5000 });
    await assertManualContrast(page, ".synthetic-hover-row > span");
  });
});
