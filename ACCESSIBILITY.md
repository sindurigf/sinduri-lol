# Accessibility

## 1. Project information

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Project             | sinduri.lol                                                |
| Project type        | Static personal website (Astro, Vue islands, Tailwind)     |
| Accessibility owner | Sinduri Guntupalli                                         |
| Public reporting    | https://github.com/sindurigf/sinduri-lol/issues            |
| Private reporting   | lol@sinduri.lol                                            |
| Target standard     | WCAG 2.2 Level AA, with AAA text contrast where achievable |
| Conformance status  | **Target only. No conformance claim.**                     |
| Last reviewed       | 2026-09-05                                                 |

## 2. Commitment

Accessibility is part of whether this site works, not a feature on top of it.

The aims are to:

- reach WCAG 2.2 Level AA, and AAA text contrast wherever the palette allows;
- prefer native HTML over ARIA, so the browser supplies the behaviour;
- verify every colour against every surface it is used on, by measurement;
- keep automated checks in CI so regressions fail the build;
- state plainly what has not been tested, rather than implying coverage;
- fix reported barriers rather than defending them.

## 3. Scope

### In scope

The built static output at `dist/`: every route listed in `tests/routes.ts`,
the layouts, the components, the design tokens, and the Markdown content
rendered through them.

### Not in scope

Third-party sites linked from the footer. The Fontsource package's own site.
Anything a fork of this repository produces after modification.

## 4. Conformance status

**No conformance claim is made.** WCAG 2.2 AA is the target. Parts of the site
have been tested against it; other parts have not been tested at all, and the
site is not finished.

What is currently true:

- Every route the site builds passes axe-core with no violations, at the
  `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` tags.
- No axe rule is disabled and no result is excluded anywhere in the suite.
- Every route also passes axe's **best-practice** rules, which the suite had
  never run: `region`, `heading-order`, `landmark-one-main`, `skip-link` and
  fourteen others executed against this site for the first time in this build
  and found nothing. They run in a block of their own rather than folded into
  the WCAG tags, because none of them is a success criterion and a failure
  should say which of the two things broke.
- **Nothing axe leaves undecided is left undecided.** `analyze()` returns
  violations, passes, incomplete and inapplicable, and until this build the
  suite read only the first. `incomplete` was not empty: eleven `color-contrast`
  nodes across `/`, `/about` and `/contact`, three of them ordinary content —
  the homepage standfirst, the "Read the blog" call to action, and the About
  portrait label. `tests/contrast-incomplete.spec.ts` decides every one by
  walking the paint stack and measuring against the resolved ground. All eleven
  clear their floors; the tightest is 4.90:1 against a 3:1 large-text floor.
- All text colour tokens have been measured against all three dark surface
  colours (`#131313`, `#1A1A1A`, `#0E0E0E`), and against `#FFC000`, which is
  the fourth surface the design uses and the one every dark token fails on.
  An inverted token set covers it; see section 5.
- Every route is checked for horizontal overflow at **two** viewport widths,
  320px and 305px, with and without the SC 1.4.12 text-spacing override
  (`tests/reflow.spec.ts`). 305px is the width a real browser with a classic
  15px scrollbar gives at a 320px CSS viewport, and it used to be a by-hand
  check only.
- The same test asserts the content box each width leaves (288px and 273px)
  and that no heading word is wider than the box it sits in. The second of
  those is new and it found two real defects on its first run.
- Every route is also scanned with the mobile menu dialog **open** at 320px, at
  the same rule tags. Before that, no element inside the panel had ever been
  scanned.
- Every target on the site passes SC 2.5.8 on **its own size**, and that is now
  a test rather than a claim. `tests/target-size.spec.ts` walks every route at
  305px and 1280px and measures each target's own box. The spacing exception is
  not implemented anywhere in the suite, deliberately: relying on it makes the
  gap between two controls load-bearing for conformance, so an unrelated
  spacing change breaks 2.5.8 silently and a long way from the edit. The two
  exceptions the criterion itself grants — an inline link in a sentence, and an
  element with no box — are implemented, and detected structurally rather than
  by class name.

  It was a claim until this build, established by measuring the handful of
  controls that existed then. The count of controls has roughly quadrupled
  since: six filter options, a pager, a pause button, card headings and contact
  cards.

- **Keyboard flow is partly covered.** `tests/focus.spec.ts` walks the tab
  order in both directions on every route at two widths and hit-tests each
  stop, for SC 2.4.11 Focus Not Obscured (Minimum) and SC 2.4.7 Focus Visible.
  It exists because that rule had already failed; see gap 8.
- The same walk now also measures the focus ring against the ground it is drawn
  on, for **SC 1.4.11 Non-text Contrast**. Presence was asserted; perceivability
  was not, so a ring at 1.2:1 would have scored a pass. Across 572 controls at
  both widths the lowest is 10.60:1. `global.css` had claimed 11.32 / 10.60 /
  11.76 against `background` / `surface` / `deep` in a comment since the ring
  was written; that claim now has a test behind it.
- **Windows High Contrast Mode is covered** (`tests/forced-colors.spec.ts`),
  which nothing in the repository had ever set. The mode suppresses every
  `box-shadow`, and this design uses `shadow-hard-*` for the offset blocks that
  give cards and buttons their shape, so anything bounded only by a shadow has
  no edges there. Asserted: nothing sets `forced-color-adjust` away from `auto`,
  every non-link control keeps a painted border or an opaque background, links
  are painted distinctly from body text, and the focus ring keeps a non-zero
  width.
- **Reduced motion is checked site-wide**, not only on the two routes that
  render a badge. Zero elements still animate under
  `prefers-reduced-motion: reduce` across all 23 routes.
- **Every page names itself** (`tests/titles.spec.ts`). axe's `document-title`
  fires only on a missing or empty title and says nothing about two pages
  sharing one. All 23 titles are distinct and name the page before the site.

**None of the above says anything about the words.** Every page currently
carries lorem ipsum, which is Latin inside a `lang="en"` document, so the
criteria that depend on real language — plain language, reading order,
pronunciation, link text out of context — are not merely untested but
unassessable. See gap 7.

Passing axe is not conformance. See section 6.

## 5. Colour and contrast

Every foreground token is measured against all three surfaces. Verified ratios:

| Token      | Value     | `#131313` | `#1A1A1A` | `#0E0E0E` |
| ---------- | --------- | --------- | --------- | --------- |
| `text`     | `#E5E2E1` | 14.42     | 13.51     | 14.98     |
| `muted`    | `#D4C5AB` | 10.95     | 10.26     | 11.37     |
| `subtle`   | `#9BB4C6` | 8.62      | 8.07      | 8.95      |
| `gold`     | `#FFC000` | 11.32     | 10.60     | 11.76     |
| `cyan`     | `#00DCFD` | 11.20     | 10.49     | 11.63     |
| `border`   | `#5A87A8` | 4.84      | 4.53      | 5.02      |
| `pink`     | `#FF007A` | 4.90      | 4.59      | 5.09      |
| `pinkText` | `#FF79B6` | 7.66      | 7.18      | 7.96      |

`text`, `muted`, `subtle`, `gold`, `cyan`, and `pinkText` clear AAA (7:1) on
every surface.

`border` carries every visible boundary and is governed by SC 1.4.11 Non-text
Contrast (3:1). It clears it on all three surfaces.

**The two pinks are split by role, not by size.** `pink` clears AA but not AAA,
so it is restricted to non-text: borders, hard offset shadows, and decorative
fills, where the applicable threshold is the 3:1 of SC 1.4.11. `pinkText` is
AAA on every surface and carries every pink glyph, including the section
number. `pink` is never applied to text at any size, and `pinkText` is never
applied to a border or a shadow.

An earlier version of this rule allowed `pink` on the section number by way of
the WCAG large-text exemption. That held only while the text stayed above
18.66px, and `--text-section-number` is `clamp(24px, 2.8vw, 32px)`, so the
guarantee depended on the type scale. The role split removes the condition.

Two predecessor colours were replaced, for different reasons. `border`'s
predecessor `#504632` measured 2.00 and failed SC 1.4.11. `subtle`'s
predecessor `#9C8F78` measured 5.85 / 5.48 / 6.08 and **passed** SC 1.4.3 AA on
all three surfaces; replacing it was an AA-to-AAA palette decision, not a
conformance fix.

The focus indicator is a 3px gold outline with a 3px offset. The offset is
required: gold against the gold button measures 1.00:1, so a ring flush with the
element would be invisible there. The offset puts surface colour on both sides
of the ring, which is what SC 1.4.11 measures.

One control does not rely on that alone. `.btn-gold-primary`'s ring is the same
colour as its own fill, so it carries a second, inner `#FFFFFF` ring flush to
that fill at 18.58. See "The gold surface is an exception" below. It is the
only control on the site with that problem, and a single-colour ring is correct
everywhere else.

### The gold surface is an exception, and every dark token fails on it

The three surfaces above are not the only ones. The Career hero in the design
comps is `background: #FFC000`: a light ground inside a dark-only palette.
**Measured against `#FFC000`, not one of the foreground tokens above passes.**

| Token      | Value     | on `#FFC000` | Needs | Result |
| ---------- | --------- | ------------ | ----- | ------ |
| `border`   | `#5A87A8` | 2.34         | 3.0   | FAIL   |
| `text`     | `#E5E2E1` | 1.27         | 4.5   | FAIL   |
| `muted`    | `#D4C5AB` | 1.03         | 4.5   | FAIL   |
| `subtle`   | `#9BB4C6` | 1.31         | 4.5   | FAIL   |
| `pinkText` | `#FF79B6` | 1.48         | 4.5   | FAIL   |
| `pink`     | `#FF007A` | 2.31         | 3.0   | FAIL   |
| `cyan`     | `#00DCFD` | 1.01         | 3.0   | FAIL   |

This is structural rather than a bad choice of tones. L(`#FFC000`) is 0.5896,
so the readable band lies below the ground: AAA needs a foreground luminance of
0.0414 or less. On `#131313` the AAA band spans luminance 0.382 to 1.0; on
`#FFC000` it spans 0 to 0.0414, fifteen times narrower. Everything readable on
gold is a near-black.

An inverted set covers it. The first four are AAA on gold:

| Token            | Value     | on `#FFC000` | Job                                     |
| ---------------- | --------- | ------------ | --------------------------------------- |
| `gold-text`      | `#131313` | 11.32        | Body copy, headings, **button borders** |
| `gold-muted`     | `#3A3020` | 7.88         | Secondary copy                          |
| `gold-border`    | `#22394D` | 7.27         | **Structural** rules, dividers, cards   |
| `darkcyan`       | `#00363F` | 8.00         | Links, and the one accent               |
| `gold-btn-label` | `#FFFFFF` | 1.64         | Label on the dark button fill only      |

This table is a copy, not a source. The same rows appear in `AI.md` and in the
design system skill, and the one authority for all three is the live CSS custom
property. `every documented gold ratio matches the live CSS` in
`tests/gold-surface.spec.ts` parses every table here keyed `on #FFC000` and
fails on any row whose hex or ratio disagrees with the running page, naming the
file and line. Retone a token and all three tables fail in the same run; edit a
number by hand and it fails on its own.

There is no `gold-subtle`, because a third step would land near luminance 0.02
and be indistinguishable from `gold-text`. Hierarchy below `gold-muted` on this
surface is weight and size.

`gold-btn-label` is listed for completeness and is the one value there that
fails against gold. It never sits on gold: it is the label on
`.btn-gold-primary`'s `#131313` fill, where it measures 18.58.

**Two border tokens apply on this surface**, split by what the border encloses.
`gold-border` carries structural boundaries: section rules, dividers, card
edges. **Button borders use `gold-text`**, matching their own fill, so the
control reads as one solid block rather than a dark block inside a navy
outline. Both clear SC 1.4.11 on gold several times over, so that split is a
design decision rather than a contrast one.

**Three site-wide rules break silently on this ground and are overridden by the
`.surface-gold` class**, which is the only supported way to build one:

- **Links.** The base layer paints every `<a>` `gold` (1.00 on this ground) and
  `cyan` on hover (1.01). They are repainted `darkcyan` and underlined. The
  underline is required, not stylistic: `darkcyan` measures 1.42 against
  `gold-text`, well under the 3:1 that would let colour carry the distinction
  alone, so the underline is what satisfies SC 1.4.1.
- **Focus (SC 2.4.7, 1.4.11).** The site's ring is gold with a 3px offset, and
  it works elsewhere _because_ of the offset: gold on gold is 1.00, and the
  offset puts the dark page background on both sides of the ring. On a large
  gold surface the offset gap is gold too, so **the ring would be completely
  invisible**. It is repainted `gold-text` (11.32).

  **That mitigation has an assumption in it worth stating generally: it holds
  only while the ring colour differs from the surface behind the element.** It
  breaks whenever a surface matches an accent, which is exactly what the gold
  ground does. Any new surface token needs its own focus ring measured rather
  than inherited, and measured twice: against the surface behind the element,
  which is what the offset gap shows, and against the element's own edge, in
  case the offset is ever reduced. The gold buttons are where the second check
  bites. The ring there is `gold-text`, the same colour as
  `.btn-gold-primary`'s fill and border, so ring-against-fill measures 1.00 and
  only the 3px offset made it 11.32 against what it actually touches.

  **That put the whole indicator on one property staying non-zero**, on the
  single control where getting it wrong hides the indicator completely rather
  than merely weakening it, so `.btn-gold-primary`'s ring is now two rings —
  one for each background it can end up against:

  | Layer                           | Against        | Ratio |
  | ------------------------------- | -------------- | ----- |
  | inner `#FFFFFF`, flush to fill  | `#131313`      | 18.58 |
  | outer `#131313`, beyond the gap | gold `#FFC000` | 11.32 |

  The inner ring is an `inset` `box-shadow` folded in alongside the button's
  pink offset shadow, because `box-shadow` is one property and a rule naming
  only the ring would delete the resting decoration for as long as the button
  had focus. It reuses `gold-btn-label`, the same white at the same 18.58 on
  the same fill, rather than adding a second white token.

  This is not a general pattern. A single-colour ring is sufficient everywhere
  else, `.btn-gold-secondary` included: its fill is transparent, so a ring
  flush to its interior sits on the gold showing through at 11.32.
  `.btn-gold-primary` is the only control whose ring colour equals its own
  opaque fill.

  The offset is unchanged at 3px and is still asserted. It is now redundant
  rather than load-bearing, which was the point: measured with
  `outline-offset: 0`, the offset assertion fails and the ring assertion
  passes, because the inner ring is still 18.58 against the fill.

- **Borders (SC 1.4.11).** The base layer defaults every border to `border`,
  2.34 on gold. The subtree is re-defaulted to `gold-border`.

Neither `.btn-primary` nor `.btn-secondary` may be used on this surface.
`.btn-primary` is `bg-gold`, a 1.00:1 fill; `.btn-secondary` carries
`border-border` (2.34 on gold) and a gold offset shadow (1.00 on gold).
`.btn-gold-primary` and `.btn-gold-secondary` are the pair the comps specify,
scoped to `.surface-gold`. Measured against what each colour actually touches:
the primary label is 18.58 on its own `#131313` fill, the primary fill is 11.32
against gold, and the secondary label and border are both 11.32 against gold.
Both render **59.6px** tall — a 15.6px line box, 18px of padding either side
and a 4px border either side — so each passes SC 2.5.8 on its own size without
the spacing exception. Measured on the real Career hero at 305px, 320px and
1280px, where they are 226.2x59.6 and 197.6x59.6. An earlier version of this
paragraph said 51.6px, which is the padding box with the border left out; the
border is part of the target.

**The pink offset shadow on the primary button measures 2.31 on gold**, under
the 3:1 of SC 1.4.11. That is acceptable only because it carries no meaning:
the control is identified by its `#131313` fill against the gold ground at
11.32. An offset shadow is never allowed to become the thing that delimits a
control here.

`tests/gold-surface.spec.ts` enforces all of this by measuring the rendered
DOM. No section of the site uses the gold ground yet, so the class contract is
tested against a mounted fixture; the route-level text check runs against real
elements (`.skip-link` on every route, `.btn-primary` on `/404`).

## 6. Testing and validation

### What is automated

Playwright drives a real Chromium against the production build. CI runs it on
every push and pull request to `main`, and a violation fails the build.

| Check                | Tool                                | Covers                                            |
| -------------------- | ----------------------------------- | ------------------------------------------------- |
| WCAG rule scan       | axe-core via `@axe-core/playwright` | Every built route                                 |
| Rule scan, menu on   | axe-core at 320px, dialog open      | Every route, with the mobile menu open            |
| Reflow overflow      | Playwright at 320px and 305px       | Every route, with and without SC 1.4.12           |
| Content box width    | Playwright at 320px and 305px       | 288px / 273px, the box the floors assume          |
| Heading word fit     | Playwright at 320px and 305px       | No heading word wider than its own box            |
| Reflow navigation    | Playwright at 320px                 | Menu opens, takes focus, closes on Escape         |
| Route drift          | Playwright                          | Test list matches real build output               |
| Badge route coverage | Playwright over the built `dist/`   | Every route rendering a badge is tested for 2.2.2 |
| Unknown path         | Playwright                          | A path with no page returns 404, not 200          |
| Response headers     | Playwright over the built `dist/`   | The CSP does not break fonts or the menu          |
| HSTS scope           | Playwright over the built `dist/`   | max-age ceiling, no preload/subdomains            |
| Gold-surface text    | Playwright over every route         | Nothing on `#FFC000` below 4.5:1                  |
| Gold-surface class   | Playwright, mounted fixture         | `.surface-gold` text, links, focus, border        |
| Gold-surface buttons | Playwright, mounted fixture         | Label, fill, border, focus, SC 2.5.8 size         |
| Invisible control    | Playwright, mounted fixture         | Fill, or border on all four edges, vs the ground  |
| Two-tone focus ring  | Playwright, mounted fixture         | Both rings and the pink shadow, at zero offset    |
| Token drift          | Playwright, live CSS variables      | The documented ratios against `#FFC000`           |
| Doc table drift      | Playwright, live CSS variables      | The gold tables in AI.md, this file and the skill |
| Type safety          | `astro check`                       | Templates and components                          |

Rule tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

The last two are there for reasons that are not obviously accessibility
reasons, and both are:

- **A 404 that answers 200 is a wrong-answer problem, not an SEO one.** Before
  `src/pages/404.astro` existed, every mistyped or dead URL on the deployed
  site returned the homepage with a success status. A sighted user sees the
  wrong page and can infer what happened from the layout. Someone using a
  screen reader is read the homepage with nothing anywhere in the announcement
  to say the address was wrong, and nothing in the status code for their
  browser to act on.
- **The CSP can silently kill the only navigation at 400% zoom.** Its hashes
  are build output, so an Astro upgrade can invalidate one; the island then
  fails to hydrate and the mobile menu stops opening. At 320px, which is where
  a desktop user at 400% zoom lands (SC 1.4.10), that menu is the entire
  navigation. The header test opens it under the real policy for that reason.

Three limits of the automated tier that are easy to mistake for coverage:

- **The suite only runs rules its tag list carries.** Anything axe classes as
  best practice, `landmark-unique` among them, has never run here and does not
  run now. A green suite is silent about those, not passing them.
- **It used to measure a wider viewport than a real one.** Playwright runs
  headless, where scrollbars are overlaid, so a 320px viewport gives a 320px
  layout box; headed Chrome draws a classic 15px scrollbar and gives 305px.
  The reflow assertion was therefore 15px more forgiving than a real browser
  at 400% zoom, and 305px was a by-hand check. 305px now runs as a fixed
  viewport width in the suite, so that gap is closed. The by-hand check in
  [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §3 stays, because resizing
  a viewport is still not zooming.
- **A rule engine cannot see an invisible control.** Every automated
  contrast rule measures a foreground against its background, which means it
  measures a button's _label_ against that button's own fill. It has nothing
  to say about whether the fill itself is distinguishable from the surface the
  control sits on. Measured: a gold section containing `.btn-primary`, whose
  `bg-gold` fill is 1.00:1 against the gold ground, returned **"No
  accessibility violations found"** from AccessLint with AAA rules enabled,
  because `.surface-gold` repaints the label `darkcyan` at 8.00 and the label
  is all the rule looks at. The button was invisible as a shape and the scan
  was clean. `tests/gold-surface.spec.ts` checks this directly, and it checks
  **both** ways a control can be delimited, because excluding one of them left
  a control unverified. An opaque fill is compared against the ground behind
  it. A fill that is transparent, or below full alpha, means the ground shows
  through and the **border** is the only boundary the control has, so the
  border is compared instead, at the 3:1 of SC 1.4.11. A border matching the
  ground is exactly as invisible as a fill matching it, and nothing else in
  the suite would have caught it: that is `.btn-gold-secondary`'s failure
  mode, and it was unverified until the border arm existed. All four edges are
  measured, not just one — verified by painting only `border-bottom-color`
  gold, which every other assertion in the file passed, the button test
  included, because that test reads `borderTopColor`.

  **The border case was confirmed to be invisible to a rule engine, the same
  way the fill case was.** Measured on 2026-09-04 against a temporary route
  rendering a `.surface-gold` section: with `.btn-gold-secondary`'s border
  painted `#FFC000`, so the control was a transparent fill inside a border the
  colour of the ground and had no visible edge anywhere, AccessLint returned
  **0 violations across 95 rules with AAA enabled**. Its label still measured
  11.32 on gold, and the label is all a contrast rule looks at. A green scan
  is not evidence for either arm of this check.

- **An overflow assertion cannot see a bad heading floor.** This one is worth
  stating because the floors were documented as locked down by a test that
  could not fail on them. `overflow-wrap: break-word` guarantees the document
  never scrolls sideways, so a heading too big for its box is cut mid-word
  rather than overflowing. Measured 2026-09-05: with the `--text-h1` floor put
  back to 36px, all 92 overflow assertions passed, and the only two failures in
  the run were the heading-word-fit assertion at 305px. The unit is calls to
  `expectNoHorizontalOverflow`, one per route per width per spacing mode. This
  figure previously read "69 overflow assertions", which was the whole suite's
  test count at the time and not the assertion count at all; see the note in
  `tests/reflow.spec.ts`. The heading-word-fit assertion added alongside the
  305px case is what actually watches the floors.

**Automated testing catches only a minority of WCAG success criteria.** Roughly
a third of WCAG failures are machine-detectable at all; the rest need a human.
A green suite means no violation of the subset axe can see. It does not mean the
page is usable. Nothing here has been checked against the majority of criteria
that require judgement.

### What is not automated, and has not been done

[docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) is the checklist for the list
below. It gives steps, a pass condition, and the criterion for each, and it
names the software each check needs.

None of the following has been performed. Each is a real gap, not a formality.

- **Keyboard flow, in part.** Occlusion by the sticky header (SC 2.4.11) and
  the presence of an indicator (SC 2.4.7) have moved into the automated tier:
  `tests/focus.spec.ts` walks the tab order in both directions on every route
  at 305px and 1280px and hit-tests each stop. It was written because the rule
  it guards had already failed — see gap 8.

  **What is still not done is the judgement half.** Whether the focus order is
  sensible, whether an indicator is easy to find on a busy page, and whether
  the route through a page makes sense to somebody who cannot see it are not
  things an assertion asks. A person still has to tab these pages.

- **Screen reader announcement quality.** Nothing has been tested with NVDA,
  JAWS, VoiceOver, or Orca. Whether announcements are correct, ordered, and not
  redundant is unknown.
- **How uppercase is announced.** Every heading, label, and button on this site
  is written in sentence case and uppercased with CSS `text-transform`. That
  does **not** keep the accessible name in sentence case: measured in Chromium
  151 via the accessibility tree, markup reading `About` exposes the name
  `"ABOUT"`, and every link and heading on `/about` came back uppercased.
  Firefox and WebKit are reported not to transform the name, which has not been
  checked here. **What a screen reader actually says for an all-caps name is
  therefore unverified.** It varies by reader as well as by browser, and no
  reader has been run. Pending the Orca pass in
  [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §6, which records the answer.
  The practice is kept for reasons that do not depend on the announcement; see
  the design system skill.
- **Reduced motion.** The `prefers-reduced-motion: reduce` block is in
  `global.css` but has not been verified with the preference enabled.
- **Zoom to 400%.** Only the 320px menu behaviour is covered by a test. Full
  reflow at 400% zoom across every page has not been checked.
- **Browsers other than Chromium.** No Firefox or WebKit run. `<dialog>`
  behaviour in particular differs between engines.
- **Cognitive load, plain language, and reading order** on real content, since
  the real content does not exist yet.

## 7. Known gaps

Stated honestly. This list is not filtered for how it looks.

1. **The contact form is not built.** No form exists, so none of the form
   criteria (1.3.5, 3.3.1, 3.3.2, 3.3.3, 3.3.7, 3.3.8, 4.1.3) have been
   addressed or tested.

   **When it is built, the CSP has to be widened in the same change.**
   `public/_headers` sets `form-action 'none'`, which is free while there are
   no forms and blocks the submission outright the moment there is one. The
   failure is silent: nothing appears on the page, the form looks like it
   submitted or like it did nothing, and only the browser console carries the
   refusal. `tests/headers.spec.ts` does not catch it either, because it
   asserts the absence of `'unsafe-inline'` and the freshness of the inline
   hashes, not what `form-action` ought to permit.

   This is in the accessibility file rather than only in the security notes
   because of who it lands on. Section 8 below points people at the contact
   form to report a barrier. A form that fails without saying so turns the
   barrier-reporting path into a barrier, and does it worst for someone who
   cannot see that the page did not change. Widen the directive to the exact
   origin the form posts to (`'self'` if same-origin), never `*`, and add an
   assertion for the new value in the same commit.

2. ~~**Most pages are placeholder stubs.**~~ **Every page is built. The copy is
   what is still placeholder, and it is lorem ipsum rather than
   `PLACEHOLDER`.** Home, About, Career, Blog index, blog post, blog category
   and Contact all render their full structure: 23 routes, a paginated
   listing, a category filter, a gold surface, rendered Markdown, and two
   animated badges with pause controls.

   **The old wording said they passed axe "because there is almost nothing on
   them", and that sentence has to go rather than be softened.** It was the
   honest reading of a stub and it is the dishonest reading of this: the scans
   now run against real markup, real prose, real lists and real controls. What
   a green scan still is not, is conformance — section 6 says why, and that
   has not changed.

   What is genuinely untested here is not the markup but the words. See gap 7.

3. ~~**The spinning badge is not built.**~~ **Built, with the pause control SC
   2.2.2 requires.** `src/components/ui/SpinBadge.vue` renders it on the
   homepage hero at 24s, and `tests/motion.spec.ts` measures the whole
   contract from the rendered DOM rather than from the markup: that the
   animation is really running (`animation-play-state: running` on a real
   `slowspin`), that a **key press** on the focused control pauses it and a
   second one resumes it, that the control passes SC 2.5.8 on its own size
   (40x40 CSS px), and that its accessible name changes with the state.

   Three decisions in it are worth stating, because each is the difference
   between the criterion being met and appearing to be met:

   - **The animation is applied by the island on mount, never by the
     server-rendered HTML.** The pause control is JavaScript. Had the
     animation been in the static markup it would run in any browser where
     the island failed to hydrate, with the control that stops it absent —
     motion with no mechanism, which is the failure 2.2.2 names. No JS now
     means no spin.
   - **Under `prefers-reduced-motion: reduce` the component does not animate
     and renders no button**, rather than leaning on the global media query to
     neutralise the animation to 0.01ms and leaving a control that pauses
     nothing in the tab order.
   - **The state is carried by the accessible name and by nothing else.** The
     comps flip `aria-pressed` _and_ swap the label, which states the same
     thing twice and lets the two contradict each other. For a transport
     control the name is the stronger carrier, because "Play" and "Pause" say
     what the button will do while "pressed" says nothing about whether
     anything is moving. `MobileMenu.vue` makes the opposite call for the same
     reason: state in one place.

   **This is not a claim that the badge has been observed by a person.** It has
   been measured headlessly in Chromium. Nobody has watched it spin, tabbed to
   it on a real page, or heard a screen reader announce the name change; the
   Orca pass in [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §6 is where
   that would be recorded. The line stays here rather than being deleted so
   that distinction is visible.

4. **No screen reader testing has been done at all.** No NVDA, JAWS,
   VoiceOver, or Orca run, so announcement quality is unknown. That includes
   how the CSS-uppercased accessible names are read: section 6 records that
   Chromium exposes markup reading `About` as `"ABOUT"`, and AI.md and the
   design system skill both flag what a reader says for such a name as
   unverified.

   **An Orca pass narrows this gap; it does not close it.**
   [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §6 is the checklist, and it
   is deliberately split by browser: everything runs in Firefox, which is the
   pairing Orca is built and tested against, except the uppercase question in
   §6.4, which needs Chrome because Chromium is the only engine that puts the
   transformed string into the accessibility tree. When those blanks are
   filled, this gap is rewritten to say what was heard, in which browser, at
   which versions, and not deleted. Orca is one screen reader read through one
   engine on one machine. NVDA and VoiceOver announce differently and neither
   is available here, JAWS is not either, so screen reader coverage stays
   partial and section 6's "Screen reader announcement quality" bullet stays
   with it.

5. ~~**Only one blog post exists.**~~ **Eleven exist, and every word of them is
   placeholder.** They are spread across all five categories and vary
   deliberately in title length, teaser length, `featured` and `readingTime`,
   so a card is exercised at a ten-character title and at a seventy-character
   one. Eleven is not arbitrary: the index paginates at nine, so it is the
   count that makes a second page exist with more than one card on it.

   What that bought is structural coverage that one post could not give:
   pagination, the category filter, rendered Markdown with lists and
   sub-headings, an author-placed soft hyphen in a frontmatter title, and
   in-prose links — which is how the missing underline in gap 8 was found.

   **What it did not buy is anything about the prose itself.** Long-form
   reading order, whether the in-page heading structure helps or hinders, and
   whether link text makes sense out of context are all judgements about real
   writing, and there is no real writing here. See gap 7.

6. ~~**The gold surface is rendered only on a throwaway fixture.**~~ **It is on a
   real route now, and measured there. The gap narrows to one thing: nobody
   has looked at it.**

   `/career` renders the hero as `.surface-gold`, and it is the only
   `.surface-gold` section on the site. `tests/gold-surface.spec.ts` measures
   it in situ at 305px and at 320px, on the shipped markup rather than on a
   mounted `<div>`:

   | Measured on `/career`           | Result                                                                                               |
   | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
   | `.btn-gold-primary`             | 226.2x59.6; label 18.58 on its own `#131313` fill; fill 11.32 on gold                                |
   | its focus ring                  | outer 11.32 on gold, **1.00 against its own fill**; inner `#FFFFFF` 18.58; 3px solid at a 3px offset |
   | `.btn-gold-secondary`           | 197.6x59.6; label and border both 11.32 on gold; ring 11.32                                          |
   | every string on the gold ground | nothing below 4.5:1                                                                                  |
   | content box                     | 273px at 305px, 288px at 320px, unchanged by the full-bleed band                                     |
   | document                        | does not scroll sideways at either width                                                             |

   Reflow on a gold ground was previously untestable for want of a route with
   one on it. It is now in the 305px and 320px suites like any other section.
   The watermark deliberately overhangs by 150px and `overflow-hidden` on the
   section contains it; both the overhang and the clip are asserted, so
   removing either fails a test rather than becoming a horizontal scrollbar.

   **The fixtures were kept, not deleted, and that is deliberate.** A fixture
   can be broken on purpose to prove an assertion still bites, without editing
   a shipped route; and it keeps the class honest for the next page written
   against it. Only the in-situ test can fail on a mistake made in
   `career.astro` — a `text-muted` written inside the section, `.btn-primary`
   reached for out of habit. Neither covers the other. A non-vacuity guard was
   added at the same time, because the route-level walk short-circuits when a
   page has no gold section: correct while none existed, and silently vacuous
   the moment one did.

   **What keeps this open.** Every number above came from headless Chromium and
   was judged by an agent. No person has looked at the gold hero, tabbed it on
   a real screen, or zoomed it; no screen reader has been near it. That is the
   whole of the remaining gap, and it is
   [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §5 that closes it.

7. **The copy is lorem ipsum, which is Latin inside a `lang="en"` document.**
   This is new with this build and it affects every page.

   A screen reader takes its pronunciation from the language of the content.
   `<html lang="en">` is correct for the site and wrong for the words currently
   in it, so every heading, paragraph, teaser and post body on the site is
   announced with English pronunciation rules applied to Latin. That is not a
   small cosmetic wrongness for someone listening to the page; it is most of
   what they receive.

   **The fix is real copy, not a language attribute.** Marking the placeholder
   `lang="la"` would make the announcement more accurate and the situation
   worse: it would be a claim that the site is deliberately publishing Latin,
   it would have to be unpicked from every element later, and it would silence
   the very oddness that signals the copy is not finished. The gap is that the
   words are placeholder. Fixing the words fixes it.

   Two consequences worth naming rather than leaving implied:

   - **Section 6's "cognitive load, plain language and reading order" bullet is
     not merely untested here, it is unassessable.** There is no prose to judge
     for plain language.
   - **SC 3.1.2 Language of Parts** is not currently satisfied for this content,
     and will stop applying the moment the real copy lands rather than needing
     a fix of its own. It is listed so the state is on the record, not because
     a change is pending.

8. **A focus defect shipped and was caught late, and the miss is worth
   recording.** `scroll-margin-top` was scoped to `:target, [id]`, which covers
   anchor destinations. Essentially nothing focusable on this site has an
   `id` — not a nav link, not a filter option, not a card heading's link — so
   the tab order was never covered at all. Shift-Tabbing back up a page put
   controls **entirely** underneath the sticky header, 80px at the time and
   96px now: an SC 2.4.11
   Focus Not Obscured (Minimum) failure at AA, not the partial obscuring that
   2.4.12 covers at AAA.

   Fixed in `bcf0ecf`; `tests/focus.spec.ts` walks the tab order in both
   directions on every route at 305px and 1280px and hit-tests each stop.

   **Two things about how it hid are the reason this is written down.**

   - **Direction.** A forward pass over every route reported nothing wrong the
     whole time it was failing. Tabbing forward, Chromium scrolls the next
     control up from the bottom edge of the viewport, so it never approaches a
     header pinned to the top. Only walking backwards reproduces it. A
     keyboard check that goes one way is not a keyboard check.
   - **Method.** Comparing the focused element's box to the header's box gets
     the wrong answer in both directions: it reports the skip link as obscured
     on every route, when the skip link deliberately overlaps that band and is
     painted over it at `z-60` against `z-50`, and it cannot see obscuring by
     anything that is not the header. `document.elementFromPoint` is what
     answers the actual question.

   Verified by reverting the fix rather than by assertion: 9 of the 46 tests
   fail, eight of them at 305px, each reporting five of five probe points
   covered.

   **This does not close [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §1,
   §2 or §5.** The automated tier now covers occlusion and indicator presence;
   it says nothing about whether the focus order is _sensible_, or whether an
   indicator is easy to find on a busy page.

## 8. Reporting a barrier

If something on this site blocks you, please report it. You do not need to know
which WCAG criterion it is, and you do not need to disclose anything about
yourself.

- **Open an issue:** https://github.com/sindurigf/sinduri-lol/issues
- **Email:** lol@sinduri.lol

Useful if you have it, but never required:

- the page URL;
- what you were trying to do and what happened instead;
- your browser, operating system, and any assistive technology and version;
- a screenshot or recording.

Reports are read. Barriers that stop someone completing a task are prioritised
above everything else in the backlog.

## 9. Maintaining this file

Update this file in the same commit as the change it describes.

Review it when:

- a page moves out of placeholder into real content;
- the contact form lands, which is also when `form-action 'none'` has to be
  widened (see section 7);
- any animation lands;
- a colour token changes, including any of the gold-surface tokens, in which
  case the tables in section 5, `AI.md` and the design system skill all quote
  the number and all three have to move together;
- a new surface colour is introduced, which means every foreground token needs
  re-measuring against it, the way `#FFC000` did;
- a manual test is actually performed, so a gap in section 7 can be closed.

Do not remove an item from section 7 because it was fixed in passing. Remove it
when it has been tested. Untested means untested.
