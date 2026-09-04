# TODO

Outstanding work on sinduri.lol. Seeded from AI.md "Not built yet",
ACCESSIBILITY.md §6 and §7, and docs/MANUAL_TESTING.md.

## Content and assets

- [ ] Replace the placeholder copy on every page with real editorial copy, which waits for Sinduri
- [ ] Add the CV PDF at `public/sinduri-guntupalli-cv.pdf`, after checking it for personal data
- [ ] Replace every `PlaceholderBox`: hero portrait, workspace square, About portrait, Career conference photo, blog post artwork
- [ ] Replace the eleven lorem ipsum posts with real ones. They exist and are valid against the schema; every word is placeholder (ACCESSIBILITY.md gap 5)

## Build

- [ ] Build the contact form, widening `form-action` in `public/_headers` with a matching assertion in `tests/headers.spec.ts` in the same commit (ACCESSIBILITY.md gap 1)
- [x] Render `.surface-gold` on a real route — `/career` does, and `tests/gold-surface.spec.ts` measures both buttons in situ at 305px and 320px. The fixtures were kept on purpose rather than replaced: a fixture can be broken deliberately to prove an assertion still bites without editing a shipped route. Gap 6 is narrowed, not closed — nobody has looked at it

## Documentation

- [ ] Rewrite `ACCESSIBILITY.md` §7 against what the site now is. Deferred on 2026-09-05 because a second agent session was writing to that file at the time:
  - [ ] Gap 2 says "Most pages are placeholder stubs … they pass axe because there is almost nothing on them". Every page is built; the _copy_ is what is placeholder. The parenthetical is now actively misleading — 23 routes pass with real markup, prose, a paginated listing and a gold surface on them
  - [ ] Gap 5 says one post exists. Eleven do
  - [ ] Gap 6: narrowed to "measured in situ, never looked at" (see above)
  - [ ] NEW GAP: the copy is lorem ipsum, which is **Latin inside a `lang="en"` document**, so a screen reader pronounces it with English rules. Wrong on every page, acceptable only until real copy lands. It also means §6's "cognitive load, plain language and reading order" cannot be assessed at all yet, rather than merely being untested
  - [ ] NEW: record the SC 2.4.11 defect found and fixed on 2026-09-05 — `scroll-margin-top` covered anchor destinations but not the tab order, so shift-tabbing put controls entirely under the sticky header. Fixed in `bcf0ecf`, tested in `9d5bacd`. §6 still lists sticky-header occlusion as unverified, which is no longer true in the automated tier
  - [ ] §4 and §6: three spec files were added (`focus`, `target-size`, `blog`), and the SC 2.5.8 claim in §4 now has a test behind it instead of being a claim

## Manual accessibility testing (docs/MANUAL_TESTING.md)

- [ ] §1 and §2: keyboard flow through header, footer and MobileMenu, including sticky-header occlusion (SC 2.4.11). Partly automated in `tests/focus.spec.ts`, which walks the tab order **both ways** on every route at 305px and 1280px and hit-tests each stop; the by-hand pass stays, because a person notices things no assertion asks about
- [ ] §3: reflow at 400% zoom on 1280px, every page
- [ ] §4: reduced motion with `prefers-reduced-motion: reduce` enabled
- [ ] §5: focus indicator visibility in context (SC 2.4.7, SC 2.4.11)
- [ ] §6: the Orca pass in Firefox, plus §6.4, the uppercase question, in Chrome (ACCESSIBILITY.md gap 4)
- [ ] §7: 200% text-only zoom (SC 1.4.4) and the text spacing override (SC 1.4.12)
- [ ] §8: cross-browser run in Firefox and WebKit, `<dialog>` in particular. Needs browsers that are not installed — `~/.cache/ms-playwright` holds only chromium, and `playwright.config.ts` defines only a chromium project, so this is a download plus a config change before it is a test run
- [ ] §9: target size (SC 2.5.8). Automated in `tests/target-size.spec.ts` for every route at 305px and 1280px, measuring each target's own box — the SC 2.5.8 spacing exception is deliberately not implemented, because relying on it makes the gap between two controls load-bearing for conformance
- [ ] Rewrite ACCESSIBILITY.md §6 and gap 4 with what was heard, in which browser, at which versions
