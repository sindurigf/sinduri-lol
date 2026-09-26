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
  dashboard change. The console check stubs Umami, so it counts no visits.
- After a deploy that changes the hero or what a page loads, run Lighthouse
  (mobile) on `https://sinduri.lol/` and the changed page; record the
  performance score and Total Blocking Time. `tests/performance.spec.ts`
  covers script bytes and layout shift; load time depends on the runner, so CI
  does not test it.
- Custom domains belong in `wrangler.jsonc`: a deploy replaces the Worker's
  routes, removing dashboard-only domains.
- Preview deployments run on workers.dev, outside the zone, so zone features
  (e.g. JavaScript Detections) only show on production.
- `preview_urls` is set in `wrangler.jsonc`; a dashboard toggle is reset by the
  next deploy. Previews are public to anyone with the URL and use production
  bindings: a message sent from one lands in the production D1 and inbox.

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
  messages still waiting (needs `npx wrangler login`).

## Contact form email

Needs Email Routing on the zone, the owner's inbox verified as a destination,
and that address as a runtime secret:

```sh
npx wrangler secret put CONTACT_NOTIFY_TO
```

In the dashboard it goes under the Worker's Settings > Variables and Secrets,
not Build (the runtime never sees Build). Without it, messages are still stored
and the endpoint logs whether the binding or the secret is missing.

## Umami

- Umami Cloud, EU region, free Hobby plan. A page view is one event; a click up
  to four (one per event data property).
- `/privacy` states retention from `UMAMI_RETENTION_MONTHS` in
  [`src/lib/platform-facts.ts`](../src/lib/platform-facts.ts); change it with the
  plan.
- Website ID, collector host and vendored date: [`src/lib/analytics.ts`](../src/lib/analytics.ts).
- Registered as `sinduri.lol`; `data-domains` stops local, test and preview
  traffic being counted.

The tracker is vendored at `public/vendor/umami.js`. `scheduled.yml` checks it
weekly; also run the check after any Umami changelog entry about the tracker:

```sh
npm run check:umami
```

Exit 0 means it matches. Otherwise it writes `tmp/umami-upstream.js` and prints
the diff. Then, in one commit:

1. Read the diff for new storage, hosts, data sent or `data-*` settings.
   `tests/privacy.spec.ts` catches storage writes and `tests/analytics.spec.ts`
   undisclosed payload fields; changes in meaning need a reader.
2. Copy `tmp/umami-upstream.js` over `public/vendor/umami.js`.
3. Update `UMAMI_VENDORED_ON`, and `/privacy` if what is sent changed.
4. Run the suite, then `npm run check:umami` again for exit 0.

A collector host change updates `UMAMI_HOST_URL` and `connect-src` in
`public/_headers` together; `tests/headers-rules.spec.ts` fails until both match.

## Hostnames

`www.sinduri.lol` and `sinduri-lol.pages.dev` 301 to the apex via an
account-level Bulk Redirect list, outside this repository. The Pages project
stays, builds disabled, to hold the `pages.dev` name.

## Google Search Console

- Verified by a DNS TXT record on the apex (`google-site-verification=...`).
  Deleting it unverifies the property.
- Nothing on the site loads from Google, so `/privacy` has nothing to disclose.
- Submitted sitemap: `https://sinduri.lol/sitemap-index.xml`.

## Cloudflare settings

Dashboard settings that change what ships without a file change.
`npm run check:live` catches most.

| Setting                   | Required state | Why                                                        |
| ------------------------- | -------------- | ---------------------------------------------------------- |
| Web Analytics             | Off            | Injects a script from another domain; Umami does the job   |
| Email Address Obfuscation | Off            | Rewrites `mailto:` links into a script-dependent page      |
| JavaScript Detections     | On, forced     | Free plan; `no-transform` in `_headers` keeps it off pages |
| Compression               | Default        | Assets only; `no-transform` on pages switches it off there |
| Bot Fight Mode            | Off            | Challenges the search engine crawlers the site wants       |
| Zone HSTS                 | Off            | Replaces the `Strict-Transport-Security` in `_headers`     |
| Minimum TLS version       | 1.2            | 1.3 alone locks out older devices that cannot update       |
| Hotlink Protection        | Off            | Refuses images to link previews and feed readers           |

## Repository settings

- CI (`.github/workflows/a11y.yml`) reports one status, `Required checks`,
  which passes only when every job passes. The `main` ruleset requires it by
  the job's `name`: rename it in both at once, or no pull request can merge.
- Turn on Dependabot alerts and automated security fixes.
- Optional Actions secret `CLOUDFLARE_API_TOKEN` and variable
  `CLOUDFLARE_ACCOUNT_ID`: let the weekly `check:live` count unsent
  notifications in production D1. Scope the token to D1 Read on this account;
  the D1 query endpoint accepts it. The account ID spares wrangler an account
  lookup the token may not be allowed. Without both that check is skipped by name.
