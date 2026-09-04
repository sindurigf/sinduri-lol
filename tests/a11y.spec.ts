import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  POST_ROUTES,
  ROUTES,
  postRoutesFromContent,
  routesFromBuild,
} from './routes';

/**
 * WCAG 2.2 AA is the target, so every A and AA tag up to 2.2 is enabled.
 * No rule is disabled and no result is excluded. If something fails here it is
 * a real defect: fix the markup, never the tag list.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Violation = Awaited<
  ReturnType<AxeBuilder['analyze']>
>['violations'][number];

/** Turn axe output into something a human can act on without opening a report. */
const formatViolations = (route: string, violations: Violation[]): string => {
  const lines = violations.map((violation) => {
    const nodes = violation.nodes
      .map((node) => {
        const selector = node.target.join(' ');
        const detail =
          node.failureSummary?.split('\n').join('\n        ') ?? '';
        return `      selector: ${selector}\n        ${detail}`;
      })
      .join('\n');

    return [
      `  rule:    ${violation.id}`,
      `  impact:  ${violation.impact ?? 'unknown'}`,
      `  help:    ${violation.help}`,
      `  url:     ${violation.helpUrl}`,
      `  nodes:   ${violation.nodes.length}`,
      nodes,
    ].join('\n');
  });

  return [
    `${violations.length} accessibility violation(s) on ${route}:`,
    ...lines,
  ].join('\n\n');
};

const analyze = async (page: Page, route: string): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.status(), `${route} should serve a 200`).toBe(200);

  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

  expect(
    results.violations,
    formatViolations(route, results.violations),
  ).toEqual([]);
};

test.describe('axe: WCAG 2.2 AA', () => {
  test('route coverage matches the build output', () => {
    expect(
      routesFromBuild(),
      'tests/routes.ts is out of sync with dist/. Update ROUTES.',
    ).toEqual([...ROUTES].sort());
  });

  /**
   * The same drift, caught one step earlier and named at the file rather than
   * at the URL. The test above compares this list to the build; this compares
   * it to `src/content/blog/`, so adding or renaming a post without touching
   * POST_ROUTES fails saying which Markdown file is unaccounted for instead of
   * which route is missing from `dist/`.
   */
  test('post routes match the Markdown in src/content/blog', () => {
    expect(
      postRoutesFromContent(),
      'POST_ROUTES in tests/routes.ts does not match src/content/blog/. A ' +
        'post was added, renamed or deleted without updating the list.',
    ).toEqual([...POST_ROUTES].sort());
  });

  for (const route of ROUTES) {
    test(`${route} has no violations`, async ({ page }) => {
      await analyze(page, route);
    });
  }
});

/**
 * The scans above run at the default desktop viewport with the menu closed. At
 * that width the whole MobileMenu subtree is display:none and the <dialog> has
 * never been opened, so axe has never seen a single element inside the panel:
 * not the nav links, not the CTA, not the close button. A rule only fires on
 * markup it can reach, so open the thing before scanning it.
 *
 * This is NOT what hid the duplicate `aria-label="Primary"` on the panel's
 * <nav>, and it is worth writing that down rather than leaving a plausible
 * story in place. Two separate reasons that never made it into a scan:
 *
 *   1. `landmark-unique` is an axe best-practice rule. It carries none of the
 *      wcag2a / wcag2aa / wcag21a / wcag21aa / wcag22aa tags below, so this
 *      suite has never run it and still does not.
 *   2. Even untagged it passes, at every width. The header nav is
 *      `hidden md:block` and the panel is inside `md:hidden`, so the two navs
 *      named "Primary" are never exposed at the same time. Measured with the
 *      panel open at 320px: the header nav computes display:none and
 *      landmark-unique returns one passing node.
 *
 * Removing that label was still right. This suite simply did not catch it and
 * is not the reason it survived.
 *
 * 320px is the SC 1.4.10 Reflow width and the only width where the trigger is
 * rendered. Same tags as the main suite, deliberately: a violation inside a
 * dialog is not a lesser violation.
 *
 * Verified not to be vacuous: an <img> with no alt and a link at #2a2a2a
 * dropped into the panel fail all eleven of these (image-alt, color-contrast)
 * while all thirty-six pre-existing tests stay green.
 */
const REFLOW_VIEWPORT = { width: 320, height: 720 };

test.describe('axe: WCAG 2.2 AA with the mobile menu open at 320px', () => {
  test.use({ viewport: REFLOW_VIEWPORT });

  for (const route of ROUTES) {
    test(`${route} has no violations with the menu open`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.status(), `${route} should serve a 200`).toBe(200);

      const trigger = page.getByRole('button', { name: /menu/i });
      await expect(
        trigger,
        'the menu trigger should be visible at 320px',
      ).toBeVisible();
      await trigger.click();

      const panel = page.getByRole('dialog');
      await expect(
        panel,
        'the panel must be open, or this scan is the closed-state scan again',
      ).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .analyze();

      expect(
        results.violations,
        formatViolations(`${route} (mobile menu open)`, results.violations),
      ).toEqual([]);
    });
  }
});
