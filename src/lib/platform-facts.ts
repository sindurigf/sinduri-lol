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
  plausibleHost: {
    claim:
      'Plausible is self-hosted on an Infomaniak server in Geneva, Switzerland',
    check:
      'Infomaniak Manager: the server behind stats.sinduri.lol and its ' +
      'data center',
    checkedOn: '2026-11-13',
  },
  plausibleLogs: {
    claim:
      'Caddy in front of Plausible writes no access log, and its error log ' +
      'drops IP addresses, ports and request headers',
    check: 'The Caddyfile on the server behind stats.sinduri.lol: log blocks',
    checkedOn: '2026-11-13',
  },
  plausibleDnsOnly: {
    claim: 'stats.sinduri.lol is DNS-only in Cloudflare, not proxied',
    check: 'Cloudflare dashboard > DNS > Records: stats shows DNS only',
    checkedOn: '2026-11-13',
  },
  plausibleBackups: {
    claim:
      'Nightly backups, encrypted on the server, go to Infomaniak Swiss ' +
      'Backup in Switzerland and are kept as 7 daily, 4 weekly and 6 monthly',
    check: 'The backup job on the server: schedule, target and retention',
    checkedOn: '2026-11-13',
  },
  plausibleRetention: {
    claim: 'The visit stats are kept until they are deleted by hand',
    check:
      'stats.sinduri.lol > Site Settings: no stats reset or deletion since ' +
      'the last check, and no retention job on the server',
    checkedOn: '2026-11-13',
  },
  dataPrivacyFramework: {
    claim:
      'Cloudflare and Google are certified under the EU-U.S. and Swiss-U.S. ' +
      'Data Privacy Frameworks',
    check:
      'cloudflare.com/privacypolicy and policies.google.com/privacy/frameworks ' +
      'still state both certifications; dataprivacyframework.gov/list shows ' +
      'whether each is active',
    checkedOn: '2026-11-13',
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
