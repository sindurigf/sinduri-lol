/*
 * The headers an on-demand response has to set for itself.
 *
 * Cloudflare applies public/_headers to static asset responses only, never to
 * anything Worker code generates, so a route that opts out of prerendering
 * loses every header in that file: the CSP, HSTS and the rest.
 *
 * Parsed out of the file at build time rather than restated here. Two copies
 * of a CSP drift, and the one that drifts silently is the one nothing renders.
 * tests/headers.spec.ts asserts the two agree.
 *
 * Vite resolves `?raw` at build time; none of the file reaches the client.
 */
import headersFile from '../../public/_headers?raw';

/** The rule whose headers apply to every path, and so to these responses. */
const GLOBAL_RULE = '/*';

const parseGlobalRule = (source: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  let inRule = false;

  for (const line of source.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    /* A rule line starts at column zero; its headers are indented. */
    if (!/^\s/.test(line)) {
      inRule = trimmed === GLOBAL_RULE;
      continue;
    }

    if (!inRule) continue;

    const separator = trimmed.indexOf(':');
    if (separator === -1) continue;

    headers[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim();
  }

  return headers;
};

const parsed = parseGlobalRule(headersFile);

/*
 * Throwing is the point. An empty map would ship an on-demand page with no
 * CSP, and nothing about the rendered page would look wrong.
 */
if (Object.keys(parsed).length === 0) {
  throw new Error(
    `No headers parsed from public/_headers for the "${GLOBAL_RULE}" rule. ` +
      'The file was reformatted; update parseGlobalRule to match.',
  );
}

/** Every `/*` header from public/_headers, for a response the Worker builds. */
export const GLOBAL_HEADERS: Readonly<Record<string, string>> = parsed;

/** Applies them to a response's headers, leaving anything already set alone. */
export const applyGlobalHeaders = (headers: Headers): Headers => {
  for (const [name, value] of Object.entries(GLOBAL_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return headers;
};

/*
 * For the owner-only comment routes, whose URLs can carry a moderation link:
 * no cache may keep the page, no index may list it, and no Referer may carry
 * the link to the next page. `no-transform` is kept from the global rule;
 * public/_headers says why.
 *
 * `strict-origin`, not `no-referrer`. Under `no-referrer` a browser sends
 * `Origin: null` with the page's own form POST, and Astro's CSRF check
 * answers 403, so no button on the page works; measured in Chromium
 * 2026-09-15. Nor `same-origin`: the next page on the site would read the
 * full URL from document.referrer, and the Umami tracker reports it.
 */
const PRIVATE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store, no-transform',
  'Referrer-Policy': 'strict-origin',
  'X-Robots-Tag': 'noindex',
};

/** Applies PRIVATE_HEADERS over the global headers. */
export const applyPrivateHeaders = (headers: Headers): Headers => {
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) {
    headers.set(name, value);
  }
  return applyGlobalHeaders(headers);
};
