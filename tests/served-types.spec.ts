import { test, expect } from './test';

/*
 * What the asset worker actually sends for the files whose type matters, run
 * by playwright.worker.config.ts against `astro preview`, which serves through
 * the Worker and applies public/_headers. The static server test:a11y uses
 * applies neither, so these can only be checked here.
 *
 * HTTP only, like the rest of this suite, which CI runs without a browser.
 * Whether Chromium accepts the rules is checked in tests/headers.spec.ts,
 * which runs in every browser project.
 *
 * Verified not to be vacuous, 2026-09-18: with the /speculationrules.json rule
 * removed from public/_headers the file arrives with the wrong type, which
 * fails the first test. Restored, all three pass.
 */

const RULES = '/speculationrules.json';
const RULES_TYPE = 'application/speculationrules+json';

test.describe('served types', () => {
  test('the speculation rules file carries the type a browser requires', async ({
    request,
  }) => {
    const response = await request.get(RULES);
    expect(response.status()).toBe(200);
    expect(
      response.headers()['content-type'],
      `${RULES} must be served as ${RULES_TYPE}, or Chromium ignores it`,
    ).toBe(RULES_TYPE);
    expect(Object.keys(await response.json())).toEqual(['prefetch']);
  });

  test('a page names the rules file and the discovery links', async ({
    request,
  }) => {
    const headers = (await request.get('/')).headers();
    expect(headers['speculation-rules']).toBe(`"${RULES}"`);
    expect(headers.link).toContain('</llms.txt>; rel="describedby"');
  });

  test('the Markdown sources and the feeds carry text types', async ({
    request,
  }) => {
    for (const [path, type] of [
      ['/blog/five-years-in-drupal.md', 'text/markdown'],
      ['/rss.xml', 'xml'],
    ] as const) {
      const response = await request.get(path);
      expect(response.status(), `${path} status`).toBe(200);
      expect(response.headers()['content-type'], `${path} type`).toContain(
        type,
      );
    }
  });
});
