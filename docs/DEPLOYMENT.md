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

**Preview URLs are set in `wrangler.jsonc`, not the dashboard.** `preview_urls`
defaults to `workers_dev`, which is off, so a dashboard toggle lasts only until
the next deploy from `main`. Anyone with a preview URL can open it, and a
preview uses the production bindings: a contact form sent from one is stored
in the production D1 database and emailed like any other.

## D1

The database is in the EU jurisdiction, which cannot be changed after creation
and which `/privacy` states. Recreate it with
`npx wrangler d1 create sinduri-lol --jurisdiction eu`, then apply the schema:

```sh
npx wrangler d1 execute sinduri-lol --remote --file migrations/0001_create_messages.sql
npx wrangler d1 execute sinduri-lol --remote --file migrations/0002_create_comments.sql
```

A daily cron trigger deletes messages older than the retention period
`/privacy` states, clears commenter email addresses at the same age, and
deletes comments nobody moderated once their links have expired.

## Comment moderation

Three runtime secrets, under the Worker's Settings > Variables and Secrets:

```sh
npx wrangler secret put COMMENTS_SIGNING_KEY
npx wrangler secret put COMMENTS_EXPORT_KEY
npx wrangler secret put COMMENTS_DEPLOY_HOOK
```

- `COMMENTS_SIGNING_KEY` signs the moderation links. At least 32 characters;
  `openssl rand -base64 48` gives one. Changing it invalidates every link
  already sent.
- `COMMENTS_EXPORT_KEY` is the bearer key for `/comments/export`, also at least
  32 characters.
- `COMMENTS_DEPLOY_HOOK` is the URL of a deploy hook for `main`, created under
  the Worker's Settings > Builds > Deploy Hooks. The URL is the credential.

Without the first two, the moderation pages and the export answer 503 and say
what is missing. Without the hook, an approval still publishes the row and the
page says the rebuild did not start.

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

Visits are counted by Umami Cloud, in the account's EU region, on the free Hobby
plan: 100K events a month, up to 3 websites, 6 months of retention. A page view
is one event and a click up to four, since each event data property is billed as
one. `/privacy` states the retention from `UMAMI_RETENTION_MONTHS`, so a plan
change means editing that constant. The website ID, the collector host and the
vendored tracker's date are in
[`src/lib/analytics.ts`](../src/lib/analytics.ts); `/privacy` says what is sent.

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

## Google Search Console

The domain is verified in Google Search Console by a DNS TXT record on the
apex, `google-site-verification=...`, added in the Cloudflare dashboard on
2026-09-14. Deleting it unverifies the property. It adds nothing to the site:
no tag, script or file, and no request from a visitor's browser to Google, so
`/privacy` has nothing to disclose about it. Search Console's reports come from
Google Search itself. The site opened to search indexes on 2026-09-14, when
`X-Robots-Tag: noindex` came out of `public/_headers`; submit
`https://sinduri.lol/sitemap-index.xml` there so Google finds every page.

## Cloudflare settings

These live in the dashboard and change what ships without changing a file here.
`npm run check:live` catches most of them.

| Setting                   | Required state | Why                                                        |
| ------------------------- | -------------- | ---------------------------------------------------------- |
| Web Analytics             | Off            | Injects a script from another domain; Umami does the job   |
| Email Address Obfuscation | Off            | Rewrites `mailto:` links into a script-dependent page      |
| JavaScript Detections     | On, forced     | Free plan; `no-transform` in `_headers` keeps it off pages |
| Compression               | Default        | Assets only; `no-transform` on pages switches it off there |
| Bot Fight Mode            | Off            | Challenges the search engine crawlers the site wants       |
| Zone HSTS                 | Off            | Replaces the `Strict-Transport-Security` in `_headers`     |
| Minimum TLS version       | 1.2            | 1.3 alone locks out older devices that cannot update       |

## Branch protection

A ruleset on `main` requires a pull request and the `Required checks` status,
which passes only when every job in `.github/workflows/a11y.yml` has. It matches
that check by the job's `name`, so renaming the job leaves every pull request
waiting on a check that never reports.
