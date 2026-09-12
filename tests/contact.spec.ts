import { expect, test } from '@playwright/test';
import { LIMITS } from '../src/lib/contact-form';

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
 *     carries the site's security headers" naming X-Robots-Tag, which is the
 *     one that would otherwise make this the single indexable page on a
 *     noindex site;
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

/*
 * Astro rejects a cross-origin form POST to an on-demand route with 403, which
 * is its CSRF protection and is on by default. A browser sends this header on
 * a real submission; `request.post` does not unless told.
 */
const sameOrigin = (baseURL: string) => ({ origin: baseURL });

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

    expect(
      html,
      'a failing control should carry aria-invalid, so the failure is exposed ' +
        'to a screen reader rather than only painted on the border.',
    ).toContain('aria-invalid="true"');
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
     * production. Locally nothing sets it, and a request without one is not
     * limited at all: keying them together made the whole machine one sender
     * and returned 429 on the second local submission.
     *
     * A distinct address per run keeps this test from limiting the others, and
     * from being limited by a previous run inside the same window.
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
      headers['x-robots-tag'],
      'the on-demand route is missing X-Robots-Tag. public/_headers does not ' +
        'reach a Worker response, so without this it is the one indexable ' +
        'page on a site that is otherwise closed to search engines.',
    ).toBe('noindex');

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
