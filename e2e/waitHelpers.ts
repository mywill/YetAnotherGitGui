import type { Page } from "@playwright/test";

/**
 * Set the theme via the settings store and wait until the change is reflected
 * on `<html data-theme>`. Replaces the brittle `setTheme(); waitForTimeout(N)`
 * pattern.
 */
export async function setThemeAndWait(page: Page, theme: "dark" | "light"): Promise<void> {
  await page.evaluate(async (t) => {
    const mod = await import("/src/stores/settingsStore.ts");
    mod.useSettingsStore.getState().setTheme(t);
  }, theme);
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    theme
  );
}

/**
 * Set the density via the settings store and wait until the change is
 * reflected on `<html data-density>`.
 */
export async function setDensityAndWait(
  page: Page,
  density: "compact" | "comfortable" | "spacious"
): Promise<void> {
  await page.evaluate(async (d) => {
    const mod = await import("/src/stores/settingsStore.ts");
    mod.useSettingsStore.getState().setDensity(d);
  }, density);
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.density === expected,
    density
  );
}

/**
 * Set the text size via the settings store and wait until the change is
 * reflected on `<html data-text-size>`.
 */
export async function setTextSizeAndWait(
  page: Page,
  textSize: "small" | "medium" | "large"
): Promise<void> {
  await page.evaluate(async (t) => {
    const mod = await import("/src/stores/settingsStore.ts");
    mod.useSettingsStore.getState().setTextSize(t);
  }, textSize);
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.textSize === expected,
    textSize
  );
}
