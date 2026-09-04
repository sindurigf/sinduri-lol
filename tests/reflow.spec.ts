import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from './routes';

/**
 * SC 1.4.10 Reflow: content must not require scrolling in two directions at a
 * 320px viewport (1280px at 400% zoom). SC 1.4.12 Text Spacing: the same has to
 * hold once a user overrides line height, letter spacing, and word spacing.
 *
 * The failure this guards against is a single long word in an uppercased
 * heading. Nothing wraps it, so it paints past the content box and the whole
 * document scrolls sideways. Three rules in global.css prevent it; this asserts
 * the outcome rather than the rules, so any future heading, token, or layout
 * change that reintroduces the overflow fails here.
 */
const REFLOW_VIEWPORT = { width: 320, height: 720 };

/** The override from WCAG SC 1.4.12, applied verbatim. */
const TEXT_SPACING_OVERRIDE = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p, li, h1, h2, h3, h4, h5, h6 { margin-bottom: 2em !important; }
`;

/**
 * Names the element that overflows, so a failure says which heading broke
 * rather than only that the document is 40px too wide.
 */
const overflowReport = async (page: Page): Promise<string> => {
  const offenders = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('body, body *')) {
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 0.5) {
        const text = (el.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 48);
        out.push(
          `${el.tagName.toLowerCase()}: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}: "${text}"`,
        );
      }
    }
    return out;
  });

  return offenders.length ? `\n  ${offenders.join('\n  ')}` : '';
};

const expectNoHorizontalOverflow = async (
  page: Page,
  route: string,
  applySpacingOverride: boolean,
): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.status(), `${route} should serve a 200`).toBe(200);

  if (applySpacingOverride) {
    await page.addStyleTag({ content: TEXT_SPACING_OVERRIDE });
  }

  // Headings are the thing at risk, so measure only after the webfont swaps in.
  await page.evaluate(() => document.fonts.ready);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    scrollWidth,
    `${route} scrolls horizontally at ${REFLOW_VIEWPORT.width}px: ` +
      `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}` +
      (await overflowReport(page)),
  ).toBeLessThanOrEqual(clientWidth);
};

test.describe('reflow at 320px: no horizontal scrolling', () => {
  test.use({ viewport: REFLOW_VIEWPORT });

  for (const route of ROUTES) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      await expectNoHorizontalOverflow(page, route, false);
    });
  }
});

test.describe('reflow at 320px with the SC 1.4.12 text-spacing override', () => {
  test.use({ viewport: REFLOW_VIEWPORT });

  for (const route of ROUTES) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      await expectNoHorizontalOverflow(page, route, true);
    });
  }
});
