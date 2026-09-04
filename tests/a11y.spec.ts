import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ROUTES, routesFromBuild } from './routes';

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

  for (const route of ROUTES) {
    test(`${route} has no violations`, async ({ page }) => {
      await analyze(page, route);
    });
  }
});
