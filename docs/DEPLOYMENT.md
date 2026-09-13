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
dashboard change.

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

## Hostnames

`www.sinduri.lol` and `sinduri-lol.pages.dev` redirect to the apex with a 301
through an account-level Bulk Redirect list, outside this repository. The Pages
project is kept with builds disabled: deleting it frees the `pages.dev` name.

## Cloudflare settings

These live in the dashboard and change what ships without changing a file here.
`npm run check:live` catches most of them.

| Setting                   | Required state | Why                                                        |
| ------------------------- | -------------- | ---------------------------------------------------------- |
| Web Analytics             | Off            | Injects a third-party script `/privacy` says is not there  |
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
