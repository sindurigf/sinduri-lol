import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { expect, test, type Page, type Response } from '@playwright/test';
import { DIST_DIR } from './routes';
import { waitForHydration } from './settle';

/**
 * Security response headers, and the CSP in particular.
 *
 * `_headers` is authored at public/_headers and copied into dist/, where
 * Cloudflare Pages reads it. `astro preview` sends none of those headers, so a
 * run against the preview server cannot tell a working policy from an empty
 * file. This spec starts its own static server over dist/, attaches the
 * headers parsed out of the built `_headers`, and drives a real browser at it.
 *
 * That proves the site can run under the policy as written: the island
 * hydrates, the fonts load, the mobile menu opens, the browser reports no
 * violation. It does not prove Cloudflare sends what the file says;
 * scripts/check-live.sh checks the deployed site (see README). On 2026-09-11
 * Cloudflare's zone HSTS setting was found replacing the value this file
 * asserts, while every test here passed.
 *
 * The hashes are the fragile part. The policy allows Astro's inline blocks by
 * sha256 rather than by 'unsafe-inline', and those hashes are build output, so
 * an Astro upgrade invalidates them and the mobile menu stops hydrating. `the
 * csp allows exactly the inline blocks the build emits` recomputes them from
 * dist/ and fails on drift in either direction.
 *
 * Proven able to fail:
 *
 *   - one character changed in a script hash in public/_headers, rebuilt:
 *     the drift test, the no-violations test (`script-src-elem blocked
 *     inline`) and the mobile menu test, which times out waiting for a dialog
 *     that never hydrates;
 *   - Referrer-Policy line deleted: the required-header test, and nothing
 *     else;
 *   - 2026-09-11, `max-age=31536000` in public/_headers: the HSTS test,
 *     Expected 15552000, Received 31536000. Deleting the header fails that
 *     test and the required-header one.
 *
 * Two rules, and the hazard the second brings. Pages applies every matching
 * rule and the more specific one does not win: where two rules set the same
 * header name, Pages joins the values with a comma. That is useful for
 * `X-Robots-Tag` and a silent corruption for every header here.
 * `Cross-Origin-Resource-Policy: same-origin, cross-origin` parses as nothing,
 * and a CSP joined to a second CSP is enforced as two policies at once, where
 * a resource must satisfy both. So the parser reads every rule and resolves a
 * path the way Pages does, and `no header is set by more than one rule` is the
 * assertion to read first if a header ever arrives looking like two stuck
 * together.
 */

const HEADERS_FILE = join(DIST_DIR, '_headers');

/** The site-wide rule. Every header but the two asset ones is set here. */
const GLOBAL_PATTERN = '/*';

/**
 * Vite's output directory. The only path in the build whose filenames carry a
 * content hash, and therefore the only one that may be cached immutably.
 */
const ASSET_PATTERN = '/_astro/*';

/** Every header the site is expected to send, checked by name. */
const REQUIRED_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'referrer-policy',
  'x-content-type-options',
] as const;

/**
 * The committed HSTS max-age, 180 days. Every other header here stops applying
 * the moment it stops being sent; a browser remembers this one for as long as
 * `max-age` says. So it is pinned exactly rather than bounded, and moving it
 * in either direction is a decision written down in public/_headers.
 */
const HSTS_MAX_AGE = 15_552_000;

/** One `_headers` rule: a URL pattern and the headers indented under it. */
type Rule = { pattern: string; headers: Map<string, string> };

/**
 * Cloudflare's `_headers` grammar, only as much of it as this file uses: `#`
 * comments, an unindented URL pattern, then the indented `Name: value` lines
 * that belong to it. Every rule is read, in file order.
 *
 * A header line before any pattern throws. Pages would have nowhere to apply
 * it either, and dropping it silently here is how a header goes missing in
 * production while the suite stays green.
 */
const parseHeadersFile = (source: string): Rule[] => {
  const rules: Rule[] = [];

  for (const raw of source.split('\n')) {
    const line = raw.split('#')[0]?.trimEnd() ?? '';
    if (line.trim() === '') continue;

    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: new Map() });
      continue;
    }

    const separator = line.indexOf(':');
    if (separator === -1) {
      throw new Error(
        `_headers line is neither a pattern nor a header: ${raw}`,
      );
    }

    const rule = rules.at(-1);
    if (!rule) {
      throw new Error(`_headers has a header line before any pattern: ${raw}`);
    }

    rule.headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    );
  }

  return rules;
};

/**
 * Does a pattern match a path? Only the subset this file uses: a literal
 * prefix and `*`, which Pages matches across `/` boundaries, so `/*` matches
 * everything and `/_astro/*` everything below it. A placeholder
 * (`/blog/:slug`) throws rather than risk a quiet mismatch.
 */
const matches = (pattern: string, pathname: string): boolean => {
  if (pattern.includes(':')) {
    throw new Error(
      `_headers pattern "${pattern}" uses a placeholder, which this test's ` +
        'matcher does not implement. Extend it in the same commit.',
    );
  }

  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${escaped}$`).test(pathname);
};

/**
 * The headers Pages would send for a path: every matching rule applies, and a
 * name set by two of them is joined with a comma. Reproducing the join, rather
 * than letting the later rule win, is what makes the corruption visible in `a
 * served response actually carries the headers` if `no header is set by more
 * than one rule` is ever weakened.
 */
const headersFor = (rules: Rule[], pathname: string): Map<string, string> => {
  const out = new Map<string, string>();

  for (const rule of rules) {
    if (!matches(rule.pattern, pathname)) continue;

    for (const [name, value] of rule.headers) {
      const existing = out.get(name);
      out.set(name, existing === undefined ? value : `${existing}, ${value}`);
    }
  }

  return out;
};

/**
 * The CSP as this server sends it: the published policy with
 * `upgrade-insecure-requests` taken out, and only that.
 *
 * No HTTP harness can carry that directive. It tells the browser to rewrite
 * every http:// subresource to https, which is what this server speaks, so the
 * page asks for its own stylesheet and island scripts over TLS and gets a
 * handshake error for each. Chromium and Firefox skip the upgrade for loopback
 * addresses; WebKit does not, for `localhost` any more than for `127.0.0.1`,
 * and loaded no assets at all with the full policy.
 *
 * No coverage is lost. `the csp allows no inline or eval escape hatch` reads
 * `_headers` directly and asserts the published policy declares the directive.
 * Only the browser honouring it goes unchecked, which no test served over http
 * could check in any engine.
 */
const asServed = (name: string, value: string): string =>
  name === 'content-security-policy'
    ? value.replace(/;\s*upgrade-insecure-requests\b/, '')
    : value;

/**
 * Script types the browser parses as data and never executes, and which
 * `script-src` therefore does not gate.
 *
 * Add an entry only with a measurement behind it. "Non-JavaScript script types
 * are exempt" is the wrong rule of thumb: `importmap` and `speculationrules`
 * are not JavaScript either and both are subject to script-src, so guessing
 * would drop a real block from the hash comparison below.
 *
 * `application/ld+json` is exempt because the HTML spec's "prepare the script
 * element" steps stop before the CSP check for a type that is not JavaScript,
 * not a module, not an import map and not speculation rules. Measured
 * 2026-09-09 with the JSON-LD block emitted and no hash for it: zero
 * violations in Chromium and Firefox, with the mobile menu still hydrating,
 * which is what says the policy was still enforced. WebKit is checked by CI;
 * see src/lib/structured-data.ts.
 */
const DATA_SCRIPT_TYPES = ['application/ld+json'];

const isDataBlock = (attributes: string): boolean => {
  const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
  return type !== undefined && DATA_SCRIPT_TYPES.includes(type.toLowerCase());
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
      const attributes = match[1] ?? '';
      if (/\bsrc\s*=/.test(attributes)) continue;
      if (isDataBlock(attributes)) continue;
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

/*
 * Every extension the build emits has to be here. The fallback below is
 * `application/octet-stream`, and `X-Content-Type-Options: nosniff` is set on
 * every response, so a type this map does not know is a type the browser
 * refuses rather than mistypes, silently. `every file type the build emits has
 * a type here` fails when the build grows an extension this map lacks.
 */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  /*
   * What <Image> emits. Every rendered image on the site is converted to WebP
   * at build time and lands in /_astro/; only the Open Graph images stay PNG,
   * because they are fetched by scrapers rather than by browsers.
   */
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  /*
   * The sitemap and its index. No `charset`, deliberately: XML carries its own
   * encoding declaration in the prolog, and a charset parameter on the media
   * type overrides it, so stating one here would make this server less like
   * the host rather than more.
   */
  '.xml': 'application/xml',
};

/**
 * The smallest static server that behaves like Pages for this build: resolve a
 * path to a file, fall back to `<path>/index.html`, then to 404.html with a
 * 404, and attach the parsed headers to every response.
 */
const startServer = async (rules: Rule[]): Promise<Server> => {
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

    for (const [name, value] of headersFor(rules, pathname)) {
      res.setHeader(name, asServed(name, value));
    }
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
 * How long a declared asset has to arrive. Well under the 30s test budget, so
 * the assertion naming the missing asset runs instead of the bare timeout that
 * would replace it.
 */
const ASSET_TIMEOUT_MS = 10_000;

/**
 * The `/_astro/` URLs the built homepage declares in its own markup: the
 * stylesheet, the font preload, each island's `component-url` and
 * `renderer-url`, and the images.
 *
 * Read from the file rather than observed on the wire. A test that measures
 * whatever happened to load cannot tell "the policy allowed everything" from
 * "nothing was requested"; this list says up front what has to arrive.
 * Transitive imports are left out: the browser discovers those, so the set
 * varies.
 *
 * Returned as groups, because an image declares alternatives. Every `<img>`
 * carries a 1x and a 2x `srcset` and the browser fetches the candidate that
 * suits its screen, so an `<img>` is one group satisfied by any of its URLs
 * arriving, and every other asset is a group of one.
 *
 * Proven that grouping did not make it lenient, 2026-09-11: with `img-src
 * 'none'` added to the CSP in dist/_headers it failed in chromium with all
 * three image groups missing, and passed with the build restored. Also run at
 * devicePixelRatio 2 in chromium, standing in for WebKit, which cannot run on
 * the development machine.
 */
const declaredAssets = (): string[][] => {
  const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
  const paths = (text: string): string[] => [
    ...new Set(
      [...text.matchAll(/\/_astro\/[A-Za-z0-9._-]+/g)].map((m) => m[0]),
    ),
  ];

  const image = /<img\b[^>]*>/g;
  const groups = [
    ...[...html.matchAll(image)].map((m) => paths(m[0])),
    ...paths(html.replace(image, '')).map((path) => [path]),
  ].filter((group) => group.length > 0);

  expect(
    groups.length,
    'dist/index.html references nothing under /_astro/. Either the build ' +
      'stopped emitting hashed assets or this pattern no longer matches ' +
      'them, and every assertion below would pass by measuring nothing.',
  ).toBeGreaterThan(0);

  return [...new Map(groups.map((group) => [group.join(' '), group])).values()];
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
  /*
   * Navigations here wait only for what each test asserts: `commit` where a test
   * reads a response header, and `domcontentloaded` for the asset test, which
   * arms its own bounded waits before navigating. The two tests that assert
   * rendering, fonts and hydration keep `load`.
   *
   * That scoping does NOT prevent the Firefox stall this file is known for, and
   * an earlier version of this comment said it did. playwright.config.ts
   * records the cause: Playwright intermittently stops delivering navigation
   * lifecycle events for Firefox, `commit` included, and every recorded stall
   * is a `page.goto` here, the one spec that navigates to an origin other than
   * the preview server. About 5 in 105 executions.
   *
   * A stalled navigation never recovers, so most of the default 30s is spent
   * waiting on nothing; `navigationTimeout` ends it sooner. And on 2026-09-12
   * the stall hit one test twice running, which one retry could not absorb and
   * which failed the required check, so CI retries this file twice. A real
   * navigation to this loopback server takes well under a second.
   */
  test.use({ navigationTimeout: 15_000 });
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });

  let server: Server;
  let origin: string;
  let rules: Rule[];
  /** The `/*` rule: every header but the two asset ones is set there. */
  let headers: Map<string, string>;

  test.beforeAll(async () => {
    expect(
      existsSync(HEADERS_FILE),
      `${HEADERS_FILE} is missing. It is authored at public/_headers and the ` +
        `build copies it; Cloudflare Pages sends no headers without it.`,
    ).toBe(true);

    rules = parseHeadersFile(readFileSync(HEADERS_FILE, 'utf8'));

    const global = rules.find((rule) => rule.pattern === GLOBAL_PATTERN);
    expect(
      global,
      `_headers has no ${GLOBAL_PATTERN} rule, so the site-wide policy is ` +
        'not being sent at all.',
    ).toBeDefined();
    headers = global!.headers;

    server = await startServer(rules);
    const { port } = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((done) => server.close(() => done()));
  });

  test('the build ships the two rules this file knows about', () => {
    expect(
      rules.map((rule) => rule.pattern),
      'a rule was added or renamed. Every rule has to be understood here, ' +
        'because the ones this test does not know about are the ones that ' +
        'can collide with the others in production and not in CI.',
    ).toEqual([GLOBAL_PATTERN, ASSET_PATTERN]);
  });

  /**
   * The guard on MIME above. This server stands in for Pages, and it can only
   * do that for file types it knows: anything else leaves here as
   * `application/octet-stream` under `nosniff`, which a browser drops on the
   * floor.
   */
  test('every file type the build emits has a type here', () => {
    const extensions = new Set<string>();

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        // `_headers` has no extension and is never requested by a browser.
        else if (extname(entry.name) !== '')
          extensions.add(extname(entry.name));
      }
    };
    walk(DIST_DIR);

    expect(
      [...extensions].filter((extension) => !(extension in MIME)).sort(),
      'the build emits a file type this spec cannot serve. Add it to MIME ' +
        'with the type Cloudflare Pages sends, or this server answers with ' +
        'application/octet-stream and nosniff makes the browser refuse it.',
    ).toEqual([]);
  });

  /** The invariant the second rule created. See the note at the top. */
  test('no header is set by more than one rule', () => {
    const seen = new Map<string, string[]>();

    for (const rule of rules) {
      for (const name of rule.headers.keys()) {
        seen.set(name, [...(seen.get(name) ?? []), rule.pattern]);
      }
    }

    const shared = [...seen.entries()]
      .filter(([, patterns]) => patterns.length > 1)
      .map(([name, patterns]) => `${name} (${patterns.join(' and ')})`);

    expect(
      shared,
      'Cloudflare joins a header set by two matching rules with a comma ' +
        'rather than letting the more specific rule win. For any header in ' +
        'this file that is a corruption, not an override: a doubled CSP is ' +
        'enforced as two policies at once, and a doubled ' +
        'Cross-Origin-Resource-Policy parses as none. Move the header so it ' +
        'appears under one pattern only.',
    ).toEqual([]);
  });

  test('the asset rule caches immutably, and nothing else does', () => {
    /*
     * The dangerous case is not a missing Cache-Control, it is an immutable
     * one on a path whose name does not change with its bytes: a browser
     * holding that will not revalidate for a year and cannot be told to. So
     * this asserts where `immutable` may appear, not just that it appears.
     */
    for (const rule of rules) {
      const cacheControl = rule.headers.get('cache-control') ?? '';
      if (!/\bimmutable\b/.test(cacheControl)) continue;

      expect(
        rule.pattern,
        `${rule.pattern} is cached immutably. Only ${ASSET_PATTERN} may be: ` +
          'Vite content-hashes every filename it emits there, so the URL ' +
          'changes with the bytes. Every other path in this build is stable ' +
          'across edits, and an immutable response at one freezes it in every ' +
          'browser that has already fetched it, for the full max-age, with no ' +
          'way to invalidate it.',
      ).toBe(ASSET_PATTERN);
    }

    const assets = rules.find((rule) => rule.pattern === ASSET_PATTERN);
    expect(
      assets?.headers.get('cache-control'),
      `${ASSET_PATTERN} should be cached immutably. Its filenames are ` +
        'content-hashed, so revalidating them is a round trip that can never ' +
        'change the answer.',
    ).toMatch(/\bimmutable\b/);
  });

  /**
   * The site is closed to search indexes until somebody opens it
   * deliberately.
   *
   * Unusually for this file, it guards a restriction rather than a protection,
   * because losing this one is silent: a launched site with the `noindex`
   * forgotten looks correct in every browser and is simply absent from every
   * search engine. Removing it has to fail here so it is a deliberate act with
   * a commit message. When the site launches, delete this test in the same
   * commit as the header; TODO.md carries it as a launch item.
   *
   * It is a header rather than a <meta name="robots"> so it also covers the
   * PDFs, llms.txt and the sitemap. It is set under `/*` only, because
   * Cloudflare comma-joins a name set by two matching rules.
   */
  test('the site is still closed to search indexes', () => {
    expect(
      headers.get('x-robots-tag'),
      'X-Robots-Tag: noindex is missing. If this is the launch, delete this ' +
        'test in the same commit and say so. If it is not, the site is now ' +
        'indexable and nothing else would have told you.',
    ).toBe('noindex');

    /*
     * robots.txt must stay permissive for the header above to mean anything.
     * A crawler told not to fetch never receives the noindex, and the URL can
     * still be listed from an external link, so the combination is strictly
     * weaker than the header alone.
     */
    const robots = readFileSync(join(DIST_DIR, 'robots.txt'), 'utf8');
    expect(
      robots,
      'robots.txt now disallows crawling. That does not reinforce the ' +
        'noindex header, it defeats it: a crawler that will not fetch the ' +
        'page never learns the page is noindex, and the URL can still be ' +
        'listed on the strength of a link from elsewhere.',
    ).not.toMatch(/^Disallow:\s*\/\s*$/m);
  });

  test('the isolation headers are set, and COEP is not', () => {
    expect(
      headers.get('cross-origin-opener-policy'),
      'Cross-Origin-Opener-Policy severs the window.opener reference a page ' +
        'that opens this one would otherwise keep.',
    ).toBe('same-origin');

    const assets = rules.find((rule) => rule.pattern === ASSET_PATTERN);
    expect(
      assets?.headers.get('cross-origin-resource-policy'),
      `${ASSET_PATTERN} is build output and nothing off-origin should be ` +
        'able to embed it. It is set here and not under ' +
        `${GLOBAL_PATTERN} on purpose: /images/og-default.png is meant to be ` +
        'rendered by other origins, and a header cannot be overridden ' +
        'per-path, only comma-joined.',
    ).toBe('same-origin');

    /*
     * COEP is deliberately absent. It unlocks SharedArrayBuffer and precise
     * timers, which nothing here uses, and otherwise only breaks a
     * cross-origin subresource the day one is added. Asserted rather than
     * merely omitted, so adding it is a recorded decision.
     */
    for (const rule of rules) {
      expect(
        rule.headers.has('cross-origin-embedder-policy'),
        `${rule.pattern} sets Cross-Origin-Embedder-Policy. Nothing here ` +
          'needs cross-origin isolation, and it only adds a way for a future ' +
          'cross-origin subresource to fail. If it is wanted, say why here.',
      ).toBe(false);
    }
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
   * HSTS is the only header here that outlives the response, so its max-age is
   * pinned. `preload` is the directive this test exists for: it puts the host
   * in browser binaries, and removal takes months of release trains nobody
   * here controls, so it is the one mistake that editing this file cannot
   * undo. `includeSubDomains` is deliberately not asserted either way; what it
   * promises is written beside it in public/_headers.
   */
  test('hsts carries the committed max-age and is not preloaded', () => {
    const hsts = headers.get('strict-transport-security') as string;

    expect(
      hsts,
      'Strict-Transport-Security must not carry `preload`. Getting a host off ' +
        'the browser preload list takes months and is outside our control.',
    ).not.toMatch(/\bpreload\b/i);

    const maxAge = hsts.match(/max-age\s*=\s*(\d+)/i);
    expect(maxAge, `no max-age in "${hsts}"`).not.toBeNull();

    expect(
      Number(maxAge?.[1]),
      `public/_headers sets max-age=${maxAge?.[1]} and the committed value ` +
        `is max-age=${HSTS_MAX_AGE}. A browser holds this for the full ` +
        `duration, so it moves deliberately rather than as part of a header ` +
        `sweep. Change HSTS_MAX_AGE in the same commit and say why there.`,
    ).toBe(HSTS_MAX_AGE);
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

    /*
     * `'self'` since the contact form landed, and no wider. It has to name the
     * exact origin the form posts to: at `'none'` the browser blocks the
     * submission with nothing on the page to say so, and at `*` the directive
     * stops being a control at all.
     *
     * Verified not to be vacuous: set back to `'none'` this fails, and the
     * form submission fails silently in a real browser with only a console
     * message.
     */
    expect(
      directive(csp, 'form-action'),
      "form-action must be 'self'. The contact form at /contact/ posts to " +
        '/contact/send/ on this origin; anything narrower blocks it silently.',
    ).toBe("form-action 'self'");

    /*
     * No http:// URL exists in the build to upgrade today, every reference
     * being same-origin and relative, so this is for the one pasted in later.
     * It rewrites such a URL to https before the request leaves, which beats
     * default-src blocking it after the fact: blocked is a broken image
     * somebody has to notice, upgraded is a working one.
     */
    expect(
      directive(csp, 'upgrade-insecure-requests'),
      'upgrade-insecure-requests rewrites an http:// subresource to https ' +
        'instead of leaving it to be blocked as mixed content.',
    ).toBe('upgrade-insecure-requests');
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
    const response = await page.goto(`${origin}/`, { waitUntil: 'commit' });

    for (const name of REQUIRED_HEADERS) {
      expect(
        (await response?.allHeaders())?.[name],
        `${name} is missing from the response`,
      ).toBe(asServed(name, headers.get(name) ?? ''));
    }
  });

  /**
   * The second rule, end to end. Everything above reads the file; this asks a
   * browser what it actually received for a real asset the page pulled in,
   * and checks the two rules resolved the way Pages resolves them rather than
   * the way this test's own parser happens to.
   */
  test('a hashed asset is served cacheable and not embeddable', async ({
    page,
  }) => {
    const assetResponses: Response[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.startsWith('/_astro/')) {
        assetResponses.push(response);
      }
    });

    /*
     * Armed before the navigation, so a response arriving while the page is
     * still parsing is not missed. Each wait is bounded and swallows its own
     * timeout: a blocked asset is never requested at all, so an unbounded wait
     * would end the test as a bare 30s timeout naming nothing, while catching
     * it lets the assertion below say which assets did not arrive.
     */
    const declared = declaredAssets();
    const arrivals = declared.map((group) =>
      page
        .waitForResponse(
          (response) => {
            const url = new URL(response.url());
            return url.origin === origin && group.includes(url.pathname);
          },
          { timeout: ASSET_TIMEOUT_MS },
        )
        .then(() => group)
        .catch(() => null),
    );

    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });

    /*
     * Every image brought into view in turn, because some declared assets are
     * lazy and are requested only as they near the viewport. Jumping straight
     * to the bottom is not enough: it passes over the middle of the page, and
     * on 2026-09-11 firefox did not request the About-teaser roundel that way
     * while chromium did.
     *
     * Scrolling rather than excluding them keeps this the one test that would
     * catch a CSP blocking an image. Two animation frames per stop give the
     * browser a rendering update in which to notice each image;
     * `waitForResponse` is already armed above.
     */
    await page.evaluate(async () => {
      for (const image of Array.from(document.images)) {
        image.scrollIntoView({ block: 'center' });
        await new Promise<void>((settled) =>
          requestAnimationFrame(() => requestAnimationFrame(() => settled())),
        );
      }
    });

    const arrived = await Promise.all(arrivals);
    expect(
      declared
        .filter((_, index) => arrived[index] === null)
        .map((group) => group.join(' or ')),
      `an asset dist/index.html declares under /_astro/ never arrived ` +
        `within ${ASSET_TIMEOUT_MS}ms. A resource the CSP refuses is never ` +
        `requested, so this is what a policy that blocks the build's own ` +
        `output looks like from here. Received is what went missing.`,
    ).toEqual([]);

    await waitForHydration(page);

    /*
     * A subset check, not an equality one. The browser also fetches what the
     * declared modules import, and that discovered set is the browser's
     * business, not this file's. What has to hold is that nothing the HTML
     * named went missing: one file from every group.
     */
    const served = new Set(
      assetResponses.map((response) => new URL(response.url()).pathname),
    );
    expect(
      declared.filter((group) => !group.some((path) => served.has(path))),
      'the homepage did not pull in everything dist/index.html declares ' +
        'under /_astro/, so this test measured less than it claims to.',
    ).toEqual([]);

    for (const response of assetResponses) {
      const received = await response.allHeaders();
      const path = new URL(response.url()).pathname;

      expect(received['cache-control'], `${path} is not cached`).toBe(
        'public, max-age=31536000, immutable',
      );
      expect(
        received['cross-origin-resource-policy'],
        `${path} is embeddable off-origin`,
      ).toBe('same-origin');

      /*
       * The asset has to keep the site-wide policy as well. Pages merges the
       * rules rather than replacing one with the other, and a doubled header,
       * `nosniff, nosniff`, is the shape the merge failure takes.
       */
      expect(received['x-content-type-options'], `${path} lost nosniff`).toBe(
        'nosniff',
      );
    }
  });

  test('the HTML is not cached immutably', async ({ page }) => {
    const response = await page.goto(`${origin}/`, { waitUntil: 'commit' });
    const cacheControl = (await response?.allHeaders())?.['cache-control'];

    expect(
      cacheControl ?? '',
      'the document is at a stable URL and its bytes change with every ' +
        'edit. An immutable response here would freeze the homepage in every ' +
        'browser that had already loaded it.',
    ).not.toMatch(/\bimmutable\b/);
  });

  test('the site runs clean under the policy: no violations, fonts load', async ({
    page,
  }) => {
    const violations = await collectViolations(page);

    await page.goto(`${origin}/`);
    await waitForHydration(page);
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
    await page.goto(`${origin}/`);
    await waitForHydration(page);

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
    const response = await page.goto(`${origin}/no-such-path-${Date.now()}`, {
      waitUntil: 'commit',
    });

    expect(response?.status()).toBe(404);
    expect((await response?.allHeaders())?.['content-security-policy']).toBe(
      asServed(
        'content-security-policy',
        headers.get('content-security-policy') ?? '',
      ),
    );
  });
});
