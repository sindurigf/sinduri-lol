# Architecture

Stack, token mechanics, content, assets, headers and test conventions for
sinduri.lol. Design rules and values are in
[docs/STYLEGUIDE.md](docs/STYLEGUIDE.md).

## Stack

| Concern     | Choice                                      |
| ----------- | ------------------------------------------- |
| Framework   | Astro 7, static output                      |
| Interactive | Vue 3 via `@astrojs/vue`, islands only      |
| Styling     | Tailwind CSS 4 via `@tailwindcss/vite`      |
| Language    | TypeScript, `astro/tsconfigs/strictest`     |
| Content     | Astro Content Collections, Markdown in repo |
| Hosting     | Cloudflare Workers static assets            |

- Vue runs with `features: { optionsAPI: false }`; every component uses
  `<script setup>`.
- No `trailingSlash` in `astro.config.mjs`: `'always'` makes `astro preview`
  404 on `/about`.
- No `tailwind.config.mjs`. Tokens live in the `@theme static` block in
  `src/styles/global.css`. `static` keeps tokens that no utility references;
  plain `@theme` tree-shakes them and `var(--color-…)` resolves to nothing.
- `global.css` holds the Tailwind import, fonts, `@source` and `@theme`, which
  the scripts read, then imports the partials in cascade order: `base.css`,
  `components/*.css` by area with `reduced-motion.css` among them,
  `utilities.css`, `light-mode.css`. Reordering the imports reorders the
  cascade.
- `@astrojs/tailwind` peers at `astro ^3 || ^4 || ^5` and cannot be used.
- Collection config is `src/content.config.ts` with `glob()` loaders.

## Browser support

Chrome 111, Edge 111, Firefox 114, Safari 16.4, iOS Safari 16.4 (Baseline
Widely Available). Set once as `CSS_TARGET` in `astro.config.mjs` and passed to
`vite.build.cssTarget`.

- Tailwind 4 sets the floor: it emits `@property`, `color-mix()` and cascade
  layers, which Safari 15 cannot render.
- Pinned, not left to the bundler default, which moves between releases.
- No `browserslist` key: neither Tailwind 4 nor Vite reads it.
- `tests/css-target.spec.ts` asserts the list and the prefixes it implies
  (e.g. `-webkit-hyphens`) in the built CSS. No engine in the suite runs at the
  floor, so this is the only cover.

## Design system

Every visual rule, token and value is in [docs/STYLEGUIDE.md](docs/STYLEGUIDE.md).
This section keeps the mechanisms.

### Light mode

Dark is the default. Colours and rules:
[STYLEGUIDE Light mode](docs/STYLEGUIDE.md#light-mode).

- `data-theme="light"` on `<html>`; `src/styles/light-mode.css`, imported last,
  overrides a subset of tokens on `<main>` while it is set. No `dark:`
  variants.
- Only `<main>` changes; the header, no-JS nav and footer stay dark, except
  the header's bottom edge, which turns `text`.
- `bunny` and `tile-edge` hold the mode-independent logo-tile colours.
- An inline script in `BaseLayout.astro`'s `<head>` sets `data-theme` from the
  saved choice or `prefers-color-scheme` before the body parses, and adds the
  `js` class the slideshow's pre-hide keys on. Its hash is in `script-src`.
  It sits in `<head>`, not beside the switch, so nothing paints in the wrong
  theme first.
- `src/components/ThemeSwitch.astro` is a `<button aria-pressed>` named "Light
  mode"; `src/scripts/theme-switch.ts` wires it and a press saves the choice.
- Without JavaScript the page is dark and the switch hidden.
- `HeroField.vue` reads its palette from its own element and rebuilds when a
  `MutationObserver` sees `data-theme` change. Its ground is `hero-ground`.
- `playwright.config.ts` sets `colorScheme: 'dark'`; specs that measure light
  set `colorScheme: 'light'` themselves (`light-mode.spec.ts`, `focus.spec.ts`,
  the talk scan in `a11y.spec.ts`).

### Token enforcement

`scripts/check-tokens.mjs` scans `src/` (comments ignored) and fails on:

- any Tailwind arbitrary value
- a raw hex outside `global.css`; `rgb()`, `rgba()`, `hsl()` or `hsla()`
  outside `@theme`
- px, rem or em in a declaration outside `@theme` (media conditions and zero
  allowed)
- spacing utilities off the 0, 1, 2, 3, 4, 6, 8, 12, 16, 24 scale
- border widths other than 0, 4, 8 (a bare `border` included)
- radius other than `rounded-nav`, `rounded-full`, `rounded-none`
- weights other than `font-normal`, `font-black`; Tailwind's own sizes,
  leading or tracking (`leading-none`, `tracking-normal` allowed)
- a removed outline
- an inline `style` attribute in a component
- a grid column count or split other than those in
  [STYLEGUIDE Grid](docs/STYLEGUIDE.md#grid)

`PENDING` lists pending exceptions and fails when one no longer matches.

Headings, alt text, focus rings and axe are checked on the rendered page by
`tests/headings.spec.ts`, `tests/alt-text.spec.ts`, `tests/focus.spec.ts` and
`tests/a11y.spec.ts`.

### Design reference

- Colours: [Colour tokens](docs/STYLEGUIDE.md#colour-tokens),
  [Contrast](docs/STYLEGUIDE.md#contrast),
  [Gold surface](docs/STYLEGUIDE.md#gold-surface).
- Typography: [Type scale](docs/STYLEGUIDE.md#type-scale),
  [Heading floors](docs/STYLEGUIDE.md#heading-floors),
  [Uppercase](docs/STYLEGUIDE.md#uppercase),
  [Soft hyphens](docs/STYLEGUIDE.md#soft-hyphens).
- Borders, shadows, radius:
  [STYLEGUIDE](docs/STYLEGUIDE.md#borders-shadows-and-radius).
- Component classes: [Components](docs/STYLEGUIDE.md#components).
- Page rules: [Sections](docs/STYLEGUIDE.md#sections-rhythm-and-grid),
  [Hero](docs/STYLEGUIDE.md#hero), [Posts](docs/STYLEGUIDE.md#posts),
  [States](docs/STYLEGUIDE.md#empty-loading-and-error-states),
  [Photo frames](docs/STYLEGUIDE.md#photo-frames-and-the-failed-photo-state).

## Content collection

`src/content.config.ts` defines `blog` (`glob()` over
`src/content/blog/*.md`, top level only) and [`talks`](#talks).

| Field            | Type              | Required     | Default |
| ---------------- | ----------------- | ------------ | ------- |
| `title`          | string            | yes          |         |
| `date`           | date              | yes          |         |
| `updated`        | date              | no           |         |
| `category`       | enum, see below   | yes          |         |
| `placeholder`    | boolean           | yes          |         |
| `tags`           | slug[], see below | no           | `[]`    |
| `teaser`         | string            | yes          |         |
| `featured`       | boolean           | no           | `false` |
| `readingTime`    | number            | no           |         |
| `seoTitle`       | string            | no           |         |
| `seoDescription` | string            | no           |         |
| `cover`          | image             | no           |         |
| `coverAlt`       | string            | with `cover` |         |
| `coverCardAlt`   | string            | no           |         |

- Categories: `skincare`, `travel`, `personal-thoughts`,
  `professional-journey`, `open-source`. Import `BLOG_CATEGORIES`.
- Accent, glyph and teaser per category: `CATEGORIES` in
  `src/lib/categories.ts`, read by every surface. Gold: `open-source`,
  `professional-journey`. Text: `skincare`, `travel`. Pink:
  `personal-thoughts`. Never cyan. `tests/blog.spec.ts` compares surfaces.
- Tags are kebab-case URL segments (`/blog/tag/<tag>/`). Proper-noun labels in
  `TAG_LABELS`. Tag `<h1>` is `text-h2`, since a tag cannot take a soft hyphen.
- A category page is built only once it has a published post. Tag listings
  are `noindex, follow` and excluded from the sitemap by
  `src/lib/sitemap-filter.ts` (`tests/sitemap.spec.ts`).
  `/contact/sent/` is `noindex`.
- Non-placeholder posts get `og:type` `article`,
  `article:published_time` and a `BlogPosting` JSON-LD node. Other pages are
  `website`.
- `cover` is relative to the post and shown only on a `feature` card; the
  schema requires `coverAlt` with it. `coverCardAlt` replaces `coverAlt` on
  the 1.91:1 `og:image` crop when the crop drops something `coverAlt` names.
- `updated` sets `dateModified`; absent, it is omitted, not copied from `date`.
- Pagination (`/blog/page/<n>`) builds only past `POSTS_PER_PAGE`.
- Every blog, category, tag, feed and Markdown-copy URL comes from
  `src/lib/paths.ts`, which imports nothing.
- `/llms.txt` and `[slug].astro` read with `getCollection`, not
  `getSortedPosts`, which drops placeholders ([rejected](#rejected-findings)).
  `tests/llms-txt.spec.ts` holds `placeholder` to each post's text.

### Feeds

- `/rss.xml` (all published posts) and `/blog/tag/<tag>/rss.xml`, RSS 2.0 from
  `src/lib/feed.ts`, with `atom:link rel="self"` and RFC 822 dates.
- The Drupal tag feed is the one for Drupal Planet.
- Placeholders are excluded. `tests/rss.spec.ts`.

### Markdown visitors

Sätteri hast visitors in `astro.config.mjs` `hastPlugins`.
`markdown.rehypePlugins` does nothing without `@astrojs/markdown-remark`,
which is not installed.

| Visitor                          | Marks                                               |
| -------------------------------- | --------------------------------------------------- |
| `src/plugins/link-list-item.mjs` | a list item that is only a link (SC 2.5.8)          |
| `src/plugins/post-figure.mjs`    | a post image: frame, sizer, `widths`, `sizes`       |
| `src/plugins/code-block.mjs`     | `<pre>` as `tabindex="0"` `role="group"` (SC 2.1.1) |

`group`, not `region`, so code blocks are not landmarks.

### Markdown sources and discovery

- Every published post is also served at `/blog/<slug>.md`
  (`src/lib/markdown-source.ts`), linked with
  `rel="alternate" type="text/markdown"`. It never reads image fields, which
  would ship the originals.
- `public/_headers` sends a `Link` header to `/llms.txt`, the sitemap and the
  feed. `tests/agent-readiness.spec.ts`.
- `robots.txt` (`src/pages/robots.txt.ts`) disallows AI training crawlers
  (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended) and allows
  everything else, search crawlers included. Cloudflare's managed robots.txt
  stays off so it cannot contradict this. `tests/sitemap.spec.ts`.

### Talks

One deck per talk, `src/content/talks/<deck>/slides.md`, Slidev Markdown
format, rendered by the site as a slideshow at `/talks/<deck>/`, a dev-only
presenter view and a PDF. Authoring rules:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#writing-a-talk).

- **Not Slidev.** Its output has no `<main>`, no slide-change announcement,
  nested buttons, a scaled fixed canvas, no reduced motion, nothing without JS,
  a public `/presenter/` and notes in the bundle, and an untagged PDF with no
  `/Lang` ([slidev#2426](https://github.com/slidevjs/slidev/issues/2426),
  [slidev#2273](https://github.com/slidevjs/slidev/pull/2273)).
- **Loader.** `src/lib/talk-loader.ts`, one entry per slide
  (`<deck>/<number>`). `src/lib/slides.ts` splits the file first (following
  Slidev's `packages/parser/src/core.ts`), then `renderMarkdown` runs the
  visitors above. Strict schema; anything the slideshow cannot render fails the
  build with file, slide and line.
- **Slideshow.** Every slide is a `.card` in `<section id="slide-N">`, all in
  the HTML. `src/scripts/slideshow.ts` adds controls, keys and a polite live
  region. Hidden slides use `data-current`, not `hidden`: Tailwind's
  `[hidden]` `!important` would stop print showing them. Focus stays on a bar
  control as a slide turns (APG carousel), scrolled back into view when a
  taller slide pushes it off screen.
  `tests/slideshow.spec.ts`, which also checks every slide fits 1280x720.
- **Presenter view.** `src/presenter/integration.mjs`, `astro dev` only, synced
  over `BroadcastChannel`. Notes load via `import.meta.glob` (no `node:fs` in
  the Cloudflare dev runtime). `tests/talk.spec.ts` checks no note is in the
  build.
- **PDF.** `scripts/publish-talk.mjs` prints one slide per 1280x720 page,
  then `scripts/tag-talk-pdf.py` fixes tags for PDF/UA-1. It prints with static
  Lexend 400/900 from `@fontsource/lexend` (dev only): the variable font
  becomes Type 3 and stalls veraPDF past CI's timeout. The PDF stores a
  SHA-256 of the deck; `tests/talk-pdf.spec.ts` fails on drift.
- **Images** live in `<deck>/images/`; reused site images are relative
  symlinks into `src/assets/`, covered by `scripts/check-untransformed.mjs`.
- The deck's four Lord of the Rings images are omitted: GIFs need a pause
  control, the captions do not stand alone, and licensing is unverified.

## Conventions

Commits, copy rules and process: [AGENTS.md](AGENTS.md).

### Code

- Comment `.astro` templates with `{/* … */}`. Authored `<!-- -->` ships
  verbatim. `tests/seo.spec.ts` fails on any in the build.
- Internal links end with `/`; production 307s the unslashed form.
  `tests/seo.spec.ts`.

### Tests

- A green check is evidence only once it has been shown to fail on its defect
  (fix removed, state forced, or defect restored).
- A validator is one reader. veraPDF passing does not mean a screen reader can
  read the PDF.
- Shared helpers: `tests/source.ts` (values read from the repo) and
  `tests/wcag.ts` (`MIN_TARGET`, `AXE_TAGS`, `REFLOW_VIEWPORT`). Read values,
  never copy them.
- **Route-list literals need a completeness guard.** Playwright collects before
  `webServer` builds, so a literal subset of `ROUTES` is unavoidable; a second
  test derives the real list from the build and fails when the literal falls
  behind. `FRAME_ROUTES` in `tests/failed-images.spec.ts` is the pattern.
- A guard that can match nothing needs a floor: two empty lists compare equal.
- **Route walks.** A check on built HTML is one test over `ROUTES` with
  `expect.soft`, pushing each route onto `checked` and asserting it equals
  `ROUTES`. A check that drives a browser stays one test per route.
- A count in a comment states its unit.
- A fact duplicated across Markdown files needs a check that fails when the
  copies disagree; otherwise keep one copy and link.

### Claims that rest on a platform setting

A public claim that depends on a dashboard or plan setting (retention, region,
mail forward) gets an entry in `src/lib/platform-facts.ts` with the page to
check and the date checked. `tests/platform-facts.spec.ts` fails when one
lapses. A fact that cannot drift gets a comment instead (D1's EU jurisdiction
in `wrangler.jsonc`).

## Assets

- **The suffix names the artwork colour.** `-dark` is `#111111` artwork (goes
  on gold or light); `-white` is `#FFFFFF` artwork (goes on dark). The wrong
  pairing renders invisible.
- `src/assets/`: rendered artwork, through `astro:assets`, WebP, hashed into
  `/_astro/`, cached immutably. Unimported files are not emitted.
- `public/images/`: stable URLs for outside consumers (Open Graph PNGs).
- `artwork/`: source artwork the build never reads (the Lepus Ridet badge,
  the `favicon.ico` frames). Nothing in it ships.

| Path                           | Artwork   | Goes on              | Used by                                                       |
| ------------------------------ | --------- | -------------------- | ------------------------------------------------------------- |
| `src/assets/bunny-dark.png`    | `#111111` | Gold, light surfaces | `Header.astro` logo tile, `Roundel.astro`, `404.astro`, About |
| `artwork/badge-white.png`      | `#FFFFFF` | Dark surfaces        | Nothing; the Lepus Ridet badge                                |
| `public/images/og-default.png` | Composite | n/a                  | `BaseLayout.astro`, every page                                |

| Artwork             | on `#131313` | on `#1A1A1A` | on `#FFFFFF` | on `#FFC000` |
| ------------------- | ------------ | ------------ | ------------ | ------------ |
| `-dark`, `#111111`  | 1.02         | 1.08         | **18.88**    | **11.50**    |
| `-white`, `#FFFFFF` | **18.58**    | **17.40**    | 1.00         | 1.64         |

- `og-default.png`: 1200x630. Gold panel with the name and the tagline in two
  lines, `#131313` strip with the logo tile, Lepus and Ridet stickers on the
  seam. Drawn in Chromium with Lexend 900 and the site tokens. PNG in
  `public/` because scrapers need a stable URL and format.
- Every placement renders through `<Image>` at its drawn size with `DENSITIES`
  (1x, 2x). The roundel resizes, so it passes `widths` and `sizes`.
- A `.vue` component cannot reach `astro:assets`: call `getImage()` in Astro
  and pass the result as a prop.
- Footer links: seven sticker tiles with Simple Icons (CC0) paths, one
  `<symbol>` per link label in `src/assets/social-icons.svg`. The footer hare
  is an inline `aria-hidden` SVG coloured from `components/footer.css`. The
  footer runs no JavaScript.

### Photos and video

- Photos: `src/assets/photos/` (pages) and `src/assets/blog/<slug>/` (posts).
  Masters are JPEG, cropped to shape, 2x drawn size, metadata stripped.
- Fixed-size photos pass `DENSITIES`; fluid ones pass `WIDTHS` and `sizes`
  from `src/lib/image-densities.ts`. `WIDTHS` steps at most 1.5x; `sizes` is
  the real drawn width. `tests/image-size.spec.ts` fails on stretching,
  more than 1.5x oversize, or `sizes` over 1.1x.
- `/about` photo boxes match their file's ratio (hence CSS-column masonry). No
  text over photos.
- Markdown images: `post-figure.mjs` sets `layout: 'full-width'` so
  `image.breakpoints` applies. An image alone in a paragraph with a title
  becomes a `figure` with that `figcaption`.
- Markdown images are WebP only, by the owner's choice: Markdown renders
  `<img>`, not `<Picture>`, so `PHOTO_FORMATS` (AVIF first) does not reach them.
- Credits: `src/lib/credits.ts`, in order of preference (personal site,
  Drupal.org, LinkedIn). Captions and `/credits` read from it.
- **Video** goes in `public/videos/` (none published). Encode AV1 WebM, H.264
  MP4 fallback, WebP poster, WebVTT captions; max 25 MiB a file.
  - Workers static assets answer `Range` with a full `200`; Safari and iOS need
    `206`. So `/videos/*` is in `run_worker_first` and
    `src/lib/video-range.ts` serves one `bytes` range, `416` past the end,
    honours `If-Range`, else the whole file.
  - Sizes come from `__VIDEO_SIZES__` at build (the ASSETS binding streams
    without `Content-Length`). A re-encoded video needs a rebuild.
  - Slices go through `FixedLengthStream` so the `206` has a length.
  - Ranged responses keep the `_headers` rules.
  - `tests/video-range.spec.ts` runs under the Worker config; its end-to-end
    tests skip while no video exists.
  - Not dead code ([rejected](#rejected-findings)).

### The favicon set

- Tab icons (`favicon.*`, `artwork/favicon-*`): the header logo tile, with its
  `tile-edge` ring, 3deg tilt and `bunny` shadow, on a transparent ground.
- App icons (`apple-touch-icon`, `android-chrome-*`, `maskable-icon`): the mark
  on a full-bleed `#FFC000` square.

| Path                                | Size         | Notes                                                |
| ----------------------------------- | ------------ | ---------------------------------------------------- |
| `public/favicon.svg`                | vector       | Primary icon for modern browsers; source of the rest |
| `public/favicon.ico`                | 16 / 32 / 48 | Legacy fallback, three frames                        |
| `artwork/favicon-16x16.png`         | 16           | `favicon.ico` frame; filled silhouette               |
| `artwork/favicon-32x32.png`         | 32           | `favicon.ico` frame; filled silhouette               |
| `artwork/favicon-48x48.png`         | 48           | `favicon.ico` frame; line art                        |
| `public/favicon-96x96.png`          | 96           | Line art, linked from the head                       |
| `public/apple-touch-icon.png`       | 180          | Full-bleed; iOS rounds it, do not pre-round          |
| `public/android-chrome-192x192.png` | 192          | PWA icon, from the manifest                          |
| `public/android-chrome-512x512.png` | 512          | PWA icon, from the manifest                          |
| `public/maskable-icon-512x512.png`  | 512          | `purpose: maskable`, mark inside the 80% safe zone   |

- 16 and 32 are a filled silhouette at 1.25x the line art's size: line art
  turns to mush below 48px. Do not downscale the 96.
- Render the PNGs from `favicon.svg` in Chromium so the tilt and radius match
  the browser's.
- `favicon.ico` must hold 16, 32 and 48:

```sh
convert artwork/favicon-16x16.png artwork/favicon-32x32.png \
  artwork/favicon-48x48.png public/favicon.ico
identify public/favicon.ico   # must report three frames
```

- `tests/icons.spec.ts` checks every `sizes` attribute against the bytes.
- Do not use the RealFaviconGenerator pack: its `.ico` is a light mark on
  `#131313`, mismatching the gold PNGs.
- No light-scheme variants.

### The web app manifest

`/site.webmanifest` is generated by `src/pages/site.webmanifest.ts` so
`theme_color` reads `--color-background` via `src/lib/theme-color.ts`, matching
`<meta name="theme-color">`. `check-tokens` only scans `src/`, so no hex goes
in `public/`.

## Security headers

- `public/_headers` sets headers for static assets only; the build copies it to
  `dist/client/`. This section explains each header. Dashboard overrides:
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#cloudflare-settings).
- Worker responses do not get `_headers`; `src/worker.ts` adds its `/*` rule to
  each one, redirects and 403s included. Routes set only their Cache-Control.
- An on-demand route must be in `assets.run_worker_first`. Otherwise a
  navigation request (`Sec-Fetch-Mode: navigate`) to it is answered by the
  asset layer, and a POST gets 405. `tests/contact.spec.ts` sends that header.
- `/videos/*` is in `run_worker_first` for byte ranges
  ([Photos and video](#photos-and-video)).
- `/_image` is in `run_worker_first`: on-demand pages (the contact error pages)
  point images at the adapter's passthrough endpoint, which serves the original
  from `/_astro/`. Without it the asset layer answers with `404.html`.

### Rules and caching

- One rule per header name. Cloudflare applies every matching rule and
  comma-joins a repeated header: `same-origin, cross-origin` does not parse,
  and two CSPs are both enforced. `tests/headers-rules.spec.ts`.
- The exception is `Cache-Control`, which later rules detach with
  `! Cache-Control`. The asset worker applies rules in file order
  (`attachCustomHeaders` in `node_modules/miniflare/dist/src/workers/assets/`).
- `immutable` for a year on `/_astro/*` only: Vite content-hashes those names.
  An unhashed file there stays stale for a year in every browser that has it.
- Everything else gets `Cache-Control: no-transform` alone, so browsers
  revalidate against the ETag. `/vendor/*`, favicons and feeds detach it so
  Cloudflare compresses them; sitemaps and `llms.txt` would save under 1 KB.
  `/vendor/*` also caches for an hour: its URL is not hashed.
- `no-transform` keeps JavaScript Detections (forced on the Free plan) off
  pages: its inline script carries a per-request token no CSP hash allows, and
  it strips the ETag. The cost is uncompressed HTML, since no pattern
  separates page paths from assets. `npm run check:live` fails if the script
  returns or an asset arrives unencoded.

### Other headers

- HSTS: 180 days, `includeSubDomains`, no `preload`. Every subdomain needs TLS
  before it serves anything. Preload ships the host in browser releases and
  takes months to undo. The zone HSTS setting stays off
  ([DEPLOYMENT](docs/DEPLOYMENT.md#cloudflare-settings)).
  `tests/headers-rules.spec.ts` pins the max-age and asserts no preload.
- `Link`: `llms.txt` as `describedby`, the sitemap, and the feed as
  `alternate` (RFC 8288). `sitemap` is not a registered relation;
  specification.website's discovery checklist names it.
- `X-Robots-Tag: noindex` on `/blog/*.md`, a copy of each page. To close the
  whole site, use this header rather than `Disallow`: a crawler barred from a
  page never sees its noindex and can still list the URL.
- No `Cross-Origin-Embedder-Policy`: nothing uses `SharedArrayBuffer`, and it
  would break any future cross-origin subresource.
- No `Reporting-Endpoints`: there is no collector.

### Speculation rules

- `Speculation-Rules: "/speculationrules.json"`: a header-named file, so no
  inline hash. Prefetch on hover only, never prerender (would count Umami
  visits).
- Excludes `/contact/send/`, `/videos/`, PDFs, downloads.
- Served as `application/speculationrules+json` or Chromium ignores it.
  `tests/served-types.spec.ts`, `tests/headers.spec.ts`.

### The CSP

```text
default-src 'self';
script-src 'self' <3 sha256 hashes>;
style-src  'self' <1 sha256 hash>;
connect-src 'self' https://gateway.umami.is;
object-src 'none'; base-uri 'none';
form-action 'self'; frame-ancestors 'none';
upgrade-insecure-requests
```

- No `'unsafe-inline'`, no `'unsafe-eval'`. Everything is same-origin: fonts in
  `/_astro/`, Umami vendored under `/vendor/`, no embeds, no `data:` URIs, Vue
  runtime-only build.
- `connect-src` names Umami's collector; `tests/headers-rules.spec.ts` asserts it
  equals `UMAMI_HOST_URL` in `src/lib/analytics.ts`. See
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#umami).
- `vite.build.assetsInlineLimit: 0` so no script is inlined.
- `form-action 'self'`, never `'none'`: `'none'` silently blocks the contact
  form. Never `*`. A form posting to a new origin widens it to that exact
  origin and updates `tests/headers-rules.spec.ts` and this section in the same
  commit; so does loosening any directive now `'none'`.
- `tests/headers-rules.spec.ts` asserts each directive.

### The hashes go stale

Hashed inline blocks:

- On `/` only (the `HeroField.vue` island): the `client:load` loader, the
  `<astro-island>` hydration script, and the
  `astro-island,astro-slot,astro-static-slot{display:contents}` style.
- On every page: the theme script in `BaseLayout.astro`'s `<head>`.
- JSON-LD needs no hash (not executed).

An Astro upgrade can change a hash; the island then silently fails to hydrate
(console only). To regenerate:

1. `npm run build`
2. `npx playwright test tests/headers-rules.spec.ts`
3. Copy the hashes printed by the failure of
   `the csp allows exactly the inline blocks the build emits` into
   `public/_headers`. Never hand-edit a hash.

`npm run check:live` checks what Cloudflare actually sends.

## The contact form's honeypot

- A filled honeypot gets an identical success response and is discarded;
  `handleSubmission` logs it.
- Hidden with the `hidden` attribute ([rejected](#rejected-findings)). It
  catches naive fillers only; the no-JS form and static `/contact/` rule out
  timing checks and tokens.
- Volume is bounded by the `CONTACT_RATE_LIMIT` binding (`wrangler.jsonc`) per
  /64; fail-open paths are logged.

## Rejected findings

Review findings investigated and rejected. Do not re-raise without new
evidence.

- **Delete the video byte-range pipeline as dead code:** the next
  published video would not play in Safari and iOS, which need `206`.
- **Route `/llms.txt` through `getSortedPosts`:** it drops placeholder
  posts, and `/llms.txt` is the one surface meant to list them.
- **Use Astro's `security.csp`:** `@astrojs/cloudflare` lacks
  `adapterFeatures.staticHeaders`, so it adds a `<meta>` policy beside the
  header instead of replacing it. `frame-ancestors` is ignored in `<meta>`, and
  the header also covers PDFs, `llms.txt`, the sitemap and videos.
- **Set `package.json` `"license"` to `"MIT"`:** the code is MIT and the
  content is all rights reserved, so one SPDX identifier would mislabel the
  content. `SEE LICENSE IN README.md` is npm's form for that case.
- **Hide the honeypot with CSS instead of `hidden`:** if the
  stylesheet fails, a person sees the field and loses their message.
- **Make `/contact`'s "Or find me here" and "Write to me about" `h2`:** they
  are parts of the "Write to me" section, other ways to write and what to
  write about, so `h3` is the true outline.
- **Turn on `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`:**
  none of their errors is a bug. Every index is guarded at runtime (an empty
  deck throws, `Map.groupBy` groups are never empty); every optional-prop
  error passes `undefined` on purpose. `tsconfig.json` turns both off.
- **Replace `contact-env.ts`'s binding types with `wrangler types`:** its
  runtime types redeclare DOM globals (`Element`, `append`), breaking the
  client scripts sharing this program. Env-only output needs
  `@cloudflare/workers-types`. The hand-written types stay narrow, so tests
  fake bindings without casts.
- **Swap the cover's `<p>` for `<div>` in a rehype plugin, not a regex in
  `TalkSlide.astro`:** the input is the site's own cover, which the loader
  holds to text only; a plugin for one tag swap costs more than it saves.
- **Store a message and count the last hour in one D1 `batch()`:** a batch
  is one transaction, so a failed count would roll back the stored message;
  apart, a failed count only skips the hourly cap.
- **Stretch feed descriptions to Drupal Planet's 600 to 1000 characters:**
  [its guidelines](https://www.drupal.org/planet/guidelines) call that length
  "recommended", to keep long posts from flooding the page; the teaser stays.
- **Give the talk page one `h1` above the slides:** the cover slide's heading
  is the `h1` and every other slide carries its own `h2`; another would repeat
  the title.
- **Add a `BreadcrumbList` to the talk page:** pages outside `/blog` carry no
  breadcrumbs (`tests/breadcrumbs.spec.ts`); the link to the talk's post
  covers the way back.
- **Name the numbers in `hero-field-hare.ts`, and the bud, head and shadow
  ellipses in `hero-field.ts`, as constants:** they are drawing coordinates,
  geometry in the hare's own units, not tuning values.
- **Move every `href` in page markup into `paths.ts`:** a route used by code
  (redirects, nav, sitemap, `llms.txt`) is a constant there; a link in prose
  stays markup, and `tests/internal-links.spec.ts` fails on a broken one.
- **Cap stored contact messages across all senders:** the per-address limit
  cannot stop a flood spread over many addresses, but the worst case is a
  temporary 503 when D1's writes run out; nothing stored is lost or exposed.
- **Run Lighthouse in CI:** timing scores vary on shared runners.
  `tests/performance.spec.ts` gates script bytes and layout shift, the image
  and head specs gate formats, priority and font preload; Lighthouse runs by
  hand after a deploy ([DEPLOYMENT.md](docs/DEPLOYMENT.md)).
- **Add ESLint, or `checkJs` for the `.mjs` scripts:** the strictest tsconfig,
  `astro check` at hint level, `vue-tsc`, Prettier and the `check:*` scripts
  cover what a linter would. A `checkJs` run gave 156 errors, 147 of them
  implicit `any` or untyped `catch` variables, and no bug.
- **Fetch external links in CI:** the result depends on other sites' uptime,
  so the gate would fail for reasons outside the repository.
  `tests/internal-links.spec.ts` covers every same-origin link.
- **Emulate touch in the browser projects:** the menu, photo strip and
  slideshow use native buttons and links, which fire the same events for
  touch; pointer and keyboard runs already cover them.

## Content notes

- Homepage section headings, category descriptions and the `/blog` heading
  and standfirst are drawn from `/about` copy and may be rewritten.
- `/career` draws on the CV and `five-years-in-drupal.md` (`career.astro` marks
  which lines). /career is the full version and the CV PDF the shorter one, so
  wording may differ; dates, roles and employers must agree.
- **CV PDF** (`public/sinduri-guntupalli-cv.pdf`): always publish through
  `npm run publish:cv`
  ([docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#publishing-the-cv)), which scrubs
  Canva metadata and `/Lang`, fixes tags and keeps the structure tree
  (pikepdf, not Ghostscript). `tests/cv.spec.ts` asserts it.
- The CV portrait is decorative, with no alt text: the name H1 beside it
  carries the same information.
- The published CV shows the contact email, "Vienna, Austria" and the GitHub
  profiles on purpose. It has no phone number, street address or date of
  birth, and its metadata only a title and dates. Remove anything else in
  Canva before export: drawing over text leaves it in the text layer.
- **Post artwork.** A `feature` `BlogCard` without a `cover` shows
  `PlaceholderBox`. `/career` has no photo placement.
