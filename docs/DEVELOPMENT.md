# Development

## Requirements

Node.js at the version in [`.nvmrc`](../.nvmrc) (`nvm use`), and the npm that
ships with it. CI and Workers Builds read the same file. `engines.node` is the
oldest version the dependency tree accepts, not the one to develop on.

## Setup

```sh
npm install
npm run dev
```

Fonts come from npm, so there is nothing else to fetch. Submitting the contact
form needs the Worker runtime and a local D1, which `npm run test:worker` sets
up; everything else works under `npm run dev`.

## Commands

| Command                      | Does                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                | Dev server at `http://localhost:4340`                            |
| `npm run build`              | Build to `dist/client` (assets) and `dist/server` (Worker)       |
| `npm run preview`            | Serve the build through the Worker runtime                       |
| `npm run typecheck`          | `astro check`                                                    |
| `npm run format`             | Prettier, write                                                  |
| `npm run check`              | Tokens, relative links, formatting and commit messages           |
| `npm run test:a11y`          | Playwright suite in Chromium and Firefox; CI adds WebKit         |
| `npm run test:a11y:ui`       | The same suite in Playwright's UI mode                           |
| `npm run test:worker`        | The contact endpoint and retention sweep, with a local D1        |
| `npm run test:coverage`      | `test:a11y` in Chromium, with line and branch coverage of `src/` |
| `npm run check:live`         | Production headers and markup against this repository            |
| `npm run check:live:console` | Every production route in a browser, failing on console errors   |
| `npm run check:umami`        | The vendored Umami tracker against the one Umami serves today    |

`check:live` and `check:live:console` read the deployed site, so they run by
hand after a deploy, never in CI. `check:umami` reads Umami's site and runs by
hand at least monthly; [DEPLOYMENT.md](DEPLOYMENT.md#umami) says what to do when
it fails. [AGENTS.md](../AGENTS.md) lists what has to
pass before a change is done.

Four environment variables, all optional:

- `LIVE_ORIGIN` points `check:live:console` at another deployment, such as a
  preview URL. It defaults to `https://sinduri.lol`.
- `PORT` sets the port of `node scripts/preview-static.mjs` when you run it by
  hand. It defaults to 4321. `test:a11y` ignores it and uses `TEST_PORT`.
- `TEST_PORT` and `TEST_WORKER_PORT` move `test:a11y` and `test:worker` off
  their defaults, 4321 and 4322. Set them when another checkout on the same
  machine is running its suites: `TEST_PORT=4331 TEST_WORKER_PORT=4332 npm run
test:a11y`. A value that is not a port from 1024 to 65535 stops the run.

`test:coverage` writes its report to `coverage/` (not committed): open
`coverage/index.html`, or read `coverage/lcov.info`. It measures the JavaScript
a browser runs, which is the Vue islands, the hero field and the page scripts,
so build-time code and the Worker are not in the number. Measured 2026-09-18:
90.8% of statements, 81.7% of branches, 90.3% of functions, 93.5% of lines. It
builds with source maps, which a deployed build must never ship, so run a plain
`npm run build` before anything that reads `dist/` afterwards.

`dev` and `build` pass `--force`, which clears Astro's content cache. Astro
invalidates that cache when the Astro config, the content config or its own
version changes, but not when a Markdown plugin in `src/plugins/` does, so
without the flag a local build keeps serving posts rendered by the old plugin.
CI builds from a clean checkout and never sees it. Measured 2026-09-16: after
the `sizes` fit in `post-figure.mjs`, local builds still emitted
`(min-width: 48rem) 48rem, 100vw` and `tests/image-size.spec.ts` failed.

## Project layout

```text
src/
  assets/           Images, processed by the build
  components/       Astro components; ui/ holds the Vue islands
  content/blog/     Blog posts as Markdown
  content.config.ts Content collection schema
  layouts/          BaseLayout (head, header, footer) and BlogLayout
  lib/              Shared TypeScript
  pages/            File-based routes
  plugins/          Markdown plugins
  scripts/          Browser modules that are not islands: click tracking
  styles/           Design tokens, base layer, component classes
  worker.ts         Worker entry: Astro's handler and the retention sweep
public/             Static files served from the site root, including _headers
                    and the vendored Umami tracker in vendor/
migrations/         D1 schema
scripts/            Convention checks and the live-site check
tests/              Playwright specs
docs/               This guide, deployment, and manual accessibility testing
```

## Writing a post

Add a Markdown file to `src/content/blog/`; the filename is the slug. The build
validates frontmatter against `src/content.config.ts` and fails on a mismatch.
`open-source-is-not-just-code.md` is a complete example.
