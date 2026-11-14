# Deployment

Workers Builds deploys the `sinduri-lol` Worker on every push to `main`, from
[`wrangler.jsonc`](../wrangler.jsonc).

| Setting        | Value                 |
| -------------- | --------------------- |
| Build command  | `npm run build`       |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/`                   |

To check the configuration without deploying:

```sh
npm run build && npx wrangler deploy --dry-run
```

- Run `npm run check:live` and `npm run check:live:console` after any deploy or
  dashboard change. The console check stubs Plausible, so it counts no visits.
- After a deploy that changes the hero or what a page loads, run Lighthouse
  (mobile: 412px, 4x CPU, Slow 4G) 5 times on `https://sinduri.lol/` and the
  changed page; record the median performance score, LCP and Total Blocking
  Time in a comment on the change's pull request. For a changed control, also
  record INP from a timespan run that uses it. The bar is Google's
  [good](https://web.dev/articles/vitals) line: LCP 2500 ms, INP 200 ms. CI
  does not run Lighthouse: timing scores vary on shared runners.
  `tests/performance.spec.ts` covers script and CSS bytes and layout shift,
  `tests/image-priority.spec.ts` image formats and priority, and
  `tests/head.spec.ts` the font preload.
- Custom domains belong in `wrangler.jsonc`: a deploy replaces the Worker's
  routes, removing dashboard-only domains.
- Preview deployments run on workers.dev, outside the zone, so zone features
  (e.g. JavaScript Detections) only show on production.
- `preview_urls` is set in `wrangler.jsonc`; a dashboard toggle is reset by the
  next deploy. Previews are public to anyone with the URL and use production
  bindings: a message sent from one lands in the production D1 and inbox.

## Bindings

The Worker's bindings, declared in [`wrangler.jsonc`](../wrangler.jsonc)
except `ASSETS`, which the Astro adapter adds, and the secret
([pipeline](../ARCHITECTURE.md#the-contact-endpoint)).

| Binding              | Type          | Used by                                           |
| -------------------- | ------------- | ------------------------------------------------- |
| `MESSAGES_DB`        | D1            | Contact messages, the retention sweep, resend     |
| `CONTACT_MAILER`     | Send Email    | Notification email ([setup](#contact-form-email)) |
| `CONTACT_RATE_LIMIT` | Rate Limiting | Submissions per sender key                        |
| `ASSETS`             | Static assets | `/videos/*` byte ranges                           |
| `CONTACT_NOTIFY_TO`  | Secret        | Notification recipient                            |

## D1

EU jurisdiction, fixed at creation and stated on `/privacy`. Recreate with
`npx wrangler d1 create sinduri-lol --jurisdiction eu`, then apply the schema:

```sh
npx wrangler d1 migrations apply sinduri-lol --remote
```

- Run the same command before deploying any commit that adds a file to
  `migrations/`: the Worker reads the new schema as soon as it is live.
- A daily cron deletes messages older than the retention `/privacy` states,
  then resends any notification email that failed. `npm run check:live` counts
  messages still waiting (needs `npx wrangler login`, or the
  [token and account ID](DEVELOPMENT.md#other-notes)).

## Contact form email

Needs Email Routing on the zone, the inbox that receives contact messages
verified as a destination address, and that address as a runtime secret:

```sh
npx wrangler secret put CONTACT_NOTIFY_TO
```

In the dashboard it goes under the Worker's Settings > Variables and Secrets,
not Build (the runtime never sees Build). Without it, messages are still stored,
no email is sent, and the endpoint logs whether the binding or the secret is
missing.

## Plausible

- Plausible Community Edition, self-hosted at `stats.sinduri.lol` on an
  Infomaniak server in Geneva. The `plausibleHost` and `plausibleRetention`
  facts in [`src/lib/platform-facts.ts`](../src/lib/platform-facts.ts) hold
  what `/privacy` states about the host and how long stats are kept.
- Registered as `sinduri.lol`. `canSend` in
  [`src/lib/analytics.ts`](../src/lib/analytics.ts) keeps the tracker off on
  local, test and preview hosts and under Do Not Track; `filterPayload` strips
  query strings and fragments.
- The npm tracker takes its options from `init()` in
  [`src/scripts/analytics.ts`](../src/scripts/analytics.ts), not from the
  dashboard's tracking toggles.

Dashboard, once per site:

- Goals: a custom event goal for each name in `CLICK_EVENTS`, and a pageview
  goal for `/contact/sent/`, which counts contact form sends.
- Shields > Hostnames: allow `sinduri.lol` only.

`@plausible-analytics/tracker` is pinned to an exact version and gets its own
Dependabot pull request. Before a bump,
read its changelog for new fields, storage or hosts: `tests/analytics.spec.ts`
fails on an undisclosed field and `tests/privacy.spec.ts` on a storage write.
Update `/privacy` if what is sent changed. A collector host change also changes
the CSP: [ARCHITECTURE.md](../ARCHITECTURE.md#the-csp).

## Hostnames

`www.sinduri.lol` and `sinduri-lol.pages.dev` 301 to the apex via an
account-level Bulk Redirect list set in the Cloudflare dashboard. Nothing in
this repository checks it; verify by hand:

```sh
curl -sI https://www.sinduri.lol | grep -i '^HTTP\|^location'
curl -sI https://sinduri-lol.pages.dev | grep -i '^HTTP\|^location'
```

Each prints `301` and a `location` on `https://sinduri.lol`. The Pages project
stays, builds disabled, to hold the `pages.dev` name.

## Google Search Console

- Verified by a DNS TXT record on the apex (`google-site-verification=...`).
  Deleting it unverifies the property.
- Nothing on the site loads from Google, so `/privacy` has nothing to disclose.
- Submitted sitemap: `https://sinduri.lol/sitemap-index.xml`.

## Bing Webmaster Tools

- Verified by the `msvalidate.01` meta tag on the homepage
  (`BING_SITE_VERIFICATION` in `src/lib/site.ts`). Removing it unverifies the
  site.
- The tag loads nothing from Microsoft, so `/privacy` has nothing to disclose.

## Cloudflare settings

Dashboard settings that change what ships without a file change.
`npm run check:live` catches most.

| Setting                   | Required state | Why                                                          |
| ------------------------- | -------------- | ------------------------------------------------------------ |
| Web Analytics             | Off            | Injects a script from another domain; Plausible does the job |
| Email Address Obfuscation | Off            | Rewrites `mailto:` links into a script-dependent page        |
| JavaScript Detections     | On, forced     | Free plan; `no-transform` in `_headers` keeps it off pages   |
| Compression               | Default        | Assets only; the Worker gzips `/about/` and `/brand/`        |
| Bot Fight Mode            | Off            | Challenges the search engine crawlers the site wants         |
| Zone HSTS                 | Off            | Replaces the `Strict-Transport-Security` in `_headers`       |
| Minimum TLS version       | 1.2            | 1.3 alone locks out older devices that cannot update         |
| Hotlink Protection        | Off            | Refuses images to link previews and feed readers             |

## Repository settings

- CI (`.github/workflows/a11y.yml`) reports one status, `Required checks`,
  which passes only when every job passes. The `main` ruleset requires it by
  the job's `name`: rename it in both at once, or no pull request can merge.
- A pull request that changes only root `*.md`, `docs/**/*.md` or
  `.github/*.md` skips the Playwright shards; `Required checks` accepts the
  skip only then. `ACCESSIBILITY.md`, `ARCHITECTURE.md`, `SECURITY.md` and
  `docs/STYLEGUIDE.md` always run them: a page or a spec reads each
  (`scripts/docs-only.mjs`, which `tests/docs-only.spec.ts` keeps complete).
  Pushes to `main` always run them.
- CI runs on pushes to `main` and on every pull request, whatever its base
  branch, so a stacked pull request gets the full gate. Its commits are checked
  against its own base branch, not `main`.
- `Test weakening` (`.github/workflows/test-weakening.yml`) is a second
  status ([rule](../ARCHITECTURE.md#tests),
  [approving](DEVELOPMENT.md#approving-a-test-change)). To require it, in both
  repositories:
  1. Settings, Rules, Rulesets, the `main` ruleset, Require status checks to
     pass, Add checks, type `Test weakening`, pick the GitHub Actions source,
     Save. The name is offered once the check has run on a pull request.
  2. Add `.github/CODEOWNERS` naming the maintainer's GitHub account for
     `/.github/` and `/scripts/check-test-weakening.mjs`, and turn on Require
     review from Code Owners in the `main` ruleset. A workflow could report a
     job also named `Test weakening`; this keeps such a change from merging.
- `Pull request text` (`.github/workflows/pr-text.yml`) checks the title and
  description for AI attribution and with `check:wording`, and re-runs on each
  edit. To require it, in both repositories: Settings, Rules, Rulesets, the
  `main` ruleset, Require status checks to pass, Add checks, type
  `Pull request text`, pick the GitHub Actions source, Save. Dependabot pull
  requests skip it, which counts as passed.
- Agents run `gh` with the maintainer's token, so they can post the marker. Fix:
  a machine account with write access and a fine-grained token (Contents, Pull
  requests: read and write) for both repositories; log agents in with it and
  remove the maintainer token from their keyring.
- Turn on Dependabot alerts and automated security fixes.
- Turn on private vulnerability reporting: [SECURITY.md](../SECURITY.md) relies
  on it.
- Optional Actions secret `CLOUDFLARE_API_TOKEN` and variable
  `CLOUDFLARE_ACCOUNT_ID`: let the weekly `check:live` count unsent
  notifications in production D1. Scope the token to D1 Read on this account;
  the D1 query endpoint accepts it. The account ID spares wrangler an account
  lookup the token may not be allowed. Without both, `check:live` prints a skip line for the D1 check.
