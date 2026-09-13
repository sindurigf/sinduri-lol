/*
 * A static server for the built site that sends the headers `public/_headers`
 * declares, and the helpers that read them. Shared by tests/headers.spec.ts,
 * which asserts the headers themselves, and tests/console.spec.ts, which walks
 * every route under them.
 *
 * The main suite deliberately runs without these headers, against
 * scripts/preview-static.mjs; that file says why.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { DIST_DIR } from './routes';

/** One `_headers` rule: a URL pattern and the headers indented under it. */
export type Rule = { pattern: string; headers: Map<string, string> };

/**
 * Cloudflare's `_headers` grammar, only as much of it as this file uses: `#`
 * comments, an unindented URL pattern, then the indented `Name: value` lines
 * that belong to it. Every rule is read, in file order.
 *
 * A header line before any pattern throws. Cloudflare would have nowhere to apply
 * it either, and dropping it silently here is how a header goes missing in
 * production while the suite stays green.
 */
export const parseHeadersFile = (source: string): Rule[] => {
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
 * prefix and `*`, which Cloudflare matches across `/` boundaries, so `/*` matches
 * everything and `/_astro/*` everything below it. A placeholder
 * (`/blog/:slug`) throws rather than risk a quiet mismatch.
 */
export const matches = (pattern: string, pathname: string): boolean => {
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
 * The headers Cloudflare would send for a path: every matching rule applies, and a
 * name set by two of them is joined with a comma. Reproducing the join, rather
 * than letting the later rule win, is what makes the corruption visible in `a
 * served response actually carries the headers` if `no header is set by more
 * than one rule` is ever weakened.
 */
export const headersFor = (
  rules: Rule[],
  pathname: string,
): Map<string, string> => {
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
export const asServed = (name: string, value: string): string =>
  name === 'content-security-policy'
    ? value.replace(/;\s*upgrade-insecure-requests\b/, '')
    : value;

/*
 * Every extension the build emits has to be here. The fallback below is
 * `application/octet-stream`, and `X-Content-Type-Options: nosniff` is set on
 * every response, so a type this map does not know is a type the browser
 * refuses rather than mistypes, silently. `every file type the build emits has
 * a type here` fails when the build grows an extension this map lacks.
 */
export const MIME: Record<string, string> = {
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
 * The smallest static server that behaves like the Worker's asset layer for
 * this build: resolve a path to a file, then `<path>.html`, then
 * `<path>/index.html`, then 404.html with a 404, and attach the parsed headers
 * to every response.
 */
export const startServer = async (rules: Rule[]): Promise<Server> => {
  const resolve = (pathname: string): string | null => {
    const direct = join(DIST_DIR, pathname);
    if (existsSync(direct) && statSync(direct).isFile()) return direct;

    /*
     * `/404` to `404.html`, as Workers resolves a page emitted as a bare
     * `.html`. tests/routes.ts lists `/404` so it is scanned like any route, and
     * without this it answered 404 and a console spec read that as an error.
     */
    const asHtml = `${direct}.html`;
    if (existsSync(asHtml) && statSync(asHtml).isFile()) return asHtml;

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
 * Collects every CSP violation the browser reports, from before the first byte
 * of page script runs. `securitypolicyviolation` is the browser's own signal,
 * so this cannot miss a refusal the way scraping console text can.
 */
export const collectViolations = async (page: Page): Promise<string[]> => {
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
