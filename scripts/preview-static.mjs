/*
 * The static server the Playwright suite runs against.
 *
 * WHY NOT `astro preview`. Since the Cloudflare adapter landed, preview serves
 * through the Worker, which applies `public/_headers`, which carries
 * `upgrade-insecure-requests`. That directive tells the browser to rewrite
 * every http:// subresource to https, and this harness speaks http. Chromium
 * and Firefox skip the upgrade for loopback addresses; WebKit does not, for
 * `localhost` any more than for `127.0.0.1`. Measured 2026-09-12: WebKit
 * fetched every stylesheet, font, image and island script over TLS against an
 * http server, failed all of them on the handshake, hydrated nothing, and 437
 * tests failed on 5-second timeouts, twice each under `retries`. CI went from
 * 13-17 minutes to past its 35-minute cap.
 *
 * `tests/headers.spec.ts` had already hit this and solved it the same way, for
 * its own server: it serves the published policy with that one directive
 * removed, and says why. This file is that decision applied to the suite.
 *
 * NO COVERAGE IS LOST. This server is deliberately header-free, and the
 * headers are not its job: `tests/headers.spec.ts` starts its own server, sends
 * the real policy, and drives a browser at it. What no http harness in any
 * engine can check is the browser honouring `upgrade-insecure-requests`, and
 * that is checked by reading `_headers` directly instead.
 *
 * It serves the client half of the build, which is where the adapter puts the
 * assets, and reproduces the two behaviours the suite depends on: a redirect
 * from an unslashed path to its slashed form, and 404.html under a real 404.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = 'dist/client';
const PORT = Number(process.env.PORT ?? 4321);

/*
 * Every type the build emits. A missing entry is served without one, which a
 * browser then sniffs or refuses; `tests/headers.spec.ts` asserts the build
 * emits nothing this list does not cover.
 */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

const fileAt = async (path) => {
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch {
    return null;
  }
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  /* Keeps a crafted path inside the build directory. */
  const path = normalize(decodeURIComponent(url.pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  );

  const direct = await fileAt(join(ROOT, path));
  if (direct) {
    res.writeHead(200, { 'content-type': TYPES[extname(direct)] ?? '' });
    res.end(await readFile(direct));
    return;
  }

  /*
   * `/404` to `404.html`, with a 200. `astro preview` does this for any page
   * emitted as a bare `.html`, and tests/routes.ts lists `/404` so the error
   * page is scanned like any other route. The 404 STATUS is a different claim,
   * asserted by tests/not-found.spec.ts against a path with no page at all.
   */
  const asHtml = await fileAt(join(ROOT, `${path}.html`));
  if (asHtml) {
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end(await readFile(asHtml));
    return;
  }

  /*
   * `/about` to `/about/`, which is what both Pages and Workers do and what
   * every spec walking ROUTES relies on. Workers answers 307; the value is not
   * asserted anywhere, and `tests/seo.spec.ts` checks the trailing slash in the
   * built links rather than the redirect.
   */
  if (!path.endsWith('/') && (await fileAt(join(ROOT, path, 'index.html')))) {
    res.writeHead(307, { location: `${path}/${url.search}` });
    res.end();
    return;
  }

  const index = await fileAt(join(ROOT, path, 'index.html'));
  if (index) {
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end(await readFile(index));
    return;
  }

  /*
   * `not_found_handling: "404-page"` in wrangler.jsonc, reproduced.
   * tests/not-found.spec.ts asserts the status, not just the body.
   */
  const notFound = await fileAt(join(ROOT, '404.html'));
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  res.end(notFound ? await readFile(notFound) : 'Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`static preview on http://127.0.0.1:${PORT} (${ROOT})`);
});
