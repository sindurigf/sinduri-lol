/*
 * Claims on /privacy that can change outside this repo.
 * tests/platform-facts.spec.ts fails when `checkedOn` goes stale: re-check at
 * `check`, then move the date. D1's EU jurisdiction is immutable, so not here.
 */

interface PlatformFact {
  claim: string;
  check: string;
  /** `YYYY-MM-DD`. */
  checkedOn: string;
}

/** Workers Free plan. */
export const WORKER_LOG_RETENTION_DAYS = 3;

/** D1 Time Travel on the Free plan. */
export const D1_RESTORE_WINDOW_DAYS = 7;

export const PLATFORM_FACTS: Readonly<Record<string, PlatformFact>> = {
  plausibleTrial: {
    claim:
      'The site is on a Plausible free trial; when it ends Plausible stops ' +
      'counting and later deletes the stats',
    check:
      'Plausible > Account Settings > Subscription: still a trial, and ' +
      'plausible.io/docs/trial for what happens when it ends',
    checkedOn: '2026-10-25',
  },
  plausibleRegion: {
    claim: 'Plausible stores the visit counts on servers in the European Union',
    check:
      'plausible.io/data-policy: where visitor data is processed and stored',
    checkedOn: '2026-10-25',
  },
  workerLogRetention: {
    claim: `Worker logs and traces are deleted after ${WORKER_LOG_RETENTION_DAYS} days`,
    check:
      'Cloudflare dashboard > Workers & Pages > sinduri-lol > Observability: ' +
      'the log and trace retention of the plan ' +
      '(developers.cloudflare.com/workers/observability/traces)',
    checkedOn: '2026-09-25',
  },
  d1RestoreWindow: {
    claim: `A deleted message stays restorable for ${D1_RESTORE_WINDOW_DAYS} days`,
    check:
      'Cloudflare dashboard > Storage & Databases > D1 > sinduri-lol > ' +
      'Time Travel',
    checkedOn: '2026-09-19',
  },
  networkErrorLogging: {
    claim:
      '/privacy: Cloudflare asks browsers to report failed requests only ' +
      '(success_fraction 0.0) to a.nel.cloudflare.com',
    check:
      "curl -sI https://sinduri.lol/ | grep -iE '^(nel|report-to):', and " +
      "Cloudflare's Network Error Logging docs for what a report holds",
    checkedOn: '2026-09-25',
  },
};
