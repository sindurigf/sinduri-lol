# Styleguide

Status: **audit and proposal from 2026-09-19, largely implemented on the
`feat/brutalist-styleguide` branch the same day.** The system in force is
`@theme static` in `src/styles/global.css`, the `sinduri-design-system` skill
and ARCHITECTURE.md. Where this file and those disagree, they win. Part 1 is
the audit of the site as it was before the branch; Parts 2 and 3 are the
proposal. The section below says what shipped and where it differs.

## What shipped, and where it differs

Implemented, one commit each:

- Contact form: summary links resolve, "(required)" in labels, `novalidate`,
  no `role="alert"`, an 8px-looking invalid edge and a decorative cross.
- Focus: 4px cyan ring, offset past the element's shadow through `--lift`
  (`lift-control`, `lift-object`).
- Shadows: one colour per job, revised after review the same day. Gold 8px
  for things that stand on the page (every card, panels, a hero photo), pink
  4px for things you press (buttons, link chips, the call to action) and pink
  for the bunny marks (logo tile, its copies, roundel), cyan 4px for where you
  are (current nav item, chip and call to action, under the unchanged blue
  border). The first cut, pink on everything, read as monotonous. `.card`
  carries its shadow itself.
- Colour roles: body copy in `text`, links in `text` with an underline, an
  opaque header, cyan kept for focus and hover, hard-edged 404 stars.
- Buttons: cyan hover, 4px press, dashed `aria-disabled`; the header call to
  action is a square gold button; `.badge` for facts that are not links.
- Type: 400 and 900 only, one label style at 14px, h3 at 900 with a 1.1 line
  height.
- Tilt: 3deg for every mark, no rotated text, no transitions.
- Alt text that describes content rather than type.
- `--spacing-actions` merged into `--spacing-head`; gold buttons on the shared
  padding.

Differences from the proposal below:

- **Token names are unchanged.** `background`, `surface`, `border`, `text` and
  `subtle` keep their names; Part 3's `ground`, `plate`, `line`, `ink` and
  `ink-quiet` are the same values under proposal names. Renaming would have
  touched every test and document for no visible change.
- **The homepage hero is kept as confirmed.** The canvas keeps its vignette
  and blur, and its buds read a canvas-only `--color-bud` (`#D4C5AB`) now that
  `muted` is gone. Its stickers did move to 3deg and lost cyan.
- **The current category filter keeps its square marker.** Part 3 proposed
  dropping it; `tests/blog.spec.ts` holds it as the non-colour cue for the
  current option, and it stays.
- **The 404 heading keeps the h2 size.** Its comment records that at h1 size
  the sentence ran to six lines. Only its tilt was removed.
- **`.label-wide` was not dead code.** The inventory in 1.2 said so; it was
  used 17 times. It was merged into `.label` instead.
- **Emphasis cards were not built.** Part 3 proposes a gold card for the one
  emphasised card per section. Every card now has the same pink shadow, and
  the current role says so with a `.badge`.

Not done, and why:

- **Heading visual levels (A9).** The 404 and tag-page h1 sizes have
  documented reasons; "In this post" and "Tags" stay at label size. Open.
- **Tile alt text (1.1, flag 2).** It needs your decision, since the
  design-system skill asks for "Lepus Ridet mark".
- **The whole-card focus ring on linked cards.** `tests/focus.spec.ts`
  expects the ring on the focused element itself, so the ring stays on the
  title link.
- **The submit button's pending state.** It needs a script and a bfcache
  reset for a double-submit case the server already rate-limits.
- **Banned spacing steps and raw px.** The about page's `gap-3.5` and
  `p-2.5` feed the image `sizes` arithmetic, which `tests/image-size.spec.ts`
  measures; changing them means re-deriving every `sizes` string. The footer
  and mobile menu raw px, and extending `scripts/check-tokens.mjs` to catch
  them, are also still open.
- **Fluid card padding.** `--spacing-card` and `--spacing-card-tight` stay
  two numbers, for the same `sizes` reason.

Scope, as agreed before writing:

- A clean-slate redesign, reasoned from brutalism and not from any one element.
  Decisions approved on 2026-09-18 and 2026-09-19 are open to change here.
  Where this file reverses one, it says so.
- **The logo tile in the header is locked** (`src/components/Header.astro:75`).
  Everything else has to sit comfortably next to it.
- WCAG 2.2 AA is the floor for every value. Ratios are WCAG relative-luminance
  contrast, computed from the hex values. Any pairing with alpha is measured
  after compositing onto the colour behind it.
- Components that do not exist in `src/` are specified anyway, and marked
  **not in codebase**.

What was not done: no page was rendered for this audit. Ratios are computed,
not sampled from pixels. Sizes come from classes and token arithmetic. Anything
that depends on rendered geometry says so and names the test that should
confirm it.

---

## Part 1. Audit

### 1.1 The locked element: the logo tile

`Header.astro:75`, inside the home link at `Header.astro:70`:

```html
<span
  class="flex h-12 w-12 rotate-3 items-center justify-center rounded-nav
             border-4 border-border bg-gold shadow-hard-pink-8"
>
  <image … alt="Lepus Ridet mark" class="h-6 w-auto" />
</span>
<span class="label text-text">sinduri.lol</span>
```

| Property        | Value                                                              | Source                                 |
| --------------- | ------------------------------------------------------------------ | -------------------------------------- |
| Box             | 48 × 48px (`h-12 w-12`)                                            | Header.astro:75                        |
| Border          | 4px solid `#5A87A8`                                                | `--color-border`, global.css:53        |
| Radius          | 14px                                                               | `--radius-nav`, global.css:251         |
| Fill            | `#FFC000`                                                          | `--color-gold`, global.css:57          |
| Shadow          | `8px 8px 0 #FF007A`, no blur                                       | `--shadow-hard-pink-8`, global.css:258 |
| Tilt            | 3deg clockwise                                                     | `rotate-3`                             |
| Mark            | `#111111` line art, 24px tall                                      | `src/assets/bunny-dark.png`, sampled   |
| Gap to wordmark | 16px                                                               | `gap-4`, Header.astro:73               |
| Behind it       | `rgba(10,10,10,.94)` over `#131313`, which composites to `#0B0B0B` | global.css:122                         |

What it carries into the rest of the system:

- **Line weight 4px, one colour.** The border is `#5A87A8`, the colour that
  draws every boundary on the site.
- **One hard shadow: 8px, pink, no blur.** The shadow is how an object stands
  off the page.
- **Gold as a solid block with dark ink on it,** not as a thin accent.
- **The only soft corner and the only tilt in the header.** These make the tile
  a stamp, not a button. The new system keeps both exclusive to the tile and
  its copies, so it stays the one soft, tilted object on screen.

Its contrast, measured:

| Pair                                   | Ratio | Needs           | Result                                                  |
| -------------------------------------- | ----- | --------------- | ------------------------------------------------------- |
| Mark `#111111` on fill `#FFC000`       | 11.50 | 3.00 (graphic)  | pass                                                    |
| Fill `#FFC000` on header `#0B0B0B`     | 11.99 | 3.00 (boundary) | pass                                                    |
| Border `#5A87A8` on header `#0B0B0B`   | 5.12  | 3.00            | pass                                                    |
| Border `#5A87A8` on fill `#FFC000`     | 2.34  | none            | not needed: the fill is the tile's edge, not the border |
| Shadow `#FF007A` on header `#0B0B0B`   | 5.19  | none            | decoration                                              |
| Wordmark `#E5E2E1` on header `#0B0B0B` | 15.28 | 4.50            | pass                                                    |

**Accessibility flags on the locked element. Nothing on the tile changes; each
fix sits outside it.**

1. **The focus ring crosses the tile's shadow.** The ring is on the home
   link: 3px gold with a 3px offset, so it sits 3 to 6px outside the link box.
   The link box is as tall as the tile. The tile's pink shadow reaches about
   9.2px below the link box, because 8px of offset plus 3deg of rotation add
   roughly 1.2px. Along the bottom edge under the tile, about 48px of the
   ring's bottom edge crosses the shadow, where gold on pink is **2.31:1**,
   under the 3:1 of SC 1.4.11. The rest of the ring is 11.99:1.
   **Fix:** set a larger outline offset on the home link, not on the tile.
   With the focus token in 3.1.5, the link gets `--lift: 8px`, so its offset
   is 12px, and the ring clears the shadow by about 2.8px of header ground.
   This is computed geometry: `tests/focus.spec.ts` should gain a pixel check
   before this is called fixed.
2. **The link's accessible name starts with the image.** The name is "Lepus
   Ridet mark sinduri.lol". The visible text "sinduri.lol" is inside it, so
   SC 2.5.3 passes, but voice-control users do best when the name starts with
   the visible label.
   **Fix:** `alt=""` on the mark, which makes the name "sinduri.lol". This
   reverses the alt table in the design-system skill, which asks for "Lepus
   Ridet mark" here, so it needs your decision. The alt text is markup, not
   styling, so changing it does not touch the lock.
3. **In forced-colors mode the tile loses its fill and shadow** and is drawn as
   a system-colour square. That is correct behaviour and needs no fix. It is
   listed so nobody "fixes" it with `forced-color-adjust: none`.

### 1.2 Inventory

#### Colours

Every declared colour is a token in `@theme static` (global.css:48). No raw hex
exists outside `global.css`, which `scripts/check-tokens.mjs` enforces. Five
`rgba()` literals slip past that check, in `src/lib/hero-field.ts`.

| Token            | Value                                   | global.css            | Main uses                                                                                                               |
| ---------------- | --------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `background`     | `#131313`                               | 50                    | page ground, `text-background` on gold fills                                                                            |
| `surface`        | `#1A1A1A`                               | 51                    | cards, chips, buttons, inputs                                                                                           |
| `deep`           | `#0E0E0E`                               | 52                    | noscript nav, photo viewer, dialog backdrop, 404 starfield                                                              |
| `border`         | `#5A87A8`                               | 53                    | every border (base rule global.css:387)                                                                                 |
| `text`           | `#E5E2E1`                               | 54                    | headings, strong, nav current                                                                                           |
| `muted`          | `#D4C5AB`                               | 55                    | body copy (33 class uses), nav links                                                                                    |
| `subtle`         | `#9BB4C6`                               | 56                    | captions, footer policies, breadcrumbs                                                                                  |
| `gold`           | `#FFC000`                               | 57                    | links (global.css:483), focus ring (526), h1, card shadows (28 uses), primary fill, field labels, list markers, bullets |
| `cyan`           | `#00DCFD`                               | 58                    | hover, CTA fill, stickers, roundel shadow, category accent                                                              |
| `pink`           | `#FF007A`                               | 74                    | shadows, invalid border, error summary border                                                                           |
| `pink-text`      | `#FF79B6`                               | 75                    | pink glyphs, field errors                                                                                               |
| `darkcyan`       | `#00363F`                               | 76                    | text on cyan, links on gold                                                                                             |
| `gold-text`      | `#131313`                               | 89                    | text on the gold surface (duplicates `background`)                                                                      |
| `gold-muted`     | `#3A3020`                               | 91                    | secondary text on gold                                                                                                  |
| `gold-border`    | `#22394D`                               | 97                    | borders on gold                                                                                                         |
| `gold-btn-label` | `#FFFFFF`                               | 106                   | label on `.btn-gold-primary`                                                                                            |
| `joint`          | `#262F36`                               | 118                   | cast-block joints                                                                                                       |
| `bolt`           | `#2A3640`                               | 119                   | cast-block bolts                                                                                                        |
| `header-bg`      | `rgba(10,10,10,.94)`                    | 122                   | sticky header                                                                                                           |
| (canvas)         | `rgba(90,135,168,…)`, `rgba(0,0,0,.34)` | hero-field.ts:473–489 | hero field glow and vignette                                                                                            |

That is 19 tokens plus 2 canvas literals, and 5 near-blacks: `#0B0B0B`
effective, `#0E0E0E`, `#131313`, `#1A1A1A`, `#262F36`/`#2A3640`.

#### Type

One family: Lexend Variable, self-hosted (`--font-sans`, global.css:130).

| Token                    | Size                                   | Line height                          | global.css                       |
| ------------------------ | -------------------------------------- | ------------------------------------ | -------------------------------- |
| `text-h1`                | clamp(33px, 9vw, 104px)                | 0.94                                 | 148                              |
| `text-hero-h1`           | clamp(33px, min(9vw, 13svh), 104px)    | 0.94                                 | 163                              |
| `text-reading-h1`        | clamp(33px, 9vw, 80px)                 | 0.94                                 | 171                              |
| `text-post-title`        | clamp(28px, 4.8vw, 60px)               | 1.06                                 | 182                              |
| `text-post-h2`           | clamp(22px, 3vw, 36px)                 | 1.02                                 | 184                              |
| `text-contents`          | clamp(15px, 1vw, 16px)                 | 1.35                                 | 187                              |
| `text-post-card`         | clamp(18px, 2.6vw, 32px)               | 1.15                                 | 189                              |
| `text-post-card-feature` | clamp(18px, calc(5.6vw − 4px), 64px)   | 1.02                                 | 191                              |
| `text-h2`                | clamp(26px, 5.6vw, 64px)               | 0.96                                 | 193                              |
| `text-h3`                | clamp(20px, 2.6vw, 32px)               | 1.15 (base `h3` rule says 1.02, 477) | 195                              |
| `text-hero-sticker`      | clamp(18px, min(2.1vw, 3.4svh), 30px)  | 1.02                                 | 202                              |
| `text-body`              | clamp(17px, 1.2vw, 19px)               | 1.62                                 | 204                              |
| `text-label`             | 13px                                   | 1.2                                  | 206                              |
| `text-button`            | clamp(14px, calc(17px − 0.25vw), 16px) | 1.2                                  | 214                              |
| `text-copyright`         | 20px                                   | 1.2                                  | 221                              |
| `text-footer-name`       | clamp(32px, 3vw, 40px)                 | 1                                    | 228                              |
| `text-section-number`    | clamp(21px, 2.4vw, 28px)               | 1                                    | 235                              |
| MobileMenu links         | clamp(34px, 8vw, 56px)                 | 1                                    | MobileMenu.vue:241 (scoped, raw) |

Weights in use: 400 (body), 700 (`font-bold`, 7 uses, e.g. `.standfirst`
global.css:1070, contents link `[slug].astro:100`), 800 (`font-extrabold`,
11 uses, h3 base rule 478, `.card-title` 981, stickers 915), 900 (`font-black`,
headings, labels, buttons).

Letter spacing: −0.05em (`--tracking-heading`), −0.04em (`-heading-tight`),
−0.02em (`-title`), 0.1em (`-label`), 0.14em (`-label-wide`), global.css:243–248.

#### Borders, radius, shadows

- **Border widths:**
  - 2px: `.photo-strip`, transparent, global.css:1110
  - 4px: buttons, chips, inputs, nav items, photos, `.post-contents`, prose
    tables, the tile, stickers, the noscript nav rule
  - 8px: `.card` 972, header rule `Header.astro:39`, `.error-summary` 1964,
    prose blockquote and hr 1272/1292, Roundel `Roundel.astro:34`, contact
    cards `contact.astro:99`, stat tiles `index.astro:257`, 404 starfield
  - `ring-4`: prose figures, 1312
- **Radius:**
  - 0 by base rule, 388
  - 14px `rounded-nav`: tile, `.nav-cta` 612, 404 tile `404.astro:88`,
    about tile `about.astro:202`
  - `rounded-full`: Roundel, cast-block bolts 703, Star Trek photo
    `about.astro:378`
- **Shadows**, 8 hard-offset tokens, global.css:254–263:
  - gold at 8, 6 and 4
  - pink at 12, 8 and 6
  - cyan at 8 and 6
- **Inset rings:** `--inset-shadow-gold-btn-ring` (3px white, 270) and
  `--inset-shadow-cta-current` (4px darkcyan, 279).
- **Soft effects:**
  - `backdrop-blur-header` 10px, global.css:376
  - canvas blur filter, `HeroField.vue:245`
  - starfield radial gradients, global.css:1981–1999
  - canvas vignettes, hero-field.ts:473–489

#### Spacing

- **Tokens:**
  - `section` clamp(56px, 8vw, 96px), 332
  - `head` clamp(32px, 4vw, 48px), 333
  - `grid` clamp(28px, 3.4vw, 40px), 334
  - `actions` clamp(32px, 4vw, 48px), 335
  - `inline` clamp(16px, 2vw, 24px), 336
  - `card-tight` 24px, 319
  - `card` 40px, 320
  - `btn-gold-y` 18px and `btn-gold-x` 34px, 344–345
  - `target` 24px, 362
  - `header` 96px, 296
  - `joint` and `bolt` sizes, 352–354
- **Raw Tailwind steps in markup** (full list in the component inventory):
  - margins: `mt-0` to `mt-16` in 12 distinct values, including `mt-3.5` and
    `mb-3.5`
  - gaps: `gap-1` to `gap-16` in 16 distinct values, including `gap-2.5` and
    `gap-3.5`
  - padding: `p-2.5`, `p-5`, `p-6`, `px-0.5`, `py-16`, `lg:py-20`, `py-28`
- **Raw px in CSS, not caught by `check:tokens`:**
  - footer block, global.css:1544–1841: 6, 7, 8, 13, 14, 16, 18, 20, 22, 24,
    28, 32, 34, 48, 56, 220 and 266px
  - MobileMenu.vue:205–241: 2.5rem, 1.5rem, 6px and −6px

#### Component variants

- **Buttons:**
  - `.btn-primary` (546): gold fill, 4px border, pink-12 shadow, 32/16px
    padding.
  - `.btn-secondary` (552): surface fill, gold-6 shadow.
  - `.btn-gold-primary` (1427): 34/18px padding, pink-8.
  - `.btn-gold-secondary` (1433): **defined, used nowhere.**
  - `.nav-cta` (611): cyan fill, 14px radius, gold-4 on hover.
  - `.strip-button` (1134): 44px.
  - `.motion-toggle` (1521): 40px.
  - Menu trigger: `MobileMenu.vue:105`, 48px.
  - No `:hover`, `:active` or disabled rule on `.btn-primary` or
    `.btn-secondary`. The contact submit (`ContactForm.astro:159`) has no
    pending state.
- **Links:**
  - Base: gold, no underline (482).
  - In sentences: gold with a 2px underline (508).
  - On gold: darkcyan with an underline (1393).
  - Stretched card link (1050).
  - Class-bearing gold links with no underline: `CloseRow.astro:20`,
    credits `LINK_ITEM` (`credits.astro:77`).
  - Breadcrumbs: gold, with the list in `subtle` (`Breadcrumbs.astro:27–31`).
  - Footer: text or subtle, hover cyan (`Footer.astro:96,112`).
  - Post contents: `font-bold text-text`, no hover (`[slug].astro:98`).
- **Cards and boxes:**
  - `.card`: 8px, surface, 24/40px padding. The shadow is chosen per use:
    gold, pink or cyan.
  - Eleven bordered boxes that are not `.card`, each different: contact cards,
    error summary, `.post-contents` (4px), PlaceholderBox (8px dashed), stat
    tiles (gold border, `background` fill), glyph tile, 404 starfield (cyan
    shadow), about panels at `p-5`, PhotoTile at `p-2.5`, Roundel (8px, cyan
    shadow), photos (4px, some with a gold-8 shadow).
- **Inputs:** `.field-control` (1932): 4px border, surface fill, 16/12px
  padding. Invalid is `border-pink` (1951). Labels are gold (1929).

### 1.3 Inconsistencies

Blunt, and in rough order of how much they cost the brutalist read.

1. **Gold does eight jobs,** so it signals nothing. It is the link colour, the
   focus ring, the page title, the primary fill, the default card shadow, field
   labels, list markers and a whole surface. The focus ring is the same colour
   as the thing it surrounds on every gold button, chip and title link.
2. **Eight shadow tokens where the tile uses one.** The offsets are 4, 6, 8 and
   12, in three colours. 6 against 8 is exactly the "nearly but not quite"
   problem. Buttons alone use three: pink-12 (primary), gold-6 (secondary),
   pink-8 (gold primary).
3. **Five near-black grounds.** `surface` against `background` is 1.07:1, and
   `deep` against `background` is 1.05:1. Nobody can see those differences,
   and none carries meaning. Brutalism uses one ground and draws the edges.
4. **Two secondary text colours from different hue families.** `muted`
   `#D4C5AB` is warm beige and `subtle` `#9BB4C6` is cool blue-grey. Beige
   body copy sits in a palette that is otherwise cool.
5. **Seventeen type tokens and two heading weights.**
   - `post-card` (18–32px) against `h3` (20–32px) against `section-number`
     (21–28px).
   - `label` 13px against `button` 14–16px.
   - `contents` 15–16px against `body` 17–19px.
   - 800 against 900 against 700, which at display sizes read as the same
     weight rendered badly.
6. **h3 line height is declared twice and disagrees.** The base rule sets
   1.02 (global.css:477) and the token 1.15 (196). Which one wins depends on
   whether the element also has `text-h3`.
7. **Two identical spacing tokens.** `--spacing-head` and `--spacing-actions`
   are both `clamp(32px, 4vw, 48px)`.
8. **The gold button padding is 34/18px and the normal button padding is
   32/16px.** Two tokens (`btn-gold-x/y`) exist for a 2px difference.
9. **The CTA copies the tile's 14px radius.** That makes the logo's one soft
   corner look like a button style, and weakens both.
10. **Every tilt is a different angle:**
    - tile 3deg
    - Roundel 12deg
    - stickers ±6deg (`index.astro:201,204`)
    - glyph tile −6deg (`index.astro:298`)
    - footer stickers −6 to 6deg (1661–1680)
    - 404 heading −1deg (`404.astro:57`), which is also the only rotated text
11. **Glass on a brutalist header.** A 94% alpha ground with a 10px backdrop
    blur (`Header.astro:39`) is the most generic, templated effect on the site.
12. **Soft light in three places:** the 404 starfield's radial-gradient glow
    dots, the hero canvas vignette, and the canvas blur. All three are feathered
    edges in a design whose argument is hard edges.
13. **Borders pick 4 or 8 with no rule.** A card is 8, `.post-contents` 4, a
    contact card 8, stat tiles 8 in gold (the only gold border outside the
    tile), and prose figures use `ring-4` rather than a border.
14. **Raw spacing everywhere.** Twelve margin values and sixteen gap values in
    markup, `p-2.5`/`p-5`/`gap-3.5` half-steps, and a footer written in raw px
    that `check:tokens` cannot see.
15. **Headings styled out of level.**
    - "In this post" and "Tags" are h2s at 13px label size (`[slug].astro:92,116`).
    - The 404 h1 and the tag-page h1 are at h2 size (`404.astro:57`,
      `tag/[tag]/index.astro:67`).
    - Credits h2s and two about h2s are at h3 size.
    - Career has an h2 styled as a standfirst (`career.astro:184`).
16. **Hover states are dead in two places:**
    - The `.card-link` hover (1056) is in the components layer, and the
      element's own `text-text` utility beats it, so linked cards never
      respond.
    - The mobile menu's scoped rule (`MobileMenu.vue:250`) is unlayered, so it
      beats `hover:text-cyan` on every menu link.
17. **Dead code:** `.btn-gold-secondary`. (`.label-wide` was listed here in
    error; it was used 17 times.)

### 1.4 Accessibility audit

Each item is confirmed from source unless it says it depends on geometry.

| #   | Finding                                                                                                                                                                                                             | Where                                                                          | Criterion                                 | Status                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------- |
| A1  | The error-summary link for the message field points at `#contact-body`; the textarea id is `contact-message`, so the link goes nowhere                                                                              | `ContactForm.astro:51`, `lib/contact-form.ts:112–116`, `ContactForm.astro:118` | 3.3.1, 2.4.3                              | **fail**                                                |
| A2  | Required fields carry `required` but no visible "required" text or marker                                                                                                                                           | `ContactForm.astro:60,83,113`                                                  | 3.3.2                                     | **fail**                                                |
| A3  | The invalid state changes the border from `#5A87A8` to `#FF007A`, which is **1.01:1** against each other: no visible change in the field's own boundary. The error message text is what currently carries the state | global.css:1951                                                                | 1.4.11 (state), 1.4.1                     | weak: passes on the message, fails as a boundary change |
| A4  | Home-link focus ring crosses the tile's pink shadow at 2.31:1 along about 48px of its bottom edge                                                                                                                   | Header.astro:70–75, global.css:525                                             | 1.4.11                                    | fail on a segment; computed from geometry, not measured |
| A5  | No `novalidate`: the browser's validation bubbles run before the site's error summary, so a first submit gets engine-specific, briefly shown messages instead of the tested pattern                                 | `ContactForm.astro:58`                                                         | 3.3.1 (consistency)                       | risk                                                    |
| A6  | Error summary carries both `role="alert"` and `autofocus`/`tabindex="-1"`, so it can be announced twice                                                                                                             | `ContactForm.astro:42`                                                         | best practice                             | minor                                                   |
| A7  | Translucent, blurred header with no `prefers-reduced-transparency` fallback                                                                                                                                         | Header.astro:39                                                                | not a WCAG criterion                      | minor                                                   |
| A8  | Alt text that restates the role: "group photo" ×3, "The sinduri.lol logo"                                                                                                                                           | `about.astro:486`, `five-years-in-drupal.md:48,58`, `BaseLayout.astro:86`      | 1.1.1 quality                             | minor                                                   |
| A9  | Heading visual size does not follow level (list in 1.3 item 15)                                                                                                                                                     | as listed                                                                      | 1.3.1 passes; hierarchy cue is unreliable | minor                                                   |
| A10 | Focus ring colour equals the fill of every gold control and the colour of every link. The offset makes it pass, but it is not distinctive                                                                           | global.css:526                                                                 | 2.4.7 passes                              | design debt                                             |

Checked and passing:

- **Targets.** No interactive element is under 24 × 24px. Smallest bounded:
  breadcrumb links about 32px, footer links 30px from `md`, chips about 40px,
  motion toggle 40px.
- **Motion.**
  - Two CSS transitions: hamburger 150ms (`MobileMenu.vue:113–122`) and
    footer sticker 150ms (global.css:1628). Both are neutralised by the
    reduced-motion block (global.css:1905).
  - The hero canvas stops under reduced motion and has a pause control
    (`HeroField.vue:361`).
- **Semantics.** No `div`/`span` click handlers. Both dialogs are native
  `<dialog>` with `showModal()`. The skip link exists
  (`BaseLayout.astro:284`). Landmarks are named without the role word.
- **Images.** No missing `alt`, and no decorative image with non-empty `alt`.
- **Colour.** Every text pairing in use passes AA. The lowest is `border`-coloured
  text on the bolt at 3.21, which is large or non-text only. Body text is at
  least 10.26.

Not measured in this audit, and already open in `tmp/TODO.md` and
`docs/MANUAL_TESTING.md`: 400% zoom, text-only 200% zoom, a screen reader
pass, and reduced motion by hand.

---

## Part 2. Direction

### Principles

1. **Edges, not tints.**
   - **Rule:** every object is marked off by a `line` border, and no fill tint
     is ever the only thing separating it.
   - **Why:** the tile is identified by its fill against the ground (11.99)
     and outlined by a line-coloured border; nothing else here gets that
     treatment. Raw structure means you can see where one thing ends.
2. **Two line weights, two shadow sizes, one shadow colour.**
   - **Rule:** borders are 4px (controls, small objects) or 8px (structure:
     cards, rules, the header edge). Shadows are 4px (controls) or 8px
     (objects), always pink, always zero blur.
   - **Why:** the tile's 4px border and 8px pink shadow are that system at
     its smallest.
3. **One job per colour.**
   - **Rule:** gold is the page title, the primary action and "you are here".
     Pink is depth and error. Cyan is interaction only: hover and focus.
     `line` is boundary. `ink` is words.
   - **Why:** today gold does eight jobs (1.3 item 1), so it means nothing.
4. **Flat and opaque.**
   - **Rule:** no alpha, blur, gradient, glow or feathered edge anywhere.
   - **Why:** béton brut is the honest surface of the material. A frosted
     header is the opposite of that.
5. **Square by default.**
   - **Rule:** radius is 0. The tile and its two drawn copies (404, about)
     keep 14px. Circles appear only where the circle is the meaning: the
     roundel, cast-block bolts, radio buttons.
6. **Binary type.**
   - **Rule:** Lexend at 400 and 900, nothing between. Uppercase for structure
     (headings, labels, buttons), sentence case for reading. Hierarchy comes
     from size and case.
   - **Why:** 700 and 800 next to 900 read as a rendering error, not a choice.
7. **Show state, do not tween it.**
   - **Rule:** state changes are instant. A pressed button moves 4px into its
     shadow and the shadow disappears. Nothing eases, fades or slides.
8. **The grid is visible where it is structural.**
   - **Rule:** the cast-block wall stays as the one place the grid is drawn.
     It is concrete formwork, literally brutalist. Nowhere else draws grid
     lines as decoration.

### Where brutalism and accessibility pull apart

- **Heavy uppercase and tight tracking harm reading.**
  - **Resolution:** uppercase only on headings, labels and buttons, never on
    running text.
  - Negative tracking only at 26px and above (h1, h2). Labels get +0.1em.
  - A heading word over twelve characters takes a soft hyphen (existing rule,
    kept).
- **Loud accents against 4.5:1.**
  - **Rule:** `pink` `#FF007A` never sets text. It is 4.59 on `plate`, but
    3.59 on `joint`, where hero text crosses.
  - `pink-text` `#FF79B6` carries every pink glyph.
- **The hard shadow looks like a focus ring, and the ring crosses it.**
  - **Resolution:** the ring is cyan, a colour that appears only on
    interaction. It is offset past the element's own shadow (the `--lift`
    rule in 3.1.5), so it only ever touches ground: 11.20.
- **Brutalism would signal error by colour.**
  - **Resolution:** `pink` against `line` is 1.01:1, so colour cannot carry
    it. An error is a shape change, the edge going from 4px to 8px, plus a ✕
    mark, plus words.
- **Tilt is expressive and hurts reading.**
  - **Resolution:** tilt is for marks only (tile, roundel, stickers), at one
    angle, 3deg. Text is never rotated.
- **Disabled controls would be greyed out,** which fails 1.4.11 for users who
  need to find them.
  - **Resolution:** disabled is shown by a dashed edge and no shadow. The label
    stays at 8.62:1 and the control stays focusable (`aria-disabled`).
- **Raw density against 320px reflow.**
  - **Resolution:** spacing tokens are fluid, and every 8px border is counted
    in the 288px content box before any heading floor changes.

### Remove entirely

- Header translucency and blur:
  - `bg-header-bg backdrop-blur-header` at Header.astro:39
  - `--color-header-bg` at global.css:122
  - `--blur-header` at global.css:376
- Starfield radial gradients: global.css:1978–2000, `404.astro:86`.
- Canvas vignette and blur: `hero-field.ts:473–489`, `HeroField.vue:245`.
  **This reverses a confirmed decision:** the homepage hero was approved as
  final on 2026-09-19. Only the feathering is proposed for removal; the field,
  the hare and the pause control stay.
- `rounded-nav` on the CTA, global.css:612.
- Rotated text: `-rotate-1` at `404.astro:57`.
- Shadow tokens gold-8/6/4, pink-12/6 and cyan-8/6, global.css:254–263.
- Colour tokens `muted`, `deep`, `bolt` and `header-bg`.
- `ring-4` on prose figures, global.css:1312.
- The gold border on stat tiles, `index.astro:257`.
- The 150ms transitions on the hamburger and footer stickers.
- `.btn-gold-secondary`, which is unused, and `.label-wide`, merged into
  `.label`.

---

## Part 3. Styleguide

### 3.1 Tokens

Names are the Tailwind `@theme` names they would become. For example,
`--color-ground` gives `bg-ground` and `text-ground`.

#### 3.1.1 Colour

| Token            | Hex       | Role                                             | Replaces                                       |
| ---------------- | --------- | ------------------------------------------------ | ---------------------------------------------- |
| `ground`         | `#131313` | page, header, footer, dialogs, backdrops         | `background`, `deep`, `header-bg`, `gold-text` |
| `plate`          | `#1A1A1A` | fill of cards, inputs, chips, secondary buttons  | `surface`                                      |
| `line`           | `#5A87A8` | every boundary                                   | `border`                                       |
| `joint`          | `#262F36` | cast-block joints and bolts only                 | `joint`, `bolt`                                |
| `ink`            | `#E5E2E1` | all reading text, h2–h6                          | `text`, `muted`                                |
| `ink-quiet`      | `#9BB4C6` | captions, meta, helper text, footer policy links | `subtle`                                       |
| `gold`           | `#FFC000` | h1, primary fill, current-state fill, the tile   | `gold`                                         |
| `pink`           | `#FF007A` | every hard shadow, error edge, destructive edge  | `pink`                                         |
| `pink-text`      | `#FF79B6` | error text, destructive label, pink glyphs       | `pink-text`                                    |
| `cyan`           | `#00DCFD` | focus ring, hover                                | `cyan`                                         |
| `on-accent`      | `#131313` | text and glyphs on gold or cyan fills            | `background` used as text                      |
| `gold-muted`     | `#3A3020` | secondary text on the gold surface               | kept                                           |
| `gold-line`      | `#22394D` | borders on the gold surface                      | `gold-border`                                  |
| `darkcyan`       | `#00363F` | links on the gold surface                        | kept; no longer text on cyan                   |
| `gold-btn-label` | `#FFFFFF` | label on the dark button on gold only            | kept                                           |

**Approved foregrounds on each ground.** Text needs 4.5, and large text and
non-text need 3.0. Ratios below the threshold for a role are banned for that
role.

| Foreground                           | on `ground` | on `plate` | on `joint` | on `gold`            | on `cyan`   |
| ------------------------------------ | ----------- | ---------- | ---------- | -------------------- | ----------- |
| `ink`                                | **14.42**   | **13.51**  | **10.57**  | 1.27 banned          | 1.29 banned |
| `ink-quiet`                          | **8.62**    | **8.07**   | **6.31**   | 1.31 banned          | 1.30 banned |
| `line` (non-text)                    | **4.84**    | **4.53**   | **3.54**   | 2.34 banned          | 2.32 banned |
| `gold`                               | **11.32**   | **10.60**  | **8.29**   | n/a                  | 1.01 banned |
| `cyan` (ring, hover text)            | **11.20**   | **10.49**  | **8.21**   | 1.01 banned          | n/a         |
| `pink` (non-text only)               | **4.90**    | **4.59**   | **3.59**   | 2.31 decoration only | 2.29 banned |
| `pink-text`                          | **7.66**    | **7.18**   | **5.62**   | 1.48 banned          | 1.46 banned |
| `on-accent`                          | n/a         | n/a        | n/a        | **11.32**            | **11.20**   |
| `gold-muted`                         | n/a         | n/a        | n/a        | **7.88**             | n/a         |
| `gold-line` (non-text)               | n/a         | n/a        | n/a        | **7.27**             | n/a         |
| `darkcyan`                           | n/a         | n/a        | n/a        | **8.00**             | n/a         |
| `ground` on `ink` (badge)            | **14.42**   |            |            |                      |             |
| `gold-btn-label` on `on-accent` fill | **18.58**   |            |            |                      |             |

Pairs that matter because they touch, and are not text:

- `cyan` ring against a `pink` shadow: **2.29**. This is why the ring is
  offset past every shadow (3.1.5).
- `pink` against `line`: **1.01**. This is why error is a shape change, not a
  colour change.
- `ink` against `ink-quiet`: **1.67**. This is why the two text colours cannot
  carry a state difference by themselves.

**Blog categories.** This reverses the approved per-category colour. Today a
category is gold, cyan or pink (`lib/blog.ts:152–166`). Cyan text would now
read as a hovered link. Proposal:

- Category labels are `ink` text.
- The category is carried by the glyph tile fill: `gold`, `pink` with
  `on-accent` (4.90), or `ink` with `ground` (14.42).
- Every category card takes the same pink 8px shadow.

#### 3.1.2 Type

Family: `'Lexend Variable', ui-sans-serif, system-ui, sans-serif`. Weights:
**400 and 900 only.** Nothing below 400 on a dark ground.

| Token                | Size                                  | Line height | Tracking | Weight | Case       | Use                                    |
| -------------------- | ------------------------------------- | ----------- | -------- | ------ | ---------- | -------------------------------------- |
| `text-h1`            | clamp(33px, 9vw, 104px)               | 0.94        | −0.05em  | 900    | upper      | page title, `gold`                     |
| `text-h1-fit`        | clamp(33px, min(9vw, 13svh), 104px)   | 0.94        | −0.05em  | 900    | upper      | homepage only (fits the viewport)      |
| `text-h1-reading`    | clamp(33px, 9vw, 80px)                | 0.94        | −0.05em  | 900    | upper      | Privacy, Accessibility (768px measure) |
| `text-h2`            | clamp(26px, 5.6vw, 64px)              | 0.96        | −0.05em  | 900    | upper      | section heading                        |
| `text-h3`            | clamp(20px, 2.6vw, 32px)              | 1.1         | −0.02em  | 900    | upper      | card title, sub-section                |
| `text-h4`            | clamp(18px, 1.4vw, 20px)              | 1.2         | 0        | 900    | upper      | not in codebase                        |
| h5                   | 16px                                  | 1.2         | 0.1em    | 900    | upper      | not in codebase                        |
| h6                   | `text-label`                          | 1.2         | 0.1em    | 900    | upper      | not in codebase                        |
| `text-article-title` | clamp(28px, 4.8vw, 60px)              | 1.06        | −0.02em  | 900    | as written | post title                             |
| `text-article-h2`    | clamp(22px, 3vw, 36px)                | 1.1         | −0.02em  | 900    | upper      | post section heading                   |
| `text-lead`          | clamp(20px, 2.6vw, 32px)              | 1.3         | 0        | 400    | sentence   | lead, standfirst                       |
| `text-body`          | clamp(17px, 1.2vw, 19px)              | 1.62        | 0        | 400    | sentence   | running text                           |
| `text-small`         | 15px                                  | 1.5         | 0        | 400    | sentence   | captions, meta, helper, post contents  |
| `text-label`         | 14px                                  | 1.2         | 0.1em    | 900    | upper      | nav, buttons, chips, field labels      |
| `text-sticker`       | clamp(18px, min(2.1vw, 3.4svh), 30px) | 1.02        | 0        | 900    | upper      | homepage stickers only                 |

Retired, with where each goes:

- `post-card` → `text-h3`, keeping the post's own case.
- `post-card-feature` → `text-article-title`. **Its floor rises from 18px to
  28px.** Measure the longest post title at 305px before shipping.
- `contents` → `text-small`.
- `section-number` → `text-h3`.
- `copyright` → `text-h4`.
- `footer-name` → `text-h3`, which lowers its ceiling from 40px to 32px.
- `button` → `text-label`.
- MobileMenu's raw clamp → `text-h2`.

The h1 and h2 floors (33px and 26px) and the soft-hyphen rule stay exactly as
the design-system skill derives them. Two changes widen glyphs, so both need
`tests/reflow.spec.ts` and `tests/header-fit.spec.ts` re-run:

- h3 at 900 instead of 800, with −0.02em instead of −0.04em.
- `text-label` at 14px instead of 13px.

#### 3.1.3 Spacing

Base unit 4px. Allowed Tailwind steps: **1, 2, 3, 4, 6, 8, 12, 16, 24** (4,
8, 12, 16, 24, 32, 48, 64, 96px). Banned:

- half steps (0.5, 2.5, 3.5)
- odd steps (5, 7)
- 10, 14, 20 and 28

Layout tokens, fluid between 390px and 1200px:

| Token               | Value                    | Use                                    | Change                           |
| ------------------- | ------------------------ | -------------------------------------- | -------------------------------- |
| `--spacing-section` | clamp(56px, 8vw, 96px)   | between sections                       | kept                             |
| `--spacing-head`    | clamp(32px, 4vw, 48px)   | heading to content, content to actions | absorbs `actions`                |
| `--spacing-grid`    | clamp(28px, 3.4vw, 40px) | between cards                          | kept                             |
| `--spacing-inline`  | clamp(16px, 2vw, 24px)   | between inline controls                | kept                             |
| `--spacing-card`    | clamp(24px, 3vw, 40px)   | card padding                           | replaces `card` and `card-tight` |
| `--spacing-target`  | 24px                     | minimum target                         | kept                             |
| `--spacing-header`  | 96px                     | header height                          | kept                             |

Sizes, not spacing: `--size-control` 48px (icon buttons, menu trigger,
stickers), `--size-tuft` 220px or 266px (footer illustration). These replace
the raw px in global.css:1621–1841.

#### 3.1.4 Borders, radius, shadow

| Token            | Value                         | Use                                                                                    |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| `--border-thin`  | 4px                           | controls, chips, inputs, photos, nav items, table cells, the tile                      |
| `--border-thick` | 8px                           | cards, dialogs, alerts, the header's bottom edge, `hr`, blockquote rule, error summary |
| `--radius-tile`  | 14px                          | the logo tile and its two copies (404, about); nothing else                            |
| `--radius-round` | 9999px                        | roundel, bolts, radio buttons                                                          |
| `--shadow-sm`    | `4px 4px 0 var(--color-pink)` | buttons, current nav item, current tag                                                 |
| `--shadow-lg`    | `8px 8px 0 var(--color-pink)` | cards, dialogs, a photo on the hero wall, the roundel, the tile                        |
| `--shadow-none`  | `none`                        | pressed and disabled controls                                                          |
| `--tilt`         | 3deg                          | marks only: tile, roundel, stickers (± by position)                                    |

#### 3.1.5 Focus

Defined once, in the base layer, and reused everywhere:

```css
:root {
  --focus-width: 4px;
  --focus-gap: 4px;
  --focus-color: var(--color-cyan);
}

:focus-visible {
  outline: var(--focus-width) solid var(--focus-color);
  outline-offset: calc(var(--focus-gap) + var(--lift, 0px));
}
```

- `--lift` is set wherever a hard shadow is set: 4px beside `shadow-sm` and
  8px beside `shadow-lg`, and 8px on the home link for the tile. The ring then
  always lands on ground, past the shadow's reach, and never touches pink.
- Ratios: cyan against `ground` **11.20**, against `plate` **10.49**, against
  `joint` **8.21**.
- The ring change against the unfocused state (SC 2.4.13, AAA, met anyway):
  4px of cyan over ground, ≥ 2px perimeter, 11.20:1.
- On `.surface-gold`: `--focus-color: var(--color-on-accent)`, **11.32** on
  gold. The two-tone ring on the dark button on gold stays as specified in the
  design-system skill: inner white 18.58, outer `#131313` 11.32.
- Never `outline: none` without a replacement, and never `outline-offset: 0`.
- **Coupled changes:**
  - MobileMenu's scroll padding (`MobileMenu.vue:214`) goes from 6px to
    `calc(var(--focus-width) + var(--focus-gap) + 8px)`.
  - Its inward offset (`:233`) goes from −6px to −8px.
  - `keepInView` already reads the live values.

#### 3.1.6 Breakpoints

In rem, so browser zoom triggers them. These are Tailwind's defaults and are
unchanged:

- `sm` 40rem (640px)
- `md` 48rem (768px)
- `lg` 64rem (1024px)
- `xl` 80rem (1280px)

Layout decisions sit at `sm` (gutter), `md` (desktop nav) and `lg` (header
grid, multi-column). `xl` is used only by the post layout's contents column.

### 3.2 Elements

In each table, "focus-visible" means the token in 3.1.5 unless the row says
otherwise. `:focus` without `:focus-visible` draws nothing extra.

#### Navbar (excluding the tile) and mobile nav

Markup, unchanged:

- `<header>` containing the home link, then `<nav aria-label="Primary"><ul>`,
  then the CTA outside the list.
- The current item carries `aria-current="page"`.
- The noscript `<nav>` stays as it is.

Header: `ground` fill, opaque, `--border-thick` bottom edge in `line` (4.84),
96px tall, sticky. `html { scroll-padding-top: calc(96px + 1rem) }` stays.

| State         | Nav link (`text-label`, 4px border, 8/16px padding, about 41px tall) |
| ------------- | -------------------------------------------------------------------- |
| default       | `ink` text (14.42), transparent border                               |
| hover         | `cyan` text (11.20); geometry unchanged                              |
| focus-visible | ring; offset 4px, or 8px when current                                |
| active        | as hover                                                             |
| current       | `line` border (4.84), `shadow-sm`, `--lift: 4px`, `ink` text         |

CTA ("Get in touch"): `.btn-primary` at the small size, 12/16px padding, about
49px tall. **No radius.** Current page: `inset 0 0 0 4px var(--color-on-accent)`
on the gold fill (11.32), plus `aria-current="page"`.

Mobile menu: the trigger and dialog as today (`MobileMenu.vue`).

- **Trigger:** 48 × 48px, `plate` fill, 4px `line` border, gold bars. Hover:
  bars `cyan`. Its name stays "Menu", with `aria-expanded`.
- **Dialog:** full-bleed `ground` panel with an opaque `ground` backdrop. Links
  are `text-h2` in `ink`; hover is `cyan`, which requires removing the scoped
  colour rule at `MobileMenu.vue:250`. The current link uses the desktop
  current treatment. Close is a `.btn-secondary` at full width.
- **Keyboard:** `showModal()` traps focus, Escape closes, focus returns to the
  trigger, Tab order is links → CTA → Close.
- **Motion:** the hamburger becomes an X instantly, with no transition.

#### Skip-to-content link

- Markup: first child of `<body>`, `<a class="skip-link" href="#main">Skip to
content</a>`, target `<main id="main" tabindex="-1">`. Exists at
  BaseLayout.astro:284 and 299.
- Style: `.btn-primary` look (gold, `on-accent` 11.32, 4px `line` border,
  `shadow-sm`). Positioned at top 16px, left 16px, z above the header.
- Hidden by `translate: 0 calc(-100% - 24px)`. On `:focus` it moves to
  `translate: 0 0` instantly. Never `display: none`.
- Focus-visible: ring with `--lift: 4px`.

#### Headings h1–h6

- Sizes from 3.1.2.
- Colour: h1 `gold` (11.32); h2–h6 `ink` (14.42).
- One `h1` per page, no skipped levels.
- **The level decides the size.** A heading that needs to look smaller is the
  wrong level, or it is not a heading. Concretely:
  - "In this post" and "Tags" (`[slug].astro:92,116`) stay h2, at `text-h4`,
    because it is the nearest step that still reads as a heading.
  - The 404 and tag-page h1 go to `text-h1`.
  - Credits h2s go to `text-h2`, or become h3 under one h2.
- `overflow-wrap: break-word`. Soft hyphen above twelve characters.
  `text-wrap: balance`.
- Negative tracking only on h1 and h2.

#### Body, small text, captions, lists, blockquotes, inline code

| Element                         | Spec                                                                                                              | Ratio                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Body `p`                        | `text-body`, `ink`, max 48rem (about 67ch)                                                                        | 14.42 / 13.51 on plate          |
| Lead                            | `text-lead`, `ink-quiet`, max 42rem                                                                               | 8.62                            |
| Small, caption (`figcaption`)   | `text-small`, `ink-quiet`, 12px above                                                                             | 8.62 / 8.07                     |
| `ul` / `ol`                     | 24px inline-start padding, 12px between items, markers `gold`                                                     | markers 11.32                   |
| `blockquote`                    | 8px `gold` inline-start border, 24px padding, text `ink`, `<p>` inside; cite in `<figcaption>` under a `<figure>` | 14.42                           |
| Inline `code` (not in codebase) | 0.9em monospace, `plate` fill, 2px `line` border, 0 4px padding                                                   | `ink` on plate 13.51; edge 4.53 |
| `strong`                        | 900, `ink`                                                                                                        | 14.42                           |

`ink` replaces `muted` for body copy. That is the largest visible change in
this proposal: running text becomes brighter (10.95 → 14.42).

#### Links

| State         | Inline (in a sentence)                                | Standalone (list of destinations, cards, footer)   |
| ------------- | ----------------------------------------------------- | -------------------------------------------------- |
| default       | `ink`, underline 2px at 0.2em offset                  | `ink`, no underline, `text-label` or heading style |
| hover         | `cyan`, underline 4px                                 | `cyan`, underline 2px                              |
| focus-visible | ring                                                  | ring                                               |
| active        | as hover                                              | as hover                                           |
| visited       | no change (a portfolio has no need)                   | no change                                          |
| on gold       | `darkcyan` (8.00), underline 2px, hover underline 4px | same                                               |

- The underline is what makes an inline link identifiable. `ink` against
  surrounding `ink` text is 1:1, so colour does nothing there (SC 1.4.1).
- An inline link is exempt from 2.5.8. A link alone in a list item keeps
  `min-height: 24px` (the existing `.link-item` rule, global.css:1246).
- An external link says so in text when it leaves the site in a new tab. This
  site opens none in new tabs, and that should stay the rule.

#### Buttons

All buttons share:

- `text-label`, 4px border, 16px/32px padding, which gives 56.8px
  (16.8 + 32 + 8).
- Square corners, `cursor: pointer`, `--lift` equal to the shadow.
- `<button type="button|submit">` for actions and `<a href>` for navigation.
  Never a `div`.

| State            | Primary                                                                                                                                              | Secondary                                                            | Tertiary                                            | Destructive (not in codebase)                                             | Icon-only                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| default          | `gold` fill, `on-accent` label (11.32), `line` border, `shadow-sm`                                                                                   | `plate` fill, `ink` label (13.51), `line` border (4.53), `shadow-sm` | no box, `ink` label underlined 2px, 24px min height | `plate` fill, `pink-text` label (7.18), `pink` border (4.59), `shadow-sm` | 48 × 48, `plate` fill, `line` border, `gold` glyph (10.60), no shadow |
| hover            | `cyan` fill, `on-accent` label (11.20)                                                                                                               | `cyan` fill, `on-accent` label (11.20)                               | `cyan` label, underline 4px                         | `pink` fill, `on-accent` label (4.90)                                     | glyph `cyan` (10.49)                                                  |
| focus-visible    | ring, offset 8px                                                                                                                                     | ring, offset 8px                                                     | ring, offset 4px                                    | ring, offset 8px                                                          | ring, offset 4px                                                      |
| active           | `translate: 4px 4px`, `shadow-none`                                                                                                                  | same                                                                 | underline 4px                                       | same as primary                                                           | `on-accent` glyph on `cyan` fill                                      |
| disabled         | `aria-disabled="true"`, `ground` fill, **dashed** 4px `line` border, `ink-quiet` label (8.62), `shadow-none`, `cursor: not-allowed`, stays focusable | same                                                                 | `ink-quiet`, no underline                           | same                                                                      | same                                                                  |
| pending (submit) | label changes to "Sending", `aria-disabled="true"`, same look as disabled                                                                            | n/a                                                                  | n/a                                                 | n/a                                                                       | n/a                                                                   |

- The destructive label names the action ("Delete draft"), so the pink is
  never the only cue.
- An icon-only button has `aria-label`, and the SVG is `aria-hidden="true"
focusable="false"`. A toggle keeps a constant name with `aria-expanded`, or
  puts the state in the name for transport controls, as the hero pause does
  today.
- A submit button is never disabled; validation runs and reports.
- On the gold surface: `.btn-gold-primary` keeps its spec (dark fill, white
  label 18.58, two-tone ring), with padding moved to 16/32px and the shadow
  to `shadow-sm`. `.btn-gold-secondary` is deleted until something uses it.

#### Form controls

Markup:

```html
<form method="post" action="/contact/send/" novalidate>
  <div class="error-summary" tabindex="-1" aria-labelledby="errors-h">…</div>
  <div class="field">
    <label class="field-label" for="contact-email"
      >Email <span class="req">(required)</span></label
    >
    <p class="field-help" id="contact-email-hint">Only used to reply to you.</p>
    <input
      id="contact-email"
      name="email"
      type="email"
      autocomplete="email"
      required
      aria-describedby="contact-email-hint"
    />
    <!-- on error: aria-invalid="true", and the error id goes FIRST in aria-describedby -->
    <p class="field-error" id="contact-email-error">
      Enter an email address, like name@example.com
    </p>
  </div>
</form>
```

| Part                       | Spec                                                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field stack                | label, help, control, error; 12px between them; 32px between fields                                                                                                                                                                                                     |
| Label                      | `text-label`, `ink` (14.42). Gold is not used on labels. "(required)" in `text-small` 400, sentence case, `ink-quiet` (8.62), inside the `<label>`                                                                                                                      |
| Help text                  | `text-small`, `ink-quiet`, above the control, linked by `aria-describedby`                                                                                                                                                                                              |
| Input, textarea            | `plate` fill, 4px `line` border (4.53 on plate, 4.84 on ground), `text-body` `ink` (13.51), 12/16px padding, min height 56px; textarea min height 160px, vertical resize                                                                                                |
| hover                      | border `ink` (13.51)                                                                                                                                                                                                                                                    |
| focus-visible              | ring, offset 4px. Inputs use `:focus-visible`, which browsers match for text fields on click too                                                                                                                                                                        |
| error                      | `aria-invalid="true"`; border `pink` plus `box-shadow: inset 0 0 0 4px var(--color-pink)`, which reads as 8px without reflow (a shape change, since colour alone is 1.01 against `line`); message `text-body` `pink-text` (7.18) prefixed by a ✕ glyph in `aria-hidden` |
| disabled                   | native `disabled` (fields, not buttons), dashed border, `ink-quiet` text                                                                                                                                                                                                |
| Placeholder                | not used. If one ever is: `ink-quiet` 8.07, never as the label                                                                                                                                                                                                          |
| Select (not in codebase)   | same box; `appearance: none`, with a ▼ glyph in `::after` on a wrapper (`aria-hidden` by being generated content), 48px right padding                                                                                                                                   |
| Checkbox (not in codebase) | native `<input type="checkbox">`, `appearance: none`, 24 × 24px, 4px `line` border, `plate` fill; checked: `gold` fill (10.60 on plate), `on-accent` tick (11.32); the whole `<label>` is the target, 24px min height, 12px gap                                         |
| Radio (not in codebase)    | same, **circular** (`--radius-round`): the circle is what tells a radio from a checkbox. Checked: `gold` fill with a 4px `on-accent` inset ring, which leaves a gold dot                                                                                                |
| Group                      | `<fieldset>` with `<legend class="label">` for radios and related checkboxes                                                                                                                                                                                            |

How errors are announced:

1. Submit posts to the server (no JavaScript needed).
2. On failure the page returns with an error summary at the top of the form:
   `tabindex="-1"` and `autofocus`, headed "There is a problem" (or "There
   are N problems").
   - It has one link per error, and each link's `href` is the field's real id.
     Today one is broken (A1).
   - Focus lands on the summary, so the heading and links are read.
3. **Drop `role="alert"`** (A6). Moving focus already announces it, and the
   pair double-announces in some screen readers.
4. Each field repeats its own message beside the control, linked through
   `aria-describedby`.
5. Summary box: `--border-thick` `pink` (4.59 on plate), `plate` fill,
   `--spacing-card` padding, links `pink-text` (7.18) underlined.

Add `novalidate` so every user gets this pattern and not the browser's
bubbles (A5). The `required` attribute stays for autofill and the
accessibility tree.

#### Cards and containers

| Part                                     | Spec                                                                                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card                                     | `<article>` when it is a self-contained item (post, role), otherwise `<div>`; `plate` fill, `--border-thick` `line` (4.53 on plate edge, 4.84 against ground), `--spacing-card` padding, `shadow-lg`, `--lift: 8px`                      |
| Title                                    | heading at the right level, `text-h3`, `ink`                                                                                                                                                                                             |
| Label above title                        | `text-label`, `gold` (10.60 on plate)                                                                                                                                                                                                    |
| Meta                                     | `text-small`, `ink-quiet` (8.07)                                                                                                                                                                                                         |
| Linked card                              | stretched `.card-link::after` over the card; hover: title `cyan` + 4px underline; focus: **ring on the whole card** via `.card:has(.card-link:focus-visible)`, offset 12px, with the link's own outline suppressed only inside that rule |
| Emphasis card                            | one per section at most: `.card.surface-gold`, which uses the gold set (`on-accent` 11.32, `gold-muted` 7.88, `darkcyan` links 8.00, `gold-line` edges 7.27); the pink shadow stays as decoration (2.31, never the delimiter)            |
| Panel (words and pictures as one object) | a card, as now (`Section panel`)                                                                                                                                                                                                         |
| Placeholder box                          | `--border-thick` **dashed** `line`, no shadow; dashed means "absent or unavailable" everywhere                                                                                                                                           |

Every bordered box in 1.2 that is not one of these becomes one:

- contact cards → linked card
- stat tiles → card without shadow
- about `p-5` panels → card
- PhotoTile → plain tile, see images
- `.post-contents` → card with `--border-thin`, because it is navigation
  beside text

#### Tables

Exists only in markdown (`open-source-is-not-just-code.md:151`), styled by
`.prose table`.

- Markup:
  - `<table>` with `<caption>` (`text-label`, `ink`, left).
  - `<th scope="col">` in `<thead>`, and `<th scope="row">` where the first
    column names the row.
  - No layout tables.
- Style:
  - 4px `line` border on the table and every cell (4.53 on plate, 4.84 on
    ground); cells 12/16px padding.
  - `<th>`: `plate` fill, `text-label`, `ink`.
  - `<td>`: `text-small`, `ink`, `tabular-nums` for figures.
- Narrow screens:
  - Keep today's `table-layout: fixed` with `wrap-anywhere` for tables up to
    three columns.
  - A wider table goes inside
    `<div class="table-scroll" role="region" aria-labelledby="<caption id>" tabindex="0">`
    with `overflow-x: auto`, so keyboard users can scroll it. The focus ring
    is on the region.

#### Modals, dropdowns, tooltips

- **Modal:** `<dialog>` + `showModal()`, as in `MobileMenu.vue` and
  `PhotoViewer.astro`.
  - Named by `aria-labelledby` pointing at its heading, or by `aria-label`
    when there is none.
  - Keyboard: focus moves in on open, focus is trapped, Escape closes, focus
    returns to the trigger.
  - A visible "Close" button (`.btn-secondary`), last in tab order unless the
    dialog is long, in which case first.
  - Style: centred panel `max-width: min(40rem, 100% - 32px)`, `ground`
    fill, `--border-thick` `line`, `shadow-lg`, `--spacing-card` padding;
    `::backdrop` opaque `ground`. Below `md`, and for the photo viewer and
    menu, full-bleed.
  - No transition on open or close.
- **Dropdown** (not in codebase): a disclosure, not an ARIA menu.
  - `<button type="button" aria-expanded aria-controls>` followed by a `<ul>`
    of links, `hidden` when closed. `<details>`/`<summary>` works when the
    trigger can be a summary.
  - Keyboard: Enter or Space toggles, Tab moves through the links, Escape
    closes and returns focus to the button, and focus leaving the group closes
    it.
  - Style: panel `plate`, `--border-thin` `line`, `shadow-sm`; items 44px
    tall, hover `cyan`. Never `role="menu"`.
- **Tooltip** (not in codebase): **avoid.** Put the information in visible
  text. If one is unavoidable, make it a toggletip:
  - Markup: a 24 × 24px minimum `<button type="button" aria-expanded
aria-controls>` that shows a panel with `popover`, containing text only.
  - Behaviour: dismissible with Escape, stays open while the pointer is over
    it, and does not vanish on its own (SC 1.4.13).
  - Style: `ink` on `plate` (13.51), `--border-thin` `line`.
  - Never the `title` attribute.

#### Alerts and toasts

- **Inline alert** (the pattern to use):
  - `--border-thick` box, `plate` fill, 16/24px padding.
  - A `text-label` title that names the type in words: "Sent", "Not sent",
    "Note".
  - Error: `pink` edge (4.59) and `pink-text` title (7.18) with ✕. Success:
    `line` edge (4.53) and `ink` title. The words carry the meaning; colour
    backs them up.
- **Live regions:**
  - Status updates use a `role="status"` element that exists in the DOM from
    page load, with text injected later (polite).
  - Urgent, blocking failures use `role="alert"`, which is also present from
    load. Nothing else is assertive.
  - Server-rendered results, such as `/contact/sent/`, need no live region:
    the page load and heading announce them.
  - The photo viewer counter's `aria-live="polite"` (`PhotoViewer.astro:18`)
    is correct and stays.
- **Toast** (not in codebase): **not used.** A static site with server round
  trips has no event that needs one. If one is ever needed:
  - A `role="status"` region at the bottom of the viewport, above the page.
  - No auto-dismiss (SC 2.2.1), a Close button, focus never moved.
  - It must not cover a focused control (SC 2.4.11).

#### Dividers, badges, tags

- **Divider:**
  - `<hr>` in prose only: `--border-thick` top edge in `line` (4.84), 64px
    above and below.
  - No dividers between sections or between the page and the footer. That
    rule was already agreed and is kept.
- **Tag** (link chip, `.chip`, e.g. `BlogListing.astro:115`):
  - `plate` fill, `--border-thin` `line`, `text-label` `ink`, 8/16px padding,
    24px min height (renders about 41px).
  - Hover: `cyan` text. Focus: ring.
  - Current: `gold` fill, `on-accent` (11.32), `shadow-sm`,
    `aria-current="page"`, `--lift: 4px`.
  - Drop the 8px square marker inside the current chip
    (`BlogListing.astro:118`): the fill and `aria-current` already say it.
- **Badge** (a fact, not a link: "Current" at `career.astro:242`, skills):
  - `ink` fill, `ground` text (14.42), `text-label`, 4/8px padding, **no
    border, no shadow**.
  - Being flat and edgeless is what says it cannot be clicked. `<span>`, or
    `<li>` in a list.

#### Images and media frames

- **Photo:** `--border-thin` `line`, no shadow, no tilt, square corners.
  - `object-fit` never crops a face.
  - The Star Trek photo (`about.astro:378`) loses `rounded-full`.
- **Photo on the hero wall:** adds `shadow-lg`, the one case where a photo
  stands forward.
- **Photos inside a panel** (PhotoTile): no border, on a `ground` tile with
  8px padding, instead of the current `p-2.5`.
- **Prose figures:** `border` in place of `ring-4`.
- **Video:** `controls`, captions (`<track kind="captions">`) for any speech,
  never autoplay with sound. The existing focus rule for media controls
  (global.css:538) stays, with the new token.
- **Alt text:**
  - Describe the content in its position.
  - Never "image", "photo", "picture" or "logo" (A8).
  - `alt=""` for decoration and for images repeated by adjacent text.
  - Linked image: its alt is the link's name.
  - Never put text over a photo.
  - `figcaption` is visible text, not a copy of the alt.

#### Footer

- `<footer>` (contentinfo, unnamed), `ground`, no separator from the page.
- Two named navs: `aria-label="Site"` and `aria-label="About this site"`.
  Social links are a `<ul>` inside a `<nav aria-label="Social">`, as today
  (`Footer.astro:92–126`).
- **Name:** `text-h3`, `ink`.
- **Page links:** `text-label` `ink` (14.42), `py-3` (12px), which gives a
  40.8px target; `py-2` from `md` gives 32.8px. Hover `cyan`.
- **Policy links:** same, in `ink-quiet` (8.62).
- **Stickers:**
  - 48 × 48px (`--size-control`) at every width, `--border-thin`.
  - Rotation ±3deg by position, and 0 on hover, **instantly**.
  - Fills: `gold` with an `on-accent` glyph (11.32), `plate` with a
    `pink-text` glyph (7.18), or `ink` with a `ground` glyph (14.42).
  - Shadow `shadow-sm` pink, `--lift: 4px`.
  - The link name comes from sr-only text, and the SVG is `aria-hidden`
    (as today).
- **Copyright:** `text-h4`, `ink-quiet` (8.62).
- The tuft keeps its forced-colours handling (global.css:1859–1885).

#### Loading and empty states

- **Loading:** none exist, and a static site should not grow any. Server
  round trips show the next page. Two cases need something:
  - **Contact submit:** the button label becomes "Sending" with
    `aria-disabled="true"` until the response arrives. This needs a small
    plain script, with no island.
  - **Photo viewer image:** the frame shows `ink-quiet` text "Loading photo"
    in a `role="status"` region until `load`. No spinner, and nothing
    rotates.
- **Empty:** the existing "No posts yet" card (`BlogListing.astro:134–141`)
  is the pattern.
  - A `text-h3` sentence saying what is missing, one `text-body` sentence
    saying why, and one standalone link to where the reader can go ("All
    posts").
  - Card style with no shadow, because it is not an object you can act on.
  - Three of five category pages are empty today (`tmp/TODO.md`), so this
    state is common, not an edge case.

### 3.3 Layout

- **Column:** `max-width: 80rem` (1280px), centred, inside the `.page-gutter`
  of 16px below `sm` and 24px from `sm`. The gutter is on `<header>`, `<main>`
  and `<footer>`, the column on the element inside them. This is unchanged,
  and `tests/alignment.spec.ts` guards it.
- **Grid:** no fixed 12-column grid. Card grids use
  `repeat(auto-fill, minmax(min(100%, 17rem), 1fr))` with `--spacing-grid`
  gaps, giving 1 column below about 600px, 2 around `md` and 3 from `lg`,
  with no breakpoint code. Two-part panels (text beside picture) are one
  column below `lg` and `1fr 1fr` from `lg`.
- **Reading measure:** 48rem (768px), which is about 67 characters of
  `text-body` at 19px. Prose, reading-page heroes and the post column all use
  it. The post contents column appears beside it from `xl`.
- **Vertical rhythm:** `--spacing-section` between sections,
  `--spacing-head` from heading to content and from content to actions,
  `--spacing-grid` between cards. Inside prose: 24px between blocks, 64px
  before an h2, 48px before an h3.
- **Full-bleed:** only the hero wall and the gold surface, by negative inline
  margins equal to the gutter (`.band`).
- **Reflow to 320px:**
  - The content box is 288px at 320px, or 273px with a classic 15px
    scrollbar.
  - An 8px-bordered card with `--spacing-card` at its 24px floor leaves 224px
    or 209px for text, where the h3 floor of 20px fits every current word.
    `tests/reflow.spec.ts` must be re-run after the h3 weight change.
  - Nothing scrolls horizontally except the photo strip (a focusable
    `tabindex="0"` region, already named) and wide tables in their scroll
    region.
- **200% zoom:** every size is rem or `clamp()` with a rem-convertible floor,
  and breakpoints are in rem. The header stays at 96px and was measured
  acceptable at 400% (design-system skill). Its opacity change means content
  no longer shows through it at any zoom.

### 3.4 Motion

The brutalist stance: things change state, and they do not travel between
states. Duration 0 is the default. One token covers everything:
`--duration-instant: 0ms`.

| What                               | Proposal                                                                                                              | Duration, easing | Reduced-motion fallback                                     | Why it fits                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Button press                       | `translate: 4px 4px`, shadow removed                                                                                  | 0ms              | no translate, shadow removed only                           | the object moves into its own shadow: physical, not decorative   |
| Hover colour changes               | instant                                                                                                               | 0ms              | same                                                        | a tween on a colour swap is polish, and brutalism refuses polish |
| Hamburger to X                     | swap instantly (remove `transition-transform duration-150`, `MobileMenu.vue:113–122`)                                 | 0ms              | same                                                        | state, not animation                                             |
| Footer sticker straighten on hover | instant (remove global.css:1628)                                                                                      | 0ms              | no rotation at all                                          | a stamp snapping straight                                        |
| Skip link reveal                   | instant                                                                                                               | 0ms              | same                                                        | already the case                                                 |
| Dialog open or close               | instant                                                                                                               | 0ms              | same                                                        | already the case                                                 |
| Photo strip buttons                | `scroll-behavior: smooth` only under `prefers-reduced-motion: no-preference` (as `photo-viewer.ts:14` already checks) | browser default  | `auto`                                                      | smooth scroll tells you where you went; turned off on request    |
| Homepage hero field                | kept: canvas stems and hare, paused by the visible control (SC 2.2.2); **feathered vignette and blur removed**        | frame-driven     | not animated, one still frame, no control rendered (as now) | the one moving thing on the site, on purpose, with a hard edge   |
| Page-load or scroll-in effects     | **none**                                                                                                              | n/a              | n/a                                                         | content is at rest when the page loads                           |

The global reduced-motion block (global.css:1905–1914) stays as a backstop.
Nothing may flash more than three times a second (SC 2.3.1).

---

## Migration plan

Ordered by impact. **Steps 1 and 2 fix accessibility failures; do them first.**
Each step is one pull request with its own tests. Every step that changes a
ratio updates ARCHITECTURE.md, ACCESSIBILITY.md §5 and the
`sinduri-design-system` skill in the same commit, as the skill requires.

1. **Contact form failures (A1, A2, A3, A5, A6). Accessibility.**
   - `src/lib/contact-form.ts`: rename the field `body` to `message`, or map
     it in the summary link, so `#contact-message` resolves.
   - `src/components/ContactForm.astro`: add "(required)" inside each label,
     `novalidate` on the form, drop `role="alert"`, and put the error id first
     in `aria-describedby`.
   - `src/styles/global.css:1924–1969`: invalid inset ring, ✕ on
     `.field-error`, labels in `ink`.
   - Tests: the contact-form and worker specs gain "every summary link
     resolves to a field" and "required is visible in the label".
2. **Focus token (A4, A10). Accessibility.**
   - `global.css:525–541`: the token from 3.1.5, plus `--lift` beside every
     hard shadow.
   - `Header.astro:70`: `--lift: 8px` on the home link.
   - `MobileMenu.vue:214,233`: scroll padding and inward offset.
   - `global.css:1408–1452`: the gold-surface ring colour.
   - Tests: `tests/focus.spec.ts` (ring colour, offset, and a pixel check that
     the home-link ring never lands on pink) and `tests/gold-surface.spec.ts`
     (ring assertions).
3. **Alt text and heading levels (A8, A9). Accessibility quality.**
   - `about.astro:486`, `src/content/blog/five-years-in-drupal.md:48,58`,
     `BaseLayout.astro:86`.
   - `[slug].astro:92,116`, `404.astro:57`, `blog/tag/[tag]/index.astro:67`,
     `credits.astro:104–214`, `career.astro:184`.
   - Needs your wording for the alt text changes. The alt text is functional
     microcopy, but it describes your photos.
4. **Colour roles.**
   - `global.css` `@theme` (50–122): add `ground`, `plate`, `line`, `ink`,
     `ink-quiet`, `on-accent`; remove `muted`, `deep`, `bolt`, `header-bg`.
   - `Header.astro:39`: opaque header, no blur.
   - Links in `ink` with underline: global.css:482–516, `CloseRow.astro:20`,
     `credits.astro:77`, `Breadcrumbs.astro:31`.
   - `src/lib/blog.ts:152–166`: category accents.
   - Every `text-muted` use (33) becomes `text-ink`.
   - Tests: `tests/gold-surface.spec.ts`, `tests/contrast-incomplete.spec.ts`,
     and axe across all routes.
5. **Shadows, borders, radius.**
   - `global.css:254–279`: the two pink shadows replace the eight.
   - Every `shadow-hard-*` use (about 50 in markup).
   - `.nav-cta` loses `rounded-nav` (612).
   - `ring-4` becomes `border-4` (1312).
   - `index.astro:257` stat tiles, `Roundel.astro:34` (pink shadow),
     `404.astro:86`, `about.astro:378`.
   - The tile and its copies (`Header.astro:75`, `404.astro:88`,
     `about.astro:202`) do not change.
6. **Buttons and states.**
   - `global.css:545–623`: hover, active, disabled and pending for every
     variant; the CTA becomes a small `.btn-primary`; the gold buttons move to
     16/32px padding; delete `.btn-gold-secondary`.
   - `ContactForm.astro:159`: pending state, with a plain script in
     `src/scripts/`.
   - Fix the dead hovers: the `.card-link` layer order (global.css:1056 against
     `BlogCard.astro:102`, `index.astro:306`) and `MobileMenu.vue:250`.
   - Tests: `tests/target-size.spec.ts` and a hover-colour assertion.
7. **Type consolidation.**
   - `global.css:148–248`: tokens per 3.1.2.
   - Every `font-bold` and `font-extrabold` becomes 400 or 900.
   - `text-label` goes to 14px.
   - `MobileMenu.vue:241` uses a token.
   - Tests: `tests/reflow.spec.ts`, `tests/header-fit.spec.ts`,
     `tests/hero-fit.spec.ts`. The featured post card floor rises from 18px to
     28px.
8. **Spacing.**
   - Merge `actions` into `head`, and `card`/`card-tight` into one fluid
     token.
   - Replace every banned step listed in 1.2.
   - Replace the footer's raw px (global.css:1544–1841) and MobileMenu's
     (205, 224) with tokens.
   - Extend `scripts/check-tokens.mjs` to reject raw px in
     `@layer components` and `rgba()` anywhere.
9. **Soft effects.**
   - `global.css:1978–2000` starfield and `404.astro:86`.
   - `hero-field.ts:473–489` vignette and `HeroField.vue:245` blur. This one
     reverses a confirmed homepage decision, so it needs your yes first.
   - Tests: `tests/motion.spec.ts` must still see the field move and stop.
10. **Transitions.**
    - `MobileMenu.vue:113–122` and global.css:1628.
    - Tests: `tests/motion.spec.ts`.
11. **Documentation.**
    - Fold this file into ARCHITECTURE.md and the design-system skill, then
      delete it or reduce it to a pointer.
    - Update ACCESSIBILITY.md §5 tables and §7 known gaps.

## Decisions this file needs from you

- Whether body copy moves from beige `muted` to `ink` (step 4), the largest
  visible change.
- Whether every shadow becomes pink (step 5), which reverses "gold is
  structure".
- Whether blog categories lose cyan text (step 4).
- Whether the homepage canvas loses its vignette and blur (step 9).
- Whether the tile's mark gets `alt=""` (1.1 flag 2).
