import { test, expect, type Page, type Locator } from "@playwright/test";
import { tauriMocks } from "./tauri-mocks";

const DENSITIES = ["compact", "comfortable", "spacious"] as const;
const TEXT_SIZES = ["small", "medium", "large"] as const;

async function setDensityAndText(page: Page, density: string, textSize: string) {
  await page.evaluate(
    ({ d, t }) => {
      document.documentElement.dataset.density = d;
      if (t === "medium") {
        delete document.documentElement.dataset.textSize;
      } else {
        document.documentElement.dataset.textSize = t;
      }
    },
    { d: density, t: textSize }
  );
}

async function assertChildFitsInParent(parent: Locator, child: Locator, label: string) {
  const parentBox = await parent.boundingBox();
  const childBox = await child.boundingBox();
  expect(parentBox, `${label}: parent has no bounding box`).not.toBeNull();
  expect(childBox, `${label}: child has no bounding box`).not.toBeNull();
  if (!parentBox || !childBox) return;
  // Allow 1px subpixel slop.
  expect(
    childBox.height,
    `${label}: child height ${childBox.height} exceeds parent height ${parentBox.height}`
  ).toBeLessThanOrEqual(parentBox.height + 1);
  expect(
    childBox.y + childBox.height,
    `${label}: child bottom ${childBox.y + childBox.height} extends past parent bottom ${
      parentBox.y + parentBox.height
    }`
  ).toBeLessThanOrEqual(parentBox.y + parentBox.height + 1);
}

test.describe("Density x text-size: chrome buttons fit inside chrome bars", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMocks);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  for (const density of DENSITIES) {
    for (const textSize of TEXT_SIZES) {
      test(`${density} + ${textSize}: header buttons fit inside .app-header`, async ({ page }) => {
        await setDensityAndText(page, density, textSize);

        const header = page.locator(".app-header");
        await expect(header).toBeVisible();

        // Search, Refresh, Settings — every button in the header right group.
        const buttons = header.locator(".header-right button");
        const count = await buttons.count();
        expect(count).toBeGreaterThanOrEqual(3);

        for (let i = 0; i < count; i++) {
          await assertChildFitsInParent(
            header,
            buttons.nth(i),
            `${density}/${textSize} header btn[${i}]`
          );
        }
      });

      test(`${density} + ${textSize}: status-bar terminal toggle fits inside .status-bar footer`, async ({
        page,
      }) => {
        await setDensityAndText(page, density, textSize);

        const footer = page.locator("footer.status-bar");
        await expect(footer).toBeVisible();

        const toggle = footer.locator(".status-bar-terminal-toggle");
        await expect(toggle).toBeVisible();

        await assertChildFitsInParent(
          footer,
          toggle,
          `${density}/${textSize} status-bar terminal toggle`
        );
      });

      test(`${density} + ${textSize}: terminal-header close button fits inside header`, async ({
        page,
      }) => {
        await setDensityAndText(page, density, textSize);

        // Open the terminal panel
        await page.keyboard.press("Control+Backquote");
        await page.waitForSelector(".terminal-header", { timeout: 5000 });

        const header = page.locator(".terminal-header");
        const close = header.locator(".terminal-close");
        await expect(close).toBeVisible();

        await assertChildFitsInParent(header, close, `${density}/${textSize} terminal close`);
      });
    }
  }
});
