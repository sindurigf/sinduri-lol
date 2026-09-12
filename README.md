# sinduri.lol

Personal website. Astro 7, Vue 3 islands, Tailwind CSS 4, TypeScript strict.
Every page is prerendered and served as static assets by a Cloudflare Worker;
the one on-demand route is the contact form endpoint, backed by D1.

## Requirements

Node.js at the version in [`.nvmrc`](.nvmrc) (`nvm use`), and the npm that ships
with it. CI and Workers Builds read the same file. `engines.node` is the oldest
version the dependency tree accepts, not the one to develop on.

## Setup

```sh
npm install
npm run dev
```

Fonts come from npm, so there is nothing else to fetch. Submitting the contact
form needs the Worker runtime and a local D1, which `npm run test:worker` sets
up; everything else works under `npm run dev`.

## Commands

| Command                      | Does                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `npm run dev`                | Dev server at `http://localhost:4321`                          |
| `npm run build`              | Build to `dist/client` (assets) and `dist/server` (Worker)     |
| `npm run preview`            | Serve the build through the Worker runtime                     |
| `npm run typecheck`          | `astro check`                                                  |
| `npm run format`             | Prettier, write                                                |
| `npm run check`              | Tokens, relative links, formatting and commit messages         |
| `npm run test:a11y`          | Playwright suite in Chromium and Firefox; CI adds WebKit       |
| `npm run test:a11y:ui`       | The same suite in Playwright's UI mode                         |
| `npm run test:worker`        | The contact endpoint, through the Worker with a local D1       |
| `npm run check:live`         | Production headers and markup against this repository          |
| `npm run check:live:console` | Every production route in a browser, failing on console errors |

`check:live` and `check:live:console` read the deployed site, so they run by
hand after a deploy, never in CI.

## Project layout

```
src/
  assets/           Images and the footer field SVG, processed by the build
  components/       Astro components; ui/ holds the Vue islands
  content/blog/     Blog posts as Markdown
  content.config.ts Content collection schema
  layouts/          BaseLayout (head, header, footer) and BlogLayout
  lib/              Shared TypeScript
  pages/            File-based routes
  plugins/          Markdown plugins
  styles/           Design tokens, base layer, component classes
public/             Static files served from the site root, including _headers
migrations/         D1 schema
scripts/            Convention checks and the live-site check
tests/              Playwright specs
docs/               The manual accessibility testing guide
```

## Writing a post

Add a Markdown file to `src/content/blog/`; the filename is the slug. The build
validates frontmatter against `src/content.config.ts` and fails on a mismatch.
`open-source-is-not-just-code.md` is a complete example.

## Deploy

Workers Builds deploys the `sinduri-lol` Worker on every push to `main`, from
[`wrangler.jsonc`](wrangler.jsonc).

| Setting        | Value                 |
| -------------- | --------------------- |
| Build command  | `npm run build`       |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/`                   |

To check the configuration without deploying:

```sh
npm run build && npx wrangler deploy --dry-run
```

**Custom domains belong in `wrangler.jsonc`.** A deploy replaces the Worker's
routes with the file's, so a domain added only in the dashboard is removed.

**The D1 database is in the EU jurisdiction**, which cannot be changed after
creation and which `/privacy` states. Recreate it with
`npx wrangler d1 create sinduri-lol --jurisdiction eu`, then apply the schema:

```sh
npx wrangler d1 execute sinduri-lol --remote --file migrations/0001_create_messages.sql
```

`www.sinduri.lol` and `sinduri-lol.pages.dev` redirect to the apex with a 301
through an account-level Bulk Redirect list, outside this repository.

### Cloudflare settings

These live in the dashboard and change what ships without changing a file here.
`npm run check:live` catches most of them.

| Setting                   | Required state | Why                                                       |
| ------------------------- | -------------- | --------------------------------------------------------- |
| Web Analytics             | Off            | Injects a third-party script `/privacy` says is not there |
| Email Address Obfuscation | Off            | Rewrites `mailto:` links into a script-dependent page     |
| JavaScript Detections     | Off            | Injects an inline script the CSP blocks on every page     |
| Bot Fight Mode            | Off            | Challenges the crawlers `X-Robots-Tag` has to reach       |
| Zone HSTS                 | Off            | Replaces the `Strict-Transport-Security` in `_headers`    |

## Branch protection

A ruleset on `main` requires a pull request and the `Required checks` status,
which passes only when every job in `.github/workflows/a11y.yml` has. It matches
that check by the job's `name`, so renaming the job leaves every pull request
waiting on a check that never reports.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): stack, design system, content schema,
  assets, security headers, test conventions
- [ACCESSIBILITY.md](ACCESSIBILITY.md): conformance statement and known gaps
- [AGENTS.md](AGENTS.md): working rules for changing this repository
- [AI_DISCLOSURE.md](AI_DISCLOSURE.md): how AI tooling was used to build it
- [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md): the by-hand accessibility
  checklist

## License

Source code is MIT licensed; see [LICENSE](LICENSE). Lexend is licensed
separately under the SIL Open Font License 1.1, copyright 2019 The Lexend
Project Authors.
