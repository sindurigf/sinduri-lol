# Architecture

The stack, the design system and the conventions behind sinduri.lol. Read this
before changing anything here.

## Stack

| Concern     | Choice                                      |
| ----------- | ------------------------------------------- |
| Framework   | Astro 7, static output                      |
| Interactive | Vue 3 via `@astrojs/vue`, islands only      |
| Styling     | Tailwind CSS 4 via `@tailwindcss/vite`      |
| Language    | TypeScript, `astro/tsconfigs/strict`        |
| Content     | Astro Content Collections, Markdown in repo |
| Hosting     | Cloudflare Workers static assets            |

The Vue integration runs with `features: { optionsAPI: false }`: every
component uses `<script setup>`, so that half of the runtime was only bytes in
the bundle every page loads.

`astro.config.mjs` deliberately sets no `trailingSlash`. `'always'` makes
`astro preview` answer 404 for `/about`, which every spec visits (measured
2026-09-11). Internal links carry the slash themselves instead.

### Two deviations from the original brief

1. **No `tailwind.config.mjs`.** Tailwind 4 is CSS-first, so all tokens live in
   the `@theme` block in `src/styles/global.css`. The legacy `@astrojs/tailwind`
   integration peers at `astro ^3 || ^4 || ^5` and cannot be used with Astro 7.

   That block is `@theme static`, not plain `@theme`. A plain block emits only
   the custom properties Tailwind sees something using, which is right for a
   utility framework and wrong for a design system: a declared token no page
   references yet is tree-shaken away, and `var(--color-…)` in a style
   attribute or a test then resolves to nothing with no error anywhere. That is
   how `--color-gold-muted` disappeared.

2. **`src/content.config.ts`, not `src/content/config.ts`.** Current Astro
   expects the collection config at the `src/` root with a `glob()` loader.
   Markdown posts still live in `src/content/blog/`.

## Design system

Neo-brutalist. Bold, editorial, heavy borders, hard offset shadows with zero
blur, uppercase typography, rotated accents.

**Dark mode only.** There is no light theme, no toggle, and deliberately no
`dark:` variant setup. Do not add one.

**No arbitrary values in components.** Every colour, size, shadow and radius
comes from a token. If you need something that does not exist, add a token.
`scripts/check-tokens.mjs` fails on a Tailwind arbitrary value or a raw hex
anywhere in `src/` outside `global.css`.

### Colours

| Token      | Hex       | Usage                      |
| ---------- | --------- | -------------------------- |
| background | `#131313` | Main background            |
| surface    | `#1A1A1A` | Cards, boxes               |
| deep       | `#0E0E0E` | Alternate sections, footer |
| border     | `#5A87A8` | All borders, cool mid blue |
| text       | `#E5E2E1` | Primary text               |
| muted      | `#D4C5AB` | Secondary body copy        |
| subtle     | `#9BB4C6` | Footer, captions           |
| gold       | `#FFC000` | Primary accent             |
| cyan       | `#00DCFD` | Secondary accent           |
| pink       | `#FF007A` | Borders, shadows, decor    |
| pinkText   | `#FF79B6` | All pink text, any size    |
| darkcyan   | `#00363F` | Text on cyan backgrounds   |

Plus `header-bg` (`rgba(10, 10, 10, 0.94)`), used only by the sticky header.

Those are the dark-surface tokens. There is a fourth surface, `gold` used as a
ground, and none of them work on it. See [The gold surface](#the-gold-surface).

`border` and `subtle` are contrast-critical and must not be changed without
re-verifying against all three surface colours. `#5A87A8` measures
4.84 / 4.53 / 5.02 and `#9BB4C6` measures 8.62 / 8.07 / 8.95. The two were
replaced for different reasons, which must not be conflated: `border` was a
conformance fix, since its predecessor `#504632` measured 2.00 on `#131313` and
failed SC 1.4.11; `subtle` was a palette decision, since its predecessor
`#9C8F78` already passed AA for text at 5.85 / 5.48 / 6.08.

The palette is cool, not warm. Gold, cyan and pink read more strongly against
blue than against the old brown, so use the accents sparingly.

#### The two pinks

The split is by role, not by size. The CSS variables are `--color-pink` and
`--color-pink-text`; the utilities are `bg-pink` / `border-pink` and
`text-pink-text`.

| Token      | Hex       | Ratios             | Allowed on                     |
| ---------- | --------- | ------------------ | ------------------------------ |
| `pink`     | `#FF007A` | 4.90 / 4.59 / 5.09 | Borders, offset shadows, fills |
| `pinkText` | `#FF79B6` | 7.66 / 7.18 / 7.96 | All pink text, at any size     |

`pink` is never used for text and `pinkText` is never used for a border or a
shadow. `#FF79B6` is AAA on all three surfaces at every size, so the rule needs
no reference to the large-text exemption and does not break if the type scale
changes. Do not merge the two tokens.

#### The gold surface

The Career hero and the closing band on `/contact` are `background: #FFC000`
with `color: #131313`. Gold is a light ground inside a dark-only palette and no
dark-surface token works on it. Measured against `#FFC000`:

| Token      | Hex       | on `#FFC000` | Needs | Result |
| ---------- | --------- | ------------ | ----- | ------ |
| `border`   | `#5A87A8` | 2.34         | 3.0   | FAIL   |
| `text`     | `#E5E2E1` | 1.27         | 4.5   | FAIL   |
| `muted`    | `#D4C5AB` | 1.03         | 4.5   | FAIL   |
| `subtle`   | `#9BB4C6` | 1.31         | 4.5   | FAIL   |
| `pinkText` | `#FF79B6` | 1.48         | 4.5   | FAIL   |
| `pink`     | `#FF007A` | 2.31         | 3.0   | FAIL   |
| `cyan`     | `#00DCFD` | 1.01         | 3.0   | FAIL   |

This is structural, not a bad pick. L(`#FFC000`) is 0.5896, so the readable
band sits below the ground: AAA needs a foreground luminance of 0.0414 or less.
On `#131313` the AAA band spans luminance 0.346 to 1.0; on `#FFC000` it spans 0
to 0.0414, nearly sixteen times narrower. Everything readable on gold is a
near-black.

The inverted set:

| Token            | Hex       | on `#FFC000` | Job                                     |
| ---------------- | --------- | ------------ | --------------------------------------- |
| `gold-text`      | `#131313` | 11.32        | Body copy, headings, **button borders** |
| `gold-muted`     | `#3A3020` | 7.88         | Secondary copy                          |
| `gold-border`    | `#22394D` | 7.27         | **Structural** rules, dividers, cards   |
| `darkcyan`       | `#00363F` | 8.00         | Links, and the one accent               |
| `gold-btn-label` | `#FFFFFF` | 1.64         | Label on the dark button fill only      |

These rows are a copy. The same table appears in
[ACCESSIBILITY.md](ACCESSIBILITY.md) and in the design system skill, and the one
authority for all three is the live CSS custom property.
`tests/gold-surface.spec.ts` parses all three and fails on any row that
disagrees with the running page.

`gold-border` is `#22394D` rather than flat `#131313` because both clear SC
1.4.11 several times over, so contrast did not decide it: `#22394D` keeps the
blue that carries every boundary elsewhere, and `#131313` is already
`gold-text`, so using it would paint every structural rule the colour of the
body copy.

`gold-border` does not govern every border on this surface. It governs
structural ones: section rules, dividers, card edges. **Button borders use
`gold-text`**, matching their own fill, because a navy outline around a solid
dark block would read as an outline this design does not have.

`gold-btn-label` is component-scoped and is the one token here that fails on
gold. It never touches gold: it sits on `.btn-gold-primary`'s `#131313` fill,
at 18.58. It is named for the button so pure white does not leak into body
copy, where `text` `#E5E2E1` is the deliberate choice, since white blooms on a
dark ground.

There is deliberately no `gold-subtle`: a third step would land near luminance
0.02 and be indistinguishable from `gold-text`.

**Build a gold section with `.surface-gold` and nothing else.** Four site-wide
rules are wrong on this ground and three fail silently: links are painted
`gold` by the base layer (1.00) and `cyan` on hover (1.01); the focus ring is
`gold`, and the 3px offset that saves it elsewhere does not help when the gap
is also gold; borders default to `border` (2.34); text defaults to `text`
(1.27). Neither `.btn-primary` nor `.btn-secondary` may be used there.
`.btn-gold-primary` and `.btn-gold-secondary` are the gold-surface pair, scoped
to `.surface-gold` so using one elsewhere renders it unstyled.

`.btn-gold-primary` carries a two-tone focus ring, an inner `#FFFFFF` flush to
its `#131313` fill (18.58) inside the `#131313` outline beyond the gold gap
(11.32), because its ring colour is its own fill colour and a single ring there
would rest entirely on the offset staying non-zero. It is the only control with
that problem.

### Typography

Lexend, self-hosted via `@fontsource-variable/lexend`. Variable on the `wght`
axis, so every weight from 100 to 900 comes from one file per subset, and this
site bundles one subset: the `@font-face` at the top of `src/styles/global.css`
names the latin file. Importing the package's own CSS instead emits all three
subsets, and latin-ext and vietnamese were never fetched (48,316 bytes,
2026-09-12). The CSS family name is `'Lexend Variable'`, not `'Lexend'`.
Licensed OFL-1.1. Do not switch to the Google Fonts CDN: this project is
self-hosted by design.

The scale is fluid via `clamp()` rather than breakpoint steps.

| Role           | Size                                    | Weight | Tracking |
| -------------- | --------------------------------------- | ------ | -------- |
| H1             | `clamp(33px, 9vw, 104px)`               | 900    | -0.05em  |
| H1, hero       | `clamp(33px, min(9vw, 13svh), 104px)`   | 900    | -0.05em  |
| H1, post title | `clamp(33px, 9vw, 80px)`                | 900    | -0.05em  |
| H2             | `clamp(26px, 5.6vw, 64px)`              | 900    | -0.05em  |
| H3             | `clamp(20px, 2.6vw, 32px)`              | 800    | -0.04em  |
| Sticker, hero  | `clamp(18px, min(2.1vw, 3.4svh), 30px)` | 800    | normal   |
| Body           | `clamp(17px, 1.2vw, 19px)`              | 400    | normal   |
| Label / tag    | `13px`                                  | 900    | 0.1em    |
| Section number | `clamp(21px, 2.4vw, 28px)`              | 800    | n/a      |

The scale is deliberately top-heavy: H1 is the display size, H2 and H3 are the
reading sizes.

**`H1, hero` and `H1, post title` are narrower versions of H1, not separate
scales**, and each must move with it. Both keep H1's 33px floor and `9vw`
middle term, so all three are identical wherever the floor bites, 305px and
400% zoom included.

- `--text-hero-h1` is the homepage hero's heading and nothing else. It is also
  capped against viewport height, because that hero is the one section asked to
  fit inside the viewport.
- `--text-post-h1` is the blog post heading and nothing else. Only its ceiling
  differs: a post title sits in that route's `max-w-3xl` measure, which stops
  growing at 768px while `9vw` keeps going, so at 104px a 12-character word
  overflows the column and `overflow-wrap: break-word` fires with no hyphen
  drawn. The first real post rendered "COMMUNITIE / S" at 1280px. 80px also
  puts the top of the scale on the ratio the bottom already uses, 80:64 = 1.25
  against 33:26 = 1.269.

`Sticker` is not a heading. It is the size of the two rotated brand words in
the homepage hero, and it is its own token so H3 could come down for lead
paragraphs and card titles without shrinking them with it. The hero uses
`--text-hero-sticker`, capped against viewport height as well as width, because
a decoration that ignores a short screen crowds the name.

**The two stickers are the same size as each other, and that is a decision.** A
matched pair reads as one mark; a mismatched pair reads as two unrelated
labels.

Headings are uppercase. Labels and tags are uppercase. Use `tracking-label-wide`
(0.14em) where a label needs more air.

#### The heading floors are a reflow constraint, not a taste call

Every route presents the same content box at a 320px viewport, because the
horizontal gutter is declared once as `.page-gutter` and applied to the header,
`<main>` and the footer rather than page by page. It is `px-4 sm:px-6`, and
only the base 16px is in this arithmetic, since `sm` is 640px:

| Viewport                          | Content box |
| --------------------------------- | ----------- |
| 305px (classic 15px scrollbar)    | **273px**   |
| 320px (overlay scrollbar, headed) | 288px       |

273px is the number to calibrate against. It is what a desktop user gets at
400% zoom, and `tests/reflow.spec.ts` asserts it directly.

**Do not zero the gutter below `sm` to win back 32px of box.** That was tried:
it bought a heading word on two category pages at the cost of every line of
body copy sitting flush against the screen edge on every phone. The floors
move; the gutter stays.

A single uppercased word is the whole risk, because nothing wraps it. Measured
in this build, headless Chromium, Lexend at weight 900 with -0.05em tracking,
as the rendered width of an `h1` at `width: max-content`:

| Word            |   36px |   34px |   33px |   32px | Largest floor it fits |
| --------------- | -----: | -----: | -----: | -----: | --------------------: |
| `PROFESSIONAL`  | 278.41 | 262.61 | 257.20 | 250.81 |               35.26px |
| `ACCESSIBILITY` | 286.61 | 270.91 | 261.56 | 258.20 |               34.24px |
| `WOODWORKING`   | 302.20 | 285.31 | 278.86 | 270.41 |               32.44px |
| `ANNOUNCEMENTS` | 329.61 | 313.91 | 304.56 | 294.20 |               29.55px |

H1 is **33px**. In the 273px box that leaves 15.80px for `PROFESSIONAL`, a real
blog category and the word that must never need help, and 11.44px for
`ACCESSIBILITY`. 34px is what the box arithmetic suggests at a glance, and
measurement rules it out: `ACCESSIBILITY` is 270.91px there, 2.09px inside the
box, the razor edge where any change to the font, the tracking or the scrollbar
width breaks it.

H2 is **26px**, and the wide step down from H1 is on purpose. The scale is
top-heavy above a viewport about 376px wide: `9vw` passes 26 × 1.3 = 33.8px at
375.6px, while H2 and H3 hold their 26px and 20px floors until 464px and 769px.

Do not "fix" the ratio by pulling H2 back to 29px; that reverses a decision
rather than correcting an error. What holds H2 up is the step down to H3, so an
H3 floor of 24px is also wrong: 26:24 is 1.083, near enough that the two look
like one size at 320px.

`ANNOUNCEMENTS` is deliberately not fitted: it needs a 29px H1 floor in this
box, no page uses it, and there is always a longer word. `WOODWORKING` is the
proof that character count is only a proxy: eleven characters, all wide, and it
overflows 273px at every floor above 32px.

Headings also set `hyphens: auto` and `overflow-wrap: break-word`; the latter is
what actually guarantees no horizontal overflow. Do not raise a floor without
re-running `tests/reflow.spec.ts`.

#### A display heading word over twelve characters takes a soft hyphen

Automatic hyphenation is inert here, because Chromium consults its lowercase
dictionary after `text-transform` and finds nothing for an uppercased word. A
soft hyphen (U+00AD) is not, because it is a DOM character rather than a
lookup: it survives the transform, wins over `break-word`, and paints a real
hyphen at the break. Display heading words over twelve characters take one, at
a syllable boundary. **Never set `hyphens: none` on a heading**, which is the
one thing that would disable it.

#### Weight

Body copy is weight 400 and never lighter. Weight 300 halates against the dark
background.

#### Uppercase

Uppercase is applied with `text-transform` in CSS and never typed uppercase in
the markup. The reason is **not** that this keeps the accessible name in
sentence case; it does not. Chromium exposes the transformed string, measured
at version 151: markup reading `About` yields the accessible name `"ABOUT"`.

The real reasons are that Firefox and WebKit do not apply `text-transform` to
the accessible name while Chromium does, so sentence case in the markup is the
only input safe under either behaviour; that the content stays editable,
copy-pasteable and searchable in its real casing; and that search engines and
social previews receive the true string. How a screen reader announces all-caps
varies by reader as well as by browser, and has not been tested here.

### Borders, shadows, radius

- Cards, and every box that reads as one: `border-8`
- Buttons: `border-4`
- Section dividers and band edges: `border-b-8` / `border-t-8`, rules across
  the layout rather than borders around a box
- Default border colour is the `border` token, set in the base layer, because
  Tailwind 4 defaults borders to `currentColor`
- Radius is `0` everywhere, with exactly two exceptions. The base layer sets
  `border-radius: 0` on every element, so both are opt-in, and any other radius
  is a bug.

  `rounded-nav` (14px) is the **softened-box** exception: the nav CTA button in
  `Header.astro` and `MobileMenu.vue`, the logo tile in `Header.astro`, and the
  larger copy of that tile at the head of `404.astro`. The third is the same
  object drawn twice, not a new use. The exception belongs to the logo tile
  wherever it is drawn; a tile that is not a copy of it does not qualify,
  however much it looks like one.

  `rounded-full` is the **circle and pill** exception: the spinning badge
  frame, the bunny roundels, `.pill`, and the disc behind the footer badge. A
  circle is a shape the comps draw, not a box with its corners taken off.

Hard offset shadow utilities, all zero blur and zero spread:

| Utility               | Value              |
| --------------------- | ------------------ |
| `shadow-hard-gold-8`  | `8px 8px 0` gold   |
| `shadow-hard-gold-6`  | `6px 6px 0` gold   |
| `shadow-hard-gold-4`  | `4px 4px 0` gold   |
| `shadow-hard-pink-12` | `12px 12px 0` pink |
| `shadow-hard-pink-8`  | `8px 8px 0` pink   |
| `shadow-hard-cyan-8`  | `8px 8px 0` cyan   |
| `shadow-hard-pink-6`  | `6px 6px 0` pink   |
| `shadow-hard-cyan-6`  | `6px 6px 0` cyan   |

### Component classes

Defined in `@layer components` in `src/styles/global.css`:

- `.btn-primary`: gold background, background-coloured text, `border-4`,
  `12px 12px 0` pink shadow, 13px / 900 / 0.1em uppercase
- `.btn-secondary`: surface background, text-coloured text, `border-4`,
  `6px 6px 0` gold shadow
- `.card`: surface background, `border-8`, 24px padding below `sm` and 40px
  from `sm` up. The split is a measure decision: at 40px a side the content box
  is 177px at a 305px viewport, where a real post title runs to six lines;
  24px leaves 209px
- `.section-rule`: a 96px x 8px bar at the head of a section, rotating through
  gold, cyan and pink. It must sit inside a column-width box, because a band is
  full-bleed and a rule placed directly in one aligns to the viewport instead.
  It replaced a full-bleed line between sections, which framed the page rather
  than punctuating it and was doing all the separating on its own (the grounds
  either side measured 1.039:1)
- `.nav-cta`: the navigation's call to action, in both the header row and the
  mobile dialog. It carries the identity and leaves the box to each call site.
  Its hover and current-page rules live in `@layer components` with it rather
  than as utilities in the markup, because `box-shadow` is one property and a
  `hover:` utility would replace the current-page ring while the pointer is
  over the control. `[aria-current='page']` draws
  `--inset-shadow-cta-current`, measured at 7.91 on the fill and 3.42 on the
  border
- `.label` / `.label-wide`: 13px / 900 uppercase, 0.1em / 0.14em tracking
- `.section-number`: `clamp(21px, 2.4vw, 28px)` / 800, `pinkText`
- `.page-gutter`: the horizontal gutter (`px-4 sm:px-6`), declared once and
  applied to the header, `<main>` and the footer. **The base `px-4` is a reflow
  constraint, not a spacing preference.** The heading floors are calibrated
  against the 273px box it leaves, so changing it, adding padding to a page
  container, or zeroing it below `sm` all invalidate that arithmetic
- `max-w-page`: the content column, `--container-page`, 80rem. Every column
  inside the header, `<main>` and the footer uses it, with the gutter on the
  outer element and this on the column inside. **That shared structure is the
  point**, not the width: applying the gutter inside one column and outside
  another reads identically below the column width and diverges by exactly one
  gutter above it, measured at 24px on `/about` at 1440px. Blog posts opt out
  with a narrower prose measure, and that exception list is derived from the
  build
- `.page-column` is not a thing. Do not add one; the column is the utility above
- `.skip-link`: the skip-to-content link, visible on focus
- `.band`: a full-bleed band inside `<main>`, breaking out of the gutter with
  negative margins and re-applying it. The four values duplicate `.page-gutter`
  and must move with it
- `.pill`: `rounded-full`, `border-4`, surface fill. A label in a frame, not
  interactive
- `.motion-toggle`: the 40px square SC 2.2.2 pause control. Appearance only;
  position comes from a second class
- `.prose`: the rendered-Markdown rules, since there is no typography plugin
- Page-specific sets, documented in place in `global.css`: `.hero*`,
  `.spin-badge` / `.spin-pace-*`, `.career-watermark`, and `.footer-*`
- `.surface-gold`, `.btn-gold-primary`, `.btn-gold-secondary`: the gold-ground
  set

Links are gold with no underline, and turn cyan on hover, set in the base
layer, so plain `<a>` elements are already correct.

## Content collection

`src/content.config.ts` defines one collection, `blog`, loaded with `glob()`
from `src/content/blog/**/*.md`.

| Field            | Type            | Required | Default |
| ---------------- | --------------- | -------- | ------- |
| `title`          | string          | yes      |         |
| `date`           | date            | yes      |         |
| `category`       | enum, see below | yes      |         |
| `tags`           | string[]        | no       | `[]`    |
| `teaser`         | string          | yes      |         |
| `ogImage`        | string          | no       |         |
| `featured`       | boolean         | no       | `false` |
| `readingTime`    | number          | no       |         |
| `seoTitle`       | string          | no       |         |
| `seoDescription` | string          | no       |         |

Categories: `skincare`, `travel`, `personal-thoughts`, `professional-journey`,
`open-source`. Exported as `BLOG_CATEGORIES`: import it rather than retyping
the list.

Eleven posts, across all five categories. One,
`open-source-is-not-just-code.md`, is real. **The other ten are lorem ipsum**,
seeded so the listing has something to exercise: the index paginates at
`POSTS_PER_PAGE`, 9, so eleven is the smallest count that makes a second page
exist, and the titles, teasers, `featured` flags and `readingTime` values
deliberately span both extremes, so a card is tested at a ten-character title
and at a seventy-character one.

Every placeholder is dated before the real post, on purpose. Listings are
newest first, so that date is what puts the real post at the head of `/blog`,
of `/blog/open-source` and of the homepage featured row. A placeholder dated
after 2026-07-10 pushes it down again.

The lorem is Latin inside a `lang="en"` document, recorded as a known gap in
[ACCESSIBILITY.md](ACCESSIBILITY.md) §7.

`consectetur-adipiscing-elit.md` carries a literal U+00AD in its frontmatter
title, which is the only form that survives there. The character is invisible
in an editor, and writing `&shy;` instead builds to a visible `&SHY;` on the
page.

## Conventions

The commit format, the copy rules and the working process are in
[AGENTS.md](AGENTS.md).

### Code

- Comment `.astro` templates with JSX comments, `{/* … */}`. Astro emits an
  authored `<!-- -->` comment verbatim: they were 43.8% of the built HTML
  (measured 2026-09-11). `tests/seo.spec.ts` fails on any in the build.
- Internal links end with a trailing slash. Every page is built as
  `<route>/index.html`, so production answers an unslashed link with a 308.
  `tests/seo.spec.ts` fails on any that does not.

### Tests

Every rule here exists because the suite has already been green while covering
less than it claimed. A test that cannot fail is worse than a missing one: it
occupies the space where the missing one would have been noticed.

Shared helpers live in `tests/source.ts` (values read out of the repository)
and `tests/wcag.ts` (`MIN_TARGET`, `AXE_TAGS`, `REFLOW_VIEWPORT`). Read a value
rather than copying it, so a stale copy cannot make an assertion pass.

**A route-list literal needs a completeness guard.** Several specs walk a
hardcoded subset of `ROUTES`. The literal cannot be removed: Playwright
collects test files before the `webServer` command builds the site, so deriving
the list at module scope would read an absent or stale `dist/`. What is
required is a second test that derives the real list from the build and fails
when the literal has fallen behind.

- `GOLD_ROUTES` in `tests/gold-surface.spec.ts` is the pattern to copy. Its
  invisible-control walk short-circuits on a page with no `.surface-gold`
  section, so every route returned `[]` and passed for the whole time no page
  used the class.
- `BADGE_ROUTES` in `tests/motion.spec.ts` is the case that shipped: the list
  said `['/']`, Contact grew a second `SpinBadge`, and its pause control had no
  SC 2.2.2 coverage while the suite reported green.

A guard that can itself match nothing needs a floor, because comparing two
empty lists passes.

**A route walk is one test, unless it needs a browser.** A check that reads
built HTML has nothing per-route to isolate, so it walks `ROUTES` inside a
single test using `expect.soft`, which names every failing route in one run
rather than stopping at the first. A check that drives a browser stays one test
per route: merging them would let a crash on one route hide the rest and would
lose per-route retry.

Every collapsed walk pushes each route it visits onto a `checked` array and
asserts that array equals `ROUTES` at the end. Comparing two empty lists passes,
so without that floor an empty route list would leave the test green while
checking nothing.

**Prove a new test fails, and record it.** Remove the fix, run the test, watch
it fail, restore the fix, watch it pass. Then write what happened into the
spec's comment: what was broken, which assertion caught it, what the failure
said. An untested assertion is a claim, and this repo does not ship claims as
tests.

**A count in a comment states its unit and its date.** A bare number rots
silently, because nothing recomputes it and it still reads correctly. Three
notes once quoted counts that were true when written; two had gone stale
against a route list that tripled, and one, "69 overflow assertions", had never
been the unit it named. Write "92 overflow assertions, meaning calls to
`expectNoHorizontalOverflow`, measured 2026-09-05", or write no number.

**A fact duplicated across Markdown files needs one enforced source of truth.**
Do not copy a measured value into a second document without a check that fails
when the copies disagree. The gold contrast table is written out in this file,
[ACCESSIBILITY.md](ACCESSIBILITY.md) and the design system skill; the enforced
source is the live CSS custom properties. Without a check, prefer one copy and
a link from the other files.

## Assets

**The suffix names the artwork colour, not the target surface.** The `-dark`
files are RGB(17, 17, 17) artwork on transparency, and the `-white` files are
RGB(255, 255, 255) artwork on transparency. So a `-dark` file goes on a light
surface and a `-white` file goes on a dark one. The wrong pairing does not
error, it renders a mark nobody can see.

**The two directories mean different things.** `src/assets/` is for artwork the
site renders: it goes through `astro:assets`, is converted to WebP,
content-hashed into `/_astro/` and cached immutably by `public/_headers`.
`public/images/` is for URLs something outside the site depends on, today only
the Open Graph images, which scrapers fetch, so they stay PNG at a stable
address. A file in `src/assets/` that nothing imports is not emitted at all.

| Path                           | Artwork                 | Goes on              | Used by                                                                            |
| ------------------------------ | ----------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `src/assets/bunny-dark.png`    | Dark, RGB(17,17,17)     | Gold, light surfaces | `Header.astro` logo tile, `404.astro`, homepage, About                             |
| `src/assets/badge-dark.png`    | Dark, RGB(17,17,17)     | Gold, light surfaces | Career hero watermark                                                              |
| `src/assets/bunny-white.png`   | White, RGB(255,255,255) | Dark surfaces        | Reserved. Not emitted                                                              |
| `src/assets/badge-white.png`   | White, RGB(255,255,255) | Dark surfaces        | `Footer.astro`, `SpinBadge.vue`, and the source the OG images were composited from |
| `public/images/og-default.png` | Composite               | n/a                  | `BaseLayout.astro`, every page                                                     |

Measured ratios for the two artwork colours, so the pairing is arithmetic
rather than judgement:

| Artwork             | on `#131313` | on `#1A1A1A` | on `#0E0E0E` | on `#FFC000` |
| ------------------- | ------------ | ------------ | ------------ | ------------ |
| `-dark`, `#111111`  | 1.02         | 1.08         | 1.02         | **11.50**    |
| `-white`, `#FFFFFF` | **18.58**    | **17.40**    | **19.30**    | 1.64         |

Each variant is invisible on the surfaces the other one is for. That is not low
contrast, it is nothing at all, and it is why the header logo puts the dark
bunny on a gold tile rather than straight on the page. Check any new pairing by
measurement before shipping it.

**No placement ships a master.** Each passes the size it is drawn at, its
Tailwind class in pixels, together with `DENSITIES` from
`src/lib/image-densities.ts`, and the build emits a 1x and a 2x file for it.
`tests/image-size.spec.ts` fails when a file is stretched past its box or is
more than 1.5x what the screen can show. The career watermark is the one
placement left at the master's size, because it is drawn at 700px from a 760px
file.

**`SpinBadge.vue` is the one exception to `<Image>`**, and not by preference.
`astro:assets` is a build-time Astro API that a `.vue` single file component
cannot reach, and a plain Vite import there would content-hash the original PNG
without converting it, leaving the largest image on the site as the only
unoptimised one. `src/lib/badge-image.ts` calls `getImage()` once, at the 160px
the badge is drawn on Contact, and `contact.astro` passes the result in as a
prop.

### Placements, and why nothing here is unused

Each is recorded so a future cleanup pass reads an intent rather than a missing
reference.

- `badge-dark.png` is the **Career hero watermark**: 700px wide, `opacity`
  0.09, `pointer-events: none`. It sits on the gold hero, which is what makes
  the dark variant the right one. Decorative, so `alt=""`. At that opacity it
  is a texture, and it must never become the only carrier of anything.
- `bunny-white.png` is the **dark-surface variant of the mark**. Nothing
  imports it yet, so the build emits no copy. Keep it in `src/assets/`: in
  `public/` it shipped 67,458 bytes to every visitor that no page could
  reference.
- `badge-white.png` is in the footer, and is the artwork inside the **spinning
  badge** on Contact. That badge auto-starts and runs past five seconds, so it
  carries the keyboard-operable pause control SC 2.2.2 asks for.

  The footer copy is `loading="lazy"` and below the fold, which caught a hole
  in `tests/headers.spec.ts`: its end-to-end check waits for every `/_astro/`
  asset the homepage declares, and an eager copy had been standing in for the
  lazy one. It now scrolls every image into view in turn, because jumping
  straight to the bottom passed over the About-teaser roundel, which Firefox
  then never requested.

`og-default.png` is 1200x630, built by compositing `badge-white.png` onto
`#131313` inside an 8px gold frame, and every page uses it. It stays in
`public/` as PNG on purpose: its URL is pasted into other people's link
previews and must not change, and a scraper is not a browser, so WebP is not
worth a card that renders as a blank box somewhere. The `ogImage` field stays
on the blog schema for the day a post brings its own.

Footer profile links are real: seven sticker tiles, each a link named by a
visually hidden label, with Simple Icons (CC0) paths from
`src/lib/social-icons.ts`. The footer badge is `badge-white.png` at 250px tall,
170px on a phone.

Its `alt` is `""` on purpose: the copyright line in the same footer already
reads "© 2026 sinduri.lol", so a name would announce the same thing twice.
**The alt belongs to the placement, not to the file.** The same asset standing
alone as the only carrier of the name needs a real alt.

The field is `src/assets/footer-field.svg`, a still drawing committed to the
repository and generated by `node scripts/footer-field.mjs` from
`src/lib/footer-field.ts`. The stems' colours are read from the `border`,
`subtle` and `muted` tokens, so retoning one means regenerating the file, and
`tests/footer.spec.ts` fails until someone does. The footer runs no JavaScript;
the hare is an inline SVG that CSS places in the field.

### The favicon set

The mark on a full-bleed `#FFC000` square. These are the one group of assets
that are not transparent artwork, so the suffix rule does not apply: each file
carries its own gold ground.

| Path                                | Size         | Notes                                              |
| ----------------------------------- | ------------ | -------------------------------------------------- |
| `public/favicon.svg`                | vector       | Primary icon for modern browsers                   |
| `public/favicon.ico`                | 16 / 32 / 48 | Legacy fallback, genuinely multi-frame             |
| `public/favicon-16x16.png`          | 16           | Filled silhouette, not line art                    |
| `public/favicon-32x32.png`          | 32           | Filled silhouette, not line art                    |
| `public/favicon-48x48.png`          | 48           | Line art                                           |
| `public/favicon-96x96.png`          | 96           | Line art, linked from the head                     |
| `public/apple-touch-icon.png`       | 180          | Full-bleed; iOS rounds it, do not pre-round        |
| `public/android-chrome-192x192.png` | 192          | PWA icon, from the manifest                        |
| `public/android-chrome-512x512.png` | 512          | PWA icon, from the manifest                        |
| `public/maskable-icon-512x512.png`  | 512          | `purpose: maskable`, mark inside the 80% safe zone |

**16 and 32 are a filled silhouette on purpose.** The mark is thin outline art
and below 48px the strokes fall under one pixel and turn to mush. Do not "fix"
the small sizes by downscaling the 96.

**`favicon.ico` must hold all three of 16, 32 and 48.** A one-frame `.ico` is
what `convert` writes from a single input, and it shipped that way once, under
a `sizes="32x32"` declaration a browser would have got a 16px image for.

```sh
convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico
identify favicon.ico   # must report three frames
```

`tests/icons.spec.ts` asserts this, and more usefully asserts that every
`sizes` attribute is true of the bytes on disk. Nothing else in the suite reads
image headers.

**There is a second favicon pack in circulation and it is the wrong one.** A
RealFaviconGenerator export has a correctly multi-frame `.ico`, which makes it
look like the better source. Its frames are a light mark on a `#131313` ground
while its own PNGs in the same folder are gold, so taking its `.ico` would flip
the tab icon between a dark square and a gold square depending on which file
the browser picked. Its 16px frame is also downscaled line art.

**No light-scheme variants.** This design is dark only, and a dark glyph on a
full-bleed gold square reads on a light and a dark tab strip alike.

### The web app manifest

`/site.webmanifest` is generated by `src/pages/site.webmanifest.ts` and is not a
file in `public/`. The reason is `theme_color`: the pack hardcodes `#FFC000`,
which disagrees with `<meta name="theme-color">`, since that emits
`--color-background`, so an installed app would paint its title bar gold over a
dark site and flash a yellow splash before every launch. Generating it reads
the token instead, via `src/lib/theme-color.ts`.

That module is also why neither file names a hex. `scripts/check-tokens.mjs`
only walks `src/`, so a colour written into `public/` is precisely the drift it
cannot see.

## Security headers

`public/_headers` is the only place response headers are set for static assets.
The build copies it to `dist/_headers`. The header table, the HSTS reasoning and
the dashboard settings that can change what ships are in [README.md](README.md).

**`_headers` does not reach responses generated by Worker code.** Cloudflare
applies it to static asset responses only, so any endpoint the Worker serves
sets its own headers in code.

### The CSP

    default-src 'self';
    script-src 'self' <2 sha256 hashes>;
    style-src  'self' <1 sha256 hash>;
    object-src 'none'; base-uri 'none';
    form-action 'self'; frame-ancestors 'none';
    upgrade-insecure-requests

No `'unsafe-inline'` and no `'unsafe-eval'`, and the site needs neither.
Everything it loads is same-origin: the fonts are bundled by Fontsource and
served from `/_astro/`, there is no third-party script, no analytics, no embed,
and no `data:` URI in the build. Vue ships as the runtime-only build, so
nothing compiles a template at runtime.

**`form-action` is `'self'`, and was `'none'` until the contact form landed.**
At `'none'` the browser blocks the submission of any form on the page, and the
failure is silent: nothing appears, the form looks like it submitted or like it
did nothing, and only the console carries the refusal. It lands hardest on the
people a contact form is for.

`tests/headers.spec.ts` now asserts the value, so it cannot drift back or
widen. Never `*`: the directive has to name the exact origin the form posts to.
`object-src`, `base-uri` and `frame-ancestors` stay `'none'`, which records
that the feature is unused rather than that it is banned.

### The hashes go stale, and that is the thing to know

Astro emits three inline blocks on every page: the `client:load` directive
loader, the `<astro-island>` element that hydrates `MobileMenu.vue`, and
`astro-island,astro-slot,astro-static-slot{display:contents}`. They have no
`src` to point at, so on a static host the only way to allow exactly those and
nothing else is by hash. The JSON-LD block needs none: `script-src` does not
govern a script the browser never runs.

Those hashes are build output. An Astro upgrade that changes one byte of that
runtime invalidates one, the browser refuses the script, the island never
hydrates, and **the mobile menu stops opening**, which is the only navigation a
desktop user has at 400% zoom. Nothing on the page shows it; the console does.

`tests/headers.spec.ts` hashes every inline `<script>` and `<style>` body in
`dist/`, skipping the JSON-LD block, fails on drift in either direction, and
then serves the built output under the real policy and drives a browser at it.
Do not hand-edit a hash. Re-run the suite and take the values from the failure
message.

What that suite cannot check is what Cloudflare actually sends, which can differ
from `_headers` because of the file's parsing or a dashboard setting. That is
`npm run check:live`.

## Not built yet

Every route is built. What is not real is the copy: every heading, paragraph,
card description, teaser and post body outside the lists below is lorem ipsum
at the length the comps' real copy occupies.

Two exceptions, both Sinduri's own words:

- The **tagline**, now the heading of the homepage About teaser.
- **`/career` entirely**, transcribed from the published CV. The page and the
  PDF have to be edited in the same commit: no test compares the sentences on
  the page against the sentences in the file.

Not lorem either, and not waiting:

- **The one real post**, `open-source-is-not-just-code.md`.
- **`/accessibility` and `/privacy`**, whose copy is factual disclosure rather
  than editorial.
- **The 404 page**, which is functional microcopy.

Still outstanding:

- **The CV PDF** is published as `public/sinduri-guntupalli-cv.pdf`. Anyone
  re-exporting it has to make both decisions again rather than inherit them.

  The metadata was scrubbed: a Canva export carries the template author's name
  in `/Author` and `dc:creator`, the template ids in `/Keywords`, Canva in
  `/Producer` and `/Creator`, and `/Lang (de-DE)` over English text, which is a
  screen reader announcing this CV in a German voice. The scrub overwrites those
  bytes in place, keeping the file length identical so no cross-reference offset
  moves and the structure tree survives; rewriting through Ghostscript would
  have dropped the tags. `tests/cv.spec.ts` asserts the metadata on every run,
  because a fresh export arrives with every field back and the rendered page
  looks identical.

  The visible text was a separate decision. The first export carried a phone
  number, a nationality and a visa status; what is published is a re-export with
  those taken out at source, the only removal that removes anything, since text
  drawn over in a PDF is still in the content stream. A city and an email
  address remain on purpose. That half has no test and cannot have one: read the
  PDF.

- **Every photograph.** Three slots are `PlaceholderBox`: the workspace square
  in the homepage About teaser, the About portrait, and the post artwork in
  `BlogCard`.

  The Career conference photo is not among them. `/career` has no placement for
  it at all. Adding that placement is a build decision about whether the section
  exists, not a matter of swapping a placeholder for a photograph.

- **Email notification for the contact form.** Submissions are stored in D1 and
  read from there. Routing one to a mailbox needs an Email Routing `send_email`
  binding and a verified destination address, neither of which can be exercised
  locally, so it is deliberately not written yet.
