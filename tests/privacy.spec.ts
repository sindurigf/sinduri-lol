import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { builtPages, DIST_DIR } from './routes';
import { configuredSite } from './source';
import { RETENTION_DAYS } from '../src/lib/contact-form';

/**
 * The privacy policy, held to what the site actually does.
 *
 * A privacy policy is the easiest document on a site to make quietly false. It
 * is written once, when it is true, and then somebody adds an embed, a font
 * from a CDN or a hit counter. Nothing breaks and no test fails, and the page
 * goes on making a claim that is now a lie told in Sinduri's name. So every
 * factual claim on /privacy has an assertion here, and each failure message
 * names the sentence that has stopped being true. Read this file before adding
 * anything that talks to another origin: the page needs an edit in the same
 * commit.
 *
 * Cloudflare's logging is deliberately not asserted. The page says requests
 * reach them and points at their policy, which is a statement about someone
 * else's system.
 *
 * This file reads src/ and dist/, and what a reader receives is dist/ after
 * Cloudflare has finished with it. On 2026-09-11 the edge was found injecting
 * a Web Analytics beacon into every page: this file passed throughout, because
 * the build never contained it, and the claims stayed true only because the
 * CSP refused the script. The edge is the other half, and
 * scripts/check-live.sh is its check, run by hand after a deploy against the
 * same element list as SUBRESOURCE below, plus any inline script the build did
 * not write. README > Cloudflare settings lists what the edge can change.
 *
 * The off-origin half reads the build rather than the source on purpose:
 * grepping src/ would miss a URL introduced by a dependency, a Markdown post,
 * or a component that composes one at build time.
 *
 * Proven able to fail, 2026-09-09:
 *
 *   - `document.cookie = 'a=b'` or `localStorage.setItem(...)` in any
 *     component fails "nothing sets a cookie or writes to browser storage";
 *   - `<img src="https://placekitten.com/2/2">` on any page fails "nothing is
 *     loaded from another origin", naming the file and the URL, and so does a
 *     stylesheet from a font CDN, which is the realistic version;
 *   - rewriting one of the four claims so the page says the opposite fails
 *     "the page still makes the claims this file checks". That mutation passed
 *     at first: the check read the whole document, and the page's own <meta
 *     name="description"> carries three of the four claim strings, so a
 *     summary in the head was satisfying a test about the body.
 */

const SRC_DIR = 'src';
const PRIVACY_PAGE = '/privacy';

/**
 * The four claims the page makes, as they appear in its `<strong>` labels,
 * lower-cased and without the trailing full stop. Each has an assertion above.
 */
const CLAIMS = [
  'no cookies',
  'no browser storage',
  'no analytics',
  'no third-party requests',
];

/**
 * The site's own host, read from `site` in astro.config.mjs rather than typed
 * here, so this cannot start passing because a constant went stale.
 */
const ownHost = (): string => new URL(configuredSite()).host;

/**
 * APIs that store something in the reader's browser. `document.cookie` covers
 * both reading and writing; the rest are the three storage mechanisms a page
 * can reach without one.
 */
const STORAGE_APIS = [
  'document.cookie',
  'localStorage',
  'sessionStorage',
  'indexedDB',
];

/**
 * Attributes that cause a fetch. `<a href>` is deliberately absent: an
 * ordinary link sends nothing until it is followed, which is what the page's
 * "Links away from here" section says. `<link href>` is included, because a
 * stylesheet or a preload is a request the page makes on its own.
 *
 * Absolute same-origin URLs are filtered out below rather than here, because
 * `<link rel="canonical">` and `<link rel="sitemap">` carry one on every page
 * and match this pattern. Neither is a fetch and neither is another domain,
 * and the claim on the page is about other domains, so comparing the host is
 * the assertion. A `rel` allowlist would be a second list to maintain and
 * would still be wrong about the next one.
 */
const SUBRESOURCE =
  /<(?:script|link|img|iframe|video|audio|source|embed|object|track)\b[^>]*\b(?:src|href|data|poster)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;

const sourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(astro|vue|ts|js|css)$/.test(entry.name)) out.push(full);
  }
  return out;
};

/**
 * Comments blanked, so prose about an API is not mistaken for a use of it.
 * This file's own subject matter guarantees the problem: /privacy exists to
 * say the site does not use localStorage, and the page and this spec both name
 * it repeatedly. scripts/check-tokens.mjs blanks comments for the same reason.
 */
const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

test.describe('the privacy policy is true', () => {
  test('the page is built and reachable from every page', () => {
    const pages = builtPages();
    const privacy = pages.find((page) => page.route === PRIVACY_PAGE);
    expect(privacy, '/privacy was not built').toBeDefined();

    /*
     * Reachability is the point, and it is what went wrong with
     * ACCESSIBILITY.md, which sat in the repository linked from nothing
     * clickable. A policy nobody can reach is the same as no policy.
     */
    const missing = pages
      .filter(({ route }) => route !== '/404')
      .filter(({ file }) => !readFileSync(file, 'utf8').includes('/privacy'))
      .map(({ route }) => route);

    expect(
      missing,
      'route(s) with no link to /privacy. It is in the footer, so every page ' +
        'should carry one: ' +
        missing.join(', '),
    ).toEqual([]);
  });

  test('nothing sets a cookie or writes to browser storage', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC_DIR)) {
      const code = withoutComments(readFileSync(file, 'utf8'));
      for (const api of STORAGE_APIS) {
        if (code.includes(api)) offenders.push(`${file}: ${api}`);
      }
    }

    expect(
      offenders,
      '/privacy says "Nothing on sinduri.lol sets a cookie, and nothing ' +
        'reads one" and "Nothing is written to local storage, session ' +
        'storage or a database in your browser". That is no longer true:\n  ' +
        offenders.join('\n  ') +
        '\nEither remove the storage, or edit the page in this same commit.',
    ).toEqual([]);
  });

  test('nothing is loaded from another origin', () => {
    const offenders: string[] = [];
    const host = ownHost();

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.html')) continue;

        const html = readFileSync(full, 'utf8');
        for (const match of html.matchAll(SUBRESOURCE)) {
          const url = match[1]!;
          if (new URL(url).host === host) continue;
          offenders.push(`${full}: ${url}`);
        }
      }
    };
    walk(DIST_DIR);

    expect(
      offenders,
      '/privacy says "Loading a page here contacts no other domain". The ' +
        'build now fetches something off-origin:\n  ' +
        offenders.join('\n  ') +
        '\nOrdinary <a href> links are not counted, because they send ' +
        'nothing until followed. This is a subresource, which the page ' +
        'requests on its own. Note the CSP would also refuse it at runtime.',
    ).toEqual([]);
  });

  test('the page still makes the claims this file checks', () => {
    /*
     * The other direction. Every test above asserts the site matches the page;
     * this asserts the page still says the things being matched, because
     * deleting a sentence is the other way to make the two agree.
     *
     * It matches the <strong> labels, not loose substrings. Searching the body
     * text for "no analytics" could not fail: the sentence explaining the
     * claim reads "There is no analytics service", so rewriting the label to
     * say the opposite left the phrase in place one word later.
     */
    const privacy = builtPages().find((page) => page.route === PRIVACY_PAGE)!;
    const html = readFileSync(privacy.file, 'utf8');

    /*
     * The body only: the page's <meta name="description"> carries three of the
     * four claim strings, so reading the whole document let a summary in the
     * head satisfy a test about the body.
     */
    const body = html.slice(html.indexOf('<body'));
    const labels = [...body.matchAll(/<strong[^>]*>([^<]+)<\/strong>/g)].map(
      (match) => match[1]!.trim().replace(/\.$/, '').toLowerCase(),
    );

    for (const claim of CLAIMS) {
      expect(
        labels,
        `/privacy no longer makes the "${claim}" claim. Its labels are now: ` +
          `${labels.join(', ')}. If the claim was removed because it stopped ` +
          'being true, the tests above should have failed first; if it was ' +
          'removed for another reason, remove the matching assertion here in ' +
          'the same commit.',
      ).toContain(claim);
    }
  });

  test('the page discloses what the contact form stores', () => {
    /*
     * The form is the only thing on this site that stores anything about a
     * visitor, so the page has to say so. Without this, deleting the section
     * leaves a privacy page describing a site that collects nothing while the
     * form keeps collecting, and every other test here still passes.
     *
     * Asserted on the rendered text rather than on prose: the retention period
     * is read from the same constant the sweep uses, so the page and the code
     * cannot disagree about it.
     */
    const privacy = builtPages().find((page) => page.route === PRIVACY_PAGE)!;
    const text = readFileSync(privacy.file, 'utf8')
      .slice(readFileSync(privacy.file, 'utf8').indexOf('<body'))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    expect(
      text,
      '/privacy no longer names the contact form. It stores a name, an email ' +
        'address and a message, so the page has to say that it does.',
    ).toContain('contact form');

    expect(
      text,
      `/privacy no longer states the ${RETENTION_DAYS}-day retention period ` +
        'for stored messages. It is read from RETENTION_DAYS, so this fails ' +
        'if the page stops rendering it or the constant changes without the ' +
        'page following.',
    ).toContain(`${RETENTION_DAYS} days`);

    /*
     * Where it is stored, which is fixed: the D1 database was created with the
     * EU jurisdiction, and D1 does not allow a jurisdiction to be changed after
     * creation. This asserts only that the page says so; wrangler.jsonc names
     * the database.
     */
    expect(
      text,
      '/privacy no longer says where stored messages are kept. The database ' +
        'is restricted to the European Union, and a reader deciding whether to ' +
        'write is owed that.',
    ).toContain('European Union');

    expect(
      text.toLowerCase(),
      '/privacy no longer says how to have a stored message deleted. A page ' +
        'that records what it keeps without saying how to get it removed is ' +
        'half a disclosure.',
    ).toContain('removed');
  });
});
