import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './test';
import ts from 'typescript';
import { LIMITS, RETENTION_DAYS } from '../src/lib/contact-form';
import {
  NOTIFICATION_SENDER,
  notificationFor,
} from '../src/lib/contact-notification';
import { retentionCutoff } from '../src/lib/contact-retention';
import { NOTIFY_TO } from '../playwright.worker.config';

/**
 * The contact form's endpoint, `/contact/send/`, which is the only route on
 * this site that is not prerendered.
 *
 * Everything else in the suite walks built HTML or drives a browser at a
 * static asset. Nothing else exercises a POST, so without this file the
 * endpoint's behaviour is asserted nowhere: validation, the honeypot, the
 * status codes, and the headers the Worker has to set for itself because
 * public/_headers does not reach a response Worker code builds.
 *
 * It runs under playwright.worker.config.ts, not with the rest of the suite:
 * that suite's static server has no endpoint to post to. `astro preview` serves
 * through the Worker with a local D1 binding, so a successful submission really
 * is stored rather than mocked.
 *
 * VERIFIED NOT TO BE VACUOUS, by breaking each rule in turn:
 *
 *   - removing `applyGlobalHeaders` from send.astro fails "the response
 *     carries the site's security headers" naming the CSP, which every asset
 *     response carries and a Worker response does not get for free;
 *   - returning 200 instead of 422 fails "a rejected submission answers 422";
 *   - dropping `value={values.name}` from ContactForm fails "a rejected
 *     submission keeps what was typed", which is the whole reason this route
 *     renders at all;
 *   - making looksAutomated always return false fails "a filled honeypot is
 *     answered exactly like a success", because the honeypot body is long
 *     enough to validate and would then be stored and redirected identically,
 *     so that test is written to compare against a real success rather than to
 *     assert a status on its own.
 */

const ENDPOINT = '/contact/send/';

/*
 * Where the local send_email simulator writes each message's text body, one
 * directory per run. Production sends a real email; this is the local stand-in.
 */
const EMAIL_TEXT_ROOT = '.wrangler/tmp/email';

/* Local only: wrangler and astro preview expose the cron handler here. */
const SCHEDULED_HANDLER = '/cdn-cgi/handler/scheduled';

const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 250;
const DAY_MS = 86_400_000;

const poll = async <T>(read: () => T | undefined): Promise<T | undefined> => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
  }
  return undefined;
};

const capturedEmailTexts = (): string[] =>
  existsSync(EMAIL_TEXT_ROOT)
    ? readdirSync(EMAIL_TEXT_ROOT).flatMap((run) => {
        const dir = join(EMAIL_TEXT_ROOT, run, 'email-text');
        return existsSync(dir)
          ? readdirSync(dir).map((file) =>
              readFileSync(join(dir, file), 'utf8'),
            )
          : [];
      })
    : [];

const localD1 = (sql: string): string =>
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

const wranglerConfig = (): {
  send_email?: { name: string; allowed_sender_addresses?: string[] }[];
  triggers?: { crons?: string[] };
} => {
  const { config, error } = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    readFileSync('wrangler.jsonc', 'utf8'),
  );
  if (error) throw new Error('wrangler.jsonc does not parse');
  return config;
};

/*
 * Comfortably past the configured limit in wrangler.jsonc, so the assertion
 * does not sit on the exact boundary.
 */
const RATE_LIMIT_ATTEMPTS = 12;
const SENT = '/contact/sent/';
const FORM = '/contact/';

/** A body that passes every rule in contact-form.ts. */
const validFields = (): Record<string, string> => ({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'x'.repeat(LIMITS.bodyMin + 20),
});

const expectTypedValuesKept = (
  html: string,
  typed: Record<'name' | 'email' | 'message', string>,
): void => {
  /*
   * The reason this route renders at all. Losing a typed message on a
   * validation error is the failure the whole on-demand page exists to
   * prevent.
   */
  expect(
    html,
    'the rejected submission lost the name that was typed.',
  ).toContain(`value="${typed.name}"`);
  expect(
    html,
    'the rejected submission lost the email address that was typed.',
  ).toContain(`value="${typed.email}"`);
  expect(
    html,
    'the rejected submission lost the message body that was typed, which ' +
      'is the longest thing on the form and the worst to retype.',
  ).toContain(typed.message);
};

/*
 * The headers a browser sends when it submits this form, so every request here
 * takes the route a real submission takes. `request.post` sends none of them
 * unless told.
 *
 * `Origin`: Astro rejects a cross-origin form POST to an on-demand route with
 * 403, its CSRF protection, on by default.
 *
 * `Sec-Fetch-Mode: navigate`: the one that decides routing. With
 * `not_found_handling` set and a compatibility date from 2025-04-01, Cloudflare
 * answers a navigation request to a path with no asset from the asset layer
 * without invoking the Worker, and a POST there is a 405. This spec first ran
 * without the header, passed, and the form was broken in production: curl got
 * a 303 and Chrome got a 405 (2026-09-12). `run_worker_first` in wrangler.jsonc
 * is the fix, and without it every POST below fails.
 *
 * `CF-Connecting-IP`: a distinct documentation address per request. The local
 * runtime supplies one address for every request that lacks the header, so
 * without this the tests share one rate limit and a second run inside its
 * window answers 429 (measured 2026-09-13).
 */
let requestCount = 0;
const sameOrigin = (baseURL: string) => ({
  'CF-Connecting-IP': `198.51.100.${(requestCount++ % 254) + 1}`,
  origin: baseURL,
  'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'document',
  'sec-fetch-site': 'same-origin',
  accept: 'text/html,application/xhtml+xml',
});

/*
 * Serially: these tests share the store and the rate limiter, so they are a
 * sequence rather than independent cases.
 */
test.describe.configure({ mode: 'serial' });

test.describe('the contact endpoint', () => {
  test('a GET is sent back to the form', async ({ request, baseURL }) => {
    const response = await request.get(ENDPOINT, {
      maxRedirects: 0,
      headers: sameOrigin(baseURL!),
    });

    expect(
      response.status(),
      'opening /contact/send/ directly should return to the form rather than ' +
        'rendering an error page for somebody who submitted nothing.',
    ).toBe(303);
    expect(response.headers()['location']).toContain(FORM);
  });

  test('a valid submission redirects to the confirmation', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post(ENDPOINT, {
      form: validFields(),
      maxRedirects: 0,
      headers: sameOrigin(baseURL!),
    });

    expect(
      response.status(),
      'a valid submission should answer 303 so a refresh cannot resubmit it.',
    ).toBe(303);
    expect(response.headers()['location']).toContain(SENT);
  });

  test('a rejected submission answers 422 and keeps what was typed', async ({
    request,
    baseURL,
  }) => {
    const typed = {
      name: 'Ada Lovelace',
      email: 'not-an-address',
      message: 'too short',
    };

    const response = await request.post(ENDPOINT, {
      form: typed,
      maxRedirects: 0,
      headers: sameOrigin(baseURL!),
    });

    expect(
      response.status(),
      'a rejected submission should answer 422, not 200: the request was ' +
        'understood and not acted on.',
    ).toBe(422);

    const html = await response.text();

    expect(
      html,
      'the rejected submission should render an error summary. Without one a ' +
        'reader is returned to a form with no statement of what went wrong.',
    ).toContain('problems with this form');

    expectTypedValuesKept(html, typed);

    expect(
      html,
      'a failing control should carry aria-invalid, so the failure is exposed ' +
        'to a screen reader rather than only painted on the border.',
    ).toContain('aria-invalid="true"');

    /*
     * Each summary entry is a link to its control, and one pointed at an id
     * nothing carried: the message error linked to #contact-body while the
     * textarea is #contact-message, so following it went nowhere. The email
     * and the message both fail in this submission. Verified to
     * fail on that markup before the fix, 2026-09-19.
     */
    const summaryTargets = [...html.matchAll(/href="#(contact-[a-z]+)"/g)].map(
      ([, id]) => id,
    );
    expect(
      summaryTargets.length,
      'the error summary should link to each failing field.',
    ).toBeGreaterThan(0);
    for (const id of summaryTargets) {
      expect(
        html,
        `the error summary links to #${id}, and nothing on the page has that id.`,
      ).toContain(`id="${id}"`);
    }

    /*
     * `required` alone is invisible to a sighted reader (SC 3.3.2), so each
     * label says it in words. Verified to fail before the labels carried it.
     */
    expect(
      html.match(
        /<label[^>]*for="contact-(?:name|email|message)"[^>]*>[^<]*<span[^>]*>\(required\)<\/span>/g,
      )?.length,
      'every required field should say "(required)" inside its label.',
    ).toBe(3);
  });

  test('a filled honeypot is answered exactly like a success', async ({
    request,
    baseURL,
  }) => {
    const success = await request.post(ENDPOINT, {
      form: validFields(),
      maxRedirects: 0,
      headers: sameOrigin(baseURL!),
    });

    const trapped = await request.post(ENDPOINT, {
      form: { ...validFields(), website: 'https://spam.example' },
      maxRedirects: 0,
      headers: sameOrigin(baseURL!),
    });

    /*
     * Compared against a real success rather than asserted on its own. A bot
     * told which check caught it can be adjusted until none do, so the two
     * responses have to be indistinguishable.
     */
    expect(
      trapped.status(),
      'a filled honeypot should answer with the same status as a success, or ' +
        'the response tells an author their submission was rejected.',
    ).toBe(success.status());
    expect(trapped.headers()['location']).toBe(success.headers()['location']);
  });

  test('repeated submissions from one address are rate limited', async ({
    request,
    baseURL,
  }) => {
    /*
     * The limit is keyed on a hash of CF-Connecting-IP, which Cloudflare sets
     * and replaces at the edge, so a client cannot choose its own in
     * production. Locally the header is honoured as sent.
     *
     * One fixed address for every attempt here, from a different range than
     * sameOrigin's, so this test limits only itself.
     */
    const address = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
    const headers = { ...sameOrigin(baseURL!), 'CF-Connecting-IP': address };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < RATE_LIMIT_ATTEMPTS; attempt += 1) {
      const response = await request.post(ENDPOINT, {
        form: validFields(),
        maxRedirects: 0,
        headers,
      });
      statuses.push(response.status());
    }

    expect(
      statuses,
      `sending ${RATE_LIMIT_ATTEMPTS} submissions from one address should be ` +
        'limited before the last one. Without this the form is an open relay ' +
        `into the inbox. Got: ${statuses.join(', ')}.`,
    ).toContain(429);
  });

  test('a stored message is emailed to the owner', async ({
    request,
    baseURL,
  }) => {
    const token = crypto.randomUUID();
    const response = await request.post(ENDPOINT, {
      form: { ...validFields(), message: `Notification check ${token}` },
      maxRedirects: 0,
      headers: sameOrigin(baseURL!),
    });
    expect(response.status()).toBe(303);

    const email = await poll(() =>
      capturedEmailTexts().find((text) => text.includes(token)),
    );

    expect(
      email,
      'a valid submission was stored but no notification email was sent, so ' +
        'the owner would never learn it arrived.',
    ).toBeDefined();
    expect(email).toContain(
      `From: ${validFields().name} <${validFields().email}>`,
    );
  });

  test('the notification replies to the sender and keeps headers on one line', () => {
    const message = notificationFor(
      {
        name: 'Ada\r\nBcc: victim@example.com',
        email: 'ada@example.com',
        body: 'Hello there, Sinduri.',
      },
      NOTIFY_TO,
      new Date(0),
    );

    expect(
      message.replyTo,
      'Reply-To should be the sender, so replying from the inbox reaches them.',
    ).toBe('ada@example.com');
    expect(
      message.subject,
      'a name carrying a line break must not start a new header in the subject.',
    ).toBe('Contact form: Ada Bcc: victim@example.com');
    expect(message.to).toBe(NOTIFY_TO);
  });

  test('the notification sender is the one wrangler.jsonc allows', () => {
    const binding = wranglerConfig().send_email?.find(
      (entry) => entry.name === 'CONTACT_MAILER',
    );

    expect(
      binding?.allowed_sender_addresses,
      'the send_email binding rejects any sender it does not list, so a ' +
        'mismatch here fails every notification in production only.',
    ).toEqual([NOTIFICATION_SENDER.email]);
  });

  test('the retention sweep deletes only expired messages', async ({
    request,
  }) => {
    expect(
      wranglerConfig().triggers?.crons?.length,
      'no cron trigger in wrangler.jsonc, so the sweep never runs and /privacy ' +
        `promises a ${RETENTION_DAYS}-day deletion nothing performs.`,
    ).toBeGreaterThan(0);

    const now = Date.now();
    const expired = `expired-${crypto.randomUUID()}`;
    const current = `current-${crypto.randomUUID()}`;
    localD1(
      'INSERT INTO messages (id, name, email, body, created_at) VALUES ' +
        `('${expired}', 'Old', 'old@example.com', 'expired', ${retentionCutoff(now) - DAY_MS}), ` +
        `('${current}', 'New', 'new@example.com', 'current', ${retentionCutoff(now) + DAY_MS})`,
    );

    expect((await request.get(SCHEDULED_HANDLER)).status()).toBe(200);

    const remaining = await poll(() => {
      const rows = localD1(
        `SELECT id FROM messages WHERE id IN ('${expired}', '${current}')`,
      );
      return rows.includes(expired) ? undefined : rows;
    });

    expect(
      remaining,
      `a message older than ${RETENTION_DAYS} days survived the sweep.`,
    ).toBeDefined();
    expect(
      remaining,
      'the sweep deleted a message still inside the retention period.',
    ).toContain(current);
  });

  test("the response carries the site's security headers", async ({
    request,
    baseURL,
  }) => {
    /*
     * public/_headers governs asset responses only. Cloudflare does not apply
     * it to anything Worker code generates, so this route sets those headers
     * itself, and this is what catches that going missing.
     */
    const response = await request.post(ENDPOINT, {
      form: { name: '', email: '', message: '' },
      maxRedirects: 0,
      headers: sameOrigin(baseURL!),
    });

    const headers = response.headers();

    expect(
      headers['content-security-policy'],
      'the on-demand route is missing its CSP, which every asset response ' +
        'carries.',
    ).toContain("default-src 'self'");

    expect(
      headers['x-frame-options'],
      'the on-demand route is missing X-Frame-Options.',
    ).toBe('DENY');
  });
});
