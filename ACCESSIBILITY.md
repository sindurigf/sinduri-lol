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

Passing axe is not conformance. See section 6.

## 5. Colour and contrast

Every foreground token is measured against all three surfaces. Verified ratios:

| Token    | Value     | `#131313` | `#1A1A1A` | `#0E0E0E` |
| -------- | --------- | --------- | --------- | --------- |
| `text`   | `#E5E2E1` | 14.42     | 13.51     | 14.98     |
| `muted`  | `#D4C5AB` | 10.95     | 10.26     | 11.37     |
| `subtle` | `#9BB4C6` | 8.62      | 8.07      | 8.95      |
| `gold`   | `#FFC000` | 11.32     | 10.60     | 11.76     |
| `cyan`   | `#00DCFD` | 11.20     | 10.49     | 11.63     |
| `border` | `#5A87A8` | 4.84      | 4.53      | 5.02      |
| `pink`   | `#FF007A` | 4.90      | 4.59      | 5.09      |

`text`, `muted`, `subtle`, `gold`, and `cyan` clear AAA (7:1) on every surface.

`border` carries every visible boundary and is governed by SC 1.4.11 Non-text
Contrast (3:1). It clears it on all three surfaces.

**`pink` is the one constrained token.** It clears AA (4.5:1) but not AAA. It is
restricted to the section number (weight 800, never below 24px, which is WCAG
large text) and to decorative accents. It is never used for body-size text.

The focus indicator is a 3px gold outline with a 3px offset. The offset is
required: gold against the gold button measures 1.00:1, so a ring flush with the
element would be invisible there. The offset puts surface colour on both sides
of the ring, which is what SC 1.4.11 measures.

## 6. Testing and validation

### What is automated

Playwright drives a real Chromium against the production build. CI runs it on
every push and pull request to `main`, and a violation fails the build.

| Check             | Tool                                | Covers                                    |
| ----------------- | ----------------------------------- | ----------------------------------------- |
| WCAG rule scan    | axe-core via `@axe-core/playwright` | Every built route                         |
| Reflow navigation | Playwright at 320px                 | Menu opens, takes focus, closes on Escape |
| Route drift       | Playwright                          | Test list matches real build output       |
| Type safety       | `astro check`                       | Templates and components                  |

Rule tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

**Automated testing catches only a minority of WCAG success criteria.** Roughly
a third of WCAG failures are machine-detectable at all; the rest need a human.
A green suite means no violation of the subset axe can see. It does not mean the
page is usable. Nothing here has been checked against the majority of criteria
that require judgement.

### What is not automated, and has not been done

None of the following has been performed. Each is a real gap, not a formality.

- **Keyboard flow.** Tab order, focus visibility in context, whether the sticky
  80px header obscures a focused element in practice (SC 2.4.11). The
  `scroll-margin-top` rule is in place but has not been verified by tabbing
  through a long page, because no long page exists yet.
- **Screen reader announcement quality.** Nothing has been tested with NVDA,
  JAWS, VoiceOver, or Orca. Whether announcements are correct, ordered, and not
  redundant is unknown.
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
3. **The footer badge image is not placed.** The design comps show a badge mark
   in the footer that has not been implemented. See the `TODO(design)` in
   `src/components/Footer.astro`. When added it takes
   `alt="Sinduri - Lepus Ridet"`, and a decorative watermark version takes
   `alt=""`.
4. **The spinning badge and the marquee are not built.** Both appear in the
   comps. Both auto-start and run past five seconds, so under SC 2.2.2 Pause,
   Stop, Hide each needs a keyboard-operable pause control. A
   `prefers-reduced-motion` media query does not satisfy 2.2.2 on its own,
   because a user who has not set that preference still has no way to stop it.
5. **No screen reader testing has been done at all.** See section 6.
6. **Only one blog post exists,** and it is placeholder content. Long-form
   reading order, in-page headings, and link text in real prose are untested.
7. **`npm run typecheck` reports 6 errors** for missing Node type definitions in
   `playwright.config.ts` and `tests/routes.ts`. This does not affect the site,
   but the gate is not clean.

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
