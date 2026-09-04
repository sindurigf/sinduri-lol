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
| `pink`       | `#FF007A`                | Tertiary accent            |
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

Pink `#FF007A` is the one token with a real ceiling. Measured: **4.90** on
`background`, **4.59** on `surface`, **5.09** on `deep`.

That clears AA for normal text (4.5:1) but not AAA (7:1). At weight 800 and
18.66px or larger it counts as WCAG large text, where 4.5:1 also satisfies AAA.

- **Use pink for:** section numbers (`.section-number`, weight 800, never
  smaller than 24px), hard offset shadows, and decorative accents.
- **Never use pink for body-size text**, captions, labels, links, or anything
  the reader has to sustain attention on. It is AA-only, and AA is the floor
  here, not the goal.

Text tokens `text`, `muted`, and `subtle` all clear AAA on all three surfaces.
Prefer them for anything readable.

---

## Typography

Lexend, self-hosted via `@fontsource-variable/lexend`, imported in
`BaseLayout.astro`. The CSS family is `'Lexend Variable'`, not `'Lexend'`.
Variable on the `wght` axis, 100 to 900. Never load the Google Fonts CDN.

### Uppercase

**Apply uppercase with `text-transform` in CSS. Never type it uppercase in the
markup.** Some screen readers spell all-caps strings out letter by letter, so
`ABOUT` typed literally can be announced "A B O U T".

```html
<!-- Yes: the accessible name stays "About" -->
<a class="label" href="/about">About</a>

<!-- No -->
<a class="label" href="/about">ABOUT</a>
```

`.label`, `.label-wide`, `.btn-primary`, `.btn-secondary`, and every heading
already apply `text-transform: uppercase`. Write sentence case and let the CSS
do it.

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

Two elements in this design fall under it:

- the **spinning badge**
- the **marquee**

Both auto-start and both run indefinitely. Each needs a real, keyboard-operable
pause control with a visible label and a visible focus indicator. A media query
alone does not satisfy 2.2.2, because a user with reduced motion turned off has
no way to stop it.

Nothing may flash more than three times per second (SC 2.3.1).

---

## Navigation

- The active item uses **`aria-current="page"`**. That is the machine-readable
  indicator and it is not optional.
- The gold dot is **visual reinforcement only**. It must never be the sole
  signal of the active page, and it carries no meaning to assistive tech, so
  mark it `aria-hidden="true"`.
- Never signal state with color alone (SC 1.4.1).

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

| Image                             | Alt                     |
| --------------------------------- | ----------------------- |
| Header bunny mark                 | `Lepus Ridet mark`      |
| Footer badge                      | `Sinduri — Lepus Ridet` |
| Large decorative watermark badges | `""`                    |

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
