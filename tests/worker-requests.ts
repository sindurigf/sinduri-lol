import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/*
 * Helpers for the specs under playwright.worker.config.ts, which reach
 * on-demand routes through the Worker and read local D1 directly.
 */

/* Local only: wrangler and astro preview expose the cron handler here. */
export const SCHEDULED_HANDLER = '/cdn-cgi/handler/scheduled';

const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 250;

export const DAY_MS = 86_400_000;

export const poll = async <T>(
  read: () => T | undefined,
): Promise<T | undefined> => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
  }
  return undefined;
};

export const localD1 = (sql: string): string =>
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'sinduri-lol',
      '--local',
      '--json',
      '--command',
      sql,
    ],
    { encoding: 'utf8' },
  );

/** The rows of a single local D1 query. */
export const localD1Rows = <Row>(sql: string): Row[] =>
  (JSON.parse(localD1(sql)) as { results: Row[] }[])[0]?.results ?? [];

export const wranglerConfig = (): {
  send_email?: { name: string; allowed_sender_addresses?: string[] }[];
  triggers?: { crons?: string[] };
  assets?: { run_worker_first?: string[] };
} => {
  const { config, error } = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    readFileSync('wrangler.jsonc', 'utf8'),
  );
  if (error) throw new Error('wrangler.jsonc does not parse');
  return config;
};

/*
 * The headers a browser sends when it submits a form or follows a link, so
 * every request takes the route a real one takes. `request.post` sends none of
 * them unless told.
 *
 * `Origin`: Astro rejects a cross-origin form POST to an on-demand route with
 * 403, its CSRF protection, on by default.
 *
 * `Sec-Fetch-Mode: navigate`: the one that decides routing. With
 * `not_found_handling` set and a compatibility date from 2025-04-01, Cloudflare
 * answers a navigation request to a path with no asset from the asset layer
 * without invoking the Worker, and a POST there is a 405. The contact spec
 * first ran without the header, passed, and the form was broken in production:
 * curl got a 303 and Chrome got a 405 (2026-09-12). `run_worker_first` in
 * wrangler.jsonc is the fix, and without it every request below fails.
 *
 * `CF-Connecting-IP`: a distinct documentation address per request. The local
 * runtime supplies one address for every request that lacks the header, so
 * without this the tests share one rate limit and a second run inside its
 * window answers 429 (measured 2026-09-13).
 */
let requestCount = 0;
export const sameOrigin = (baseURL: string) => ({
  'CF-Connecting-IP': `198.51.100.${(requestCount++ % 254) + 1}`,
  origin: baseURL,
  'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'document',
  'sec-fetch-site': 'same-origin',
  accept: 'text/html,application/xhtml+xml',
});
