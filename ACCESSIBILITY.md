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
| Last reviewed       | 2026-09-11                                                 |

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

In scope: the built static output at `dist/`, meaning every route listed in
`tests/routes.ts`, the layouts, the components, the design tokens, and the
Markdown content rendered through them.

Not in scope: third-party sites linked from the footer, the Fontsource
package's own site, and anything a fork of this repository produces after
modification.

## 4. Conformance status

**No conformance claim is made.** WCAG 2.2 AA is the target. Parts of the site
have been tested against it, other parts have not been tested at all, and the
site is not finished.

What is currently true:

- Every route passes axe-core with no violations at the `wcag2a`, `wcag2aa`,
  `wcag21a`, `wcag21aa` and `wcag22aa` tags. No rule is disabled and no result
  is excluded anywhere in the suite.
- Every route also passes axe's `best-practice` rules, run in a block of their
  own rather than folded into the WCAG tags, so a failure says which of the two
  broke.
- Nothing axe leaves undecided is left undecided. `analyze()` returns
  violations, passes, incomplete and inapplicable, and the suite reads all
  four. `incomplete` was not empty: eleven `color-contrast` nodes across `/`,
  `/about` and `/contact` on 2026-09-05. `tests/contrast-incomplete.spec.ts`
  decides each by walking the paint stack and measuring against the resolved
  ground. All clear their floors; the tightest is 4.90:1 against a 3:1
  large-text floor.
- All text colour tokens are measured against all three dark surfaces
  (`#131313`, `#1A1A1A`, `#0E0E0E`) and against `#FFC000`, the fourth surface
  the design uses and the one every dark token fails on. An inverted token set
  covers it; see section 5.
- Every route is checked for horizontal overflow at 320px and 305px, with and
  without the SC 1.4.12 text-spacing override, and at 640px and 1280px without
  it. 305px is the width a real browser with a classic 15px scrollbar gives at
  a 320px CSS viewport. The same test asserts the content box each width leaves
  (288px and 273px) and that no heading word is wider than its own box; the
  heading check found two real defects on its first run.
- Every route is also scanned with the mobile menu dialog open at 320px.
- Every target passes SC 2.5.8 on its own size, measured rather than claimed.
  `tests/target-size.spec.ts` walks every route at 305px and 1280px. The
  spacing exception is not implemented anywhere in the suite, deliberately:
  relying on it makes the gap between two controls load-bearing for
  conformance, so an unrelated spacing change breaks 2.5.8 silently and a long
  way from the edit. The two exceptions the criterion grants, an inline link in
  a sentence and an element with no box, are detected structurally rather than
  by class name.
- Keyboard flow is partly covered. `tests/focus.spec.ts` walks the tab order in
  both directions on every route at two widths and hit-tests each stop, for SC
  2.4.11 and SC 2.4.7. The same walk measures the focus ring against the ground
  it is drawn on, for SC 1.4.11. Across 1672 controls at both widths the lowest
  is 10.60:1, measured 2026-09-08 and dated rather than maintained.
- Windows High Contrast Mode is covered by `tests/forced-colors.spec.ts`. The
  mode suppresses every `box-shadow`, and this design uses `shadow-hard-*` for
  the offset blocks that give cards and buttons their shape, so anything
  bounded only by a shadow has no edges there. Asserted: nothing sets
  `forced-color-adjust` away from `auto`, every non-link control keeps a
  painted border or an opaque background, links are painted distinctly from
  body text, and the focus ring keeps a non-zero width.
- Reduced motion is checked site-wide. Zero elements animate under
  `prefers-reduced-motion: reduce` across all 25 routes. That walk reads
  computed styles, which a `<canvas>` is invisible to, so the homepage hero is
  measured separately by fingerprinting its pixels.
- Every page names itself. axe's `document-title` fires only on a missing or
  empty title and says nothing about two pages sharing one. All 25 titles are
  distinct, and every one except the homepage's names the page before the site.

**None of the above says anything about the words.** Twenty of the 25 built
pages carry lorem ipsum, which is Latin inside a `lang="en"` document. On those
twenty the criteria that depend on real language are not merely untested but
unassessable. See gap 3.

Passing axe is not conformance. See section 6.

### The one browser-conditional skip

`tests/forced-colors.spec.ts` does not run on WebKit: 27 of its 28 tests are
skipped there. WebKit reports `(forced-colors: active)` as matching and then
paints the author's palette anyway, so those tests would have run against the
ordinary rendering and passed without exercising anything. Forced colours is
the CSS surface of Windows High Contrast, and WebKit ships on no platform that
has it.

The one test that does run everywhere asserts that Chromium and Firefox still
substitute the palette and that WebKit still does not, so an engine that
silently stopped forcing fails loudly, and WebKit gaining support fails too.

This does not touch the WCAG 2.2 AA target. Forced-colors support is an
accommodation rather than a success criterion, and SC 1.4.3 and SC 1.4.11 are
measured on Chromium and Firefox by three specs that skip nowhere.

WebKit is defined in CI only. The development machine is Ubuntu 25.10, which
ships ICU 76, and Playwright builds WebKit against ICU 74: an ABI
incompatibility rather than a missing package. `playwright.config.ts` carries
the command for running it in Playwright's container. Headless WebKit is also
not Safari, and says nothing about VoiceOver.

## 5. Colour and contrast

Every foreground token measured against all three dark surfaces:

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

`text`, `muted`, `subtle`, `gold`, `cyan` and `pinkText` clear AAA (7:1) on
every surface. `border` carries every visible boundary, is governed by SC
1.4.11 (3:1), and clears it on all three.

**The two pinks are split by role, not by size.** `pink` clears AA but not AAA,
so it is restricted to non-text: borders, hard offset shadows and decorative
fills, where the threshold is the 3:1 of SC 1.4.11. `pinkText` is AAA on every
surface and carries every pink glyph. An earlier rule allowed `pink` on the
section number by the large-text exemption, which held only while that text
stayed above 18.66px; `--text-section-number` is `clamp(21px, 2.4vw, 28px)`, so
the guarantee depended on the type scale. The role split removes the condition.

Two predecessor colours were replaced for different reasons. `border`'s
predecessor `#504632` measured 2.00 and failed SC 1.4.11. `subtle`'s
predecessor `#9C8F78` measured 5.85 / 5.48 / 6.08 and passed SC 1.4.3 AA on all
three surfaces; replacing it was an AA-to-AAA palette decision, not a
conformance fix.

The focus indicator is a 3px gold outline at a 3px offset. The offset is
required: gold against the gold button measures 1.00:1, so a ring flush with
the element would be invisible there. The offset puts surface colour on both
sides of the ring, which is what SC 1.4.11 measures.

### The gold surface is an exception, and every dark token fails on it

The Career hero is `background: #FFC000`, a light ground inside a dark-only
palette. Measured against `#FFC000`, not one foreground token above passes:

| Token      | Value     | on `#FFC000` | Needs | Result |
| ---------- | --------- | ------------ | ----- | ------ |
| `border`   | `#5A87A8` | 2.34         | 3.0   | FAIL   |
| `text`     | `#E5E2E1` | 1.27         | 4.5   | FAIL   |
| `muted`    | `#D4C5AB` | 1.03         | 4.5   | FAIL   |
| `subtle`   | `#9BB4C6` | 1.31         | 4.5   | FAIL   |
| `pinkText` | `#FF79B6` | 1.48         | 4.5   | FAIL   |
| `pink`     | `#FF007A` | 2.31         | 3.0   | FAIL   |
| `cyan`     | `#00DCFD` | 1.01         | 3.0   | FAIL   |

This is structural, not a bad choice of tones. L(`#FFC000`) is 0.5896, so the
readable band lies below the ground: AAA needs a foreground luminance of 0.0414
or less. On `#131313` the AAA band spans luminance 0.346 to 1.0; on `#FFC000`
it spans 0 to 0.0414, nearly sixteen times narrower. Everything readable on
gold is a near-black.

An inverted set covers it. The first four are AAA on gold:

| Token            | Value     | on `#FFC000` | Job                                     |
| ---------------- | --------- | ------------ | --------------------------------------- |
| `gold-text`      | `#131313` | 11.32        | Body copy, headings, **button borders** |
| `gold-muted`     | `#3A3020` | 7.88         | Secondary copy                          |
| `gold-border`    | `#22394D` | 7.27         | **Structural** rules, dividers, cards   |
| `darkcyan`       | `#00363F` | 8.00         | Links, and the one accent               |
| `gold-btn-label` | `#FFFFFF` | 1.64         | Label on the dark button fill only      |

This table is a copy, not a source. The same rows appear in
[ARCHITECTURE.md](ARCHITECTURE.md) and in the design system skill, and the one
authority for all three is the live CSS custom property.
`tests/gold-surface.spec.ts` parses every table keyed `on #FFC000` and fails on
any row whose hex or ratio disagrees with the running page, naming the file and
line.

There is no `gold-subtle`: a third step would land near luminance 0.02 and be
indistinguishable from `gold-text`. Hierarchy below `gold-muted` on this
surface is weight and size.

`gold-btn-label` is the one value there that fails against gold. It never sits
on gold: it is the label on `.btn-gold-primary`'s `#131313` fill, where it
measures 18.58.

**Two border tokens apply on this surface**, split by what the border encloses.
`gold-border` carries structural boundaries: section rules, dividers, card
edges. Button borders use `gold-text`, matching their own fill, so the control
reads as one solid block rather than a dark block inside a navy outline. Both
clear SC 1.4.11 on gold several times over, so that split is a design decision
rather than a contrast one.

**Three site-wide rules break silently on this ground** and are overridden by
the `.surface-gold` class, which is the only supported way to build one:

- **Links.** The base layer paints every `<a>` `gold` (1.00 here) and `cyan` on
  hover (1.01). They are repainted `darkcyan` and underlined. The underline is
  required, not stylistic: `darkcyan` measures 1.42 against `gold-text`, well
  under the 3:1 that would let colour carry the distinction alone, so the
  underline is what satisfies SC 1.4.1.
- **Focus.** The site's ring is gold at a 3px offset, and works elsewhere
  because of the offset: gold on gold is 1.00, and the offset puts the dark
  page background on both sides. On a large gold surface the offset gap is gold
  too, so the ring would be completely invisible. It is repainted `gold-text`
  (11.32).
- **Borders.** The base layer defaults every border to `border`, 2.34 on gold.
  The subtree is re-defaulted to `gold-border`.

**The mitigation holds only while the ring colour differs from the surface
behind the element.** Any new surface token needs its own focus ring measured
rather than inherited, and measured twice: against the surface behind the
element, which is what the offset gap shows, and against the element's own
edge, in case the offset is ever reduced.

`.btn-gold-primary` is where the second check bites. Its ring is `gold-text`,
the same colour as its own fill and border, so ring-against-fill measures 1.00
and only the 3px offset made it 11.32 against what it actually touches. That
put the whole indicator on one property staying non-zero, on the single control
where getting it wrong hides the indicator completely. Its ring is therefore
two rings, one for each background it can end up against:

| Layer                           | Against        | Ratio |
| ------------------------------- | -------------- | ----- |
| inner `#FFFFFF`, flush to fill  | `#131313`      | 18.58 |
| outer `#131313`, beyond the gap | gold `#FFC000` | 11.32 |

The inner ring is an `inset` `box-shadow` folded in alongside the button's pink
offset shadow, because `box-shadow` is one property and a rule naming only the
ring would delete the resting decoration for as long as the button had focus.
It reuses `gold-btn-label`, the same white at the same 18.58 on the same fill,
rather than adding a second white token.

This is not a general pattern. A single-colour ring is sufficient everywhere
else, `.btn-gold-secondary` included: its fill is transparent, so a ring flush
to its interior sits on the gold showing through at 11.32.

Neither `.btn-primary` nor `.btn-secondary` may be used on this surface.
`.btn-primary` is `bg-gold`, a 1.00:1 fill; `.btn-secondary` carries
`border-border` (2.34 on gold) and a gold offset shadow (1.00 on gold).
`.btn-gold-primary` and `.btn-gold-secondary` are the pair the comps specify.
Both render 59.6px tall, a 15.6px line box with 18px of padding and a 4px
border either side, so each passes SC 2.5.8 on its own size without the spacing
exception. The border is part of the target.

**The pink offset shadow on the primary button measures 2.31 on gold**, under
the 3:1 of SC 1.4.11. That is acceptable only because it carries no meaning:
the control is identified by its `#131313` fill against the gold ground at
11.32. An offset shadow is never allowed to become the thing that delimits a
control here.

## 6. Testing and validation

### What is automated

Playwright drives real Chromium and Firefox against the production build, and
CI adds WebKit. CI runs on every push to `main` and every pull request against
it, and a violation fails the build.

| Check                | Tool                                | Covers                                              |
| -------------------- | ----------------------------------- | --------------------------------------------------- |
| WCAG rule scan       | axe-core via `@axe-core/playwright` | Every built route                                   |
| Rule scan, menu on   | axe-core at 320px, dialog open      | Every route, with the mobile menu open              |
| Reflow overflow      | Playwright at 320px and 305px       | Every route, with and without SC 1.4.12             |
| Content box width    | Playwright at 320px and 305px       | 288px / 273px, the box the floors assume            |
| Heading word fit     | Playwright at 320px and 305px       | No heading word wider than its own box              |
| Reflow navigation    | Playwright at 320px                 | Menu opens, takes focus, closes on Escape           |
| Route drift          | Playwright                          | Test list matches real build output                 |
| Badge route coverage | Playwright over the built `dist/`   | Every route rendering a badge is tested for 2.2.2   |
| Hero field motion    | Playwright, canvas pixels           | It repaints, a key press stops it, still when asked |
| Unknown path         | Playwright                          | A path with no page returns 404, not 200            |
| Response headers     | Playwright over the built `dist/`   | The CSP does not break fonts or the menu            |
| HSTS scope           | Playwright over the built `dist/`   | max-age pinned, no preload                          |
| Gold-surface text    | Playwright over every route         | Nothing on `#FFC000` below 4.5:1                    |
| Gold-surface class   | Playwright, mounted fixture         | `.surface-gold` text, links, focus, border          |
| Gold-surface buttons | Playwright, mounted fixture         | Label, fill, border, focus, SC 2.5.8 size           |
| Invisible control    | Playwright, mounted fixture         | Fill, or border on all four edges, vs the ground    |
| Two-tone focus ring  | Playwright, mounted fixture         | Both rings and the pink shadow, at zero offset      |
| Token drift          | Playwright, live CSS variables      | The documented ratios against `#FFC000`             |
| Doc table drift      | Playwright, live CSS variables      | The gold tables in the docs and the skill           |
| Best-practice scan   | axe-core, `best-practice` tag       | Every route, in its own block                       |
| Undecided contrast   | axe `incomplete`, paint-stack walk  | Every route at 1280px and 320px                     |
| Keyboard walk        | Playwright, Tab and Shift+Tab       | SC 2.4.7, 2.4.11 and 1.4.11 on the ring             |
| Target size          | Playwright at 305px and 1280px      | Every target on its own box, no spacing exception   |
| Forced colours       | Playwright, `emulateMedia`          | Every route; skipped on WebKit, see section 4       |
| Reduced motion       | Playwright, `emulateMedia`          | Nothing on any route still moves                    |
| Page titles          | Playwright over the built `dist/`   | Every title distinct and names its page             |
| No-JavaScript nav    | Playwright, scripting off           | Fallback visible, below the header, not doubled     |
| Current page         | Playwright                          | `aria-current` in all three navs, and the ring      |
| Hero fit             | Playwright, hero viewports          | Fits the screen; control clears name and stickers   |
| Accessibility page   | Playwright over the built `dist/`   | Linked from every page, status matches section 1    |
| Contact form         | Playwright, POST to the endpoint    | Validation, honeypot, rate limit, 422 keeping text  |
| Type safety          | `astro check`                       | Templates and components                            |

Two of those are accessibility checks for less obvious reasons:

- **A 404 that answers 200 is a wrong-answer problem, not an SEO one.** A
  sighted user sees the wrong page and infers what happened from the layout.
  Someone using a screen reader is read the homepage with nothing in the
  announcement to say the address was wrong, and nothing in the status code for
  their browser to act on.
- **The CSP can silently kill the only navigation at 400% zoom.** Its hashes
  are build output, so an Astro upgrade can invalidate one; the island then
  fails to hydrate and the mobile menu stops opening. At 320px, where a desktop
  user at 400% zoom lands, that menu is the entire navigation.

### Four limits that are easy to mistake for coverage

- **The suite only runs rules its tag lists carry.** Any rule outside the WCAG
  A and AA tags and axe's `best-practice` tag, including axe's `wcag2aaa`
  rules, does not run. A green suite is silent about those, not passing them.
- **Headless measures a wider viewport than a real browser.** Scrollbars are
  overlaid headless, so a 320px viewport gives a 320px layout box where headed
  Chrome draws a classic 15px scrollbar and gives 305px. 305px now runs as a
  fixed viewport width. The by-hand check in
  [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §3 stays, because resizing a
  viewport is still not zooming.
- **A rule engine cannot see an invisible control.** Every automated contrast
  rule measures a foreground against its background, meaning a button's label
  against that button's own fill. It says nothing about whether the fill is
  distinguishable from the surface the control sits on. Measured: a gold
  section containing `.btn-primary`, whose fill is 1.00:1 against the gold
  ground, returned no violations from AccessLint with AAA rules enabled,
  because `.surface-gold` repaints the label at 8.00 and the label is all the
  rule looks at. Measured again 2026-09-04 with `.btn-gold-secondary`'s border
  painted the colour of the ground, so the control had no visible edge
  anywhere: 0 violations across 95 rules with AAA enabled.
  `tests/gold-surface.spec.ts` checks both ways a control can be delimited. An
  opaque fill is compared against the ground behind it; a fill below full alpha
  means the border is the only boundary, so the border is compared instead, on
  all four edges.
- **An overflow assertion cannot see a bad heading floor.**
  `overflow-wrap: break-word` guarantees the document never scrolls sideways,
  so a heading too big for its box is cut mid-word rather than overflowing.
  Measured 2026-09-05: with `--text-h1` put back to a 36px floor, all 92
  overflow assertions passed and the only failures were the heading-word-fit
  assertion at 305px.

**Automated testing catches only a minority of WCAG success criteria.** Roughly
a third of WCAG failures are machine-detectable at all. A green suite means no
violation of the subset axe can see. It does not mean the page is usable.

### What is not automated, and has not been done

[docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) is the checklist: steps, a pass
condition, and the criterion for each. None of the following has been
performed.

- **Keyboard flow, the judgement half.** Occlusion (SC 2.4.11) and indicator
  presence (SC 2.4.7) are automated. Whether the focus order is sensible,
  whether an indicator is easy to find on a busy page, and whether the route
  through a page makes sense to somebody who cannot see it are not things an
  assertion asks.
- **Screen reader announcement quality.** Nothing has been tested with NVDA,
  JAWS, VoiceOver or Orca.
- **How uppercase is announced.** Every heading, label and button is written in
  sentence case and uppercased with CSS `text-transform`. That does not keep
  the accessible name in sentence case: measured in Chromium 151 via the
  accessibility tree, markup reading `About` exposes the name `"ABOUT"`.
  Firefox and WebKit are reported not to transform the name, unverified here.
- **Reduced motion, by hand.** Nobody has turned the preference on in an
  operating system and looked at whether the still pages make sense.
- **Zoom to 400%, by hand.** Resizing a viewport is not zooming.
- **Browsers other than Chromium, by hand.** No person has used the site in
  Firefox, and headless WebKit is not Safari.
- **Cognitive load, plain language and reading order**, since the real content
  does not exist yet.

## 7. Known gaps

Stated honestly. This list is not filtered for how it looks.

1. **The contact form is built; its form criteria are untested by a person.**
   `/contact` carries a name, email and message form posting to
   `/contact/send/`. What is automated: labels, the error summary taking focus,
   `aria-invalid` and `aria-describedby` on failing fields, and a success state
   reachable with scripting off, all walked by the route-level suites like any
   other page.

   What is not: whether the error messages actually help. SC 3.3.1 Error
   Identification and SC 3.3.3 Error Suggestion are satisfied by a message
   being present and specific, and whether a given sentence is specific enough
   to act on is a judgement no assertion makes. Nobody has submitted this form
   with a screen reader and listened to what the summary announces.

   SC 1.3.5 Identify Input Purpose is met by `autocomplete` on the name and
   email fields. SC 3.3.7 Redundant Entry does not apply: nothing is asked
   twice. SC 3.3.8 Accessible Authentication does not apply: there is no
   authentication.

   **The failure path is the part worth testing by hand**, because it is the
   one nobody sees until it happens. `/contact/send/` re-renders the form with
   what was typed still in it, so a rejected submission loses nothing, and that
   has been asserted but not experienced.

2. **No screen reader testing has been done at all.** No NVDA, JAWS, VoiceOver
   or Orca run, so announcement quality is unknown. That includes how the
   CSS-uppercased accessible names are read.

   An Orca pass narrows this gap without closing it.
   [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §6 is deliberately split by
   browser: everything in Firefox, which is the pairing Orca is built against,
   except the uppercase question in §6.4, which needs Chrome because Chromium
   is the only engine that puts the transformed string into the accessibility
   tree. When those blanks are filled this gap is rewritten to say what was
   heard, in which browser, at which versions, and not deleted. Orca is one
   screen reader through one engine on one machine.

3. **The copy is lorem ipsum, which is Latin inside a `lang="en"` document.**
   It affects 20 of the 25 built pages, measured 2026-09-11 by counting
   distinctive lorem words in the visible text of every page in `dist/`. Five
   have none: `/career`, whose copy is transcribed from the published CV; the
   one real post at `/blog/open-source-is-not-just-code`; `/accessibility`;
   `/privacy`; and `/404`.

   A screen reader takes its pronunciation from the language of the content.
   `<html lang="en">` is correct for the site and wrong for the words in it, so
   every heading, paragraph, teaser and post body is announced with English
   pronunciation rules applied to Latin. For someone listening, that is most of
   what they receive.

   **The fix is real copy, not a language attribute.** Marking the placeholder
   `lang="la"` would make the announcement more accurate and the situation
   worse: it would claim the site deliberately publishes Latin, it would have
   to be unpicked from every element later, and it would silence the oddness
   that signals the copy is unfinished.

   Two consequences: section 6's plain-language bullet is unassessable rather
   than merely untested, and SC 3.1.2 Language of Parts is not currently
   satisfied for this content. It will stop applying when the real copy lands
   rather than needing a fix of its own.

4. **The gold surface has never been looked at by a person.** `/career` renders
   the hero as `.surface-gold` and `/contact` closes with a `.surface-gold`
   band. `tests/gold-surface.spec.ts` measures the Career hero in situ at 305px
   and 320px on the shipped markup:

   | Measured on `/career`           | Result                                                                                           |
   | ------------------------------- | ------------------------------------------------------------------------------------------------ |
   | `.btn-gold-primary`             | 226.2x59.6; label 18.58 on its own `#131313` fill; fill 11.32 on gold                            |
   | its focus ring                  | outer 11.32 on gold, 1.00 against its own fill; inner `#FFFFFF` 18.58; 3px solid at a 3px offset |
   | `.btn-gold-secondary`           | 197.6x59.6; label and border both 11.32 on gold; ring 11.32                                      |
   | every string on the gold ground | nothing below 4.5:1                                                                              |
   | content box                     | 273px at 305px, 288px at 320px, unchanged by the full-bleed band                                 |
   | document                        | does not scroll sideways at either width                                                         |

   Every number came from headless Chromium. No person has looked at the gold
   hero, tabbed it on a real screen or zoomed it, and no screen reader has been
   near it. [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) §5 closes this.

5. **The mounted fixtures are kept, not deleted.** A fixture can be broken on
   purpose to prove an assertion still bites without editing a shipped route.
   Only the in-situ test can fail on a mistake made in `career.astro`, such as
   a `text-muted` written inside the section or `.btn-primary` reached for out
   of habit. Neither covers the other. The route-level walk short-circuits when
   a page has no gold section, so a non-vacuity guard sits beside it.

6. **Prose judgements have one post to make them on and none have been made.**
   Long-form reading order, whether the in-page heading structure helps, and
   whether link text makes sense out of context are judgements about real
   writing. `/blog/open-source-is-not-just-code` is the only real writing on
   the site and no manual pass has been recorded against it.

### Defects found and fixed

Each of these shipped, and each hid for a reason worth not repeating. The long
form of every one is in the archived repository.

- **Focus obscured by the sticky header (SC 2.4.11).** `scroll-margin-top` was
  scoped to `:target, [id]`, and essentially nothing focusable has an `id`, so
  the tab order was never covered. Shift-Tabbing put controls entirely under
  the header. **A forward pass reported nothing wrong the whole time it was
  failing**, because Chromium scrolls the next control up from the bottom edge.
  A keyboard check that goes one way is not a keyboard check. Comparing boxes
  also gets the wrong answer in both directions; `document.elementFromPoint` is
  what answers the actual question.
- **The no-JavaScript fallback duplicated the primary navigation above 768px.**
  The `md:hidden` scope existed in the prose describing it and nowhere in the
  markup, so with scripting off every link rendered twice under two landmarks
  both named "Primary". `tests/no-script.spec.ts` ran at 305px only, the one
  band where the two cannot collide, so the suite was green on a claim it never
  visited.
- **The fallback then spilled out of the sticky header below 768px.** Five
  wrapped links need more than the fixed 96px header. At 305px Home sat above
  the top of the page where no scroll reaches it. Fixed by rendering the
  fallback in normal flow after the header. Growing the header was the other
  option and the wrong one: the sticky band would then be taller than the
  page's scroll offset allows for.
- **`/contact` had no current-page indicator and the three navigations
  disagreed.** With scripting off the page said where you were and with
  scripting on it did not.
- **The hero tagline was small text over the moving canvas and failed
  contrast.** Every ratio quoted for it had been measured against the flat
  background. Sampled beside its glyphs it fell to 1.25:1 at 1280x720 and
  1.00:1 at 844x390. A rule engine reported nothing, because it cannot read
  canvas pixels. Fixed by moving the tagline onto a flat ground.
- **The hero pause control covered part of the name under text spacing.** At
  320x256, a 1280x1024 screen at 400%, the fold fell where the name ended and
  the control covered the last letters where no scrolling could uncover them.
- **The open mobile menu drew focus rings off screen when it scrolled.** The
  dialog fills the viewport, so the site's outward ring landed outside it.

Three of those were found while measuring something else, not by the suite, by
axe, or by a manual pass. That is the argument for reading section 6's untested
list as untested rather than as probably fine.

## 8. Reporting a barrier

If something on this site blocks you, please report it. You do not need to know
which WCAG criterion it is, and you do not need to disclose anything about
yourself.

- **Open an issue:** https://github.com/sindurigf/sinduri-lol/issues
- **Email:** lol@sinduri.lol

Useful if you have it, but never required: the page URL, what you were trying
to do and what happened instead, your browser, operating system and any
assistive technology and version, and a screenshot or recording.

Reports are read. Barriers that stop someone completing a task are prioritised
above everything else in the backlog.

## 9. Maintaining this file

Update this file in the same commit as the change it describes.

Review it when:

- a page moves out of placeholder into real content;
- a manual pass is run against the contact form, which closes the rest of gap
  1;
- any animation lands;
- a colour token changes, including any gold-surface token, in which case the
  tables in section 5, [ARCHITECTURE.md](ARCHITECTURE.md) and the design system
  skill all quote the number and all three have to move together;
- a new surface colour is introduced, which means every foreground token needs
  re-measuring against it, the way `#FFC000` did;
- a manual test is actually performed, so a gap in section 7 can be closed.

Do not remove an item from section 7 because it was fixed in passing. Remove it
when it has been tested. Untested means untested.
