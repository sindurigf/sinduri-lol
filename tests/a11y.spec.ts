import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gotoSettled } from './settle';
import {
  POST_ROUTES,
  ROUTES,
  postRoutesFromContent,
  routesFromBuild,
} from './routes';
import { AXE_TAGS, REFLOW_VIEWPORT } from './wcag';

/**
 * axe's best-practice rules, kept in their own set and run in their own block
 * below rather than appended to AXE_TAGS.
 *
 * Why they are separate: ACCESSIBILITY.md targets WCAG 2.2 AA without yet
 * claiming conformance, and CI is what keeps that target honest. None of these
 * rules is a success criterion, so folding them into AXE_TAGS would report a
 * `region` or `heading-order` regression as a failure of a test named
 * "WCAG 2.2 AA", which is not what broke. Keeping the sets apart means the
 * failure names which of the two things you did. TODO.md > Considered and
 * declined cites this as the argument against merging the axe passes.
 *
 * Advisory is not lesser. `heading-order`, `landmark-one-main`, `region` and
 * `skip-link` are the structure a screen reader navigates by.
 *
 * Measured on `/` when this block landed, 2026-09-05: 17 rules passed, 10 were
 * inapplicable, 0 violations, 0 incomplete. Dated, not maintained.
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
  const response = await gotoSettled(page, route);
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
   * at the URL. The test above compares this list with the build; this
   * compares it with `src/content/blog/`, so adding or renaming a post without
   * touching POST_ROUTES names the Markdown file rather than the missing
   * route.
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
 * WCAG success criteria. See BEST_PRACTICE_TAGS for why they are not simply
 * appended to AXE_TAGS.
 *
 * It is a regression guard, not a worklist: green on every route on the day it
 * was written, and it now fails a build if a page drops content outside a
 * landmark or skips a heading level, which nothing here would have noticed
 * before.
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
 * 320px is the SC 1.4.10 Reflow width and the only width where the trigger is
 * rendered. Same tags as the main suite, deliberately: a violation inside a
 * dialog is not a lesser violation. That means the WCAG tags only, so
 * `landmark-unique` does not run here; the best-practice block above runs it
 * with the panel closed, and docs/MANUAL_TESTING.md checks the open panel by
 * hand.
 *
 * Verified not to be vacuous: an <img> with no alt and a link at #2a2a2a
 * dropped into the panel fail every test in this describe block, on image-alt
 * and color-contrast, while every test outside it stays green.
 */
test.describe('axe: WCAG 2.2 AA with the mobile menu open at 320px', () => {
  test.use({ viewport: REFLOW_VIEWPORT });

  for (const route of ROUTES) {
    test(`${route} has no violations with the menu open`, async ({ page }) => {
      const response = await gotoSettled(page, route);
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
