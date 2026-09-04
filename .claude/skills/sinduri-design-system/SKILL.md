---
name: sinduri-design-system
description: Design system rules for sinduri.lol - color tokens and their verified contrast ratios, typography, motion, navigation, focus, component choice, hydration, and radius. Use on every task that writes or reviews markup, CSS, or components in this repo, and before adding any new color, animation, or interactive element. Read alongside the frontend-a11y skill, which covers general accessible markup; this file covers only what is specific to this project.
---

# sinduri.lol design system

Neo-brutalist, dark mode only. No light theme, no `dark:` variants, no toggle.

Tokens live in the `@theme` block in `src/styles/global.css`. There is no
`tailwind.config.mjs`; Tailwind 4 is CSS-first.

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

The three surfaces are `#131313`, `#1A1A1A`, and `#0E0E0E`. Every foreground
color must be checked against **all three**, not just one.

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
2. Measure it against `#131313`, `#1A1A1A`, and `#0E0E0E`.
3. Meet the threshold for its job: **4.5:1** for body text, **3:1** for large
   text, borders, focus rings, icons, and any other non-text boundary.
4. Record the three ratios in `AI.md` next to the token.

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

`text-h1` floors at **36px** and `text-h2` at **32px**. Both numbers are
derived, not chosen. Do not raise either without redoing the arithmetic and
re-running `tests/reflow.spec.ts`.

**One content box.** Every route presents the same content box at a 320px
viewport: **305px** with a classic 15px scrollbar, 320px where scrollbars are
overlaid. That is why page containers drop their horizontal padding below `sm`
(`sm:px-6`, not `px-6`). **Do not add unconditional horizontal padding to a
page container or to any element that can hold a heading.** It narrows the box
below what the floors were calibrated against, and the only symptom is a
heading quietly cut mid-word. `px-6` on the blog routes is exactly how
`PROFESSIONAL` came to overflow by 37px without anyone noticing.

The header is the one exception and holds no heading. Keep it that way.

**The arithmetic.** A single uppercased word is the whole risk, because nothing
wraps it. Width scales linearly with font-size, so the largest floor a word
fits at is `44 x 305 / (its width at 44px)`:

| Word            | at 44px | Largest floor | At 36px | At 32px |
| --------------- | ------: | ------------: | ------: | ------: |
| `PROFESSIONAL`  |  340.92 |       39.36px |  278.94 |  247.94 |
| `ACCESSIBILITY` |  351.17 |       38.22px |  287.33 |  255.41 |
| `ANNOUNCEMENTS` |  405.25 |       33.12px |  331.56 |  294.73 |

36px leaves 17.67px of headroom for `ACCESSIBILITY` and 26.06px for
`PROFESSIONAL`. `ANNOUNCEMENTS` is deliberately not fitted: there is always a
longer word, and `overflow-wrap: break-word` is the guarantee for outliers.

### Content rule: a display heading word over twelve characters takes a soft hyphen

Put a soft hyphen (`&shy;`, U+00AD) at a **syllable boundary** in any word over
twelve characters that appears in an `h1` or `h2`. Twelve is where the
arithmetic above runs out: `PROFESSIONAL` is twelve and clears the box by
26px, `ACCESSIBILITY` is thirteen and clears it by 18px, `ANNOUNCEMENTS` is
thirteen and does not clear it at all.

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
