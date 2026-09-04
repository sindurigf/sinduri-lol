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
| Last reviewed       | 2026-09-04                                                 |

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
- Every target on the site now passes SC 2.5.8 on **its own size**. The
  spacing exception is not relied on anywhere. The last two that did were the
  breadcrumb links on blog routes; measured at a 305px viewport they are now
  86.7x31.6 ("All posts") and 178.1x31.6 (the category link), up from 16px
  tall, with the `<h1>` below them at an unchanged y.

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
Both render 51.6px tall, so each passes SC 2.5.8 on its own size without the
spacing exception.

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

| Check                | Tool                                | Covers                                           |
| -------------------- | ----------------------------------- | ------------------------------------------------ |
| WCAG rule scan       | axe-core via `@axe-core/playwright` | Every built route                                |
| Rule scan, menu on   | axe-core at 320px, dialog open      | Every route, with the mobile menu open           |
| Reflow overflow      | Playwright at 320px and 305px       | Every route, with and without SC 1.4.12          |
| Content box width    | Playwright at 320px and 305px       | 288px / 273px, the box the floors assume         |
| Heading word fit     | Playwright at 320px and 305px       | No heading word wider than its own box           |
| Reflow navigation    | Playwright at 320px                 | Menu opens, takes focus, closes on Escape        |
| Route drift          | Playwright                          | Test list matches real build output              |
| Unknown path         | Playwright                          | A path with no page returns 404, not 200         |
| Response headers     | Playwright over the built `dist/`   | The CSP does not break fonts or the menu         |
| HSTS scope           | Playwright over the built `dist/`   | max-age ceiling, no preload/subdomains           |
| Gold-surface text    | Playwright over every route         | Nothing on `#FFC000` below 4.5:1                 |
| Gold-surface class   | Playwright, mounted fixture         | `.surface-gold` text, links, focus, border       |
| Gold-surface buttons | Playwright, mounted fixture         | Label, fill, border, focus, SC 2.5.8 size        |
| Invisible control    | Playwright, mounted fixture         | Fill, or border on all four edges, vs the ground |
| Two-tone focus ring  | Playwright, mounted fixture         | Both rings and the pink shadow, at zero offset   |
| Token drift          | Playwright, live CSS variables      | The documented ratios against `#FFC000`          |
| Type safety          | `astro check`                       | Templates and components                         |

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
- **An overflow assertion cannot see a bad heading floor.** This one is worth
  stating because the floors were documented as locked down by a test that
  could not fail on them. `overflow-wrap: break-word` guarantees the document
  never scrolls sideways, so a heading too big for its box is cut mid-word
  rather than overflowing. Measured: with the h1 floor put back to 36px, all
  69 overflow assertions passed while "PROFESSIONAL" was being broken across
  two lines. The heading-word-fit assertion added alongside the 305px case is
  what actually watches the floors.

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

- **Keyboard flow.** Tab order, focus visibility in context, whether the sticky
  80px header obscures a focused element in practice (SC 2.4.11). The
  `scroll-margin-top` rule is in place but has not been verified by tabbing
  through a long page, because no long page exists yet.
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

2. **Most pages are placeholder stubs.** Home, About, Career, Blog index, and
   Contact render `PLACEHOLDER` copy. They pass axe because there is almost
   nothing on them. That is not evidence of anything.
3. **The spinning badge is not built.** It appears in the comps, auto-starts,
   and runs past five seconds, so under SC 2.2.2 Pause, Stop, Hide it needs a
   keyboard-operable pause control. A `prefers-reduced-motion` media query does
   not satisfy 2.2.2 on its own, because a user who has not set that preference
   still has no way to stop it.
4. **No screen reader testing has been done at all.** See section 6.
5. **Only one blog post exists,** and it is placeholder content. Long-form
   reading order, in-page headings, and link text in real prose are untested.
6. **The gold surface has been measured but never rendered.** The inverted
   token set in section 5 is arithmetic, a CSS class and two button classes;
   no page uses any of them yet, so the contracts are tested against mounted
   fixtures rather than against real markup. Nothing has been looked at,
   tabbed through, or zoomed on an actual gold section. The focus ring on that
   ground is still the item to look at first. On `.btn-gold-primary` it is now
   two rings, an inner `#FFFFFF` at 18.58 against the button's own fill and the
   outer `#131313` at 11.32 against the gold beyond the offset gap, so it no
   longer depends on the offset alone. **Both numbers are measurement, and
   nobody has looked at the result.** Whether two concentric rings 3px apart
   read as one indicator or as visual noise at real size is a judgement no test
   makes. Reflow is untested there too, since no gold section exists to run the
   305px suite against. Re-test when the Career page lands and replace the
   fixtures with the real section.

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
