import { expect, test } from './test';
import { builtHtml, SAMPLED_ROUTES } from './routes';
import { REPORT_LINK } from '../src/lib/nav';
import { ACCESSIBILITY_PATH, REPORT_BARRIER_ID } from '../src/lib/paths';
import { NODE } from './tags';
import { gotoSettled } from './settle';

/* The band above the header: one report link, the same place on every page (SC 3.2.6). */

const SKIP_HREF = '#main-content';

/** Every link, button and tabindex stop before <header>, in source order. */
const stopsBeforeHeader = (html: string): string[] => {
  const body = html.slice(html.indexOf('<body'), html.indexOf('<header'));
  return [
    ...body.matchAll(/<(a|button|input|select|textarea)\b[^>]*>|tabindex="0"/g),
  ].map((match) => /href="([^"]*)"/.exec(match[0])?.[1] ?? match[0]);
};

test.describe('the report band', () => {
  test(
    'every built page has the skip link, then the report link, before the header',
    NODE,
    () => {
      const pages = builtHtml();
      expect(pages.size, 'no built pages were found').toBeGreaterThan(0);
      for (const [route, html] of pages) {
        expect(
          stopsBeforeHeader(html),
          `${route}: the skip link and the report link must be the only stops before the header, in that order (SC 2.4.1, 3.2.6).`,
        ).toEqual([SKIP_HREF, REPORT_LINK.href]);
        expect(
          html,
          `${route}: the report link text is not "${REPORT_LINK.label}".`,
        ).toContain(`>${REPORT_LINK.label}</a>`);
      }
    },
  );

  test('the report link leads to the Report a Barrier heading', NODE, () => {
    const route = ACCESSIBILITY_PATH.replace(/\/$/, '');
    const html = builtHtml().get(route);
    expect(html, `${route} was not built`).toBeDefined();
    expect(
      REPORT_LINK.href,
      'the report link does not point at the accessibility statement.',
    ).toBe(`${ACCESSIBILITY_PATH}#${REPORT_BARRIER_ID}`);
    expect(
      html,
      `${route} has no h2 with id "${REPORT_BARRIER_ID}" reading "Report a Barrier".`,
    ).toMatch(
      new RegExp(
        `<h2[^>]*\\bid="${REPORT_BARRIER_ID}"[^>]*>Report a Barrier</h2>`,
      ),
    );
  });

  for (const route of SAMPLED_ROUTES) {
    test(`${route}: the second Tab reaches the report link`, async ({
      page,
    }) => {
      await gotoSettled(page, route);
      await page.locator('body').press('Tab');
      await page.keyboard.press('Tab');
      await expect(
        page
          .getByRole('complementary', { name: 'Accessibility help' })
          .getByRole('link', {
            name: REPORT_LINK.label,
            exact: true,
          }),
        'the second Tab should reach the report link, right after the skip link.',
      ).toBeFocused();
    });
  }

  test('without JavaScript the report link shows and opens the report section', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    const link = page.getByRole('link', {
      name: REPORT_LINK.label,
      exact: true,
    });
    await expect(
      link,
      'the report link is hidden without JavaScript.',
    ).toBeVisible();
    await link.click();
    await expect(
      page.getByRole('heading', { name: 'Report a Barrier', level: 2 }),
      'following the report link without JavaScript does not show the Report a Barrier heading.',
    ).toBeInViewport();
    await context.close();
  });
});
