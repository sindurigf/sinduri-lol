---
name: sinduri-design-system
description: Design system rules for sinduri.lol - color tokens and their verified contrast ratios, typography, motion, navigation, focus, component choice, hydration, and radius. Use on every task that writes or reviews markup, CSS, or components in this repo, and before adding any new color, animation, or interactive element. Read alongside the frontend-a11y skill, which covers general accessible markup; this file covers only what is specific to this project.
---

# sinduri.lol design system

Neo-brutalist, dark mode only. No light theme, no `dark:` variants, no toggle.

Tokens live in the `@theme static` block in `src/styles/global.css`. There is
no `tailwind.config.mjs`; Tailwind 4 is CSS-first. The `static` keyword is
load-bearing: without it Tailwind emits only the custom properties it can see
something using, so a token nothing references yet is tree-shaken away and
`var(--color-…)` silently resolves to nothing. Do not drop it.

**Never write an arbitrary value in a component.** No raw hex, no `text-[32px]`,
no `shadow-[8px_8px_0]`. If the value you need does not exist, add a token.

`scripts/check-tokens.mjs` (`npm run check:tokens`, run in CI) scans `.astro`,
`.vue`, `.ts` and `.css` in `src/`, ignoring comments, and fails on:

- a Tailwind arbitrary value anywhere, `global.css` included;
- a raw hex outside `src/styles/global.css`, and `rgb()`, `rgba()`, `hsl()` or
  `hsla()` outside its `@theme` block;
- px, rem or em in a CSS declaration outside `@theme`: in `global.css` and in a
  component's `<style>`. A custom property definition, a media condition and
  zero are allowed, so a new length is a token;
- a margin, padding, gap or inset utility off the spacing scale, 0, 1, 2, 3,
  4, 6, 8, 12, 16 and 24: no half steps, no 5, 7, 10, 14, 20 or 28;
- an inline `style` attribute in an `.astro` or `.vue` file.

Its `PENDING` list holds the exceptions waiting on a decision, PageHero's
`lg:py-20` and the 404's `py-28`, and fails when an entry no longer matches,
so remove an entry with the code it excused. It does not catch radius.

---

## Colors

| Token        | Value     | Use                              |
| ------------ | --------- | -------------------------------- |
| `background` | `#131313` | Main background                  |
| `surface`    | `#1A1A1A` | Cards, boxes                     |
| `border`     | `#5A87A8` | All borders                      |
| `text`       | `#E5E2E1` | Primary text                     |
| `subtle`     | `#9BB4C6` | Footer, captions                 |
| `gold`       | `#FFC000` | Primary accent                   |
| `cyan`       | `#00DCFD` | Focus and hover only             |
| `pink`       | `#FF007A` | Borders, shadows, decor          |
| `pink-text`  | `#FF79B6` | All pink text, any size          |
| `darkcyan`   | `#00363F` | Links on the gold surface        |
| `joint`      | `#262F36` | Cast-block joints and bolts only |
| `bud`        | `#D4C5AB` | Homepage canvas buds only        |

The two **dark** surfaces are `#131313` and `#1A1A1A`. Every foreground color
must be checked against **both**, not just one. The header, the footer and
every band sit on `#131313`; there is no third, deeper ground.

`joint` is decoration, not a surface, but PageHero's text crosses it, in the
joints and in the bolts, so every foreground was measured on it too: the
lowest is `border` at 3.54, and `subtle` and `pink-text` drop from AAA to AA
there. `global.css` beside `--color-joint` and ARCHITECTURE.md carry the
numbers. A new foreground used in a hero is measured on it.

`bud` is not a text colour. Body copy is `text`, at 14.42 on the background.

**Those two are not the only surfaces, and the tokens above are not
universal.** There is a third: `gold` used as a ground rather than as an
accent. Not one foreground token in the table above passes on it except
`darkcyan`, which exists for links on that ground, and measures 8.00 on gold.
See [The gold surface](#the-gold-surface-the-dark-tokens-are-not-universal)
before building anything on `#FFC000`.

**Each colour has one job, read from the shadow a thing casts.** Gold is
things that stand on the page: cards, panels, a hero photo (`shadow-hard-gold-8`),
plus the page title, card labels and the primary fill. Pink is things you
press: buttons, link chips, the call to action (`shadow-hard-pink-4`), and the
bunny marks, which keep the locked logo tile's pink. Cyan is what you are
touching: focus, hover, and `shadow-hard-cyan-8` in place of the gold shadow on
a hovered linked card or contact card. A cyan label, fill or shadow at rest
would read as a control under the pointer. Where you are is not a colour: the
current nav item, mobile menu item and chip are a flat `bg-text` block with a
background-coloured label (14.42) and no shadow, like a `.badge`, and the
current call to action drops its shadow and keeps an inset ring, pressed in.
Links are `text`, underlined in running text.

### Contrast-critical tokens

`border` and `subtle` were chosen for contrast, not aesthetics. Do not change
them without re-verifying.

| Token    | on `#131313` | on `#1A1A1A` |
| -------- | ------------ | ------------ |
| `border` | 4.84         | 4.53         |
| `subtle` | 8.62         | 8.07         |

`border` carries every visible boundary in the design, so it is governed by
WCAG 2.2 SC 1.4.11 Non-text Contrast, which requires **3:1**. Its predecessor
`#504632` measured 2.00 and failed. Anything that replaces it must clear 3:1 on
both surfaces, and the numbers above must be updated in the same commit.

`subtle` is a different case, and the two are easy to confuse. It is text, so
SC 1.4.3 governs it, not 1.4.11. Its predecessor `#9C8F78` measured
5.85 / 5.48 / 6.08 and **passed AA on all three surfaces the site then had**;
it only fell short of AAA. Replacing it with `#9BB4C6` was an AA-to-AAA upgrade and a palette
decision, not a conformance fix. Do not describe it as one.

### Adding a color

Do all four steps, in order. Do not skip step 2 because a color "looks fine".

1. Add it as a token in the `@theme` block. Never inline it.
2. Measure it against `#131313` and `#1A1A1A`, and against `#FFC000` too if
   it will ever appear on a gold surface.
3. Meet the threshold for its job: **4.5:1** for body text, **3:1** for large
   text, borders, focus rings, icons, and any other non-text boundary.
4. Record the ratios in `ARCHITECTURE.md` next to the token.

The palette is cool. Gold, cyan, and pink read more strongly against blue than
they did against the warm brown that preceded it. Use accents sparingly.

---

## Contrast rules

### The two pinks

There are two pink tokens and they are split by **role**, never by size.

| Token       | Hex       | on `#131313` | on `#1A1A1A` |
| ----------- | --------- | ------------ | ------------ |
| `pink`      | `#FF007A` | 4.90         | 4.59         |
| `pink-text` | `#FF79B6` | 7.66         | 7.18         |

- **`pink` is decoration only.** Borders, hard offset shadows, decorative
  fills. It clears the 3:1 that SC 1.4.11 asks of non-text by a wide margin.
  **Never put `pink` on text.** Not on a heading, not on a section number, not
  on a label, not at any size.
- **`pink-text` is for every pink glyph on the site**, including category
  labels. It is AAA (7:1) on both surfaces at every size and weight.
  **Never use `pink-text` for a border, a shadow, or a fill.** Keeping it off
  non-text is what stops the two drifting back into one token.

```html
<!-- Yes -->
<span class="label text-pink-text">Personal thoughts</span>
<div class="border-4 border-pink shadow-hard-pink-8">…</div>

<!-- No -->
<span class="label text-pink">Personal thoughts</span>
```

The old rule made pink conditional on the text being 18.66px or larger, which
leaned on the WCAG large-text exemption. That held only while the type scale
did, and it contradicted `--text-section-number`, whose value at the time was
`clamp(24px, 2.8vw, 32px)`. It is now `clamp(21px, 2.4vw, 28px)`. The role
split has no size condition, so it cannot be invalidated by a change to the
scale.

Text tokens `text` and `subtle` both clear AAA on both surfaces.
Prefer them for anything readable that is not deliberately pink.

---

## The gold surface: the dark tokens are not universal

This site is dark-mode only and every foreground token was picked against
`#131313` and `#1A1A1A`. **There is one exception, and it is a real
section of the design, not a hypothetical.** The closing band on `/contact`
and the kindness quote on `/about` are `background: #FFC000` with
`color: #131313`: a light ground inside a dark-only palette.

**Measured against `#FFC000`, every dark-surface foreground token fails.**

| Token       | Hex       | on `#FFC000` | Needs |        |
| ----------- | --------- | ------------ | ----- | ------ |
| `border`    | `#5A87A8` | 2.34         | 3.0   | FAIL   |
| `text`      | `#E5E2E1` | 1.27         | 4.5   | FAIL   |
| `subtle`    | `#9BB4C6` | 1.31         | 4.5   | FAIL   |
| `pink-text` | `#FF79B6` | 1.48         | 4.5   | FAIL   |
| `pink`      | `#FF007A` | 2.31         | 3.0   | FAIL   |
| `cyan`      | `#00DCFD` | 1.01         | 3.0   | FAIL   |
| `gold`      | `#FFC000` | 1.00         | —     | itself |

Not one is close, and no amount of retoning fixes it. L(`#FFC000`) is 0.5896,
so the readable band on gold sits entirely _below_ the ground: AAA needs a
foreground luminance of 0.0414 or less. On `#131313` the AAA band runs from
luminance 0.346 to 1.0, a span of 0.654. On `#FFC000` it runs from 0 to 0.0414,
a span of 0.041. **The AAA band on gold is nearly sixteen times narrower.**
Everything readable on gold is a near-black.

### The inverted set

| Token            | Hex       | on `#FFC000` | Job                                     |
| ---------------- | --------- | ------------ | --------------------------------------- |
| `gold-text`      | `#131313` | 11.32        | Body copy, headings, **button borders** |
| `gold-muted`     | `#3A3020` | 7.88         | Secondary copy                          |
| `gold-border`    | `#22394D` | 7.27         | **Structural** rules, dividers, cards   |
| `darkcyan`       | `#00363F` | 8.00         | Links, and the one accent               |
| `gold-btn-label` | `#FFFFFF` | 1.64         | Label on the dark button fill only      |

These rows are a copy. `ARCHITECTURE.md` and `ACCESSIBILITY.md` carry the same table, and
the live CSS custom property is the one source of truth for all three:
`every documented gold ratio matches the live CSS` in
`tests/gold-surface.spec.ts` compares each hex and ratio here against the
running page and fails naming the file and line. Never hand-correct a number in
this table to make it agree with another document — re-measure, or change the
token and let all three fail together.

The first four are AAA on gold, and `gold-border` clears the 3:1 of SC 1.4.11
by 2.4x. `gold-btn-label` is the exception in that column: it is **1.64 on
gold and must never touch it**, because it never does. It sits on
`.btn-gold-primary`'s `#131313` fill, where it measures **18.58**. It is named
for the button rather than for a role because the site's text colour is `text`
`#E5E2E1`, and that softness is deliberate: pure white blooms on a dark ground.
That argument is about continuous prose, not about a 14px uppercase label on a
small control, and the component-scoped name is what stops `#FFFFFF` leaking
into body copy.

#### Two border tokens on this surface, split by what the border encloses

`gold-border` does **not** govern every border on gold. The split is:

| Border on gold                                 | Token         | Why                                                                 |
| ---------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| Structural rules, section dividers, card edges | `gold-border` | A boundary between areas; the blue keeps the site's identity.       |
| Button borders                                 | `gold-text`   | The border matches its own fill, so the control reads as one block. |

A navy outline around a solid dark button would read as an outline this design
does not have. Do not "correct" `.btn-gold-primary`'s border to `gold-border`:
`tests/gold-surface.spec.ts` asserts that the primary button's border colour
equals its own fill, precisely so that edit fails.

**`gold-border` is `#22394D`, not flat `#131313`.** Both clear the threshold
several times over, so contrast did not decide it. Two things did. `#22394D`
keeps the blue that carries every boundary elsewhere on the site, so a gold
section still reads as the same design. And `#131313` is already `gold-text`,
so using it for borders too would paint every rule in the exact colour of the
body copy, collapsing a figure/ground separation the dark set is careful about:
`border` `#5A87A8` is nowhere near `text` `#E5E2E1`.

**There is no `gold-subtle`, and adding one is not a small change.** A third
step between `gold-muted` (7.88) and `gold-text` (11.32) would land around
luminance 0.02, which is another near-black indistinguishable from both. Below
`gold-muted`, hierarchy on this surface is weight and size, not colour.

**Only one accent survives, and it is `darkcyan`.** Every other accent here is
a light saturated hue chosen to sit on near-black, and gold itself is the
ground. Do not reach for `cyan`, `pink` or `pink-text` on this surface at all,
including for a shadow: `pink` is 2.31, under the 3:1 a boundary needs.

### Build one with `.surface-gold`. Nothing else.

```html
<!-- Yes -->
<section class="surface-gold">
  <h2>Career</h2>
  <p class="text-gold-muted">PLACEHOLDER: secondary line.</p>
  <a href="/contact">Get in touch</a>
</section>

<!-- No: the dark set on a gold ground -->
<section class="bg-gold">
  <h2 class="text-text">Career</h2>
  <p class="text-subtle">…</p>
  <div class="border-8 border-border">…</div>
</section>
```

The class exists because **four site-wide rules are wrong on this surface and
three of them fail silently.** Applying `bg-gold` by hand gets none of them.

1. **Links.** The base layer paints every `<a>` `text`, which is **1.27** on
   this ground, and `cyan` on hover, **1.01**. Every link in a hand-rolled gold
   section is invisible. `.surface-gold` repaints them `darkcyan` and
   **underlines them**. The underline is not decoration: `darkcyan` measures
   only 1.42 against `gold-text`, far under the 3:1 that would let colour carry
   the distinction on its own, so the underline is what satisfies SC 1.4.1.
   Do not remove it.
2. **Focus.** The site's ring is `cyan`, which is **1.01** on gold. **On a
   large gold surface the offset gap is gold too, so the ring disappears
   entirely.** `.surface-gold` repaints it `gold-text` (11.32).
3. **Borders.** The base layer defaults every border to `border` `#5A87A8`,
   2.34 on gold. `.surface-gold` re-defaults the subtree to `gold-border`.
4. **Text.** `text` is 1.27 on gold, so the class sets the foreground rather
   than trusting each element to.

### Buttons on gold

**Neither `.btn-primary` nor `.btn-secondary` may be used on this surface.**
`.btn-primary` is `bg-gold`, so on this ground it is a 1.00:1 fill: an
invisible button identified only by its border. `.btn-secondary` carries
`border-border` (2.34 on gold) and a pink offset shadow (2.31 on gold).

Use `.btn-gold-primary` and `.btn-gold-secondary`, which are scoped to
`.surface-gold` so that using one anywhere else renders it unstyled — loudly
wrong rather than quietly wrong.

```html
<div class="surface-gold">
  <a class="btn-gold-primary" href="/cv.pdf" download>Download CV</a>
  <a class="btn-gold-secondary" href="/contact">Get in touch</a>
</div>
```

| Button      | Fill        | Label            | Border          | Shadow               |
| ----------- | ----------- | ---------------- | --------------- | -------------------- |
| `primary`   | `gold-text` | `gold-btn-label` | 4px `gold-text` | `shadow-hard-pink-4` |
| `secondary` | transparent | `gold-text`      | 4px `gold-text` | none                 |

Both are `text-button` (14px on a desktop, up to 16px on a phone) / weight 900
/ 0.1em / uppercase with 16px 32px of padding, the same as every other button. Measured, each colour against what it is actually adjacent to:

| Measurement                             | Ratio     | Needs |
| --------------------------------------- | --------- | ----- |
| Primary label on its own `#131313` fill | **18.58** | 4.5   |
| Primary fill against the gold ground    | **11.32** | 3.0   |
| Secondary label on gold                 | **11.32** | 4.5   |
| Secondary border on gold                | **11.32** | 3.0   |
| Primary inner focus ring on its fill    | **18.58** | 3.0   |
| Primary outer focus ring on gold        | **11.32** | 3.0   |

Four things about these that are easy to get wrong:

- **The pink shadow is decoration and nothing else.** `pink` measures 2.31 on
  gold, under the 3:1 of SC 1.4.11, and that is acceptable here only because
  the shadow carries no meaning: what identifies the control is its `#131313`
  fill against gold at 11.32. **Never let an offset shadow become the thing
  that delimits a control**, on this surface or any other. If the fill ever
  goes, the shadow does not inherit the job.
- **The padding is a conformance floor, not a spacing preference.** The label
  is `text-button`, 14px on a desktop and up to 16px on a phone; at
  line-height 1.2 that is a 16.8px to 19.2px line box. `16px` top and bottom
  and the 4px border take the rendered control to **56.8px to 59.2px**, well
  past the 24px SC 2.5.8 asks of a target on its own size. Measured on the
  Career hero while it was gold, at 305px, 320px and 1280px, with the 13px
  label it had then: 59.6px tall at all three, 226.2px and 197.6px wide. An earlier version of this note quoted
  51.6px as the rendered height, which is the padding box with the border left
  out; SC 2.5.8 measures the target, and the border is part of it.
  The comps' 18px and 34px were folded into the shared 16px and 32px, a 2px
  difference that needed two tokens of its own.
- **`.btn-gold-primary`'s focus ring is two rings, and it is the only one.**
  Its ring colour is its own fill colour, so a single ring depends entirely on
  the offset gap. See
  [A two-tone ring](#a-two-tone-ring-for-an-indicator-that-has-to-survive-two-backgrounds).
  Do not copy it to `.btn-gold-secondary`, which does not have the problem.
- **The button label is not underlined**, unlike every other link on this
  surface. The border and fill already distinguish it, so SC 1.4.1 is
  satisfied by the box rather than by the colour, and an underline under a
  0.1em-tracked uppercase label reads as damage.

A gold section is full-bleed, so it breaks out of `.page-gutter` with negative
inline margins and re-applies the gutter inside itself. See the `.page-gutter`
rule.

### The escape hatch, and the test that watches it

An explicit utility still beats the subtree default, because utilities come
after components in the cascade. That is intentional, and it is also the hole:
`class="border-border"` or `class="text-subtle"` written inside a gold section
is a bug no CSS can prevent.

**A rule engine will not catch this for you.** Measured twice, on a real route
rendering a `.surface-gold` section, both times with AAA enabled:

| Broken control                                | AccessLint result      |
| --------------------------------------------- | ---------------------- |
| `.btn-primary` on gold — 1.00:1 gold fill     | 0 violations           |
| `.btn-gold-secondary` with a `#FFC000` border | 0 violations, 95 rules |

Both controls had no visible edge anywhere on them. Contrast rules measure a
label against its own control's background, and `.surface-gold` repaints those
labels to something that passes, so the scan is clean while the button is not
there. **A green scan is not evidence about whether a control is visible**, on
either the fill case or the border case.

`tests/gold-surface.spec.ts` is what catches it. It measures from the rendered
DOM rather than matching class names, so it fails on the _outcome_:

- every route is walked for text sitting on a `#FFC000` effective background,
  and anything under 4.5:1 fails with the selector and the measured ratio;
- the ratios in this table are re-measured from the live CSS variables, so
  retoning any token here or in the dark set fails until every table in
  `ARCHITECTURE.md`, `ACCESSIBILITY.md` and this file is updated;
- every control inside a `.surface-gold` section is checked for being invisible
  as a shape, on **whichever of the two things delimits it**. An opaque fill is
  compared against the ground behind it, which is the `.btn-primary` case
  above. A fill that is transparent, or below full alpha, means the ground
  shows through and the **border** is the control's only boundary, so the
  border is compared instead, at the 3:1 of SC 1.4.11. That second arm exists
  because excluding a transparent fill by its alpha left `.btn-gold-secondary`
  unverified: it is delimited entirely by its border, so a border matching the
  ground makes it exactly as invisible as the fill case, for the same reason,
  and nothing else in the suite watches for it. **All four edges are measured.**
  Width and colour are set independently, so the narrowest edge is a proxy for
  nothing; verified by painting only `border-bottom-color` gold, which every
  other assertion in the file passed — the button test included, since it reads
  `borderTopColor`. A control with no declared border is not flagged: a link in
  prose is delimited by its colour and its underline, not by a boundary;
- `.surface-gold` itself is asserted for text, muted text, link colour, link
  underline, focus ring and border colour;
- both button classes are asserted for label, fill, border, focus ring, focus
  offset, absence of an underline, and SC 2.5.8 target size;
- `.btn-gold-primary`'s two-tone focus ring is asserted on its own: both rings
  and the pink offset shadow present at once, each ring's ratio pinned to the
  number the docs quote, and — the assertion the phase exists for — a visible
  ring remaining with `outline-offset` forced to `0`.

If you change a number on this page, run it.

---

## Typography

Lexend, self-hosted via `@fontsource-variable/lexend`, declared as one
`@font-face` at the top of `src/styles/global.css`: the latin subset only. The
CSS family is `'Lexend Variable'`, not `'Lexend'`. Variable on the `wght` axis,
100 to 900. Never load the Google Fonts CDN.

### Uppercase

**Apply uppercase with `text-transform` in CSS. Never type it uppercase in the
markup.**

```html
<!-- Yes -->
<a class="label" href="/about">About</a>

<!-- No -->
<a class="label" href="/about">ABOUT</a>
```

`.label`, `.badge`, `.btn-primary`, `.btn-secondary`, and every heading
already apply `text-transform: uppercase`. Write sentence case and let the CSS
do it.

#### Why, accurately

An earlier version of this rule claimed `text-transform` keeps the accessible
name in sentence case. **That is false and the rule should never be defended
that way.** Chromium exposes the _transformed_ string: measured in Chromium 151
via `Accessibility.getFullAXTree` on `/about`, source markup reading `About`
and `Get in touch` produced accessible names `"ABOUT"` and `"GET IN TOUCH"`.
Every link and heading in the a11y tree came back uppercased.

The practice is still right, for reasons that hold up:

- **Engine behaviour is inconsistent.** Firefox and WebKit do not apply
  `text-transform` to the accessible name; Chromium does. Writing sentence case
  is the only input that is safe under either behaviour, because it is the only
  one that never _forces_ caps into the name. Do not depend on a specific
  engine's choice here, in either direction.
- **The content stays real.** Sentence case in the markup stays editable,
  copy-pasteable, and searchable as written. Literal caps corrupt the content
  itself to achieve a visual effect.
- **Machines get the true string.** Search engines, social previews, and
  anything else reading the DOM receive `About`, not `ABOUT`.
- **Announcement is a screen-reader decision, not just a browser one.** How a
  reader handles an all-caps string varies by screen reader as well as by
  browser: some read the word, some spell it, some depend on verbosity
  settings.

**Do not claim caps "will be spelled out letter by letter."** That claim is too
strong, it is what made the old rule wrong, and nothing here has been verified
against an actual screen reader. What a user hears is untested; see the Orca
pass in `docs/MANUAL_TESTING.md` §6.

The vendored `frontend-a11y` skill states the spelled-out reason too, under
"Don't Write All Caps in HTML" and again in `references/css.md`. Those files are
vendored unmodified and must not be edited (see their `NOTICE`). **This section
supersedes them on the reason.** The practice they recommend is the same one, so
follow it; just do not repeat their justification.

### Weight

**Minimum weight 400 for body copy on dark backgrounds.** Weight 300 causes
halation: light strokes on a dark ground bloom and smear, which is worst for
readers with low vision or astigmatism. 300 is available on the axis; do not
use it for anything a person reads in continuous prose.

**Two weights, 400 and 900, and nothing between.** Reading text is 400;
headings, card titles, labels, buttons, names and quoted text are 900. There is
no `font-bold` or `font-extrabold` on the site.

### Scale

Every size is a token. Headings, body, the stickers and the glyph tile are
fluid via `clamp()`; `text-label` (14px) and `text-copyright` (20px) are fixed.
Do not add breakpoint steps.

| Role                   | Token                                     | Weight |
| ---------------------- | ----------------------------------------- | ------ |
| H1                     | `text-h1`                                 | 900    |
| H1, homepage hero      | `text-hero-h1`                            | 900    |
| H1, reading page       | `text-reading-h1`                         | 900    |
| H1, post title         | `text-post-title`                         | 900    |
| H2, in a post          | `text-post-h2`                            | 900    |
| H2                     | `text-h2`                                 | 900    |
| H3                     | `text-h3`                                 | 900    |
| Sticker, homepage hero | `--text-hero-sticker` via `.hero-sticker` | 900    |
| Body                   | `text-body`                               | 400    |
| Label / tag            | `text-label`                              | 900    |
| Copyright              | `text-copyright`                          | 900    |
| Footer name            | `text-footer-name`                        | 900    |
| Category glyph tile    | `text-section-number`                     | 900    |

H3 sets its line height, 1.1, from its token, and its tracking at
`--tracking-title` (-0.02em) rather than the -0.05em of H1 and H2.

Headings must not skip levels. One `<h1>` per page.

**`text-reading-h1` is the title of a reading page and nothing else**: Privacy
and Accessibility. Their PageHero uses `measure="reading"`, which puts the text
in the `max-w-3xl` measure, not the full page column, so these are the h1s on
the site sized against a box that stops growing at 768px while `text-h1`'s
`9vw` does not. PageHero applies it itself. Its floor and middle term are
`text-h1`'s own, so it changes nothing at 305px or at 400% zoom, where the
floor is what bites. `text-h1` in the same box broke `ACCESSIBILITY` as
`ACCESSIBIL / ITY` at 1440px. Do not use it for a title in the page column, and
do not lower it to 64px, which is `text-h2`'s ceiling.

**A blog post has its own, smaller scale**, because it reads as an article
rather than a page. `text-post-title` sets the title up to 60px in the case it
is written in, `text-post-h2` its section headings up to 36px, a step under
the title so the two never read as one size, and `text-post-h3`,
`clamp(19px, 2vw, 24px)`, a step under that. At the page scale a post opened
with a 104px title over 64px headings and read as a poster. Do not raise
either back to the page scale without asking; the smaller scale was the
request.

H3 came down from a 48px ceiling to 32px because it also sizes lead
paragraphs and card titles, which were reading as headings; the stickers are
decoration, so they were split off rather than dragged down — and then set to
the 30px the comp always specified, rather than the 48px the build had drifted
to. Reach for it only for a short decorative word in a box.

**A decoration belongs to the thing it decorates.** On the homepage the two
stickers are a column spread top and bottom against the right edge of the
content area, counterweighting the name in the opposite corner.
They used to hang off the corners of a 16:9 portrait frame; that frame is gone
and the canvas field behind them is now the whole hero, so they belong to the
composition rather than to one object in it. They are the same size as each
other on purpose: sized by depth, one near and one far, they read as two
unrelated labels rather than one mark.

**And it does not get to push that thing off the screen.** The homepage hero is
sized to fit the viewport, and the stickers size from `--text-hero-sticker`,
`clamp(18px, min(2.1vw, 3.4svh), 30px)`, which keeps the comp's 2.1vw sticker
term and 30px ceiling, adds a viewport-height cap and lowers the floor to 18px,
so they give space back on a short screen instead of crowding the name. From
`sm` up, 640px wide, they are the column; on a phone held upright they
drop into a row under the name. They used to be removed below
`lg` instead, on the reasoning that a column at 320px would overlap the
heading or be clipped, and that left the brand words missing from every phone
and tablet. What cannot be laid out on a phone is the column, not the
stickers: move a decoration before you delete it. `tests/hero-fit.spec.ts` measures that they never cover the
heading. If a decorative element's position is expressed
relative to the page rather than to the layout it sits in, that is the bug.

### The heading floors are a reflow constraint, not a taste call

`text-h1` floors at **33px** and `text-h2` at **26px**. Both numbers are
derived, not chosen. Do not raise either without redoing the arithmetic and
re-running `tests/reflow.spec.ts`.

The step from H1 to H2 is wide on purpose. H1 is the display size; H2 and H3
are the reading sizes. The scale is top-heavy above a viewport about **376px**
wide, where H1:H2 becomes the wider step: `9vw` passes 26 × 1.3 = 33.8px at
375.6px, while H2 and H3 hold their 26px and 20px floors until 464px and 769px.
Below it H1:H2 narrows to 1.269 (33:26, from 367px down) while H2:H3 stays
1.300 (26:20). Do not even out the ratio by raising H2.

**One content box, declared once.** The horizontal gutter is `.page-gutter`
(`px-4 sm:px-6`) and it is applied to the three landmarks: the header, `<main>`
in `BaseLayout.astro`, and the `<footer>` element. The no-JavaScript navigation after
the header carries it too. **Only the base `px-4` is
load-bearing.** `sm` is 640px, so at the viewports the floors are measured at,
only `px-4` applies; the `sm` step is ordinary spacing and can change freely.
Every route therefore presents the same box:

| Viewport                       | Content box |
| ------------------------------ | ----------- |
| 305px (classic 15px scrollbar) | **273px**   |
| 320px (overlay scrollbar)      | 288px       |

**Do not add horizontal padding to a page container.** `<main>` already has
it, so a container that adds its own narrows that route's box below what the
floors were calibrated against, and the only symptom is a heading quietly cut
mid-word. `px-6` on the blog routes is exactly how `PROFESSIONAL` came to
overflow by 37px without anyone noticing.

**And do not zero it either.** The fix for that overflow was to drop the
gutter below `sm`, which moved the cost from one heading word on two category
pages to every line of body copy on every page on every phone. Both mistakes
are the same mistake: a per-page decision about a site-wide box. The gutter is
fixed; the floors are the variable.

A full-bleed band inside `<main>` has to break out with negative inline
margins. That is the right way round — the exception is visible in the markup
that wants it. `.band` duplicates all four of the gutter's values and has to
move with it.

**The column is `max-w-page`**, `--container-page`, 80rem / 1280px. The gutter
goes on the outer element (header, `<main>`, footer) and the column goes on the
element inside it. Never the other way round. The header used to apply the
gutter _inside_ its column, which is invisible below the column width and puts
the header's content one whole gutter inside main's above it — measured at 24px
on `/about` at 1440px, 1600px and 1920px, for as long as the site had existed.

The width itself is a free variable: once all three share the structure, any
value keeps them aligned, because each centres the same box inside boxes that
differ by exactly the gutter. `tests/alignment.spec.ts` asserts the three
landmarks share one column, and pins the absolute edges separately so the
agreement and the width cannot drift apart silently.

**Widening the gutter does not fix a cramped-looking page.** It was tried, to
`sm:px-8 lg:px-12`, and reverted: the real cause was decorations positioned
against the viewport rather than against an element. See the decoration rule
under Typography.

**The arithmetic.** A single uppercased word is the whole risk, because
nothing wraps it. Measured in headless Chromium as the rendered width of an
`h1` at `width: max-content`, Lexend 900, -0.05em:

| Word            |   36px |   34px |   33px |   32px | Largest floor it fits |
| --------------- | -----: | -----: | -----: | -----: | --------------------: |
| `PROFESSIONAL`  | 278.41 | 262.61 | 257.20 | 250.81 |               35.26px |
| `ACCESSIBILITY` | 286.61 | 270.91 | 261.56 | 258.20 |               34.24px |
| `WOODWORKING`   | 302.20 | 285.31 | 278.86 | 270.41 |               32.44px |
| `ANNOUNCEMENTS` | 329.61 | 313.91 | 304.56 | 294.20 |               29.55px |

33px leaves 15.80px of headroom for `PROFESSIONAL` (5.8% of the box) and
11.44px for `ACCESSIBILITY` (4.2%). 34px is the number the box arithmetic
suggests at a glance and measurement rules it out: it leaves `ACCESSIBILITY`
2.09px, 0.77% of the box, the same razor edge the old 38px floor sat on.

`ANNOUNCEMENTS` and `WOODWORKING` are deliberately not fitted: there is always
a longer word, and `overflow-wrap: break-word` is the guarantee for outliers.

### Content rule: a display heading word over twelve characters takes a soft hyphen

Put a soft hyphen (`&shy;`, U+00AD) at a **syllable boundary** in any word over
twelve characters that appears in an `h1` or `h2`. Twelve is where the
arithmetic above runs out for the words this site actually uses:
`PROFESSIONAL` is twelve and clears the 273px box by 15.80px, `ACCESSIBILITY`
is thirteen and clears it by 11.44px only because its letters are narrow, and
`ANNOUNCEMENTS` is thirteen and misses by 31.56px.

**Twelve is a proxy for width, not a rule about width.** `WOODWORKING` is
_eleven_ characters and overflows the box by 5.86px, because W, O, D and M are
wide and I, L and S are not. If a heading word looks wide, measure it against
273px at 33px rather than counting letters. The threshold catches the common
case; it does not replace the measurement.

Without one, the fallback is `overflow-wrap: break-word`, which breaks
**anywhere** and draws **no hyphen**. Verified headed in Chrome 152, 36px
Lexend 900 uppercase in a 250px box:

| Written              | Renders                                 |
| -------------------- | --------------------------------------- |
| `announcements`      | `ANNOUNCEM` / `ENTS` — no hyphen at all |
| `announce&shy;ments` | `ANNOUNCE-` / `MENTS` — hyphen drawn    |
| `acces&shy;sibility` | `ACCES-` / `SIBILITY` — hyphen drawn    |

The soft hyphen wins over `break-word`, so it decides where the break lands.
It paints nothing when the word fits, so it is safe to leave in at every
width. It is a DOM character rather than a dictionary lookup, which is why it
survives `text-transform: uppercase` when `hyphens: auto` does not — Chromium
consults its lowercase dictionary after the transform and finds nothing. Never
set `hyphens: none` on a heading; that is the one thing that would disable it.

**Where to write it.** The entity only survives on the paths where Astro emits
HTML. Verified against the build output:

| Path                                     | Write                         |
| ---------------------------------------- | ----------------------------- |
| `.astro` template text                   | `<h1>Acces&shy;sibility</h1>` |
| Markdown body heading                    | `## Announce&shy;ments`       |
| Frontmatter, or any interpolated `{...}` | the literal U+00AD character  |

`{expr}` output is escaped, so `&shy;` in a frontmatter `title` builds to
`Acces&amp;shy;sibility` and the reader sees `&SHY;` on the page. A literal
U+00AD in the same field builds correctly. It is invisible in an editor, so
say in a comment beside it that it is there.

Worked example, a post title that needs one:

```yaml
# src/content/blog/*.md — the character between "Accessi" and "bility" is
# U+00AD, a soft hyphen. It only paints at a line break.
title: 'Accessi­bility Is Not A Feature'
```

```markdown
<!-- Markdown body: the entity works here, the Markdown pipeline decodes it. -->

## Announce&shy;ments
```

---

## Motion

**Every animation respects `prefers-reduced-motion: reduce`.** No exceptions.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

That media query is necessary but **not sufficient**. WCAG 2.2 SC 2.2.2 Pause,
Stop, Hide applies to anything that moves automatically for more than five
seconds, and it requires a control the user can operate, not an OS setting.

One element in this design falls under it: the **homepage hero field**, a
`<canvas>` of stems with a hare hopping through it, driven by a
`requestAnimationFrame` loop in `src/components/ui/HeroField.vue`. Contact's
spinning badge did too, until it became the plain roundel on 2026-09-19.
`tests/motion.spec.ts` measures the field. A canvas has no
`animation-play-state` to read, so the test fingerprints its pixels and
asserts they change while running and stop when paused. Three things about
how, because each is the difference between meeting 2.2.2 and appearing to:

- **The animation is added by the island on mount, never by the server-rendered
  HTML.** The control is JavaScript, so motion in the static markup would run
  in a browser where the island failed to hydrate with nothing able to stop
  it. No JS, no motion. Reuse this shape for anything animated that is paused
  by script.
- **Under `prefers-reduced-motion: reduce` the component does not animate or
  render its button.** Leaving the global media query to neutralise the
  animation to 0.01ms would leave a control in the tab order that pauses
  nothing. The hero field still paints one still frame rather than hiding: the
  preference asks for less movement, not for less picture.
- **The state lives in the accessible name and nowhere else.** No
  `aria-pressed` beside it. The comps do both, which states the same thing
  twice and lets the two disagree. `MobileMenu.vue` makes the opposite call —
  fixed name, state in `aria-expanded` — for the same underlying rule. Which
  half carries the state depends on the control: for a transport control the
  name wins, because "Play" and "Pause" say what pressing it will do, while
  "pressed" says nothing about whether anything is moving.

Anything else animated on this site needs the same treatment. A media query
alone does not satisfy 2.2.2, because a user with reduced motion turned off has
no way to stop it.

There is no marquee in this design. The source comps once declared
`@keyframes marquee` without applying it to any element, and it has since been
removed from them. Do not build one.

Nothing may flash more than three times per second (SC 2.3.1).

---

## Navigation

- The active item uses **`aria-current="page"`**. That is the machine-readable
  indicator and it is not optional.
- The active item's **box** is visual reinforcement only: `border-4
border-border bg-text text-background`, a flat text-colour block with no
  shadow, like a `.badge` (14.42). It must never be the sole signal of
  the active page. It carries no meaning to assistive tech and needs no ARIA of
  its own, because it is drawn with border and fill rather than an element.
  (It replaced an 8x8 gold dot, which was a separate `aria-hidden` span.) The
  mobile menu and the no-JavaScript nav draw their current item the same way.
- **Every link carries the border and padding; only the colours change.** Inactive links get `border-transparent`, which is holding space,
  not decorating. An indicator applied to the active link alone makes that item
  wider on its own page and reflows the whole row as you navigate.
- Never signal state with color alone (SC 1.4.1). A box is a shape cue and
  passes; recolouring the active label and nothing else would not.
- The link set is `NAV_LINKS` (Home, About, Career, Blog) plus `CTA`
  (`/contact`, "Get in touch") in `src/lib/nav.ts`, shared by the header,
  `MobileMenu.vue` and the no-JavaScript fallback nav, with one `isActive` (the route or a
  route below it, never a bare prefix). The desktop header maps `HEADER_LINKS`,
  which is `NAV_LINKS` without Home: the logo link directly before it already
  goes to `/`, and a Home item beside it was two adjacent links to one URL. On
  `/` the logo link carries `aria-current="page"` instead. The call to action sits outside the
  Primary `<nav>` and marks the current page with its own indicator: it drops
  its pink shadow and draws an inset 4px ring in the background colour
  (`--inset-shadow-cta-current`), 11.32 on its gold fill, so it reads as
  pressed in. Both are shape changes, so the state never rests on colour
  (SC 1.4.1).
- The call to action, `.nav-cta`, is a square gold primary action: `bg-gold`,
  a background-coloured label, `border-4` and `shadow-hard-pink-4`, with no
  radius. It shares the buttons' hover (cyan fill) and pressed (4px into its
  shadow) states.

### Target size: every nav link is at least 24px tall

**Every nav link carries its own 24x24 CSS px hit area (SC 2.5.8).** Size the
target, never the gap between targets.

A `.label` link is 14px at line-height 1.2, so its line box is 16.8px and the
link fails on its own. `py-2` adds 8px top and bottom and takes it to 32.8px;
the `border-4` the active-item box needs adds 8px more, to **40.8px**. The `ul`
is `items-center`, so symmetric padding grows the hit area about the same
centre line and moves no glyph.

Every link now measures the same height, which they did not before: the old
gold dot sat inside the anchor with `mt-2`, so the active link alone was 47.6px
and the other three were 31.6px, with the 13px label it had then.

```html
<!-- Yes: 40.8px tall, passes on its own size, same box active or not -->
<a
  class="label block border-4 border-transparent px-4 py-2 text-text"
  href="/about"
  >About</a
>

<!-- No: 16.8px tall, passing only while a neighbour stays far enough away -->
<a class="label block text-text hover:text-cyan" href="/about">About</a>
```

SC 2.5.8 does offer a spacing exception, where an undersized target passes if a
24px circle centred on it does not touch another target's circle. **Do not rely
on it here.** It made the 40px `gap-10` load-bearing for conformance, so any
future change to nav spacing, or stacking the items, would have broken 2.5.8
silently and at a distance from the edit. The gap is now free to be a
typographic choice again, and it has since been used as one twice over. It is
`gap-3` from `lg`, because the links carry 16px of horizontal padding of their
own and the old 40px gap on top of that read as a broken row. Below `lg` it is
`gap-1`, with the links at `px-3` and the call to action at `px-4`, because the
row does not otherwise fit between 768px and about 830px: it needed 730px
inside a 720px column, and the wordmark touched the first link while the call
to action wrapped onto two lines. `tests/header-fit.spec.ts` measures that
band. Check the link's own box, not its neighbours: none of this moves the
40.8px that satisfies 2.5.8, which is `py-2` and `border-4` and is deliberately
independent of every horizontal number here.

### The sticky header

The header is 96px (`--spacing-header`) and sticky. It will cover an element
that receives focus near the top of the viewport, which fails WCAG 2.2 SC 2.4.11
Focus Not Obscured.

It is fixed pixels of every viewport, a 720px-tall one at 400% zoom included,
which is the argument against growing it further.

Set the offset on the scroller, `html`, as `scroll-padding-top` of at least the
header height, not as `scroll-margin-top` on each focusable element:

```css
html {
  scroll-padding-top: calc(var(--spacing-header) + 1rem);
}
```

The element version looks equivalent and is not. WebKit ignores an element's
`scroll-margin` when it scrolls a focused text `<input>` into view to reveal its
caret, and honours the scroller's `scroll-padding`: the contact form's inputs
landed fully under the header in WebKit while its textarea did not. Chromium and
Firefox honour both, so a local run in either passes a rule that fails in Safari.

Check it by Shift-Tabbing back from the footer of a long page, not by reading
the CSS: tabbing forward never brings a control near the header.
`tests/focus.spec.ts` walks both directions on every route, and WebKit is the
engine that matters for text inputs, which runs in CI only.

---

## Focus

- **Every** interactive element has a visible focus indicator. Buttons, links,
  form controls, the menu trigger, cards that are links, all of them.
- The indicator must reach **3:1 against adjacent colors** (SC 1.4.11) on both
  surfaces.
- **Never remove an outline without replacing it.** `outline: none` on its own
  is a bug.
- **The hard offset shadow aesthetic is not a focus indicator.** An offset
  shadow reads as decoration, it is already used for resting state on buttons
  and cards, and a change in it is not a reliable focus signal. Use a real
  outline with an offset:

```css
:root {
  --focus-width: 4px;
  --focus-gap: 4px;
  --lift-control: 4px;
  --lift-object: 8px;
}

:focus-visible {
  outline: var(--focus-width) solid var(--color-cyan);
  outline-offset: calc(var(--focus-gap) + var(--lift, 0px));
}
```

Cyan measures **11.20** on `#131313`, **10.49** on `#1A1A1A` and **8.21** on a
cast-block joint. It is spent on focus and hover and nothing else, so a ring
never looks like a gold control or a gold link.

Use `:focus-visible`, not `:focus`, so a mouse click does not leave a ring
behind. Never rely on the browser default alone against these dark surfaces.

**The one exception is native media controls.** A `<video controls>` holds its
buttons in a user-agent shadow tree; while one has focus the host matches
neither `:focus-visible` nor, in one engine, `:focus`. `global.css` rings
`:is(video, audio)[controls]:is(:focus, :focus-within)` instead, 4px cyan at a
4px offset, and `tests/focus.spec.ts` steps through the controls to check it.

### The ring clears the shadow: `lift-control` and `lift-object`

A cyan ring crossing the pink shadow measures **2.29**, under the 3:1 of SC
1.4.11. So **anything focusable that casts a hard shadow also sets the lift
for that shadow**: `lift-control` beside `shadow-hard-pink-4`, `lift-object`
beside an 8px shadow, gold or pink. Each sets `--lift`, which the offset adds to the
4px gap, so the ring lands on the ground past the shadow rather than across
it. `.btn-primary`, `.btn-secondary`, `.btn-gold-primary`, `.nav-cta` and
`.chip` carry it in their class; the logo link, the contact cards and the
footer stickers set it where they draw the shadow. A current item casts no
shadow, so the current chip and the current `.nav-cta` set `--lift: 0px`. A new
shadow on a focusable element without its lift is a bug.

The ring must not touch a neighbour either. Chip lists (the category filter,
the pager, About's on-page nav, a post's tags) and the no-JavaScript nav are
`gap-6`: a chip's ring reaches 12px past its box and the next chip's shadow
4px, and at `gap-3` the two met. `tests/states.spec.ts` measures it.

### The offset is a mitigation, and it has an assumption in it

The offset is not spacing. It puts the _page_ background on both sides of the
ring, and 3:1 is then measured against that rather than against the element.

**That only holds while the ring colour differs from the surface behind the
element.** It is an assumption, not a guarantee, and it breaks the moment a
surface matches the ring. On `.surface-gold` the offset gap is gold, cyan on
gold is 1.01, and the ring has to be repainted (`gold-text`, 11.32).

So, as a standing rule:

**Any new surface token needs its own focus ring measured, never inherited.**
Two checks, not one, because the offset means the ring touches two things:

1. the ring against the **surface behind the element**, which is what the
   offset gap shows;
2. the ring against the **element's own edge**, in case the offset is ever
   reduced to zero.

The gold buttons are the case where the second check bites. The ring on that
surface is `gold-text`, which is the same colour as `.btn-gold-primary`'s fill
and border: ring against fill measures **1.00**, ring against the gold gap
measures **11.32**. Never set `outline-offset: 0` anywhere on this site;
`tests/gold-surface.spec.ts` asserts it is non-zero.

### A two-tone ring, for an indicator that has to survive two backgrounds

**`.btn-gold-primary` is the only control on this site with this problem, and
this is not a general pattern to copy.**

The check above found it, and finding it was not the same as fixing it. The
ring on that button was a single `gold-text` `#131313` ring, 1.00:1 against the
button's own `#131313` fill, made visible only by the offset gap, which is
gold, at 11.32. So the entire indicator rested on one property staying
non-zero, on the one control where getting it wrong hides the indicator
completely rather than merely weakening it. Asserting the offset guards that
dependency. It does not remove it.

**The technique: give the indicator one ring for each background it can end up
against.**

| Layer                           | Against        | Ratio     |
| ------------------------------- | -------------- | --------- |
| inner `#FFFFFF`, flush to fill  | `#131313` fill | **18.58** |
| outer `#131313`, beyond the gap | gold `#FFC000` | **11.32** |

```css
.surface-gold .btn-gold-primary:focus-visible {
  box-shadow: var(--inset-shadow-gold-btn-ring), var(--shadow-hard-pink-4);
}
```

Three things that are easy to get wrong here:

- **It folds into `box-shadow`, it does not replace it.** `box-shadow` is one
  property, so a `:focus-visible` rule naming only the ring deletes
  `4px 4px 0` pink for as long as the button has focus: the resting decoration
  vanishes at exactly the moment someone is looking at the control. Both
  layers are named, and the pink one is the same token the resting rule uses,
  so they cannot drift.
- **The inner ring is a shadow, not a second outline.** An element gets one
  outline. `inset` clips the shadow to the padding box, which puts it flush
  against the inner edge of the 4px border, with `#131313` on both sides.
- **It reuses `gold-btn-label`.** Same white, same fill, same 18.58. A second
  white token would be the same value measured against the same thing, free to
  drift and quoted twice in every table.

**A single-colour ring is sufficient everywhere else**, including on
`.btn-gold-secondary`: its fill is transparent, so a ring flush to its interior
sits on the gold showing through, where `gold-text` already measures 11.32.
Reach for two tones only when the ring colour equals the control's own opaque
fill. Adding one where it is not needed is a second thing to keep in sync for
no gain.

The offset assertion stays and is now **redundant rather than load-bearing**,
which is the point. Measured both ways: deleting the two-tone rule fails the
ring test at 1.00:1 with the offset zeroed, and setting `outline-offset: 0`
fails the offset assertion while the ring test passes, because the inner ring
is still 18.58.

---

## Page rules

Every page is built from the same parts in the same order, so no page decides
its own opening, heading treatment or rhythm. Agreed with Sinduri on
2026-09-18 after a cohesion audit found five openings, six section-heading
treatments and five section paddings, and the openings revised on 2026-09-19.
`tests/page-structure.spec.ts` and `tests/page-hero.spec.ts` check the ones a
machine can see.

- **Opening.** There are three, and a page does not invent a fourth. Home
  has its canvas hero, which nothing else copies. A blog post opens as an
  article: breadcrumb, the title in its own case in the text colour, teaser,
  date, then the text in `.post-layout`, with the contents box beside it from
  `xl`. Every other page opens with `PageHero`: a full-bleed wall of cast
  blocks behind a gold `h1`, three rows of page-ground blocks with the joint
  colour between them. The wall is what ends the hero. **Never add a line,
  fill, card or separator strip between the hero and the first section**;
  each was tried and rejected, a blue rule last. A photo passes `image` and
  stands on the wall with its border and 8px gold shadow; Contact passes
  `roundel`, which sits on a joint crossing from `lg`. Career uses PageHero
  until its own recruiter-facing opening is chosen.
- **Sections.** Everything after the hero is a `Section`: a band with
  `py-section`, a white `text-h2` heading, an optional `.lead`, then the
  content at `mt-head`. There is no rule above the heading; the heading and the
  spacing mark the section.
- **Panels.** A section that is one object, words and pictures together, is
  one `.card`. `Section panel` puts the heading at `.card-title` size inside
  it. `Section headless` leaves the heading to the section's own layout, for
  a panel whose heading sits beside its picture rather than above it (Lepus
  Ridet, Positivity advocate on `/about`); the slot renders the `h2` with the
  id `<id>-heading`.
- **A page that closes on links closes on `CloseRow`**: a card with one place
  to read next (labelled "Continue reading" for a post, "Next" for a page) and
  the one action that leads on. `/`, `/about`, `/career` and `/contact/sent`
  end this way; `/404` and `/accessibility` do not, because their buttons are
  the page's own content.
- **Colour has a job.** Gold is things that stand on the page: every card,
  panel and hero photo casts an 8px gold shadow, and gold is also the page
  title, card labels and the primary fill. Pink is things you press: buttons,
  tags and the call to action cast a 4px pink shadow; the bunny marks (the
  logo tile, its copies, the roundel) keep the tile's pink too. Cyan is what
  you are touching: focus, hover, and a hovered linked card's shadow. Where
  you are is not a colour: the current nav item and chip are a flat
  text-colour block, and the current call to action is pressed in. On the blog, colour means
  category on the label and the glyph tile only.
- **One card.** `.card`, which carries its 8px gold shadow itself, and
  `.card-title` for its heading. Section has no `shadow` prop and no card
  picks a shadow colour. A linked card's title is `.card-link`, inline-block
  with a 24px minimum height so a wrapped title's focus ring is one rectangle;
  hovering the card turns the title and the shadow cyan, with no underline,
  which crossed the next line of a wrapped title at 320px. A state such as "current" is a `.badge` with words in
  it, never a border or shadow colour alone (SC 1.4.1).
- **Chip or badge.** A `.chip` is always a link: a tag, a jump link, a filter.
  A fact that is not a link, such as the current role, a skill or "Episode
  404", is a `.badge`: flat `bg-text`, a background-coloured label (14.42), no
  border and no shadow, so it does not look clickable.
- **Tilt.** Every tilted mark is at 3deg: the homepage stickers, the glyph
  tiles, the roundel, the logo tile and its copies, the footer stickers. Text
  is never rotated.
- **Photos** take a 4px `border` frame and no shadow or tilt; only cards stand
  forward. A PageHero photo is the exception: it casts the 8px gold shadow,
  because it stands on the wall rather than on the page.
  Inside a panel they take no frame of their own: `PhotoTile` sets
  each on a quiet `bg-background` tile, links it to its full-size file, and
  `PhotoViewer` opens that link in a native `<dialog>`. A group too long for a
  row is one `.photo-strip` that scrolls sideways, each photo uncropped in
  its own shape and never wider than the strip.
- **Spacing** comes from `--spacing-section`, `-head`, `-grid` and `-inline`.
  `-head` is both heading to content and content to the actions under it
  (`mt-head`). Each is fluid from 390px to 1200px, because the desktop values
  left a phone with screens of empty ground between one-column sections.
- **Links**: a link in a sentence uses the base underline, 2px, thickening to
  4px in cyan on hover; a standalone link that carries a class and is not a
  box takes `.link` for the same underline; an action is `.btn-primary` or
  `.btn-secondary`; tags, jump links and filters are `.chip`.
- **Button states.** `.btn-primary`, `.btn-secondary` and `.nav-cta` fill with
  cyan under a background-coloured label on hover (11.20), and move 4px into
  their shadow when pressed, dropping it, with no move under reduced motion.
  Unavailable is `aria-disabled="true"`, never `disabled`: a dashed border,
  `bg-background`, a `subtle` label (8.62) and no shadow. Sending is not
  unavailable: while the contact form posts (`src/scripts/contact-sending.ts`,
  `aria-busy` on the form, `aria-disabled` and the label "Sending" on the
  button), the button holds its pressed position, gold with its label (11.32)
  and a solid border, and does not move under reduced motion.
- **Reading pages** (Privacy, Accessibility) are a PageHero with
  `measure="reading"`, whose text sits in a centred `max-w-3xl` while the wall
  stays full width, then one `.prose` column of the same width, so the title
  and the text start on the same edge.
- **Case.** Headings are uppercase, except a post's title, at the top of the
  post and on its cards, which keeps the case it is written in (`.post-title`, with
  `--text-post-title` and `--text-post-card`). Uppercase suits a page name
  and makes a sentence long and loud: at 390px the first post's title ran to
  five lines at 35px, and reads in three at 28px in its own case.
- **One ground.** Sections do not alternate backgrounds. The gold surface is
  the only change of ground.

---

## Components

**Native elements before ARIA.** Every ARIA attribute is a promise you then have
to implement by hand; a native element ships the behavior already.

| Need                | Use                        | Not                            |
| ------------------- | -------------------------- | ------------------------------ |
| Click target        | `<button type="button">`   | `<div role="button" tabindex>` |
| Navigation          | `<a href>`                 | `<button>` with a router push  |
| Modal               | `<dialog>` + `showModal()` | A hand-rolled overlay          |
| Disclosure          | `<details>` / `<summary>`  | `aria-expanded` on a `<div>`   |
| Grouped form fields | `<fieldset>` / `<legend>`  | A `<div>` with `role="group"`  |

Rules:

- **No focus-trap libraries.** `<dialog>` with `showModal()` traps focus,
  handles Escape, and restores focus to the trigger. That is the whole feature.
- Reach for `role=` or `aria-*` only when no native element does the job, and
  say in a comment why.
- Do not put an `aria-label` on an element that already has visible text; it
  overrides what the user sees and breaks voice control.
- `alt=""` for decorative images. Never put a filename in `alt`.
- **Never set text over a photograph.** Put it beside the photo on a flat
  token ground, as the `/about` cover does: text on an image cannot be
  measured, and `tests/contrast-incomplete.spec.ts` fails it. See
  ARCHITECTURE.md, Photos and video.

### Alt text conventions

Alt text is decided by what the image does **in its position**, not by which
file it is. The same badge is informative in one place and decorative in
another.

| Image                                   | Alt                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Header bunny mark, inside the home link | `""`, the wordmark names the link                                         |
| Badge standing alone as the only name   | `Sinduri — Lepus Ridet`                                                   |
| Large decorative watermark badges       | `""`                                                                      |
| Share image, `og:image:alt`             | `The Sinduri, Lepus Ridet badge: a line drawing of a hare inside a ring.` |

Describe an image by what it shows, not by its type: a screen reader already
announces an image, so "logo" or "group photo" in the alt text adds nothing.

The footer carries no image. "Lepus Ridet" there is real text, a `<div lang="la">`
rather than a heading or a paragraph, and the hare in its tuft is an `aria-hidden` inline SVG.
`tests/footer.spec.ts` asserts both, and that the footer has no `<img>`.

---

## Coupled changes

Some changes here are only correct when a second, non-obvious edit lands in the
**same** commit. Each of these has already failed once, or would fail silently.

### A form that posts anywhere new needs the CSP widened in the same change

`public/_headers` sets `form-action 'self'`, because the one form on the site,
the contact form, posts same-origin to `/contact/send/`. It was `'none'` until
that form landed, and `tests/headers.spec.ts` now asserts `'self'`.

**If a form ever posts to another origin, that directive has to be widened in
the same commit.** Otherwise the browser blocks the submission outright. The
failure is bad in a specific way:

- **It is silent.** Nothing appears on the page. The form looks like it
  submitted, or looks like it did nothing. Only the console carries the
  refusal, and only if someone has it open.
- **It survives the tests.** `tests/headers.spec.ts` asserts `'self'`; it
  cannot know about an origin nobody has told it a form posts to.
- **It is worst for the people the form exists for.** `ACCESSIBILITY.md`
  section 8 asks people to report barriers, and the contact form is one of
  the routes; a submission that fails without saying so turns the
  barrier-reporting path into a barrier.

Widen it to the exact origin the form posts to, never to `*`. Update the
assertion in
`tests/headers.spec.ts` for whatever it becomes, and update the CSP section in
`ARCHITECTURE.md` and its header table in the same commit.

The same rule applies to any other directive that is currently `'none'` because
nothing needs it yet: `object-src`, `base-uri`, `frame-ancestors`. A `'none'`
in that file is a statement that the feature is unused, not that it is
forbidden forever.

### Anything animated needs a pause control, not just a media query

See [Motion](#motion). `prefers-reduced-motion` is necessary and not
sufficient; SC 2.2.2 wants a control. The hero field carries one; the next
animated element is the one this will bite.

---

## Hydration

**`MobileMenu` stays `client:load`.** Do not "optimize" it to `client:media`.

A desktop user at 400% zoom crosses the mobile breakpoint. If the island failed
to hydrate on that media change, the only navigation available to them would be
dead, and that is exactly the population that depends on magnification
(SC 1.4.10 Reflow). The saving is a few kilobytes. The cost is a broken site for
a magnification user. See the comment in `Header.astro`.

Both islands are `client:load`: `MobileMenu` in `Header.astro` and
`HeroField` in `index.astro`. The field loads with the pause control SC 2.2.2
needs, and `client:visible` on the hero, which is in view at load, would fire
at once anyway after first shipping an IntersectionObserver. See the comment in
`index.astro`.

---

## Radius

Everything is `0` unless it is one of two named exceptions. The base layer sets
`border-radius: 0` on every element, so any radius has to be opted into.

**`rounded-nav` (14px) is the softened-box exception**, and it applies to
the logo tile and its copies only:

1. the logo tile in `Header.astro`
2. the bunny tile on `404.astro`, in its starfield panel. It is the logo tile drawn a second
   time, not a new element: the same mark on the same gold tile, with the same
   `border-4` and `rotate-3`, at 96px where the header draws 48px, and with its
   pink hard shadow scaled to match (`shadow-hard-pink-12` against `-8`). The
   exception belongs to the logo tile as an object, so a copy of it takes the
   tile's radius the way it takes its colour, border and tilt. A tile that is
   not a copy of the logo tile does not qualify, however much it looks like one
3. the bunny tile in the Lepus Ridet panel on `/about`, the same copy again at
   112px from `lg` and 80px below it, as the name card's mark

**`rounded-full` is the circle exception.** It applies to the bunny roundel
(`Roundel.astro`, on Contact's PageHero and in the homepage About teaser), the
bolts in PageHero's cast blocks, and the Star Trek thumbnail on `/about`. There is no pill: tags are the square `.chip` and facts the square `.badge`.

The two are not degrees of the same thing and the second is not a loophole in
the first. `rounded-nav` softens a rectangle, which is the move this design
language is built to avoid, so it is capped at the logo tile, drawn
in the places listed, and stays there.
`rounded-full` draws a circle, which is a shape in its own right:
there is no rectangle underneath it to have gone soft. The comps write
`border-radius: 9999px` on every one of these.

Any other rounded corner is a bug.

---

## Before calling anything done

```sh
npm run build        # must be warning-free
npm run typecheck    # 0 errors, 0 warnings, 0 hints
npm run check:tokens # no arbitrary value, raw colour, raw length, off-scale spacing or inline style in src/
npm run test:a11y    # the whole Playwright suite, axe included, 0 failures
```

Read the summary line, not the last few lines of output, and check the reported
total against `npx playwright test --list`. A total below the collected count
means those tests did not run; it does not mean they passed.

Automated testing catches a minority of WCAG failures. Also tab the page,
zoom to 400%, and toggle reduced motion. Never suppress an axe rule to get
green; fix the markup or report the failure.

If you added a test, prove it can fail before believing it: remove the thing it
guards, watch it go red, restore it, watch it go green, and write both results
into the spec's comment. A new colour, animation or control almost always needs
a new assertion, and an assertion nobody has seen fail is not yet evidence of
anything. `ARCHITECTURE.md` > Conventions > Tests has the full rule and the cases behind
it.
