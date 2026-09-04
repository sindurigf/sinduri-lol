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

---

## Colors

| Token        | Value                    | Use                        |
| ------------ | ------------------------ | -------------------------- |
| `background` | `#131313`                | Main background            |
| `surface`    | `#1A1A1A`                | Cards, boxes               |
| `deep`       | `#0E0E0E`                | Alternate sections, footer |
| `border`     | `#5A87A8`                | All borders                |
| `text`       | `#E5E2E1`                | Primary text               |
| `muted`      | `#D4C5AB`                | Secondary body copy        |
| `subtle`     | `#9BB4C6`                | Footer, captions           |
| `gold`       | `#FFC000`                | Primary accent             |
| `cyan`       | `#00DCFD`                | Secondary accent           |
| `pink`       | `#FF007A`                | Borders, shadows, decor    |
| `pink-text`  | `#FF79B6`                | All pink text, any size    |
| `darkcyan`   | `#00363F`                | Text on cyan backgrounds   |
| `header-bg`  | `rgba(10, 10, 10, 0.94)` | Sticky header only         |

The three **dark** surfaces are `#131313`, `#1A1A1A`, and `#0E0E0E`. Every
foreground color must be checked against **all three**, not just one.

**Those three are not the only surfaces, and the tokens above are not
universal.** There is a fourth: `gold` used as a ground rather than as an
accent. Not one foreground token in the table above passes on it. See
[The gold surface](#the-gold-surface-the-dark-tokens-are-not-universal) before
building anything on `#FFC000`.

### Contrast-critical tokens

`border` and `subtle` were chosen for contrast, not aesthetics. Do not change
them without re-verifying.

| Token    | on `#131313` | on `#1A1A1A` | on `#0E0E0E` |
| -------- | ------------ | ------------ | ------------ |
| `border` | 4.84         | 4.53         | 5.02         |
| `subtle` | 8.62         | 8.07         | 8.95         |

`border` carries every visible boundary in the design, so it is governed by
WCAG 2.2 SC 1.4.11 Non-text Contrast, which requires **3:1**. Its predecessor
`#504632` measured 2.00 and failed. Anything that replaces it must clear 3:1 on
all three surfaces, and the numbers above must be updated in the same commit.

`subtle` is a different case, and the two are easy to confuse. It is text, so
SC 1.4.3 governs it, not 1.4.11. Its predecessor `#9C8F78` measured
5.85 / 5.48 / 6.08 and **passed AA on all three surfaces**; it only fell short
of AAA. Replacing it with `#9BB4C6` was an AA-to-AAA upgrade and a palette
decision, not a conformance fix. Do not describe it as one.

### Adding a color

Do all four steps, in order. Do not skip step 2 because a color "looks fine".

1. Add it as a token in the `@theme` block. Never inline it.
2. Measure it against `#131313`, `#1A1A1A`, and `#0E0E0E` — and against
   `#FFC000` too if it will ever appear on a gold surface.
3. Meet the threshold for its job: **4.5:1** for body text, **3:1** for large
   text, borders, focus rings, icons, and any other non-text boundary.
4. Record the ratios in `AI.md` next to the token.

The palette is cool. Gold, cyan, and pink read more strongly against blue than
they did against the warm brown that preceded it. Use accents sparingly.

---

## Contrast rules

### The two pinks

There are two pink tokens and they are split by **role**, never by size.

| Token       | Hex       | on `#131313` | on `#1A1A1A` | on `#0E0E0E` |
| ----------- | --------- | ------------ | ------------ | ------------ |
| `pink`      | `#FF007A` | 4.90         | 4.59         | 5.09         |
| `pink-text` | `#FF79B6` | 7.66         | 7.18         | 7.96         |

- **`pink` is decoration only.** Borders, hard offset shadows, decorative
  fills. It clears the 3:1 that SC 1.4.11 asks of non-text by a wide margin.
  **Never put `pink` on text.** Not on a heading, not on a section number, not
  on a label, not at any size.
- **`pink-text` is for every pink glyph on the site**, including the section
  number. It is AAA (7:1) on all three surfaces at every size and weight.
  **Never use `pink-text` for a border, a shadow, or a fill.** Keeping it off
  non-text is what stops the two drifting back into one token.

```html
<!-- Yes -->
<span class="section-number text-pink-text">01</span>
<div class="border-4 border-pink shadow-hard-pink-12">…</div>

<!-- No -->
<span class="text-pink">01</span>
```

The old rule made pink conditional on the text being 18.66px or larger, which
leaned on the WCAG large-text exemption. That held only while the type scale
did, and it contradicted `--text-section-number`, whose floor is
`clamp(24px, 2.8vw, 32px)`. The role split has no size condition, so it cannot
be invalidated by a change to the scale.

Text tokens `text`, `muted`, and `subtle` all clear AAA on all three surfaces.
Prefer them for anything readable that is not deliberately pink.

---

## The gold surface: the dark tokens are not universal

This site is dark-mode only and every foreground token was picked against
`#131313`, `#1A1A1A` and `#0E0E0E`. **There is one exception, and it is a real
section of the design, not a hypothetical.** The Career hero is
`background: #FFC000` with `color: #131313`: a light ground inside a dark-only
palette.

**Measured against `#FFC000`, every dark-surface foreground token fails.**

| Token       | Hex       | on `#FFC000` | Needs |        |
| ----------- | --------- | ------------ | ----- | ------ |
| `border`    | `#5A87A8` | 2.34         | 3.0   | FAIL   |
| `text`      | `#E5E2E1` | 1.27         | 4.5   | FAIL   |
| `muted`     | `#D4C5AB` | 1.03         | 4.5   | FAIL   |
| `subtle`    | `#9BB4C6` | 1.31         | 4.5   | FAIL   |
| `pink-text` | `#FF79B6` | 1.48         | 4.5   | FAIL   |
| `pink`      | `#FF007A` | 2.31         | 3.0   | FAIL   |
| `cyan`      | `#00DCFD` | 1.01         | 3.0   | FAIL   |
| `gold`      | `#FFC000` | 1.00         | —     | itself |

Not one is close, and no amount of retoning fixes it. L(`#FFC000`) is 0.5896,
so the readable band on gold sits entirely _below_ the ground: AAA needs a
foreground luminance of 0.0414 or less. On `#131313` the AAA band runs from
luminance 0.382 to 1.0, a span of 0.618. On `#FFC000` it runs from 0 to 0.0414,
a span of 0.041. **The AAA band on gold is fifteen times narrower.** Everything
readable on gold is a near-black.

### The inverted set

| Token            | Hex       | on `#FFC000` | Job                                     |
| ---------------- | --------- | ------------ | --------------------------------------- |
| `gold-text`      | `#131313` | 11.32        | Body copy, headings, **button borders** |
| `gold-muted`     | `#3A3020` | 7.88         | Secondary copy                          |
| `gold-border`    | `#22394D` | 7.27         | **Structural** rules, dividers, cards   |
| `darkcyan`       | `#00363F` | 8.00         | Links, and the one accent               |
| `gold-btn-label` | `#FFFFFF` | 1.64         | Label on the dark button fill only      |

The first four are AAA on gold, and `gold-border` clears the 3:1 of SC 1.4.11
by 2.4x. `gold-btn-label` is the exception in that column: it is **1.64 on
gold and must never touch it**, because it never does. It sits on
`.btn-gold-primary`'s `#131313` fill, where it measures **18.58**. It is named
for the button rather than for a role because the site's text colour is `text`
`#E5E2E1`, and that softness is deliberate: pure white blooms on a dark ground.
That argument is about continuous prose, not about a 13px uppercase label on a
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
  <p class="text-muted">…</p>
  <div class="border-8 border-border">…</div>
</section>
```

The class exists because **four site-wide rules are wrong on this surface and
three of them fail silently.** Applying `bg-gold` by hand gets none of them.

1. **Links.** The base layer paints every `<a>` `gold`, which is **1.00** on
   this ground, and `cyan` on hover, **1.01**. Every link in a hand-rolled gold
   section is invisible. `.surface-gold` repaints them `darkcyan` and
   **underlines them**. The underline is not decoration: `darkcyan` measures
   only 1.42 against `gold-text`, far under the 3:1 that would let colour carry
   the distinction on its own, so the underline is what satisfies SC 1.4.1.
   Do not remove it.
2. **Focus.** The site's ring is `gold` with a 3px offset, and it works
   everywhere else _because_ of that offset: gold on gold is 1.00, and the
   offset puts the dark page background on both sides of the ring. **On a large
   gold surface the offset gap is gold too, so the ring disappears entirely.**
   `.surface-gold` repaints it `gold-text` (11.32).
3. **Borders.** The base layer defaults every border to `border` `#5A87A8`,
   2.34 on gold. `.surface-gold` re-defaults the subtree to `gold-border`.
4. **Text.** `text` is 1.27 on gold, so the class sets the foreground rather
   than trusting each element to.

### Buttons on gold

**Neither `.btn-primary` nor `.btn-secondary` may be used on this surface.**
`.btn-primary` is `bg-gold`, so on this ground it is a 1.00:1 fill: an
invisible button identified only by its border. `.btn-secondary` carries
`border-border` (2.34 on gold) and a gold offset shadow (1.00 on gold).

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
| `primary`   | `gold-text` | `gold-btn-label` | 4px `gold-text` | `shadow-hard-pink-8` |
| `secondary` | transparent | `gold-text`      | 4px `gold-text` | none                 |

Both are 13px / weight 900 / 0.1em / uppercase with 18px 34px of padding, from
the comps. Measured, each colour against what it is actually adjacent to:

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
- **The padding is a conformance floor, not a spacing preference.** A 13px
  label at line-height 1.2 is a 15.6px line box; `18px` top and bottom takes
  the control to 51.6px, past the 24px SC 2.5.8 asks of a target on its own
  size. `--spacing-btn-gold-y` and `--spacing-btn-gold-x` exist as tokens
  because 18 and 34 are not multiples of the 4px Tailwind step and this
  project does not allow arbitrary values.
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
`class="border-border"` or `class="text-muted"` written inside a gold section
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
  `AI.md`, `ACCESSIBILITY.md` and this file is updated;
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

Lexend, self-hosted via `@fontsource-variable/lexend`, imported in
`BaseLayout.astro`. The CSS family is `'Lexend Variable'`, not `'Lexend'`.
Variable on the `wght` axis, 100 to 900. Never load the Google Fonts CDN.

### Uppercase

**Apply uppercase with `text-transform` in CSS. Never type it uppercase in the
markup.**

```html
<!-- Yes -->
<a class="label" href="/about">About</a>

<!-- No -->
<a class="label" href="/about">ABOUT</a>
```

`.label`, `.label-wide`, `.btn-primary`, `.btn-secondary`, and every heading
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

### Scale

Every size is a token and fluid via `clamp()`. Do not add breakpoint steps.

| Role           | Token                 | Weight |
| -------------- | --------------------- | ------ |
| H1             | `text-h1`             | 900    |
| H2             | `text-h2`             | 900    |
| H3             | `text-h3`             | 800    |
| Body           | `text-body`           | 400    |
| Label / tag    | `text-label`          | 900    |
| Section number | `text-section-number` | 800    |

Headings must not skip levels. One `<h1>` per page.

### The heading floors are a reflow constraint, not a taste call

`text-h1` floors at **33px** and `text-h2` at **29px**. Both numbers are
derived, not chosen. Do not raise either without redoing the arithmetic and
re-running `tests/reflow.spec.ts`.

**One content box, declared once.** The horizontal gutter is `.page-gutter`
(`px-4 sm:px-6`) and it is applied in exactly three places: the header,
`<main>` in `BaseLayout.astro`, and the footer. Every route therefore presents
the same box:

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
that wants it.

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

One element in this design falls under it: the **spinning badge**, `slowspin`
at 24s on the homepage hero and 28s on Contact, linear and infinite. It is
built, in `src/components/ui/SpinBadge.vue`, and `tests/motion.spec.ts`
measures it. Three things about how, because each is the difference between
meeting 2.2.2 and appearing to:

- **The animation is added by the island on mount, never by the server-rendered
  HTML.** The control is JavaScript, so motion in the static markup would run
  in a browser where the island failed to hydrate with nothing able to stop
  it. No JS, no spin. Reuse this shape for anything animated that is paused by
  script.
- **Under `prefers-reduced-motion: reduce` the component neither animates nor
  renders the button.** Leaving the global media query to neutralise the
  animation to 0.01ms would leave a control in the tab order that pauses
  nothing.
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

There is no marquee in this design. `@keyframes marquee` is declared in the
source comps but is never applied to an element. Do not build one.

Nothing may flash more than three times per second (SC 2.3.1).

---

## Navigation

- The active item uses **`aria-current="page"`**. That is the machine-readable
  indicator and it is not optional.
- The gold dot is **visual reinforcement only**. It must never be the sole
  signal of the active page, and it carries no meaning to assistive tech, so
  mark it `aria-hidden="true"`.
- Never signal state with color alone (SC 1.4.1).

### Target size: every nav link is at least 24px tall

**Every nav link carries its own 24x24 CSS px hit area (SC 2.5.8).** Size the
target, never the gap between targets.

A `.label` link is 13px at line-height 1.2, so its line box is 15.6px and the
link fails on its own. `py-2` adds 8px top and bottom and takes it to 31.6px.
The `ul` is `items-center`, so symmetric padding grows the hit area about the
same centre line and moves no glyph: the rendered header is unchanged.

```html
<!-- Yes: 31.6px tall, passes on its own size -->
<a class="label block py-2 text-muted hover:text-cyan" href="/about">About</a>

<!-- No: 15.6px tall, passing only while a neighbour stays far enough away -->
<a class="label block text-muted hover:text-cyan" href="/about">About</a>
```

SC 2.5.8 does offer a spacing exception, where an undersized target passes if a
24px circle centred on it does not touch another target's circle. **Do not rely
on it here.** It made the 40px `gap-10` load-bearing for conformance, so any
future change to nav spacing, or stacking the items, would have broken 2.5.8
silently and at a distance from the edit. The gap is now free to be a
typographic choice again. Check the link's own box, not its neighbours.

### The sticky header

The header is 80px (`--spacing-header`) and sticky. It will cover an element
that receives focus near the top of the viewport, which fails WCAG 2.2 SC 2.4.11
Focus Not Obscured.

Give focusable targets and in-page anchor destinations a `scroll-margin-top` of
at least the header height:

```css
:target,
[id] {
  scroll-margin-top: calc(var(--spacing-header) + 1rem);
}
```

Check this by tabbing from the top of a long page, not by reading the CSS.

---

## Focus

- **Every** interactive element has a visible focus indicator. Buttons, links,
  form controls, the menu trigger, cards that are links, all of them.
- The indicator must reach **3:1 against adjacent colors** (SC 1.4.11) on all
  three surfaces.
- **Never remove an outline without replacing it.** `outline: none` on its own
  is a bug.
- **The hard offset shadow aesthetic is not a focus indicator.** An offset
  shadow reads as decoration, it is already used for resting state on buttons
  and cards, and a change in it is not a reliable focus signal. Use a real
  outline with an offset:

```css
:focus-visible {
  outline: 3px solid var(--color-gold);
  outline-offset: 3px;
}
```

Use `:focus-visible`, not `:focus`, so a mouse click does not leave a ring
behind. Never rely on the browser default alone against these dark surfaces.

### The 3px offset is a mitigation, and it has an assumption in it

The site-wide ring is `gold` with a 3px offset, and the offset is not spacing.
Gold on the gold `.btn-primary` fill measures **1.00**, so a ring flush against
that button would be invisible. The offset works by putting the _page_
background on both sides of the ring, and 3:1 is then measured against that
rather than against the element.

**That only holds while the ring colour differs from the surface behind the
element.** It is an assumption, not a guarantee, and it breaks the moment a
surface matches an accent — which is exactly what the gold ground does. On
`.surface-gold` the offset gap is gold too, so the mitigation buys nothing and
the ring has to be repainted (`gold-text`, 11.32).

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
button's own `#131313` fill, made visible only by the 3px offset gap, which is
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
  box-shadow: var(--inset-shadow-gold-btn-ring), var(--shadow-hard-pink-8);
}
```

Three things that are easy to get wrong here:

- **It folds into `box-shadow`, it does not replace it.** `box-shadow` is one
  property, so a `:focus-visible` rule naming only the ring deletes
  `8px 8px 0` pink for as long as the button has focus: the resting decoration
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

### Alt text conventions

Alt text is decided by what the image does **in its position**, not by which
file it is. The same badge is informative in one place and decorative in
another.

| Image                                   | Alt                     |
| --------------------------------------- | ----------------------- |
| Header bunny mark, inside the home link | `Lepus Ridet mark`      |
| Footer badge, beside the copyright line | `""`                    |
| Badge standing alone as the only name   | `Sinduri — Lepus Ridet` |
| Large decorative watermark badges       | `""`                    |

The footer badge is `alt=""` because the copyright line next to it already
reads "© 2026 sinduri.lol". Naming the badge would announce the same thing
twice and add nothing. Do not "fix" it by giving it a name.

---

## Coupled changes

Some changes here are only correct when a second, non-obvious edit lands in the
**same** commit. Each of these has already failed once, or would fail silently.

### A contact form needs the CSP widened in the same change

`public/_headers` sets `form-action 'none'`. That is a claim about today: there
are no forms on this site, so the safest possible value is free.

**The moment a `<form>` with a real submission target is added — the Contact
page is the one that will want it — that directive has to be widened in the
same commit.** Otherwise the browser blocks the submission outright. The
failure is bad in a specific way:

- **It is silent.** Nothing appears on the page. The form looks like it
  submitted, or looks like it did nothing. Only the console carries the
  refusal, and only if someone has it open.
- **It survives the tests.** `tests/headers.spec.ts` asserts there is no
  `'unsafe-inline'` and no hash drift; it does not know what `form-action`
  should permit, because that depends on where the form posts.
- **It is worst for the people the form exists for.** `ACCESSIBILITY.md`
  section 8 asks people to report barriers, and the contact form is one of the
  two routes for doing that. A submission that fails without saying so turns
  the barrier-reporting path into a barrier.

Widen it to the exact origin the form posts to, never to `*`. If the form posts
same-origin, `form-action 'self'` is the value. Add an assertion to
`tests/headers.spec.ts` for whatever it becomes, and update the CSP section in
`AI.md` and the header table in `README.md` in the same commit.

The same rule applies to any other directive that is currently `'none'` because
nothing needs it yet: `object-src`, `base-uri`, `frame-ancestors`. A `'none'`
in that file is a statement that the feature is unused, not that it is
forbidden forever.

### Anything animated needs a pause control, not just a media query

See [Motion](#motion). `prefers-reduced-motion` is necessary and not
sufficient; SC 2.2.2 wants a control. The spinning badge is the element this
will bite.

---

## Hydration

**`MobileMenu` stays `client:load`.** Do not "optimize" it to `client:media`.

A desktop user at 400% zoom crosses the mobile breakpoint. If the island failed
to hydrate on that media change, the only navigation available to them would be
dead, and that is exactly the population that depends on magnification
(SC 1.4.10 Reflow). The saving is a few kilobytes. The cost is a broken site for
a magnification user. See the comment in `Header.astro`.

---

## Radius

Everything is `0` unless it is one of two named exceptions. The base layer sets
`border-radius: 0` on every element, so any radius has to be opted into.

**`rounded-nav` (14px) is the softened-box exception**, and it applies to
exactly two things:

1. the nav CTA button, in `Header.astro` and `MobileMenu.vue`
2. the logo tile in `Header.astro`

**`rounded-full` is the circle-and-pill exception.** It applies to the spinning
badge frame (`SpinBadge.vue`), the bunny roundel in the homepage About teaser,
the decorative hero glow, and `.pill`.

The two are not degrees of the same thing and the second is not a loophole in
the first. `rounded-nav` softens a rectangle, which is the move this design
language is built to avoid, so it is capped at two elements and stays there.
`rounded-full` draws a circle or a pill, which is a shape in its own right:
there is no rectangle underneath it to have gone soft. The comps write
`border-radius: 9999px` on every one of these.

Any other rounded corner is a bug.

---

## Before calling anything done

```sh
npm run build      # must be warning-free
npm run typecheck  # 0 errors, 0 warnings, 0 hints
npm run test:a11y  # axe, 0 violations
```

Automated testing catches a minority of WCAG failures. Also tab the page,
zoom to 400%, and toggle reduced motion. Never suppress an axe rule to get
green; fix the markup or report the failure.
