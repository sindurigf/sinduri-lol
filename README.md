# sinduri.lol

Personal website. Astro 7, Vue 3 islands, Tailwind CSS 4, TypeScript strict,
static output, deployed to a Cloudflare Worker as static assets.

## Requirements

Node.js at the exact version pinned in [`.nvmrc`](.nvmrc). Run `nvm use` in the
repository root to match it. npm, whichever version ships with that Node.

`.nvmrc` is the single source of truth for the Node version, and everything
that runs a build reads it: `nvm use` locally, `node-version-file: '.nvmrc'` in
`.github/workflows/a11y.yml`, and Workers Builds at build time with no
dashboard setting.

`engines.node` in `package.json` is `>=22.19.0`: a floor, the oldest runtime the
dependency tree accepts. `.nvmrc` pins 24.20.0, the version CI and production
run. They answer different questions, so both are kept, and the two majors are
deliberate: 22 and 24 are both LTS, nothing in the tree requires 24, and someone
on Node 22 can still build.

**npm does not enforce that floor on install.** Below it npm prints an
`EBADENGINE` warning and installs anyway. Failing the install needs
`engine-strict=true` in `.npmrc`, deliberately not set, because it enforces
every third-party `engines` declaration too, so one dependency shipping an
over-tight field becomes a hard install failure here.

The floor is measured, not guessed. On 2026-09-11, across the 168 distinct
packages in `node_modules` that declare `engines.node`, 22.19.0 is the lowest
22.x that satisfies every one: `undici` declares `>=22.19.0`. To move to a newer
Node, edit `.nvmrc`. Raise `engines.node` only when a dependency actually
requires it, and check the tree rather than guessing:

```sh
nvm use 22.19.0 && rm -rf node_modules && npm install 2>&1 | grep EBADENGINE
```

Silence there means the floor holds on that version.

## Setup

```sh
npm install
```

That is the whole setup. Fonts come from npm, so there are no files to drop in
by hand.

## Fonts

Lexend is installed as [`@fontsource-variable/lexend`][fontsource], a variable
font covering weights 100 to 900 on the `wght` axis. The package ships three
subsets, latin, latin-ext and vietnamese; this site declares the latin one in
`src/styles/global.css` and bundles only that file. The other two deployed and
were never fetched: 48,316 bytes across all 25 routes, measured 2026-09-12.

Text outside the latin unicode-range falls back to the next family in
`--font-sans` rather than rendering in Lexend. To restore the other two, import
`@fontsource-variable/lexend` in `BaseLayout.astro` and delete that
`@font-face`.

It is self-hosted: Fontsource bundles the `.woff2` files into the build and they
are served from our own origin. No Google Fonts CDN, no third-party request at
runtime.

Lexend is licensed under the [SIL Open Font License 1.1][ofl], copyright 2019
The Lexend Project Authors. The full text ships with the package.

[fontsource]: https://fontsource.org/fonts/lexend
[ofl]: https://openfontlicense.org/

## Commands

| Command                 | Does                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Dev server at `http://localhost:4321`                            |
| `npm run build`         | Static build to `dist/`                                          |
| `npm run preview`       | Serve the built `dist/` locally                                  |
| `npm run typecheck`     | `astro check` (it runs `astro sync` itself)                      |
| `npm run format`        | Prettier, write                                                  |
| `npm run format:check`  | Prettier, check only                                             |
| `npm run test:a11y`     | Playwright: builds, serves, drives Chromium and Firefox          |
| `npm run test:a11y:ui`  | The same suite in Playwright's UI mode                           |
| `npm run check:tokens`  | Fails on any arbitrary value, or on raw hex outside `global.css` |
| `npm run check:links`   | Fails on a relative Markdown link that does not resolve          |
| `npm run check:commits` | Format, sign-off and attribution over `origin/main..HEAD`        |
| `npm run check`         | The four checks above in turn. Not `check:live`                  |
| `npm run check:live`    | Production against this repository. By hand, never in CI         |
| `npm run astro`         | Astro CLI passthrough                                            |

CI also runs the suite in WebKit. `playwright.config.ts` explains why WebKit is
not run locally.

A suite is green only when the summary line with the counts says so. Check the
reported total against `npx playwright test --list`: a total below the collected
count means those tests did not run, not that they passed.

## Project layout

```
src/
  assets/           Images and the footer field SVG, processed by the build
  components/       Astro components; ui/ holds the Vue islands
  layouts/          BaseLayout (head, header, footer) and BlogLayout
  lib/              Shared TypeScript: nav, blog, structured data, drawings
  pages/            File-based routes
  plugins/          The Markdown plugin that marks link-only list items
  content/blog/     Blog posts as Markdown
  content.config.ts Content collection schema
  styles/           Design tokens, base layer, component classes
public/             Static assets served from the site root
scripts/            Convention checks run in CI, and the footer field generator
tests/              The Playwright suite; source.ts and wcag.ts are helpers
docs/               The manual testing guide
```

## Writing a post

Add a Markdown file to `src/content/blog/`. The filename becomes the slug.
Frontmatter is validated against the Zod schema in `src/content.config.ts`, and
the build fails on anything that does not match. See
`src/content/blog/open-source-is-not-just-code.md`, the one real post, for a
complete example: it sets every field the schema defines except `ogImage`.

## Deploy

A Cloudflare Worker named `sinduri-lol`, deployed by Workers Builds from this
repository on every push to `main`. It serves `dist/` as static assets,
configured by [`wrangler.jsonc`](wrangler.jsonc). Workers reads the `_headers`
file the build copies into `dist/`.

| Setting         | Value                          |
| --------------- | ------------------------------ |
| Build command   | `npm run build`                |
| Deploy command  | `npx wrangler deploy`          |
| Version command | `npx wrangler versions upload` |
| Root directory  | `/`                            |
| Node version    | Read from `.nvmrc`             |

`wrangler.jsonc` has to exist. Without it, `wrangler deploy` runs Cloudflare's
[automatic configuration][cf-autoconfig], which installs the adapter itself and
builds a second time. The adapter is a declared dependency here and configured
in `astro.config.mjs`; autoconfiguration guessing at it is what broke the first
Workers build on 2026-09-11.

Four adapter options are load-bearing, and three of them fail quietly:

- `prerenderEnvironment: 'node'`. Prerendering defaults to `workerd`, where the
  build fails outright: several pages read files at build time.
- `imageService: { build: 'compile' }`. The default is `cloudflare-binding`,
  which defers to a binding that does not exist at build time, so every image
  ships at its master size. `badge-white` went from 8.8-33 KB per density to
  152 KB with nothing going red.
- `session: false`. The adapter otherwise enables sessions backed by a KV
  binding, which is a cookie, and `/privacy` says this site sets none.
- The build splits into `dist/client` and `dist/server`. `assets.directory` and
  `DIST_DIR` in `tests/routes.ts` both name the client half.

Astro's image cache in `node_modules/.astro` survives a config change, so a bad
build poisons it and the next build reports "reused cache entry" while serving
the old output. Anything touching image handling needs
`rm -rf dist .astro node_modules/.astro` before the result means anything.

Wrangler is an exact-version devDependency, so the build runs the version in
`package-lock.json` rather than whatever `npx` resolves that day. To check the
config without deploying:

```sh
npm run build && npx wrangler deploy --dry-run
```

**Trailing-slash redirects are a 307 here**, where Pages answered `/about` with
a 308. Workers [uses 307][cf-html-handling], which is not a permanent redirect.

`not_found_handling: "404-page"` is set explicitly. Pages found `404.html`
without being told; Workers does not. `tests/not-found.spec.ts` asserts it.

### Cutting over from Pages

Pages serves production until step 5, so every step before it is reversible.

1. **Disconnect the old repository from Workers Builds** before connecting this
   one. Two repositories deploying to one Worker is the same hazard as Pages and
   Workers both deploying, one step earlier.
2. **Connect this repository to Workers Builds** and let it deploy. The Worker
   answers only on its `workers.dev` address at this point.
3. **Create the bindings.** `npx wrangler d1 create sinduri-lol`, put the real
   `database_id` into `wrangler.jsonc`, and apply the migration with
   `npx wrangler d1 execute sinduri-lol --remote --file migrations/0001_create_messages.sql`.
   Bindings, variables and secrets do not carry over from Pages, and Workers
   Builds keeps build-time and runtime variables separate.
4. **Verify on `workers.dev`.** The 404 status, the headers, and the contact
   form if it has landed.
5. **Swap the domain.** Remove the custom domain from the Pages project, then
   add it to the Worker. In `wrangler.jsonc` that is a `routes` entry with
   `custom_domain: true`; a route without that flag is treated as a pattern, not
   a domain. Both sides sit behind Cloudflare's proxy, so the cutover is seconds
   and waits on no DNS propagation. Wrangler replaces a Worker's routes with the
   file's on every deploy, so the domain goes in the file, not just the
   dashboard.
6. **Turn `workers_dev` off**, or the site has a third hostname.
7. **Add the bulk redirects** for `www` and `pages.dev`, below.
8. **Disable automatic deployments on the Pages project**, confirm the Worker is
   serving, and only then `npx wrangler pages project delete`. Deleting before
   disabling leaves a window where both systems deploy.
9. **`npm run check:live`**, which compares production against `public/_headers`.

[cf-autoconfig]: https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/
[cf-html-handling]: https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/

### Hostnames

Three hostnames resolve to this site. Only one is canonical.

| Hostname                | Role                                               |
| ----------------------- | -------------------------------------------------- |
| `sinduri.lol`           | Canonical. Matches `site` in `astro.config.mjs`.   |
| `www.sinduri.lol`       | Redirects to the apex.                             |
| `sinduri-lol.pages.dev` | Cloudflare's project alias. Redirects to the apex. |

The canonical side needs nothing at the edge. `BaseLayout.astro` builds
`<link rel="canonical">`, `og:url` and both image URLs with
`new URL(..., Astro.site)`, and `Astro.site` is the apex. The site is static, so
those absolute URLs are baked in at build time and cannot vary by request host.

Redirects belong in **Cloudflare Bulk Redirects**, because no in-repository
mechanism can do the job:

- **`_redirects` cannot.** Cloudflare lists [domain-level redirects][cf-redirects]
  as unsupported there, and its source side matches paths, not hosts, so "when
  the Host header is `www`" is not expressible.
- **A zone-level Redirect Rule only solves half of it.** `www.sinduri.lol` is in
  our zone, so a Single Redirect handles it, but `pages.dev` is in no zone of
  ours and a zone-scoped rule can never match it. Two mechanisms for one job.

Bulk Redirects are account-level, run at the edge before the request reaches the
Worker, and cover both hostnames from one list.

#### Configuring the redirects

Under **Account Home > Bulk Redirects**, create one list with two entries:

| Source URL              | Target URL            | Status |
| ----------------------- | --------------------- | ------ |
| `www.sinduri.lol`       | `https://sinduri.lol` | 301    |
| `sinduri-lol.pages.dev` | `https://sinduri.lol` | 301    |

Both take **Preserve query string**, **Subpath matching** and **Preserve path
suffix**, which is what makes the redirect keep the path rather than dumping
every URL on the homepage. Then create a Bulk Redirect rule that uses the list.

**Leave "Include subdomains" off on both entries**, though Cloudflare's own
how-to turns it on. Every preview deployment lives at a subdomain of
`sinduri-lol.pages.dev`, so including subdomains would redirect every preview
build to production and make previews useless.

`www.sinduri.lol` needs a proxied DNS record for Cloudflare to terminate the
request at all. The Cloudflare recipe is a proxied `A` record for `www` pointing
at `192.0.2.1`, a reserved documentation address that is never connected to.

Verify from a shell, not a browser, so no cache is involved:

```sh
curl -sI https://www.sinduri.lol/about       | grep -iE '^(HTTP|location)'
curl -sI https://sinduri-lol.pages.dev/about | grep -iE '^(HTTP|location)'
```

Both should report `301` and `location: https://sinduri.lol/about`. A `200` on
either host means the rule is absent or not matching.

[cf-redirects]: https://developers.cloudflare.com/pages/configuration/redirects/

### Response headers

`public/_headers` is copied into `dist/` by the build. It has two rules, and no
header name appears under both: when two matching rules set the same header,
Cloudflare joins the values with a comma. The `/*` rule covers every asset
response, including `404.html`:

| Header                       | Value                                               |
| ---------------------------- | --------------------------------------------------- |
| `Content-Security-Policy`    | Same-origin only, inline blocks allowed by hash     |
| `Strict-Transport-Security`  | `max-age=15552000; includeSubDomains`, no `preload` |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                   |
| `X-Content-Type-Options`     | `nosniff`                                           |
| `X-Frame-Options`            | `DENY`                                              |
| `Permissions-Policy`         | Camera, mic, geolocation, payment and USB denied    |
| `Cross-Origin-Opener-Policy` | `same-origin`                                       |
| `X-Robots-Tag`               | `noindex`                                           |

The `/_astro/*` rule covers only Vite's content-hashed build output:

| Header                         | Value                                 |
| ------------------------------ | ------------------------------------- |
| `Cache-Control`                | `public, max-age=31536000, immutable` |
| `Cross-Origin-Resource-Policy` | `same-origin`                         |

**`_headers` reaches asset responses only.** Cloudflare does not apply it to
responses generated by Worker code, so any endpoint the Worker serves sets its
own headers in code.

**`X-Robots-Tag: noindex` closes the whole site to search indexes, and it is the
only thing doing so.** Removing it is a launch step. `tests/headers.spec.ts`
asserts it is present, so removing it takes a deliberate edit to the test.

`nosniff` and `strict-origin-when-cross-origin` were already sent by default,
measured on 2026-09-04; they are declared here so they belong to this repository
rather than to a platform default. The CSP reasoning, and the standing hazard
that its hashes are Astro build output and go stale on an Astro upgrade, is in
[ARCHITECTURE.md](ARCHITECTURE.md).

#### HSTS, and the one directive it does not carry

Every other header in that table stops applying the moment it stops being sent.
HSTS does not: a browser that sees it refuses to reach this host over http for
the full `max-age`, 180 days, and a stored policy changes only when that browser
revisits and receives a different value, or when it expires.

**`includeSubDomains` promises that every subdomain is HTTPS-only**, the ones
that exist today and any created later, with no way to click through. Give a new
subdomain working TLS before anything is served on it.

**`preload` is omitted deliberately, and it is the one that cannot be walked
back.** It bakes the host into browser binaries, enforced before any response is
received, and removal rides out browser release trains over months on a timing
outside our control.

The value was raised from a cautious `max-age=86400` on 2026-09-11, when
production was measured sending `max-age=15552000; includeSubDomains` from
Cloudflare's zone-level HSTS setting, which replaces the file's header. The file
was raised to the value browsers already held rather than production being
lowered, so there is no window in which the file is the weaker of the two.

`tests/headers.spec.ts` pins the max-age and asserts `preload` is absent, so
changing either needs an edit to the test in the same commit.

### The 404 page

`src/pages/404.astro` builds to `dist/404.html`. `astro preview` reproduces the
fixed behaviour but not the broken one, so the suite cannot prove the deploy is
fixed. Confirm it against the deployed site:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://sinduri.lol/definitely-not-a-real-path-9f3a
```

That should report `404`.

### Checking production against the repository

The suite reads `dist/`. What a reader receives is `dist/` after Cloudflare has
finished with it, and the dashboard can change that without any file here
changing: on 2026-09-11 five such changes were found on the live site, three of
them by accident.

`npm run check:live` fetches the homepage, `/privacy/`, the real blog post, a
hashed `/_astro/` asset and a path with no page, each with a cache-busting query
and a browser's request headers. It exits non-zero on any of these:

- a header `public/_headers` sets for that path arriving with a different value,
  or not at all, with both values printed. The expected values are parsed from
  the file rather than typed into the script;
- `cdn-cgi`, `__cf_email__` or `email-protection` anywhere in a body;
- an element that fetches from another origin;
- an inline `<script>` or `<style>` whose hash is not in the CSP;
- an unexpected status.

**Run it after any deploy that changes `public/_headers`, and after any change
in the Cloudflare dashboard.**

**It is not in CI, on purpose.** CI runs before the deploy, so nothing live
corresponds to the change under test yet, and a job that depends on the network
and on Cloudflare would fail for reasons unrelated to that change.

**It fails today, and the failure is known.** JavaScript Detections, below, puts
`cdn-cgi` and an unhashed inline script on every HTML page. The rule is not
relaxed to fit it.

It also cannot see a change to the text of a file. Managed robots.txt, below,
added no script, no `cdn-cgi` and no header, and was found by reading the file.

### Dashboard settings the site depends on

Each lives in the Cloudflare dashboard rather than in this repository, and each
changes what ships without changing a file here. Paths were checked against
Cloudflare's documentation on 2026-09-11; search for the setting's name if one
has moved.

| Setting                                | Level | State on 2026-09-11                                  |
| -------------------------------------- | ----- | ---------------------------------------------------- |
| Web Analytics                          | Both  | Off. Must stay off                                   |
| Email Address Obfuscation              | Zone  | Off. Must stay off                                   |
| Zone HSTS                              | Zone  | On, to be turned off once the file's value deploys   |
| Bot Fight Mode / JavaScript Detections | Zone  | Bot Fight Mode off, JavaScript Detections injecting  |
| Managed robots.txt                     | Zone  | Not reaching the file that evening. Check the toggle |

**Web Analytics** adds a `static.cloudflareinsights.com/beacon.min.js` script to
every page. `/privacy` says there are no analytics and no third-party requests,
and `tests/privacy.spec.ts` checks both against the build, which never contains
the beacon. The CSP blocked it, so the page stayed true by accident, at the cost
of a console error on every page. Two places need checking, the project's
Metrics tab and the account's Web Analytics setup. If pageview numbers are ever
wanted, the zone's server-side analytics counts requests at the edge with no
client script and leaves both claims true.

**Email Address Obfuscation** rewrites every `mailto:` into a
`/cdn-cgi/l/email-protection#...` link and injects a script to decode it. With
JavaScript off, the footer's email link then opens a Cloudflare page instead of
a mail client. That is the reader `tests/no-script.spec.ts` exists to protect,
and it cannot see this, because it reads the build. A Configuration Rule can
turn it on for matching requests, overriding the zone toggle, so check
**Rules > Configuration Rules** as well.

**Zone HSTS** sends its own `Strict-Transport-Security`, which replaces the one
`public/_headers` sets. Cloudflare's documentation does not describe that
override; it was measured. The file stops being what ships, silently, and
`tests/headers.spec.ts` stays green whatever the zone sends. Turning it off
retracts nothing: a browser holding the 180-day policy keeps it until it
revisits and receives a different value.

**JavaScript Detections** injects an inline script after `</footer>` on every
page, which loads `/cdn-cgi/challenge-platform/scripts/jsd/main.js` in a 1x1
iframe. The CSP can never allow it: it is inline, `script-src` carries no
`'unsafe-inline'`, and its body embeds a per-request token, so no hash can
match. That is one CSP console error per page load and no request to
`/cdn-cgi/`. Cloudflare strips `ETag` from every HTML response it is injected
into, which is why the HTML cannot answer a conditional request. Bot Fight Mode
stays off because it challenges crawlers, which works against `robots.txt` being
deliberately permissive so that `X-Robots-Tag: noindex` actually reaches an
indexer.

**Managed robots.txt** prepends Cloudflare's content-signals preamble and a
block disallowing nine AI crawlers to the site's own `robots.txt`. It was doing
that earlier on 2026-09-11 and was not that evening. Nothing records who changed
it, so check the toggle before relying on either state. `check:live` cannot see
it: it changes text, not markup or headers.

## Branch protection

Cloudflare builds and deploys whatever lands on `main` without consulting GitHub
Actions, so the accessibility suite gates nothing on its own: a push that fails
CI still ships, and nothing in this repository can change that, because the
deploy trigger lives in the Cloudflare and GitHub integration.

What can change is what is allowed to reach `main`. A branch ruleset requiring
the suite to pass on a pull request means the only way to `main` is through a
green run. The gate is on the merge, not on the deploy.

1. **Settings > Rules > Rulesets**, then **New ruleset > New branch ruleset**.
2. Name it `main`. Leave **Enforcement status** on **Active**.
3. Leave the **Bypass list** empty. Anyone in it can push straight to `main`,
   and as the repository owner you would otherwise be the hole in your own gate.
4. Under **Target branches**, choose **Add target > Include default branch**.
5. Under **Branch rules**, tick **Restrict deletions**, **Block force pushes**,
   **Require a pull request before merging** with **Required approvals** set to
   `0`, and **Require status checks to pass** with **`Build, typecheck, and
axe`** selected. Also tick **Require branches to be up to date before
   merging**.

### The check name

The string to require is **`Build, typecheck, and axe`**, the `name` of the
`a11y` job. It is not `Accessibility`, the name of the workflow. GitHub reports
one status check per job and labels it with the job name, so the workflow name
never appears in the picker.

- **The picker only lists checks GitHub has seen in the last week.** If the name
  is not offered, open a throwaway pull request, let the workflow run once, and
  come back to the ruleset.
- **The requirement matches on that string and nothing else.** Renaming
  `jobs.a11y.name` does not break the ruleset loudly; it leaves it waiting for a
  check that no longer exists. Do not rename the job without updating the
  ruleset in the same change.

### Two things that look like a misconfiguration and are not

**`required_approving_review_count` is `0`, on purpose.** With one maintainer, a
review requirement would mean nobody could merge anything, and the way out is a
bypass entry, a bigger hole than the missing review. The ruleset enforces
"changes arrive via a pull request with CI green", not "reviewed by another
person".

**GitHub's "your main branch isn't protected" banner is safe to ignore.** It
reads the legacy branch-protection API, which this repository does not use. Look
under **Settings > Rules > Rulesets** for the real state.

## MCP servers

`.mcp.json` declares one project-scoped MCP server, `chrome-devtools`, used to
drive a real browser when checking rendering, focus order and zoom behaviour. It
is committed so the setup is shared, not per-machine, and is fetched with `npx`
on first run.

## Accessibility

The conformance target, the known gaps and how to report a barrier are in
[ACCESSIBILITY.md](ACCESSIBILITY.md).

## AI use

AI tooling was used to build this repository. What was used, how it is reviewed,
and the fact that no AI runs at runtime are in
[AI_DISCLOSURE.md](AI_DISCLOSURE.md). Attribution is recorded there for the
project rather than as a trailer on every commit.

## License

Source code is MIT licensed. See [LICENSE](LICENSE).

Lexend is licensed separately under the SIL Open Font License 1.1, copyright
2019 The Lexend Project Authors. See [Fonts](#fonts) above.
