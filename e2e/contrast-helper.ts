import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type AxeResults = Awaited<ReturnType<InstanceType<typeof AxeBuilder>["analyze"]>>;
type AxeResult = AxeResults["violations"][number];

export interface ContrastScanResult {
  /** WCAG AA failures (4.5:1 normal / 3:1 large) — `color-contrast` rule. */
  aaViolations: AxeResult[];
  /** Cases where axe could not resolve fg/bg (color-mix, single-character pills,
   *  background-image stacks). Logged for visibility but not asserted on at the
   *  AA bar — many are short-text pills the rule explicitly skips. */
  incomplete: AxeResult[];
}

/**
 * Scan a region for WCAG AA color-contrast issues.
 *
 * Runs only the `color-contrast` rule (4.5:1 normal text, 3:1 large text).
 * `color-contrast-enhanced` (AAA) is intentionally not enabled — the AAA
 * inventory exercise produced 21 unique failures across the brand palette,
 * many of which are intentional design trade-offs (commit-button magenta,
 * toast green/red). AA stays the enforced bar; AAA is tracked manually.
 */
export async function scanForContrast(page: Page, selector?: string): Promise<ContrastScanResult> {
  let builder = new AxeBuilder({ page }).withRules(["color-contrast"]);
  if (selector) {
    builder = builder.include(selector);
  }
  const results = await builder.analyze();

  const incomplete = results.incomplete.filter((v) => v.id === "color-contrast");
  if (incomplete.length > 0) {
    console.log(
      `[contrast] incomplete (un-asserted) results for "${selector ?? "page"}":`,
      incomplete.map((i) => i.nodes.map((n) => n.html)).flat()
    );
  }

  return {
    aaViolations: results.violations.filter((v) => v.id === "color-contrast"),
    incomplete,
  };
}

/**
 * Scan and assert that a region passes WCAG AA color-contrast.
 *
 * Use this from every contrast test. The raw `scanForContrast` is exported for
 * diagnostics that need to inspect rather than assert. `incomplete` results are
 * logged but not asserted on — they're mostly single-character pills the rule
 * explicitly skips, and treating them as failures was too noisy.
 */
export async function assertContrastClean(page: Page, selector?: string): Promise<void> {
  const { aaViolations } = await scanForContrast(page, selector);
  expect(aaViolations, "AA color-contrast (4.5:1)").toEqual([]);
}

/**
 * Read the rendered foreground and background of an element and compute the
 * WCAG 2.1 contrast ratio manually. Use this for cases axe refuses to score:
 *   - Single-character pills (axe: "content too short to determine if text").
 *   - Elements where axe lands in `inapplicable` because of include-scope edge
 *     cases.
 *
 * Walks parent chain to resolve a non-transparent background. Throws if the
 * computed color cannot be parsed (color-mix, oklab, etc.) — those cases need
 * a different strategy, not a manual fallback.
 *
 * @param minRatio Defaults to 4.5 (WCAG AA normal text). Pass 3 for large text
 *                 or 7 for AAA normal text.
 */
export async function assertManualContrast(
  page: Page,
  selector: string,
  minRatio = 4.5
): Promise<void> {
  const sample = await page
    .locator(selector)
    .first()
    .evaluate((node) => {
      const el = node as HTMLElement;
      const fg = getComputedStyle(el).color;
      let bg = getComputedStyle(el).backgroundColor;
      let cur: HTMLElement | null = el;
      while (cur && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) {
        cur = cur.parentElement;
        if (!cur) break;
        bg = getComputedStyle(cur).backgroundColor;
      }
      return { fg, bg };
    });
  const ratio = wcagRatio(sample.fg, sample.bg);
  expect(
    ratio,
    `Manual contrast for "${selector}": fg=${sample.fg} bg=${sample.bg} → ${ratio.toFixed(
      2
    )}:1, expected ≥ ${minRatio}:1`
  ).toBeGreaterThanOrEqual(minRatio);
}

function wcagRatio(fg: string, bg: string): number {
  const Lfg = relativeLuminance(parseRgb(fg));
  const Lbg = relativeLuminance(parseRgb(bg));
  const [L1, L2] = Lfg > Lbg ? [Lfg, Lbg] : [Lbg, Lfg];
  return (L1 + 0.05) / (L2 + 0.05);
}

function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`Cannot parse RGB from computed color "${s}"`);
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
