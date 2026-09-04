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
Measured on all eleven built routes:

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

### Placeholder content

Never invent copy. Where real copy is missing, use text prefixed with
`PLACEHOLDER` so it is obvious at a glance and greppable.

---

## Assets

All referenced assets are now in the repo.

| Path                               | Used by            |
| ---------------------------------- | ------------------ |
| `public/images/bunny-dark.png`     | `Header.astro`     |
| `public/images/badge-white.png`    | `Footer.astro`, OG |
| `public/images/og-default.png`     | `BaseLayout.astro` |
| `public/images/og-placeholder.png` | `example-post.md`  |

`og-default.png` and `og-placeholder.png` are 1200x630, built by compositing
`badge-white.png` onto `#131313` inside an 8px gold frame. Use `badge-white`,
not `badge-dark`: the dark badge is near-black line art meant for the gold
tile, and it measures 1.04:1 against `#131313`, which is invisible.

Footer social links are real. The footer badge is placed: `badge-white.png` at
44px tall, `opacity-80`, in a 14px flex row to the left of the copyright line.

Its `alt` is `""` on purpose. Beside a copyright line that already reads
"© 2026 sinduri.lol", a name of "Sinduri — Lepus Ridet" would announce the same
thing twice. **The alt belongs to the placement, not to the file.** The same
asset standing alone as the only carrier of the name needs a real alt.

---

## Not built yet

Homepage, About, Career, Blog index, blog post, blog category, and Contact pages
are minimal stubs by design. `src/pages/blog/[slug].astro` and
`src/pages/blog/[category]/index.astro` both return an empty `getStaticPaths()`
and still need wiring to the `blog` collection.
