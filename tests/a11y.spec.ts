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

/**
 * axe's best-practice rules, kept in their own set and run in their own block
 * below rather than appended to AXE_TAGS.
 *
 * WHY THEY ARE SEPARATE. ACCESSIBILITY.md makes a formal WCAG 2.2 AA
 * conformance claim, and CI is what keeps that claim honest. Folding these
 * tags into AXE_TAGS would be one line shorter and would report a
 * `region` or `heading-order` regression as a failure of a test named
 * "WCAG 2.2 AA" — which is not what broke. None of these rules is a success
 * criterion. Keeping the sets apart means the failure tells you which of the
 * two things you did.
 *
 * They are not a lesser check for being advisory. `heading-order`,
 * `landmark-one-main`, `region` and `skip-link` are the structure a screen
 * reader navigates by, and this suite ran none of them until now.
 *
 * UNIT: rules that executed on `/` when this block was added, 2026-09-05 —
 * 17 passing, 10 inapplicable, 0 violations, 0 incomplete. Recorded because a
 * block that is green on the day it lands has to be shown to be doing work at
 * all; the passing list was empty-heading, heading-order, image-redundant-alt,
 * landmark-banner-is-top-level, landmark-contentinfo-is-top-level,
 * landmark-main-is-top-level, landmark-no-duplicate-banner,
 * landmark-no-duplicate-contentinfo, landmark-no-duplicate-main,
 * landmark-one-main, landmark-unique, meta-viewport-large,
 * page-has-heading-one, presentation-role-conflict, region, skip-link and
 * tabindex. The numbers are dated, not maintained.
 */
const BEST_PRACTICE_TAGS = ['best-practice'];

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

const analyze = async (
  page: Page,
  route: string,
  tags: string[] = AXE_TAGS,
): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.status(), `${route} should serve a 200`).toBe(200);

  const results = await new AxeBuilder({ page }).withTags(tags).analyze();

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
 * The same sweep, over the rules axe classes as best practice rather than as
 * WCAG success criteria. Separate block, separate tag set; see
 * BEST_PRACTICE_TAGS for why they are not simply appended to AXE_TAGS.
 *
 * Green on the day it was written, on every route. That is the point: it is a
 * regression guard, not a worklist. Nothing here needed fixing, and the value
 * is that `region`, `heading-order`, `landmark-one-main`, `skip-link` and the
 * rest now fail a build if a future page drops content outside a landmark or
 * skips a heading level — which, until this block existed, nothing in this
 * repository would have noticed.
 *
 * Verified not to be vacuous: an <h4> placed directly under an <h2>, and a <p>
 * moved outside every landmark, each fail this block on heading-order and
 * region respectively while every test outside it stays green.
 */
test.describe('axe: best practice', () => {
  for (const route of ROUTES) {
    test(`${route} has no best-practice violations`, async ({ page }) => {
      await analyze(page, route, BEST_PRACTICE_TAGS);
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
 *      wcag2a / wcag2aa / wcag21a / wcag21aa / wcag22aa tags, so for as long
 *      as AXE_TAGS was the only tag set this suite never ran it. It does now,
 *      in the best-practice block above — which changes nothing about the
 *      history below, and is the reason this paragraph is worth keeping.
 *   2. Even untagged it passes, at every width, so running it would not have
 *      caught the label either. The header nav is `hidden md:block` and the
 *      panel is inside `md:hidden`, so the two navs named "Primary" are never
 *      exposed at the same time. Measured with the panel open at 320px: the
 *      header nav computes display:none and landmark-unique returns one
 *      passing node. Re-measured 2026-09-05 with the rule actually enabled:
 *      still one passing node, still no violation.
 *
 * Removing that label was still right. This suite simply did not catch it and
 * is not the reason it survived.
 *
 * 320px is the SC 1.4.10 Reflow width and the only width where the trigger is
 * rendered. Same tags as the main suite, deliberately: a violation inside a
 * dialog is not a lesser violation.
 *
 * Verified not to be vacuous: an <img> with no alt and a link at #2a2a2a
 * dropped into the panel fail every test in this describe block, on image-alt
 * and color-contrast, while every test outside it stays green.
 *
 * UNIT: tests in this block, which is one per entry in ROUTES. Measured at
 * commit 39e10b9, where that was 11 of a 47-test suite; the comment used to
 * quote those two figures bare, as "eleven" and "thirty-six" (47 minus the 11
 * new ones), and both rotted the moment the blog added twelve routes. The
 * block is 23 tests as of 2026-09-05. The numbers are not the claim — "every
 * test in this block" is — so they are dated rather than maintained.
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
