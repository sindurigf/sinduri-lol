/*
 * Visit counting, with Umami Cloud in its EU region.
 *
 * WHY UMAMI. It sets no cookie and writes nothing to the browser, so the site
 * needs no consent banner and /privacy can keep saying "No cookies" and "No
 * browser storage". tests/privacy.spec.ts holds the vendored tracker to both.
 *
 * THE TRACKER IS VENDORED, NOT LOADED FROM UMAMI. public/vendor/umami.js is a
 * byte-identical copy of UMAMI_UPSTREAM_SCRIPT, so the CSP keeps `script-src`
 * to this origin and only `connect-src` names Umami. A script loaded from
 * their host would run whatever that host serves, on every page, and it
 * changes too often to pin with Subresource Integrity.
 *
 * THE COPY GOES STALE, AND NOTHING WILL TELL YOU. Umami's API can move on
 * while this file stands still, and the first symptom is a dashboard that
 * quietly stops counting. Run `npm run check:umami` at least monthly and
 * after any Umami changelog entry that mentions the tracker. When it reports
 * a difference, replace the file with the upstream bytes, read the diff for
 * new storage, new hosts or new data sent, update /privacy to match, and move
 * UMAMI_VENDORED_ON. docs/DEPLOYMENT.md > Umami has the steps.
 */

export const UMAMI_UPSTREAM_SCRIPT = 'https://cloud.umami.is/script.js';

/** Where the vendored copy is served from. */
export const UMAMI_SCRIPT_PATH = '/vendor/umami.js';

/** When public/vendor/umami.js was last replaced with the upstream bytes. */
export const UMAMI_VENDORED_ON = '2026-09-13';

/*
 * The collector. Set explicitly rather than left to the tracker's built-in
 * default, so an upstream change to that default cannot move where data goes
 * without a diff here, and so the CSP's `connect-src` has one value to match.
 * tests/headers.spec.ts asserts the two agree.
 */
export const UMAMI_HOST_URL = 'https://gateway.umami.is';

/** Public by design: it is in every page's HTML. */
export const UMAMI_WEBSITE_ID = '5d1a79cf-b9cc-409e-a43e-df37d881e314';

/*
 * Sent as a click event's name. Umami caps names at 50 characters, and a small
 * fixed set keeps the dashboard's event list readable; what was clicked goes
 * in the event data instead.
 */
export const CLICK_EVENTS = {
  internalLink: 'Internal link',
  outboundLink: 'Outbound link',
  download: 'Download',
  email: 'Email link',
  button: 'Button',
} as const;

export type ClickEventName = (typeof CLICK_EVENTS)[keyof typeof CLICK_EVENTS];

/*
 * Umami bills each event data property as one event, so a click costs four:
 * the event and these three. Add a property only when it answers a question
 * the other three cannot.
 */
export type ClickEventData = {
  label: string;
  area: string;
  target?: string;
};

/*
 * A label is the site's own text, never anything a reader typed, and is cut
 * short so a long card title cannot run into Umami's per-value limit.
 */
export const MAX_LABEL_LENGTH = 100;

/*
 * File extensions a link downloads rather than navigates to. The CV and the
 * talk slides are the PDFs this site publishes.
 */
export const DOWNLOAD_EXTENSIONS = ['.pdf'] as const;
