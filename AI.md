# AI.md

Context for AI sessions working on sinduri.lol. Read this before making changes
so the design system and conventions do not have to be re-explained.

---

## Stack

| Concern     | Choice                                      |
| ----------- | ------------------------------------------- |
| Framework   | Astro 7 (static output, no SSR adapter)     |
| Interactive | Vue 3 via `@astrojs/vue`, islands only      |
| Styling     | Tailwind CSS 4 via `@tailwindcss/vite`      |
| Language    | TypeScript, `astro/tsconfigs/strict`        |
| Content     | Astro Content Collections, Markdown in repo |
| Hosting     | Cloudflare Pages                            |

### Two deviations from the original brief

Both were confirmed before implementation.

1. **No `tailwind.config.mjs`.** Tailwind 4 is CSS-first. All tokens live in the
   `@theme` block in `src/styles/global.css`. The legacy `@astrojs/tailwind`
   integration peers at `astro ^3 || ^4 || ^5` and cannot be used with Astro 7.

   That block is `@theme static`, not plain `@theme`. A plain block only emits
   the custom properties Tailwind can see something using, which is right for a
   utility framework and wrong for a design system: a declared token that no
   page happens to reference yet is tree-shaken away, and `var(--color-…)` in a
   style attribute or a test then resolves to nothing with no error anywhere.
   That is not hypothetical; it is how `--color-gold-muted` disappeared. See
   the comment above the block.

2. **`src/content.config.ts`, not `src/content/config.ts`.** Current Astro
   expects the collection config at the `src/` root with a `glob()` loader.
   Markdown posts still live in `src/content/blog/`.

---

## Design system

Neo-brutalist. Bold, editorial, heavy borders, hard offset shadows with zero
blur, uppercase typography, rotated accents.

**Dark mode only.** There is no light theme, no toggle, and deliberately no
`dark:` variant setup. Do not add one.

**No arbitrary values in components.** Every color, size, shadow, and radius
comes from a token. If you need something that does not exist, add a token.

### Colors

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

Those are the **dark-surface** tokens. There is a fourth surface, `gold` used
as a ground, and none of them work on it. See [The gold surface](#the-gold-surface).

`border` and `subtle` are contrast-critical and must not be changed without
re-verifying against all three surface colors, `#131313`, `#1A1A1A`, and
`#0E0E0E`. `#5A87A8` measures 4.84 / 4.53 / 5.02 and `#9BB4C6` measures
8.62 / 8.07 / 8.95.

The two replacements were made for different reasons, and an earlier note here
conflated them:

- **`border` was a conformance fix.** Its predecessor `#504632` measured 2.00 on
  `#131313` and failed WCAG 2.2 SC 1.4.11 Non-text Contrast, which requires 3:1.
- **`subtle` was a palette decision.** Its predecessor `#9C8F78` measured
  5.85 / 5.48 / 6.08. It is text, so SC 1.4.3 applied, and it passed AA (4.5:1)
  on all three surfaces. It fell short of AAA (7:1). Swapping it for `#9BB4C6`
  was an upgrade from AA to AAA and an alignment with the cool palette, not a
  1.4.11 fix. `#9C8F78` never failed a success criterion.

The palette is cool, not warm. Gold, cyan, and pink read more strongly against
blue than they did against the old brown, so use the accents sparingly.

#### The two pinks

The split is by **role**, not by size. The CSS variables are `--color-pink` and
`--color-pink-text`; the Tailwind utilities are `bg-pink` / `border-pink` and
`text-pink-text`.

| Token      | Hex       | Ratios             | Allowed on                     |
| ---------- | --------- | ------------------ | ------------------------------ |
| `pink`     | `#FF007A` | 4.90 / 4.59 / 5.09 | Borders, offset shadows, fills |
| `pinkText` | `#FF79B6` | 7.66 / 7.18 / 7.96 | All pink text, at any size     |

`pink` is never used for text and `pinkText` is never used for a border or a
shadow. `#FF79B6` is AAA on all three surfaces at every size, so the rule needs
no reference to the WCAG large-text exemption and does not break if the type
scale changes. Do not merge the two tokens.

#### The gold surface

The Career hero is `background: #FFC000` with `color: #131313`. It is a light
ground inside a dark-only palette and **no dark-surface token works on it.**
Measured against `#FFC000`:

| Token      | Hex       | Ratio | Needs | Result |
| ---------- | --------- | ----- | ----- | ------ |
| `border`   | `#5A87A8` | 2.34  | 3.0   | FAIL   |
| `text`     | `#E5E2E1` | 1.27  | 4.5   | FAIL   |
| `muted`    | `#D4C5AB` | 1.03  | 4.5   | FAIL   |
| `subtle`   | `#9BB4C6` | 1.31  | 4.5   | FAIL   |
| `pinkText` | `#FF79B6` | 1.48  | 4.5   | FAIL   |
| `pink`     | `#FF007A` | 2.31  | 3.0   | FAIL   |
| `cyan`     | `#00DCFD` | 1.01  | 3.0   | FAIL   |

This is structural, not a bad pick. L(`#FFC000`) is 0.5896, so the readable
band sits below the ground: AAA needs a foreground luminance of 0.0414 or less.
On `#131313` the AAA band spans luminance 0.382 to 1.0 (0.618); on `#FFC000` it
spans 0 to 0.0414 (0.041), **fifteen times narrower**. Everything readable on
gold is a near-black.

The inverted set:

| Token            | Hex       | on `#FFC000` | Job                                     |
| ---------------- | --------- | ------------ | --------------------------------------- |
| `gold-text`      | `#131313` | 11.32        | Body copy, headings, **button borders** |
| `gold-muted`     | `#3A3020` | 7.88         | Secondary copy                          |
| `gold-border`    | `#22394D` | 7.27         | **Structural** rules, dividers, cards   |
| `darkcyan`       | `#00363F` | 8.00         | Links, and the one accent               |
| `gold-btn-label` | `#FFFFFF` | 1.64         | Label on the dark button fill only      |

`gold-border` is `#22394D` rather than flat `#131313` because contrast did not
decide it: both clear 1.4.11 several times over. `#22394D` keeps the blue that
carries every boundary elsewhere, and `#131313` is already `gold-text`, so
using it would paint every structural rule the exact colour of the body copy.

**`gold-border` does not govern every border on this surface.** It governs
structural ones: section rules, dividers, card edges. **Button borders use
`gold-text`**, matching their own fill, because a navy outline around a solid
dark block would read as an outline this design does not have.

`gold-btn-label` is the one token here that is component-scoped, and the one
that fails on gold (1.64). It never touches gold: it sits on
`.btn-gold-primary`'s `#131313` fill, at 18.58. It is named for the button so
that pure white does not leak into body copy, where `text` `#E5E2E1` is the
deliberate choice, since white blooms on a dark ground.

There is deliberately no `gold-subtle`: a third step would land near luminance
0.02 and be indistinguishable from `gold-text`. `darkcyan` is the only accent
that survives; every other accent here is a light saturated hue picked for
near-black.

**Build a gold section with `.surface-gold` and nothing else.** Four site-wide
rules are wrong on this ground and three fail silently: links are painted
`gold` by the base layer (1.00) and `cyan` on hover (1.01); the focus ring is
`gold`, and the 3px offset that saves it elsewhere does not help when the
offset gap is also gold; borders default to `border` (2.34); text defaults to
`text` (1.27). Neither `.btn-primary` nor `.btn-secondary` may be used there;
`.btn-gold-primary` and `.btn-gold-secondary` are the gold-surface pair, scoped
to `.surface-gold` so using one elsewhere renders it unstyled.
`tests/gold-surface.spec.ts` measures all of it from the rendered DOM. The full
rules, including the button specifications and their measured ratios, are in
the design system skill.

### Typography

Lexend, self-hosted via `@fontsource-variable/lexend`, imported in
`BaseLayout.astro`. Variable on the `wght` axis, so every weight from 100 to 900
is available from one file per subset. The CSS family name is `'Lexend
Variable'`, not `'Lexend'`. Licensed OFL-1.1.

Do not switch to the Google Fonts CDN. The design comps reference it; this
project is self-hosted by design.

The scale is fluid via `clamp()` rather than breakpoint steps, so there are no
jumps between device sizes. Ceilings land at roughly a 1156px viewport.

| Role           | Size                       | Weight | Tracking |
| -------------- | -------------------------- | ------ | -------- |
| H1             | `clamp(33px, 9vw, 104px)`  | 900    | -0.05em  |
| H2             | `clamp(29px, 6.6vw, 76px)` | 900    | -0.05em  |
| H3             | `clamp(26px, 4.4vw, 56px)` | 800    | -0.04em  |
| Body           | `clamp(17px, 1.2vw, 19px)` | 400    | normal   |
| Label / tag    | `13px`                     | 900    | 0.1em    |
| Section number | `clamp(24px, 2.8vw, 32px)` | 800    | n/a      |

Headings are uppercase. Labels and tags are uppercase. Use `tracking-label-wide`
(0.14em) where a label needs more air.

The H1 and H2 floors are reflow constraints, not taste calls (SC 1.4.10).

Every route presents the same content box at a 320px viewport, because the
horizontal gutter is declared once as `.page-gutter` and applied to the header,
`<main>` and the footer rather than page by page. Below `sm` it is 16px a side.
Measured on all twelve built routes:

| Viewport                          | Content box |
| --------------------------------- | ----------- |
| 305px (classic 15px scrollbar)    | **273px**   |
| 320px (overlay scrollbar, headed) | 288px       |

273px is the number to calibrate against. It is what a desktop user gets at
400% zoom, and `tests/reflow.spec.ts` now asserts it directly by running a
fixed 305px viewport alongside 320px.

An earlier round zeroed the gutter below `sm` to win back 32px of box. That
bought a heading word on two category pages at the cost of every line of body
copy on every page sitting flush against the screen edge on every phone. The
floors move; the gutter stays.

A single uppercased word is the whole risk, because nothing wraps it. Measured
in this build, headless Chromium, Lexend at weight 900 with -0.05em tracking,
as the rendered width of an `h1` at `width: max-content`:

| Word            |   36px |   34px |   33px |   32px | Largest floor it fits |
| --------------- | -----: | -----: | -----: | -----: | --------------------: |
| `PROFESSIONAL`  | 278.41 | 262.61 | 257.20 | 250.81 |               35.26px |
| `ACCESSIBILITY` | 286.61 | 270.91 | 261.56 | 258.20 |               34.24px |
| `WOODWORKING`   | 302.20 | 285.31 | 278.86 | 270.41 |               32.44px |
| `ANNOUNCEMENTS` | 329.61 | 313.91 | 304.56 | 294.20 |               29.55px |

H1 is **33px**. In the 273px box that leaves 15.80px for `PROFESSIONAL` (5.8%
of the box) and 11.44px for `ACCESSIBILITY` (4.2%). `PROFESSIONAL` is a real
blog category, not a hypothetical, and it is the word that must never need
help.

34px is the number the box arithmetic suggests at a glance, and measurement
rules it out: `ACCESSIBILITY` is 270.91px there, 2.09px inside the box, 0.77%
of it. That is the same razor edge the old 38px floor sat on in the old 305px
box, where 1.72px of headroom meant any change to the font, the tracking or
the scrollbar width broke it.

H2 is **29px**. The word arithmetic is identical, so overflow alone would
allow H2 the same 33px; what holds it lower is the step down from H1, and what
holds it up is the step down to H3. 33:29 is 1.138 and 29:26 is 1.115, either
side of the 1.125 the old 36:32 pair held. 28px would read better against H1
and worse against H3: 28:26 is 1.077, near enough that the two look like one
size at 320px.

`ANNOUNCEMENTS` is deliberately not fitted. It needs a 29px H1 floor in this
box, no page uses it, and there is always a longer word. `WOODWORKING` is the
cheap proof that character count is only a proxy: eleven characters, all wide,
and it overflows 273px at every floor above 32px.

Headings also set `hyphens: auto` and `overflow-wrap: break-word`; the latter is
what actually guarantees no horizontal overflow. `tests/reflow.spec.ts` locks
this down. Do not raise a floor without re-running it.

Automatic hyphenation is inert here, because Chromium consults its lowercase
dictionary after `text-transform` and finds nothing for an uppercased word. A
**soft hyphen** (`&shy;`, U+00AD) is not, because it is a DOM character rather
than a lookup: it survives the transform, wins over `break-word`, and paints a
real hyphen at the break. Display heading words over twelve characters take
one, at a syllable boundary. **Never set `hyphens: none` on a heading**, which
is the one thing that would disable it. The design system skill carries the
rule and the authoring paths.

Body copy is weight 400 and never lighter. Weight 300 halates against the dark
background.

Uppercase is applied with `text-transform` in CSS and never typed uppercase in
the markup. The reason is **not** that this keeps the accessible name in
sentence case; it does not. Chromium exposes the transformed string, measured
at version 151: markup reading `About` yields the accessible name `"ABOUT"`.
The real reasons are that Firefox and WebKit do not apply `text-transform` to
the accessible name while Chromium does, so sentence case in the markup is the
only input that is safe under either behaviour; that the content stays
editable, copy-pasteable and searchable in its real casing; and that search
engines and social previews receive the true string. How a screen reader
announces all-caps varies by reader as well as by browser, and has not been
tested here. See the design system skill for the full rule.

### Borders, shadows, radius

- Cards and sections: `border-8`
- Buttons: `border-4`
- Section dividers: `border-b-8`
- Default border color is the `border` token, set in the base layer, because
  Tailwind 4 defaults borders to `currentColor`.
- Radius is `0` everywhere. `rounded-nav` (14px) applies to exactly two things
  and nothing else:
  1. the nav CTA button, in both `Header.astro` and `MobileMenu.vue`
  2. the logo tile in `Header.astro`

  Anything else with a radius is a bug. The base layer sets `border-radius: 0`
  on every element, so `rounded-nav` has to be opted into explicitly.

Hard offset shadow utilities, all zero blur and zero spread:

| Utility               | Value              |
| --------------------- | ------------------ |
| `shadow-hard-gold-8`  | `8px 8px 0` gold   |
| `shadow-hard-gold-6`  | `6px 6px 0` gold   |
| `shadow-hard-gold-4`  | `4px 4px 0` gold   |
| `shadow-hard-pink-12` | `12px 12px 0` pink |
| `shadow-hard-cyan-8`  | `8px 8px 0` cyan   |

### Component classes

Defined in `@layer components` in `src/styles/global.css`:

- `.btn-primary` — gold background, background-colored text, `border-4`,
  `12px 12px 0` pink shadow, 13px / 900 / 0.1em uppercase
- `.btn-secondary` — surface background, text-colored text, `border-4`,
  `6px 6px 0` gold shadow
- `.card` — surface background, `border-8`, 24px padding below `sm` and 40px
  from `sm` up (`p-card-tight sm:p-card`). Two numbers because the card is a
  box inside a box: 40px a side leaves a 177px content box at a 305px
  viewport, which breaks a card title mid-word. 24px leaves 209px. It steps up
  at the same breakpoint as the page gutter
- `.section-divider` — `border-b-8`
- `.label` / `.label-wide` — 13px / 900 uppercase, 0.1em / 0.14em tracking
- `.section-number` — `clamp(24px, 2.8vw, 32px)` / 800, `pinkText`

Links are gold with no underline, and turn cyan on hover. This is set in the
base layer, so plain `<a>` elements are already correct.

---

## Content collection

`src/content.config.ts` defines one collection, `blog`, loaded with `glob()`
from `src/content/blog/**/*.md`.

Frontmatter schema:

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
`open-source`. Exported as `BLOG_CATEGORIES` — import it rather than retyping
the list.

`src/content/blog/example-post.md` exists only to validate the schema. Delete it
once real posts land.

---

## Conventions

### Commits

Format: `type: Full sentence with a full stop.`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `perf`, `security`,
`config`, `revert`.

Example: `feat: Add Header component with sticky nav and active indicator.`

Commits are signed off (`git commit -s`). No AI attribution in commit messages.

### Code

- Functional style. No classes unless there is a clear reason.
- No magic numbers. Config or named constants only.
- Self-documenting code. Comments only where intent is not obvious.
- Validate external input at the boundary.
- Handle error paths explicitly. Never swallow errors.
- Check for an existing pattern before introducing a new one.
- Prefer stdlib or an existing dependency over adding a package. Ask before
  adding anything not already in `package.json`.

### Copy: two kinds, two different rules

"Never invent copy" was one rule covering two things that need opposite
treatment, and the 404 page is where that showed. Its body text was written
by an agent and then read as a violation of the placeholder rule, when it is
in fact the category that has to be written.

**Functional microcopy is agent-authored by default.** 404 body text, the skip
link, `aria-label`s and `aria-describedby` text, button and form-control
labels, error and validation messages, empty states, `alt` text, the visually
hidden text that gives a control its accessible name. Write it. Do not leave it
as `PLACEHOLDER`.

This text is part of how the interface works rather than part of what the site
says. A `PLACEHOLDER` skip link or a `PLACEHOLDER` error message is not a
neutral gap waiting to be filled: it is a broken control, and it is broken
specifically for the people who depend on it most. The 404 page is the clearest
case, which is why it is finished and the other stubs are not — a 404 that says
nothing useful is a dead end for someone who cannot see the layout and infer
what happened. Keep it plain, short, second person, and never blame the reader.

**Editorial copy is never invented.** Blog posts, About, Career, taglines,
project descriptions, bios, the homepage hero line, anything with a voice or a
claim about Sinduri. This stays `PLACEHOLDER`-prefixed until she writes it, so
it is obvious at a glance and greppable.

The test is whose voice it is. If the sentence could only be written by the
person whose site this is, it is editorial and it waits. If it would read the
same on any competent website, it is functional and it gets written now.

Where the two meet, split them. A Career section gets a real, working heading
structure and real control labels around `PLACEHOLDER` prose.

---

## Assets

All referenced assets are now in the repo.

**The suffix names the artwork colour, not the target surface.** Measured: the
`-dark` files are RGB(17, 17, 17) artwork on transparency, and the `-white`
files are RGB(255, 255, 255) artwork on transparency. So a `-dark` file goes on
a _light_ surface and a `-white` file goes on a _dark_ one. An earlier version
of this table had that inverted, which is an easy mistake to make and an
invisible one to ship: the wrong pairing does not error, it just renders a mark
nobody can see.

| Path                               | Artwork                 | Goes on              | Used by                                  |
| ---------------------------------- | ----------------------- | -------------------- | ---------------------------------------- |
| `public/images/bunny-dark.png`     | Dark, RGB(17,17,17)     | Gold, light surfaces | `Header.astro` logo tile, `404.astro`    |
| `public/images/badge-dark.png`     | Dark, RGB(17,17,17)     | Gold, light surfaces | Career hero watermark, see below         |
| `public/images/bunny-white.png`    | White, RGB(255,255,255) | Dark surfaces        | Reserved, see below                      |
| `public/images/badge-white.png`    | White, RGB(255,255,255) | Dark surfaces        | `Footer.astro`, Contact badge, OG images |
| `public/images/og-default.png`     | Composite               | n/a                  | `BaseLayout.astro`                       |
| `public/images/og-placeholder.png` | Composite               | n/a                  | `example-post.md`                        |

Measured ratios for the two artwork colours, so the pairing is arithmetic
rather than judgement:

| Artwork             | on `#131313` | on `#1A1A1A` | on `#0E0E0E` | on `#FFC000` |
| ------------------- | ------------ | ------------ | ------------ | ------------ |
| `-dark`, `#111111`  | 1.02         | 1.08         | 1.02         | **11.50**    |
| `-white`, `#FFFFFF` | **18.58**    | **17.40**    | **19.30**    | 1.64         |

Each variant is invisible on the surfaces the other one is for. That is not
"low contrast", it is nothing at all, and it is why the header logo puts the
dark bunny on a gold tile rather than straight on the page. **The gold surface
is the only ground this site has that a `-dark` asset can sit on**; see
[The gold surface](#the-gold-surface). Everything else takes `-white`.

An earlier version of this file quoted 1.04:1 for the dark artwork on
`#131313`. The correct figure is 1.02: 1.04 is what `#0E0E0E` measures there,
and the artwork is `#111111`. It changes nothing about the conclusion and it
is corrected because the number is quoted as a measurement.

**No reserved asset is unused. Do not delete them.** Each is a placement on a
page that is a stub today, recorded here so a future cleanup pass reads an
intent rather than a missing reference:

- `badge-dark.png` is the **Career hero watermark**: 700px wide, `opacity` 0.09,
  positioned `right: -150px; top: 20px`, `pointer-events: none`. It sits on the
  gold hero, which is what makes the dark variant the right one. Decorative, so
  it takes `alt=""`. At that opacity it is a texture, not an image, and it must
  never become the only carrier of anything.
- `bunny-white.png` is the **dark-surface variant of the mark**, for anywhere
  the mark sits directly on `#131313`, `#1A1A1A` or `#0E0E0E` rather than on a
  gold tile.
- `badge-white.png` is already in the footer, and is also the **Contact page
  spinning badge**, which sits on the dark background. That badge auto-starts
  and runs past five seconds, so building it means building a keyboard-operable
  pause control with it (SC 2.2.2); see `ACCESSIBILITY.md` §7.

Check any new pairing by measurement before shipping it, as with any colour
here.

`og-default.png` and `og-placeholder.png` are 1200x630, built by compositing
`badge-white.png` onto `#131313` inside an 8px gold frame. Use `badge-white`,
not `badge-dark`: the ground is `#131313`, and the dark badge measures 1.02:1
against it.

Footer social links are real. The footer badge is placed: `badge-white.png` at
44px tall, `opacity-80`, in a 14px flex row to the left of the copyright line.

Its `alt` is `""` on purpose. Beside a copyright line that already reads
"© 2026 sinduri.lol", a name of "Sinduri — Lepus Ridet" would announce the same
thing twice. **The alt belongs to the placement, not to the file.** The same
asset standing alone as the only carrier of the name needs a real alt.

---

## Security headers

`public/_headers` is the only place response headers are set. The build copies
it to `dist/_headers`, which is where Cloudflare Pages reads it. There is no
SSR adapter and no Pages Function, so nothing else is in the request path and
there is no request-time nonce to be had.

Measured against the deployed site on 2026-09-04, before this file existed,
Cloudflare Pages was already sending `x-content-type-options: nosniff` and
`referrer-policy: strict-origin-when-cross-origin` by default. Both are
declared here anyway, at the same values, so they are a property of this
repository rather than of a platform default that can change without notice.
There was no `Content-Security-Policy` at all, and that is the real addition.

### HSTS is set short, and it is the only header here that outlives itself

`Strict-Transport-Security: max-age=86400`, with **no `includeSubDomains`** and
**no `preload`**.

Every other header stops applying the moment it stops being sent. This one is
remembered: a browser that has seen it will refuse to reach this host over http
for the full `max-age`, and there is no way to shorten that after the fact. One
day is long enough to mean something and short enough that a mistake ages out
by tomorrow.

`preload` is the directive that cannot be walked back at all — it bakes the
host into browser binaries and removal takes months of release trains nobody
here controls — so it is omitted deliberately, not overlooked.
`includeSubDomains` is omitted because it would commit subdomains that do not
exist yet. Raise `max-age` only once the deployed setup has been proven stable,
and in steps. `tests/headers.spec.ts` asserts the ceiling and the absence of
both directives, so widening it requires editing the test in the same commit.
Full reasoning in README.

### The CSP

    default-src 'self';
    script-src 'self' <2 sha256 hashes>;
    style-src  'self' <1 sha256 hash>;
    object-src 'none'; base-uri 'none';
    form-action 'none'; frame-ancestors 'none'

No `'unsafe-inline'` and no `'unsafe-eval'`, and the site needs neither.
Everything it loads is same-origin: the fonts are bundled by Fontsource and
served from `/_astro/`, there is no third-party script, no analytics, no
embed, and no `data:` URI in the build. Vue ships as the runtime-only build,
so nothing compiles a template at runtime and nothing calls `eval` or
`new Function`.

**`form-action 'none'` is a claim about today, and it is a coupled change.**
There are no forms, so the safest value is free. **Adding a `<form>` with a
real submission target — the Contact page is the one that will want it —
requires widening this directive in the same commit, or the browser blocks the
submission.**

That failure is silent in three ways at once. Nothing appears on the page: the
form looks like it submitted, or like it did nothing, and only the console
carries the refusal. `tests/headers.spec.ts` does not catch it, because it
asserts there is no `'unsafe-inline'` and no hash drift, not what `form-action`
ought to permit. And it lands hardest on the people the form exists for:
`ACCESSIBILITY.md` §8 points people at the contact form to report a barrier, so
a submission that fails without saying so turns the reporting path into a
barrier of its own.

Widen it to the exact origin the form posts to, never to `*`; `form-action
'self'` if it posts same-origin. Add an assertion for the new value to
`tests/headers.spec.ts`, and update the header table in `README.md`, in the
same commit. The same applies to `object-src`, `base-uri` and `frame-ancestors`:
`'none'` there records that the feature is unused, not that it is banned.

### The hashes go stale, and that is the thing to know

Astro emits three inline blocks on every page: the `client:load` directive
loader, the `<astro-island>` element that hydrates `MobileMenu.vue`, and
`astro-island,astro-slot,astro-static-slot{display:contents}`. They have no
`src` to point at, so on a static host the only way to allow exactly those and
nothing else is by hash.

Those hashes are build output. An Astro upgrade that changes one byte of that
runtime invalidates one, the browser refuses the script, the island never
hydrates, and **the mobile menu stops opening**, which is the only navigation a
desktop user has at 400% zoom. Nothing on the page shows it; the console does.

`tests/headers.spec.ts` is what keeps that from shipping. It recomputes all
three hashes from `dist/`, fails on drift in either direction, and then serves
the built output under the real policy and drives a browser at it: the fonts
load, the island hydrates, the menu opens, and the browser reports no
violation. Do not hand-edit a hash. Re-run the suite and take the values from
the failure message.

The one thing that suite cannot check is Cloudflare's own parsing of
`_headers`. That is a `curl -I` against the deployed site; see README.

---

## Not built yet

Homepage, About, Career, Blog index, blog post, blog category, and Contact pages
are minimal stubs by design. `src/pages/404.astro` is not one of them: it is a
finished page, because what it does only works if it ships. `src/pages/blog/[slug].astro` and
`src/pages/blog/[category]/index.astro` both return an empty `getStaticPaths()`
and still need wiring to the `blog` collection.
