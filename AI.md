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
| pink       | `#FF007A` | Tertiary accent            |
| darkcyan   | `#00363F` | Text on cyan backgrounds   |

Plus `header-bg` (`rgba(10, 10, 10, 0.94)`), used only by the sticky header.

`border` and `subtle` are contrast-critical and must not be changed without
re-verifying against all three surface colors, `#131313`, `#1A1A1A`, and
`#0E0E0E`. `#5A87A8` measures 4.84 / 4.53 / 5.02 and `#9BB4C6` measures
8.62 / 8.07 / 8.95. The border they replaced sat at 2.00 and failed WCAG 2.2
SC 1.4.11, which requires 3:1 for non-text contrast.

The palette is cool, not warm. Gold, cyan, and pink read more strongly against
blue than they did against the old brown, so use the accents sparingly.

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
| H1             | `clamp(44px, 9vw, 104px)`  | 900    | -0.05em  |
| H2             | `clamp(34px, 6.6vw, 76px)` | 900    | -0.05em  |
| H3             | `clamp(26px, 4.4vw, 56px)` | 800    | -0.04em  |
| Body           | `clamp(17px, 1.2vw, 19px)` | 300    | normal   |
| Label / tag    | `13px`                     | 900    | 0.1em    |
| Section number | `clamp(24px, 2.8vw, 32px)` | 800    | n/a      |

Headings are uppercase. Labels and tags are uppercase. Use `tracking-label-wide`
(0.14em) where a label needs more air.

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
- `.card` — surface background, `border-8`, 40px padding
- `.section-divider` — `border-b-8`
- `.label` / `.label-wide` — 13px / 900 uppercase, 0.1em / 0.14em tracking
- `.section-number` — `clamp(24px, 2.8vw, 32px)` / 800, pink

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

## Assets not yet in the repo

These paths are referenced in code but the files do not exist. Each renders a
broken image until it is supplied.

| Path                               | Referenced by      |
| ---------------------------------- | ------------------ |
| `public/images/og-default.png`     | `BaseLayout.astro` |
| `public/images/og-placeholder.png` | `example-post.md`  |

Footer social links are all `href="#"` placeholders: GitHub, LinkedIn,
Instagram, Email.

---

## Not built yet

Homepage, About, Career, Blog index, blog post, blog category, and Contact pages
are minimal stubs by design. `src/pages/blog/[slug].astro` and
`src/pages/blog/[category]/index.astro` both return an empty `getStaticPaths()`
and still need wiring to the `blog` collection.
