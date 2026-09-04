# sinduri.lol

Personal website. Astro 7, Vue 3 islands, Tailwind CSS 4, TypeScript strict,
static output, deployed to Cloudflare Pages.

## Requirements

- Node.js, at the exact version pinned in [`.nvmrc`](.nvmrc). Run `nvm use` in
  the repository root to match it.
- npm, whichever version ships with that Node. Nothing here needs a newer one.

`package.json` declares `engines.node` and no `engines.npm`, and that is
deliberate rather than an omission. An earlier version of this file asked for
npm `>=9.6.5`, a floor that was never declared anywhere a tool could read and
that every npm bundled with a supported Node already clears. A requirement no
tool checks and no install can fail is not a requirement, so the claim is gone
rather than copied into `package.json`.

`.nvmrc` is the single source of truth for the Node version, and everything
that runs a build reads it:

| Reader           | How                                                           |
| ---------------- | ------------------------------------------------------------- |
| Your shell       | `nvm use`                                                     |
| GitHub Actions   | `node-version-file: '.nvmrc'` in `.github/workflows/a11y.yml` |
| Cloudflare Pages | Read from the repository at build time, no dashboard setting  |

`engines.node` in `package.json` is `>=22.19.0`. It is a floor, the oldest
runtime the dependency tree accepts. `.nvmrc` is a pin, the one version CI and
production actually run. They answer different questions, so both are kept.

**npm does not enforce that floor on install.** An earlier version of this file
said it did. What npm actually does on a runtime below the floor is print an
`EBADENGINE` warning and install anyway; a failed install needs
`engine-strict=true` in `.npmrc`, which is not set here. So `engines.node` is a
declaration and a warning, not a gate. `.nvmrc` is the thing that decides which
Node runs, and it is read by `nvm use`, by GitHub Actions and by Cloudflare.

The floor was also wrong, which is what made the enforcement claim worth
checking. It said `>=22.12.0`, and the installed tree rules that version out:
`undici` declares `>=22.19.0` and `@napi-rs/wasm-runtime` declares
`^20.19.0 || ^22.13.0 || >=23.5.0`. Measured across all 167 packages in
`node_modules` that declare `engines.node`, 22.12.0 and 22.13.0 both fail and
22.19.0 is the lowest 22.x that satisfies every one of them. The floor is now
22.19.0.

`engine-strict=true` was considered and not set. It does not only enforce the
floor declared here; it enforces all 167 of those third-party declarations, so
one dependency shipping an over-tight or mistaken `engines` field turns into a
hard install failure in this repository. That is exactly the shape of the
problem above, and it would have blocked `npm install` on the version this
file was advertising as supported. The Node version that matters is pinned by
`.nvmrc` in all three places that build, so the marginal value of a fourth,
more brittle check is small.

To move to a newer Node, edit `.nvmrc`. Raise `engines.node` only when a
dependency actually requires it, and check the tree rather than guessing.
Because npm only warns, the warnings are the check:

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

Lexend is installed as [`@fontsource-variable/lexend`][fontsource] and imported
in `src/layouts/BaseLayout.astro`. It is a variable font covering weights 100
to 900 on the `wght` axis, subsets latin, latin-ext, and vietnamese.

It is still self-hosted: Fontsource bundles the `.woff2` files into the build
and they are served from our own origin. No Google Fonts CDN, no third-party
request at runtime.

Lexend is licensed under the [SIL Open Font License 1.1][ofl], copyright 2019
The Lexend Project Authors. The full license text ships with the package at
`node_modules/@fontsource-variable/lexend/LICENSE`.

[fontsource]: https://fontsource.org/fonts/lexend
[ofl]: https://openfontlicense.org/

## Commands

| Command           | Does                                  |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Dev server at `http://localhost:4321` |
| `npm run build`   | Static build to `dist/`               |
| `npm run preview` | Serve the built `dist/` locally       |
| `npm run astro`   | Astro CLI passthrough                 |

## Commit hooks

Commit messages here carry no AI attribution. Two things enforce that, and the
second exists because the first is not reliable on its own:

1. `.claude/settings.json` sets an empty attribution template for Claude Code.
2. `.githooks/commit-msg` strips any AI attribution that lands anyway.

Git does not clone hooks, so the hook has to be switched on once per checkout:

```sh
git config core.hooksPath .githooks
```

Do that after `npm install`. It is not wired into a `prepare` script on
purpose: that would run `git config` during CI and deploy installs, where
there is no developer checkout to configure and a failure would take the
install down with it.

The hook removes `Co-Authored-By:` lines naming Claude or Anthropic and the
`Generated with [Claude Code]` line. It deliberately leaves a `Co-Authored-By:`
line naming a person alone, because silently dropping a human collaborator's
credit would be a worse failure than the one it prevents.

## Project layout

```
src/
  components/       Astro components; ui/ holds the Vue islands
  layouts/          BaseLayout (head, header, footer) and BlogLayout
  pages/            File-based routes
  content/blog/     Blog posts as Markdown
  content.config.ts Content collection schema
  styles/global.css Fonts, design tokens, base layer, component classes
public/             Static assets served from the site root
```

## Writing a post

Add a Markdown file to `src/content/blog/`. The filename becomes the slug.
Frontmatter is validated against the Zod schema in `src/content.config.ts`, and
the build fails on anything that does not match. See
`src/content/blog/example-post.md` for a complete example.

## Deploy

Cloudflare Pages, static, built by the GitHub integration on every push to
`main`. No SSR adapter is configured and there are no Pages Functions, so every
response is a static asset served from Cloudflare's edge with no compute in
front of it.

| Setting          | Value              |
| ---------------- | ------------------ |
| Framework preset | Astro              |
| Build command    | `npm run build`    |
| Build output     | `dist`             |
| Node version     | Read from `.nvmrc` |

Do not set `NODE_VERSION` in the Pages environment variables. It overrides
`.nvmrc` and reintroduces the drift the pin exists to prevent. If one is set
already, delete it.

### Hostnames

Three hostnames resolve to this site. Only one of them is canonical.

| Hostname                | Role                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `sinduri.lol`           | Canonical. Matches `site` in `astro.config.mjs`.           |
| `www.sinduri.lol`       | Redirects to the apex.                                     |
| `sinduri-lol.pages.dev` | Cloudflare's project alias. Cannot be disabled. Redirects. |

The canonical side is already handled in the build and needs nothing at the
edge. `BaseLayout.astro` builds `<link rel="canonical">`, `og:url`, and both
image URLs with `new URL(..., Astro.site)`, and `Astro.site` is the apex. The
site is static, so those absolute apex URLs are baked into the HTML at build
time and cannot vary by request host. Whichever hostname serves a page, it
names `https://sinduri.lol/...` as the canonical copy.

Redirects are the other half, and they are **Cloudflare Bulk Redirects**,
configured in the dashboard. They are deliberately not in this repository,
because no in-repository mechanism can do the job:

- **`_redirects` cannot.** Cloudflare lists [domain-level
  redirects][cf-redirects] as unsupported in `_redirects`. The source side
  matches paths, not hosts, so "when the Host header is `www`" is not
  expressible.
- **A Pages Function could, at a price not worth paying.** A root
  `functions/_middleware.ts` can read the Host header and redirect, but
  Cloudflare runs root middleware [in front of static files][cf-middleware].
  Every request for every page, image, and font on the canonical domain would
  invoke a Worker so that two non-canonical hostnames can be redirected. It
  would also give a purely static deployment a compute path, and a way to fail,
  that it does not currently have.
- **A zone-level Redirect Rule only solves half of it.** `www.sinduri.lol` is
  in the `sinduri.lol` zone, so a Single Redirect handles it. `pages.dev` is
  Cloudflare's domain, not in any zone of ours, so a zone-scoped rule can never
  match it. That means two mechanisms for one job.

Bulk Redirects are account-level rather than zone-level, run at the edge before
the request reaches the Pages project, and cover both hostnames from one list.
This is also what Cloudflare documents for [www to apex][cf-www] and for
[`*.pages.dev` to a custom domain][cf-pagesdev].

#### Configuring the redirects

In the Cloudflare dashboard, under **Account Home > Bulk Redirects**, create
one list with two entries:

| Source URL              | Target URL            | Status |
| ----------------------- | --------------------- | ------ |
| `www.sinduri.lol`       | `https://sinduri.lol` | 301    |
| `sinduri-lol.pages.dev` | `https://sinduri.lol` | 301    |

Both entries take **Preserve query string**, **Subpath matching**, and
**Preserve path suffix**, which is what makes the redirect keep the path rather
than dumping every URL on the homepage. Then create a Bulk Redirect rule that
uses the list.

**Leave "Include subdomains" off on both entries.** Cloudflare's own how-to
turns it on. Do not follow that here: every Pages preview deployment lives at
`<hash>.sinduri-lol.pages.dev` and every branch alias at
`<branch>.sinduri-lol.pages.dev`, so including subdomains would redirect every
preview build to production and make previews useless. That matters more once
pull requests are the way changes land. Nothing exists under `www` either, so
the flag buys nothing on that entry.

`www.sinduri.lol` needs a proxied DNS record for Cloudflare to terminate the
request at all, and it already has one. Measured on 2026-09-04 it answers
`HTTP 522`, which is Cloudflare reporting that it could not reach an origin: the
record is proxied, so Cloudflare terminates TLS, but whatever it points at does
not answer. **`www` is currently broken rather than duplicating content.** Add
the Bulk Redirect and the 522 goes away with it, because a redirect rule is
evaluated before an origin is chosen and the dead origin is never contacted.

If that record is ever removed, the Cloudflare recipe is a proxied `A` record
for `www` pointing at `192.0.2.1`, a reserved documentation address that is
never connected to, for exactly the same reason.

Verify from a shell, not a browser, so no cache is involved:

```sh
curl -sI https://www.sinduri.lol/about       | grep -iE '^(HTTP|location)'
curl -sI https://sinduri-lol.pages.dev/about | grep -iE '^(HTTP|location)'
```

Both should report `301` and `location: https://sinduri.lol/about`. Anything
else means the rule is not matching: a `200` on `pages.dev` is the redirect
missing, and a `522` on `www` is the redirect missing in front of the dead
origin described above.

[cf-redirects]: https://developers.cloudflare.com/pages/configuration/redirects/
[cf-middleware]: https://developers.cloudflare.com/pages/functions/middleware/
[cf-www]: https://developers.cloudflare.com/pages/how-to/www-redirect/
[cf-pagesdev]: https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/

### Response headers

`public/_headers` is copied into `dist/` by the build and read by Cloudflare
Pages. It sets one `/*` rule covering every response, including `404.html`:

| Header                      | Value                                            |
| --------------------------- | ------------------------------------------------ |
| `Content-Security-Policy`   | Same-origin only, inline blocks allowed by hash  |
| `Strict-Transport-Security` | `max-age=86400`, nothing else                    |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                |
| `X-Content-Type-Options`    | `nosniff`                                        |
| `X-Frame-Options`           | `DENY`                                           |
| `Permissions-Policy`        | Camera, mic, geolocation, payment and USB denied |

Pages already sent `nosniff` and `strict-origin-when-cross-origin` by default,
measured on 2026-09-04. They are declared here so they belong to this
repository rather than to a platform default. The CSP is the new part, and the
reasoning behind it, along with the standing hazard that its hashes are build
output and go stale on an Astro upgrade, is in [AI.md](AI.md).

#### HSTS, and the two directives it does not carry

`Strict-Transport-Security: max-age=86400`. No `includeSubDomains`, no
`preload`.

Every other header in that table stops applying the moment it stops being
sent. HSTS does not. A browser that sees it will refuse to reach this host over
http for the full `max-age`, and there is no way to reach into that browser and
shorten it. That is why the value is one day rather than the year the header is
usually seen with: long enough to be a real commitment, short enough that a
mistake ages out by tomorrow instead of next year.

**`preload` is omitted deliberately, and it is the one that cannot be walked
back.** Submitting a host to the preload list bakes it into browser binaries,
so it is enforced before any response is ever received. Removal is a request
that has to ride out browser release trains, which takes months, and the
timing is entirely outside our control. Nothing about this site needs that.

**`includeSubDomains` is omitted for the same reason at smaller scale.** It
would extend the promise to every subdomain, including ones that do not exist
yet and whose TLS nobody has checked.

**Raise `max-age` only once the setup is proven stable on the deployed site**,
and raise it in steps, not straight to a year. Each increase is the same
irreversible commitment for a longer period, so it is worth having watched the
site serve correctly over https for a while first. `tests/headers.spec.ts`
asserts the ceiling and the absence of both directives, so widening this needs
an edit to the test in the same commit, which is the point.

Note that the header is only a defence for a _returning_ visitor: the first
request over http is unprotected either way, which is the problem `preload`
solves and the reason it exists. Cloudflare already redirects http to https
for this site, so what HSTS adds here is removing that redirect hop for anyone
who has been before.

`tests/headers.spec.ts` serves the built output under this policy and drives a
browser at it, so the policy itself is covered by the suite. What the suite
cannot cover is whether Cloudflare parses the file the same way. Check that
once, against the deployed site, after the first deploy:

```sh
curl -sI https://sinduri.lol/ | grep -iE 'content-security-policy|strict-transport-security|referrer-policy|x-content-type|x-frame|permissions-policy'
```

All six should come back. If none do, Cloudflare rejected the file; the Pages
build log reports the parse error. Check the HSTS line in particular: Cloudflare
can also set this one from its own dashboard, and if it is enabled there the
value that arrives may not be the value in this file.

### The 404 page

`src/pages/404.astro` builds to `dist/404.html`, which is the filename
Cloudflare Pages looks for when a request matches no asset. Without it, Pages
answers every unknown path with `index.html` and a **200**. That is what this
site did: measured on 2026-09-04, `https://sinduri.lol/definitely-not-a-real-path-9f3a`,
`/blog/nope/deeper`, and even `/images/nope.png` all returned 200 and the
homepage.

`astro preview` reproduces the fixed behaviour but not the broken one, so the
suite cannot prove the deploy is fixed. Confirm it once against the deployed
site:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://sinduri.lol/definitely-not-a-real-path-9f3a
```

That should report `404`.

## Branch protection

Cloudflare builds and deploys whatever lands on `main`, and it does not consult
GitHub Actions before doing so. The accessibility suite therefore gates nothing
on its own: a push that fails CI still ships. Nothing in this repository can
change that, because the deploy trigger lives in the Cloudflare and GitHub
integration, not here.

What can change is what is allowed to reach `main`. A branch ruleset that
requires the suite to pass on a pull request means the only way to `main` is
through a green run, and Cloudflare then deploys a commit that has already been
checked. The gate is on the merge, not on the deploy.

The workflow already runs on `pull_request` against `main`, so nothing in
`.github/workflows/a11y.yml` needs changing for this. The rest is repository
settings, which have to be set by hand:

1. Go to **Settings > Rules > Rulesets**, then **New ruleset > New branch
   ruleset**.
2. Name it `main`.
3. Leave **Enforcement status** on **Active**.
4. Leave the **Bypass list** empty. Anyone or anything in it can push straight
   to `main`, and as the repository owner you would otherwise be the hole in
   your own gate.
5. Under **Target branches**, choose **Add target > Include default branch**.
6. Under **Branch rules**, tick:
   - **Restrict deletions**
   - **Block force pushes**
   - **Require a pull request before merging**, with **Required approvals** set
     to `0`. There is one maintainer, so a review requirement would only block
     you; the point of the rule here is that it forces the checks to run on a
     head that is not `main`.
   - **Require status checks to pass**, then **Add checks** and select
     **`Build, typecheck, and axe`**. Also tick **Require branches to be up to
     date before merging**.
7. **Create**.

### The check name

The string to require is **`Build, typecheck, and axe`**, which is the `name` of
the `a11y` job. It is not `Accessibility`, which is the name of the workflow.
GitHub reports one status check per job and labels it with the job name, so the
workflow name never appears in the picker.

Two things about that are worth knowing before they bite:

- **The picker only lists checks GitHub has seen in the last week.** If the name
  is not offered, open a throwaway pull request, let the workflow run once, and
  come back to the ruleset.
- **The requirement matches on that string and nothing else.** Renaming
  `jobs.a11y.name` in `.github/workflows/a11y.yml` does not break the ruleset
  loudly; it leaves it waiting for a check that no longer exists, or silently
  satisfied, depending on the rest of the configuration. Either rename is a
  settings change too, so do not rename the job without updating the ruleset in
  the same change.

### What it costs

Once the ruleset is active, `git push origin main` is rejected. Every change,
including a one-line typo fix, goes through a branch and a pull request. That is
the intended trade: it is the only way the suite gets to run before the deploy
rather than alongside it.

Pull requests also make Cloudflare build a preview deployment for each one, at
`<hash>.sinduri-lol.pages.dev`. See the note about "Include subdomains" under
[Configuring the redirects](#configuring-the-redirects); getting that flag wrong
would redirect every preview to production.

## Conventions

Design system, tokens, commit format, and code conventions are documented in
[AI.md](AI.md).

## MCP servers

`.mcp.json` declares one project-scoped MCP server, `chrome-devtools`, used to
drive a real browser when checking rendering, focus order, and zoom behaviour.

It is committed so the setup is shared, not per-machine. Claude Code asks for
approval the first time it starts the server in this repo; approve it once and
the prompt does not return. It is fetched with `npx` on first run, so that run
is slower and needs network access.

The `accesslint` server is deliberately not here. It is installed globally as a
Claude Code plugin with its own bundled MCP server.

## Accessibility

The conformance target, the known gaps, and how to report a barrier are in
[ACCESSIBILITY.md](ACCESSIBILITY.md).

## AI use

AI tooling was used to build this repository. What was used, how it is
reviewed, and the fact that no AI runs at runtime are documented in
[AI_DISCLOSURE.md](AI_DISCLOSURE.md).

## License

Source code is MIT licensed. See [LICENSE](LICENSE).

Lexend is licensed separately under the SIL Open Font License 1.1, copyright
2019 The Lexend Project Authors. See [Fonts](#fonts) above.
