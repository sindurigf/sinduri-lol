# Accessibility

## 1. Project information

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Project             | sinduri.lol                                                |
| Project type        | Static personal website (Astro, Vue islands, Tailwind)     |
| Accessibility owner | Sinduri Guntupalli                                         |
| Public reporting    | https://github.com/sindurigf/sinduri-lol/issues            |
| Private reporting   | sinduri.g@gmail.com                                        |
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
- All text colour tokens have been measured against all three surface colours
  (`#131313`, `#1A1A1A`, `#0E0E0E`).
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

## 6. Testing and validation

### What is automated

Playwright drives a real Chromium against the production build. CI runs it on
every push and pull request to `main`, and a violation fails the build.

| Check              | Tool                                | Covers                                    |
| ------------------ | ----------------------------------- | ----------------------------------------- |
| WCAG rule scan     | axe-core via `@axe-core/playwright` | Every built route                         |
| Rule scan, menu on | axe-core at 320px, dialog open      | Every route, with the mobile menu open    |
| Reflow overflow    | Playwright at 320px and 305px       | Every route, with and without SC 1.4.12   |
| Content box width  | Playwright at 320px and 305px       | 288px / 273px, the box the floors assume  |
| Heading word fit   | Playwright at 320px and 305px       | No heading word wider than its own box    |
| Reflow navigation  | Playwright at 320px                 | Menu opens, takes focus, closes on Escape |
| Route drift        | Playwright                          | Test list matches real build output       |
| Type safety        | `astro check`                       | Templates and components                  |

Rule tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

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

## 8. Reporting a barrier

If something on this site blocks you, please report it. You do not need to know
which WCAG criterion it is, and you do not need to disclose anything about
yourself.

- **Open an issue:** https://github.com/sindurigf/sinduri-lol/issues
- **Email:** sinduri.g@gmail.com

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
- the contact form lands;
- any animation lands;
- a colour token changes;
- a manual test is actually performed, so a gap in section 7 can be closed.

Do not remove an item from section 7 because it was fixed in passing. Remove it
when it has been tested. Untested means untested.
