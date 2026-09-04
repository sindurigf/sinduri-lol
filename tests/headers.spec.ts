import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DIST_DIR } from './routes';

/**
 * Security response headers, and the CSP in particular.
 *
 * `_headers` is authored at public/_headers and copied into dist/ by the
 * build, which is where Cloudflare Pages reads it. Nothing in the Playwright
 * setup serves it: `astro preview` is a plain static server and sends none of
 * these headers, so a suite run against the preview server cannot tell a
 * working policy from an empty file. This spec therefore starts its own static
 * server over the same dist/ and attaches the headers parsed out of the built
 * `_headers`, then drives a real browser at it.
 *
 * WHAT THAT PROVES AND WHAT IT DOES NOT. It proves the policy that is written
 * in the file is one the site can actually run under: the island hydrates, the
 * fonts load, the mobile menu opens, and the browser reports no violation. It
 * does not prove Cloudflare parses the file the same way this test does. That
 * half is a one-time check against the deployed site with `curl -I`; see
 * README. The failure mode it leaves open is a syntax mistake in `_headers`,
 * which Cloudflare surfaces in the Pages build log rather than silently.
 *
 * THE HASHES ARE THE FRAGILE PART. The policy allows Astro's three inline
 * blocks by sha256 rather than by 'unsafe-inline'. Those hashes are build
 * output, so an Astro upgrade invalidates them and the mobile menu stops
 * hydrating. `csp allows exactly the inline blocks the build emits` recomputes
 * them from dist/ and fails on drift in either direction.
 *
 * Verified not to be vacuous. Changing one character of one script hash in
 * public/_headers and rebuilding fails three tests: the drift test, the
 * no-violations test (`script-src-elem blocked inline`), and the mobile menu
 * test, which times out waiting for a dialog that never hydrates. That last
 * one is the point: it is the same failure a real user would hit, reached
 * from the same cause. Deleting the Referrer-Policy line fails the required
 * header test and nothing else.
 *
 * The HSTS assertions were checked the same way: adding `preload` or
 * `includeSubDomains`, or raising max-age past the ceiling, fails the HSTS
 * test, and deleting the header fails both it and the required-header test.
 * With the file as committed, all nine pass.
 */

const HEADERS_FILE = join(DIST_DIR, '_headers');

/** Every header the site is expected to send, checked by name. */
const REQUIRED_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'referrer-policy',
  'x-content-type-options',
] as const;

/**
 * The HSTS ceiling. Every other header here stops applying the moment it stops
 * being sent; this one is remembered by the browser for as long as `max-age`
 * says, and there is no way to shorten that after the fact. One day is the
 * committed value, so one day is the ceiling until someone raises it
 * deliberately and says so here.
 */
const MAX_AGE_CEILING = 86_400;

/**
 * Cloudflare's `_headers` grammar, only as much of it as this file uses: `#`
 * comments, an unindented URL pattern, then indented `Name: value` lines that
 * belong to it. One rule is parsed, `/*`, because that is the only one here;
 * a second rule would be silently ignored, so the test asserts there is not
 * one rather than growing a parser.
 */
const parseHeadersFile = (
  source: string,
): { patterns: string[]; headers: Map<string, string> } => {
  const patterns: string[] = [];
  const headers = new Map<string, string>();

  for (const raw of source.split('\n')) {
    const line = raw.split('#')[0]?.trimEnd() ?? '';
    if (line.trim() === '') continue;

    if (!/^\s/.test(line)) {
      patterns.push(line.trim());
      continue;
    }

    const separator = line.indexOf(':');
    if (separator === -1) {
      throw new Error(
        `_headers line is neither a pattern nor a header: ${raw}`,
      );
    }

    headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    );
  }

  return { patterns, headers };
};

/** sha256-base64 of a string, in the form a CSP source expression takes. */
const cspHash = (body: string): string =>
  `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;

const htmlFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
};

/** Every distinct inline <script> and <style> body across the whole build. */
const inlineBlocks = (): { scripts: Set<string>; styles: Set<string> } => {
  const scripts = new Set<string>();
  const styles = new Set<string>();

  for (const file of htmlFiles(DIST_DIR)) {
    const html = readFileSync(file, 'utf8');

    for (const match of html.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
    )) {
      if (/\bsrc\s*=/.test(match[1] ?? '')) continue;
      scripts.add(match[2] ?? '');
    }

    for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      styles.add(match[1] ?? '');
    }
  }

  return { scripts, styles };
};

const directive = (csp: string, name: string): string => {
  const found = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));

  expect(found, `the CSP has no ${name} directive:\n  ${csp}`).toBeDefined();
  return found as string;
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * The smallest static server that behaves like Pages for this build: resolve a
 * path to a file, fall back to `<path>/index.html`, then to 404.html with a
 * 404, and attach the parsed headers to every response.
 */
const startServer = async (headers: Map<string, string>): Promise<Server> => {
  const resolve = (pathname: string): string | null => {
    const direct = join(DIST_DIR, pathname);
    if (existsSync(direct) && statSync(direct).isFile()) return direct;

    const indexed = join(direct, 'index.html');
    return existsSync(indexed) ? indexed : null;
  };

  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url ?? '/', 'http://localhost').pathname,
    );

    const resolved = resolve(pathname);
    const file = resolved ?? join(DIST_DIR, '404.html');
    const status = resolved === null ? 404 : 200;

    for (const [name, value] of headers) res.setHeader(name, value);
    res.setHeader(
      'content-type',
      MIME[extname(file)] ?? 'application/octet-stream',
    );
    res.writeHead(status);
    res.end(readFileSync(file));
  });

  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return server;
};

/**
 * Collects every CSP violation the browser reports, from before the first byte
 * of page script runs. `securitypolicyviolation` is the browser's own signal,
 * so this cannot miss a refusal the way scraping console text can.
 */
const collectViolations = async (page: Page): Promise<string[]> => {
  const violations: string[] = [];

  await page.exposeFunction('__reportViolation', (detail: string) => {
    violations.push(detail);
  });

  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const e = event as SecurityPolicyViolationEvent;
      (
        window as unknown as {
          __reportViolation: (detail: string) => void;
        }
      ).__reportViolation(
        `${e.violatedDirective} blocked ${e.blockedURI || '(inline)'} on ${e.documentURI}`,
      );
    });
  });

  return violations;
};

test.describe('security headers', () => {
  let server: Server;
  let origin: string;
  let headers: Map<string, string>;
  let patterns: string[];

  test.beforeAll(async () => {
    expect(
      existsSync(HEADERS_FILE),
      `${HEADERS_FILE} is missing. It is authored at public/_headers and the ` +
        `build copies it; Cloudflare Pages sends no headers without it.`,
    ).toBe(true);

    ({ headers, patterns } = parseHeadersFile(
      readFileSync(HEADERS_FILE, 'utf8'),
    ));

    server = await startServer(headers);
    const { port } = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((done) => server.close(() => done()));
  });

  test('the build ships _headers with one /* rule', () => {
    expect(
      patterns,
      'the parser only reads the first rule, so a second one would be ' +
        'silently ignored here while Cloudflare applied it',
    ).toEqual(['/*']);
  });

  test('every required header is declared', () => {
    for (const name of REQUIRED_HEADERS) {
      expect(
        headers.get(name),
        `_headers does not declare ${name}`,
      ).toBeTruthy();
    }

    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });

  /**
   * HSTS is the only header in this file that outlives the response, so it is
   * the only one with an assertion about how *small* it is. `preload` is the
   * one that cannot be walked back at all: it puts the host in browser
   * binaries, and removal takes months of release trains nobody here controls.
   * `includeSubDomains` extends the promise to subdomains that do not exist
   * yet and whose TLS nobody has checked.
   */
  test('hsts is short-lived, and is not preloaded or extended to subdomains', () => {
    const hsts = headers.get('strict-transport-security') as string;

    expect(
      hsts,
      'Strict-Transport-Security must not carry `preload`. Getting a host off ' +
        'the browser preload list takes months and is outside our control.',
    ).not.toMatch(/\bpreload\b/i);

    expect(
      hsts,
      'Strict-Transport-Security must not carry `includeSubDomains`. It ' +
        'commits every subdomain, including ones that do not exist yet.',
    ).not.toMatch(/\bincludeSubDomains\b/i);

    const maxAge = hsts.match(/max-age\s*=\s*(\d+)/i);
    expect(maxAge, `no max-age in "${hsts}"`).not.toBeNull();

    expect(
      Number(maxAge?.[1]),
      `max-age is ${maxAge?.[1]}s. A browser holds this for the full ` +
        `duration and cannot be told to forget it early, so it is raised ` +
        `deliberately, after the deployed setup has been proven stable, not ` +
        `as part of a header sweep. Raise MAX_AGE_CEILING in the same commit.`,
    ).toBeLessThanOrEqual(MAX_AGE_CEILING);
  });

  test('the csp allows no inline or eval escape hatch', () => {
    const csp = headers.get('content-security-policy') as string;

    for (const escape of [
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'unsafe-hashes'",
    ]) {
      expect(
        csp,
        `the CSP contains ${escape}. Astro's inline blocks are allowed by ` +
          `hash; nothing here needs this.`,
      ).not.toContain(escape);
    }

    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
  });

  /**
   * The drift test. Both directions matter: a hash the build no longer emits
   * is dead weight that hides what the policy is really allowing, and a block
   * the build emits with no hash is a script the browser will refuse.
   */
  test('the csp allows exactly the inline blocks the build emits', () => {
    const csp = headers.get('content-security-policy') as string;
    const { scripts, styles } = inlineBlocks();

    const check = (name: string, bodies: Set<string>, source: string): void => {
      const expected = [...bodies].map(cspHash).sort();
      const listed = (source.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? []).sort();

      expect(
        listed,
        `${name} in public/_headers does not match the ${bodies.size} inline ` +
          `block(s) in dist/. This is what an Astro upgrade breaks. Replace ` +
          `the hashes in that directive with:\n  ${expected.join(' ')}`,
      ).toEqual(expected);
    };

    expect(
      scripts.size,
      'expected inline scripts in the build',
    ).toBeGreaterThan(0);
    check('script-src', scripts, directive(csp, 'script-src'));
    check('style-src', styles, directive(csp, 'style-src'));
  });

  test('a served response actually carries the headers', async ({ page }) => {
    const response = await page.goto(`${origin}/`);

    for (const name of REQUIRED_HEADERS) {
      expect(
        (await response?.allHeaders())?.[name],
        `${name} is missing from the response`,
      ).toBe(headers.get(name));
    }
  });

  test('the site runs clean under the policy: no violations, fonts load', async ({
    page,
  }) => {
    const violations = await collectViolations(page);

    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    expect(violations, 'the browser refused something under the CSP').toEqual(
      [],
    );

    // The font is same-origin, so font-src 'self' should not touch it. This
    // fails if a future change moves it to a CDN without updating the policy.
    const loaded = await page.evaluate(() =>
      document.fonts.check('900 33px "Lexend Variable"'),
    );
    expect(loaded, "Lexend did not load under font-src 'self'").toBe(true);
  });

  test('the mobile menu still hydrates and opens under the policy', async ({
    page,
  }) => {
    const violations = await collectViolations(page);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    const trigger = page.getByRole('button', { name: /menu/i });
    await trigger.click();

    const panel = page.getByRole('dialog');
    await expect(
      panel,
      'the island did not hydrate, which is what a stale script hash looks ' +
        'like from the outside',
    ).toBeVisible();

    await expect(panel.getByRole('link')).not.toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    expect(violations, 'the browser refused something under the CSP').toEqual(
      [],
    );
  });

  test('the 404 response carries the headers too', async ({ page }) => {
    const response = await page.goto(`${origin}/no-such-path-${Date.now()}`);

    expect(response?.status()).toBe(404);
    expect((await response?.allHeaders())?.['content-security-policy']).toBe(
      headers.get('content-security-policy'),
    );
  });
});
