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

| Token         | Hex       | on `#FFC000` | Job                       |
| ------------- | --------- | ------------ | ------------------------- |
| `gold-text`   | `#131313` | 11.32        | Headings and body copy    |
| `gold-muted`  | `#3A3020` | 7.88         | Secondary copy            |
| `gold-border` | `#22394D` | 7.27         | Every border and rule     |
| `darkcyan`    | `#00363F` | 8.00         | Links, and the one accent |

All four are AAA on gold; `gold-border` clears the 3:1 of SC 1.4.11 by 2.4x.

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

**`.btn-primary` must not be used on a gold surface.** It is `bg-gold`, so on
this ground it is a 1.00:1 fill: an invisible button identified only by its
border, carrying a `shadow-hard-pink-12` that measures 2.31. A primary action
here is a dark fill instead — `bg-background text-gold` with a `border-4` in
`gold-border`. There is no class for it yet; build it with the page that needs
one.

A gold section is full-bleed, so it breaks out of `.page-gutter` with negative
inline margins and re-applies the gutter inside itself. See the `.page-gutter`
rule.

### The escape hatch, and the test that watches it

An explicit utility still beats the subtree default, because utilities come
after components in the cascade. That is intentional, and it is also the hole:
`class="border-border"` or `class="text-muted"` written inside a gold section
is a bug no CSS can prevent.

`tests/gold-surface.spec.ts` is what catches it. It measures from the rendered
DOM rather than matching class names, so it fails on the _outcome_:

- every route is walked for text sitting on a `#FFC000` effective background,
  and anything under 4.5:1 fails with the selector and the measured ratio;
- the ratios in this table are re-measured from the live CSS variables, so
  retoning any token here or in the dark set fails until every table in
  `AI.md`, `ACCESSIBILITY.md` and this file is updated;
- `.surface-gold` itself is asserted for text, muted text, link colour, link
  underline, focus ring and border colour.

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

One element in this design falls under it: the **spinning badge**. The comps
apply `slowspin` to it at 24s and 28s, linear, infinite. It auto-starts and runs
indefinitely, so it needs a real, keyboard-operable pause control with a visible
label and a visible focus indicator. A media query alone does not satisfy 2.2.2,
because a user with reduced motion turned off has no way to stop it.

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

`rounded-nav` is 14px and applies to **exactly two things**:

1. the nav CTA button, in `Header.astro` and `MobileMenu.vue`
2. the logo tile in `Header.astro`

Everything else is `0`. The base layer sets `border-radius: 0` on every element,
so a radius has to be opted into. Any other rounded corner is a bug.

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
