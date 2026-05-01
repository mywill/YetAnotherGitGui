import { test as base, expect } from "@playwright/test";

type Fixtures = Record<string, never>;

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));
    await use(page);
    if (errors.length > 0) {
      const msg = errors.map((e) => `${e.name}: ${e.message}`).join("\n");
      throw new Error(`Test produced uncaught page errors:\n${msg}`);
    }
  },
});

export { expect };
