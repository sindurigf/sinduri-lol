# TODO

Outstanding work on sinduri.lol. Seeded from AI.md "Not built yet",
ACCESSIBILITY.md §6 and §7, and docs/MANUAL_TESTING.md.

## Content and assets

- [ ] Replace the placeholder copy on every page with real editorial copy, which waits for Sinduri
- [ ] Add the CV PDF at `public/sinduri-guntupalli-cv.pdf`, after checking it for personal data
- [ ] Replace the four `PlaceholderBox` slots that exist: the hero portrait and
      the workspace square on the homepage, the About portrait, and the blog
      post artwork in `BlogCard`. There is no fifth. **The Career conference
      photo has no placement on `/career` at all**, neither a `PlaceholderBox`
      nor an `<img>`; the page's only image is the decorative hero watermark.
      The `photo` ratio comment in `PlaceholderBox.astro` still names it as
      though it were a frame already waiting for a photograph; AI.md said the
      same and was corrected. Building that placement is a separate change
      from replacing a placeholder
- [ ] Replace the eleven lorem ipsum posts with real ones. They exist and are valid against the schema; every word is placeholder (ACCESSIBILITY.md gap 5)

## Build

- [ ] Build the contact form, widening `form-action` in `public/_headers` with a matching assertion in `tests/headers.spec.ts` in the same commit (ACCESSIBILITY.md gap 1)
- [x] Render `.surface-gold` on a real route — `/career` does, and `tests/gold-surface.spec.ts` measures both buttons in situ at 305px and 320px. The fixtures were kept on purpose rather than replaced: a fixture can be broken deliberately to prove an assertion still bites without editing a shipped route. Gap 6 is narrowed, not closed — nobody has looked at it

## Documentation

- [x] Rewrite `ACCESSIBILITY.md` §7 against what the site now is — done 2026-09-05 in `b090d4f`. Gaps 2, 5 and 6 rewritten; gap 7 (lorem ipsum is Latin in a `lang="en"` document) and gap 8 (the SC 2.4.11 defect) added; §4 and §6 corrected, including a §6 bullet that still claimed the sticky-header rule was unverified "because no long page exists yet"

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
