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

Run `npm run check:live` and `npm run check:live:console` after any deploy or
dashboard change. The console check routes Umami's requests to a stand-in, so
it adds nothing to the visit counts.

**Custom domains belong in `wrangler.jsonc`.** A deploy replaces the Worker's
routes with the file's, so a domain added only in the dashboard is removed.

**Preview deployments run on workers.dev, outside the zone.** They get none of
the zone's settings, so they cannot show a zone feature such as JavaScript
Detections; test those on production.

## D1

The database is in the EU jurisdiction, which cannot be changed after creation
and which `/privacy` states. Recreate it with
`npx wrangler d1 create sinduri-lol --jurisdiction eu`, then apply the schema:

```sh
npx wrangler d1 execute sinduri-lol --remote --file migrations/0001_create_messages.sql
```

A daily cron trigger deletes messages older than the retention period
`/privacy` states.

## Contact form email

Needs Email Routing enabled on the zone, the owner's inbox added and verified as
a destination address, and that address stored as a runtime secret:

```sh
npx wrangler secret put CONTACT_NOTIFY_TO
```

In the dashboard it belongs under the Worker's Settings > Variables and
Secrets, not the Build section, which the runtime never sees. Without it,
messages are still stored and the endpoint logs which of the binding or the
secret is missing.

## Umami

Visits are counted by Umami Cloud, in the account's EU region. The website ID,
the collector host and the vendored tracker's date are in
[`src/lib/analytics.ts`](../src/lib/analytics.ts); `/privacy` says what is
sent.

The tracker is a copy in `public/vendor/umami.js`, not loaded from Umami, and
**it has to be checked by hand at least monthly**, and after any Umami
changelog entry that mentions the tracker:

```sh
npm run check:umami
```

It exits 0 when the copy matches what Umami serves. When it does not, it leaves
the new file in `tmp/umami-upstream.js` and prints the diff. Then, in one
commit:

1. Read the diff for new storage, new hosts, new data sent and new `data-*`
   settings. `tests/privacy.spec.ts` fails on a storage write and
   `tests/analytics.spec.ts` on an undisclosed payload field, but only a
   reader sees a change in meaning.
2. Copy `tmp/umami-upstream.js` over `public/vendor/umami.js`.
3. Update `UMAMI_VENDORED_ON`, and `/privacy` if what is sent changed.
4. Run the suite, then `npm run check:umami` again to see exit 0.

If the collector host ever changes, `UMAMI_HOST_URL` and `connect-src` in
`public/_headers` change together; `tests/headers.spec.ts` fails until they do.

In the Umami dashboard the site is registered as `sinduri.lol`. The tracker's
`data-domains` limits sending to that host, so local runs, the test suite and
workers.dev previews are never counted.

## Hostnames

`www.sinduri.lol` and `sinduri-lol.pages.dev` redirect to the apex with a 301
through an account-level Bulk Redirect list, outside this repository. The Pages
project is kept with builds disabled: deleting it frees the `pages.dev` name.

## Cloudflare settings

These live in the dashboard and change what ships without changing a file here.
`npm run check:live` catches most of them.

| Setting                   | Required state | Why                                                        |
| ------------------------- | -------------- | ---------------------------------------------------------- |
| Web Analytics             | Off            | Injects a script from another domain; Umami does the job   |
| Email Address Obfuscation | Off            | Rewrites `mailto:` links into a script-dependent page      |
| JavaScript Detections     | On, forced     | Free plan; `no-transform` in `_headers` keeps it off pages |
| Bot Fight Mode            | Off            | Challenges the crawlers `X-Robots-Tag` has to reach        |
| Zone HSTS                 | Off            | Replaces the `Strict-Transport-Security` in `_headers`     |
| Minimum TLS version       | 1.2            | 1.3 alone locks out older devices that cannot update       |

## Branch protection

A ruleset on `main` requires a pull request and the `Required checks` status,
which passes only when every job in `.github/workflows/a11y.yml` has. It matches
that check by the job's `name`, so renaming the job leaves every pull request
waiting on a check that never reports.
