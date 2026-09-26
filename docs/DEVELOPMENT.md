# Development

## Requirements

- Node.js from [`.nvmrc`](../.nvmrc) (`nvm use`) and its bundled npm. CI and
  Workers Builds read the same file, and `engines.node` matches it: no older
  Node is tested.
- Docker for `test:webkit` and `check:pdf`.
- No Cloudflare account or secrets for `dev`, `build`, `check` or any test
  suite. Only `check:live`'s D1 count needs `npx wrangler login` or
  `CLOUDFLARE_API_TOKEN`.
- Python 3 with pikepdf for `publish:cv` and `publish:talk`, plus
  poppler-utils for `publish:cv`: `apt install python3-pikepdf poppler-utils`.

## Setup

```sh
npm ci
npx playwright install --with-deps chromium firefox
git config core.hooksPath .githooks
npm run dev
```

The pre-push hook refuses a push that does not contain the last-fetched `main`;
the commit-msg hook: [AGENTS.md](../AGENTS.md#commits).

The contact form needs a local D1 with the schema applied. To try it by hand:

```sh
npm run build
npx wrangler d1 migrations apply sinduri-lol --local
npm run preview
```

Without the `CONTACT_NOTIFY_TO` secret a message is stored and no email is sent;
the log says so.

## Commands

| Command                      | Does                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                | Dev server at `http://localhost:4340`                            |
| `npm run build`              | Build to `dist/client` (assets) and `dist/server` (Worker)       |
| `npm run preview`            | Serve the build through the Worker runtime                       |
| `npm run typecheck`          | `astro check`, then `vue-tsc` on `.vue` files                    |
| `npm run format`             | Prettier, write                                                  |
| `npm run check`              | Conventions, format and commits; needs `npm run build` first     |
| `npm run test:a11y`          | Playwright suite in Chromium and Firefox; CI adds WebKit         |
| `npm run test:webkit`        | The same suite in WebKit, in Playwright's Docker image           |
| `npm run test:a11y:ui`       | The same suite in Playwright's UI mode                           |
| `npm run test:worker`        | Worker specs, local D1: contact endpoint, byte ranges, types     |
| `npm run test:coverage`      | `test:a11y` in Chromium, with line and branch coverage of `src/` |
| `npm run check:live`         | Production headers and markup against this repository            |
| `npm run check:live:console` | Every production route in a browser, failing on console errors   |
| `npm run check:umami`        | The vendored Umami tracker against the one Umami serves          |
| `npm run check:pdf`          | Every PDF in `public/` against PDF/UA-1, veraPDF in Docker       |
| `npm run publish:cv`         | Scrub, retag and check a Canva export of the CV, then publish it |
| `npm run publish:talk`       | Print a talk's slideshow to its tagged PDF in `public/talks/`    |

### WebKit

Run before pushing any markup, CSS or image change: WebKit fails where Chromium
and Firefox pass (e.g. it drops `aspect-ratio` from a failed image).

WebKit cannot run on Ubuntu newer than 24.04 (see `projects` in
`playwright.config.ts`), so the script runs the suite in
`mcr.microsoft.com/playwright`, pinned by digest in `scripts/test-webkit.sh`
(`check:pins` enforces it). The script refuses to run when the image's tag is
not the installed `@playwright/test` version; bump both together. Arguments
pass through to `playwright test`:

```sh
npm run test:webkit
npm run test:webkit -- tests/reflow.spec.ts
```

### Published PDFs

- `npm run check:pdf` validates every PDF in `public/` against PDF/UA-1;
  `npm run check:pdf -- <path>` validates one.
- veraPDF runs in Docker, pinned by digest in `scripts/check-pdf.mjs`
  (`check:pins` enforces it), with no network and a read-only mount.
- Exit codes: 0 all pass, 1 a failure, 2 could not run (e.g. no Docker).
- `EXPECTED_FAILURES` in `scripts/check-pdf.mjs` lists known non-conforming
  files, pinned to a SHA-256 and to an [ACCESSIBILITY.md](../ACCESSIBILITY.md)
  section 7 gap. It fails when the bytes change, the file starts passing, or
  the gap no longer names it.
- CI runs it; it stays out of `npm run check`, which needs no Docker.
- A pass is the machine half; [MANUAL_TESTING.md](MANUAL_TESTING.md) §13 is
  the rest.

### Other notes

- A test that never opens a page takes `NODE` from `tests/tags.ts`: it runs
  once, in the `node` project, and the browser projects skip it.
- `.github/workflows/scheduled.yml` runs weekly, never on pull requests:
  `npm audit --omit=dev`, `check:live`, `check:umami` and
  `tests/security-txt.spec.ts`. After a deploy:
  [DEPLOYMENT.md](DEPLOYMENT.md).
- `test:coverage` writes `coverage/` (`index.html`, `lcov.info`). It covers
  browser JavaScript only (the island and page scripts). It builds with source
  maps: run a plain `npm run build` before anything else reads `dist/`.
- `dev` and `build` pass `--force` to clear Astro's content cache, which does
  not invalidate when a plugin in `src/plugins/` changes. The resulting
  `[WARN] [content] data store cleared (force)` is expected.
- [AGENTS.md](../AGENTS.md) lists what must pass before a change is done.

| Variable                        | Default                | Effect                                                   |
| ------------------------------- | ---------------------- | -------------------------------------------------------- |
| `LIVE_ORIGIN`                   | `https://sinduri.lol`  | Target of `check:live:console`, e.g. a preview URL       |
| `PORT`                          | 4321                   | Port of `node scripts/preview-static.mjs` run by hand    |
| `TEST_PORT`, `TEST_WORKER_PORT` | from the checkout path | Ports for `test:a11y`, `test:worker`; must be 1024-65535 |
| `WEBKIT`                        | unset                  | `1` adds the WebKit project outside CI                   |
| `CLOUDFLARE_API_TOKEN`          | unset                  | Lets `check:live` count unsent notifications in D1       |
| `CHECK_LIVE_SKIP_D1`            | unset                  | `1` skips that D1 count                                  |

Each checkout gets its own pair. Set them to run two suites in one checkout:

```sh
TEST_PORT=4331 TEST_WORKER_PORT=4332 npm run test:a11y
```

## Project layout

```text
src/
  assets/           Images, processed by the build
  components/       Astro components; ui/ holds the Vue island
  content/blog/     Blog posts as Markdown
  content/talks/    One Slidev Markdown deck per talk
  content.config.ts Content collection schema
  layouts/          BaseLayout: head, header, footer
  lib/              Shared TypeScript
  licenses/         Licence texts for vendored scripts
  pages/            File-based routes
  plugins/          Markdown plugins
  presenter/        Dev-only presenter view for talks
  scripts/          Browser modules that are not islands
  styles/           global.css (tokens, imports), base, components/, light mode
  worker.ts         Worker entry: Astro's handler and the retention sweep
public/             Static files served from the site root, including _headers
                    and the vendored Umami tracker in vendor/
artwork/            Source artwork the build never reads
migrations/         D1 schema
scripts/            Convention and live-site checks, PDF publishing, test helpers
tests/              Playwright specs; fixtures/ holds files the specs serve
.github/            CI workflows, Dependabot, pull request template
.githooks/          commit-msg and pre-push hooks
docs/               Development, deployment, style guide, manual testing
```

## Writing a post

Add a Markdown file to `src/content/blog/`; the filename is the slug. The build
validates frontmatter against `src/content.config.ts` and fails on a mismatch.
`open-source-is-not-just-code.md` is a complete example.

## Writing a talk

One deck per talk: `src/content/talks/<deck>/slides.md`, in Slidev's Markdown
format, shown at `/talks/<deck>/`. Example:
`open-source-is-not-just-code/slides.md`. The build fails on anything the
slideshow cannot render, naming slide and line (`src/lib/slides.ts`).

- Opening frontmatter is slide 1: `layout: cover` and `info:` (the meta
  description).
- Later slides put settings in a `yaml` code block at the top, never between
  `---` lines (Prettier breaks those).
- The first slide after the cover sets `part:`. `layout: section` also opens a
  part, centred under its number; name it `Part N: Title`.
- One `#` heading per slide, in the case it should display.
- A group label is a `**bold**` paragraph. Two or more on a slide become cards.
  `**A Good Model: ...**` and `**Example: ...**` always become a card. Six or
  more non-card blocks run two columns on wide screens.
- `label:` adds a grouping (e.g. a pillar number) inside the heading. Use only
  where the heading alone loses it.
- Images go in the deck's `images/` as `./images/<file>`. Reuse a site image
  by relative symlink into `src/assets/` (needs `core.symlinks` on Windows).
- No `v-click`, Vue components, `::right::` slots or `src:` imports.
- A slide's last HTML comment is its speaker note, never published
  (`tests/talk.spec.ts`). Any other comment fails the build.
- Add a new deck's route to `TALK_ROUTES` in `tests/routes.ts`.

### Publishing the PDF

```sh
npm run build
npm run publish:talk -- <deck>
npm run check:pdf -- public/talks/<deck>.pdf
```

- Prints the built slideshow to `public/talks/<deck>.pdf`, one slide a page,
  and tags it with `scripts/tag-talk-pdf.py`. Refuses a stale build.
- Update the size and page count wherever the PDF is linked;
  `tests/slides.spec.ts` fails until they match.
- Reprint after changing a slide; `tests/talk-pdf.spec.ts` fails when
  `slides.md` no longer matches. Speaker notes do not count.

### Presenting

```sh
npm run dev
```

- Open `/talks/<deck>/presenter/` for yourself and the slideshow from its
  "Open the slideshow" link for the room; put that window on the projector and
  press Full screen.
- The windows stay in sync; arrow keys and Page Up/Down (clickers) work in
  both.
- Shows the slide, notes, next title and a timer. Dev server only, so notes
  never reach the build. Edited notes show on reload.

## Publishing the CV

The CV is designed in Canva. Every export needs its metadata scrubbed, its
language fixed and its tags repaired:

```sh
npm run publish:cv -- ~/Downloads/export.pdf
```

- Draws every Canva form with tagged text in the page stream, so no text is
  tagged inside an artifact and Firefox's viewer keeps the structure.
- Untags the photo, which stays drawn as an artifact
  ([decorative](../ARCHITECTURE.md#content-notes)), and refuses anything
  tagged inside an artifact.
- Writes `public/sinduri-guntupalli-cv.pdf` only if the result renders like
  the export (anti-aliasing aside), extracts the same text, has one H1 and the
  six expected H2s drawing their own labels, and passes PDF/UA-1
  ([Published PDFs](#published-pdfs)).
  Otherwise it prints why and leaves `public/` alone.
- A section added, removed or renamed: update `SECTIONS` at the top of
  `scripts/publish-cv.py`.
- Any other refusal is an unknown layout; the message says what.
- Read the result in a PDF reader before committing: the checks cover
  structure, not readability.
