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

## Found while adding the best-practice and checklist coverage (2026-09-05)

- [ ] Five category pages title themselves in lower case — `skincare | sinduri.lol`,
      `open source | sinduri.lol`, `personal thoughts`, `professional journey`,
      `travel` — against `Blog | sinduri.lol` and `Career | sinduri.lol`, because
      the segment comes through from the content as authored.
      `tests/titles.spec.ts` deliberately does not assert casing: the titles are
      distinct and descriptive, so nothing fails SC 2.4.2, and normalising them
      is a content decision rather than one a test should settle by fiat
- [ ] No accessibility statement is reachable from the site. `ACCESSIBILITY.md`
      exists in the repository and is linked from nothing a reader can click.
      Both external checklists call this out. Building `/accessibility` is a
      page plus copy, so it waits on the same decision as the rest of the copy
- [ ] `docs/MANUAL_TESTING.md` §10 has gone stale and now understates the site.
      It says "the **spinning badge** is not built, so SC 2.2.2 has nothing to
      test" — `tests/motion.spec.ts` has measured it for several commits — and
      that "`BlogCard.astro` is a stub no route renders", which `/blog` and the
      homepage both contradict. Rewrite §10 against what the site is, the way §7
      of ACCESSIBILITY.md was
- [ ] No `robots.txt` and no `sitemap.xml` are built. `public/` holds only
      `_headers`, `favicon.ico`, `favicon.svg` and `images/`.
      specification.website grades both Recommended. SEO rather than
      accessibility, so it is out of `npm run test:a11y` scope, but it is a real
      absence and `@astrojs/sitemap` would need asking about first
- [ ] `public/_headers` has no `/.well-known/security.txt` and no COOP / COEP /
      CORP, both Recommended on specification.website. The file already carries
      CSP, HSTS, Referrer-Policy, X-Content-Type-Options, X-Frame-Options and
      Permissions-Policy, so this is an addition rather than a gap in what is
      there. Any change needs a matching assertion in `tests/headers.spec.ts` in
      the same commit, the way the contact form item above does

## Manual accessibility testing (docs/MANUAL_TESTING.md)

- [ ] §1 and §2: keyboard flow through header, footer and MobileMenu, including sticky-header occlusion (SC 2.4.11). Partly automated in `tests/focus.spec.ts`, which walks the tab order **both ways** on every route at 305px and 1280px and hit-tests each stop; the by-hand pass stays, because a person notices things no assertion asks about
- [ ] §3: reflow at 400% zoom on 1280px, every page
- [ ] §4: reduced motion with `prefers-reduced-motion: reduce` enabled. Now
      partly automated twice over: `tests/motion.spec.ts` asserts the badge
      never gets the animation class and renders no dead pause control, and a
      second test sweeps **all 23 routes** for any animation or transition that
      survives the reduce block, including one neutralised on duration but left
      `infinite`. Zero survive today. The by-hand pass stays: none of that says
      whether the still page still makes sense
- [ ] §5: focus indicator visibility in context (SC 2.4.7, SC 2.4.11). The
      _contrast_ half is now automated: `tests/focus.spec.ts` measures the ring
      against the composited ground at every stop of the real keyboard walk,
      for SC 1.4.11. 572 controls, lowest 10.60:1. What stays by hand is
      whether the ring reads as a focus indicator in context, which no ratio
      answers
- [ ] §6: the Orca pass in Firefox, plus §6.4, the uppercase question, in Chrome (ACCESSIBILITY.md gap 4)
- [ ] §7: 200% text-only zoom (SC 1.4.4) and the text spacing override (SC 1.4.12)
- [ ] §8: cross-browser. **Firefox is done and automated** — `playwright.config.ts`
      defines a `firefox` project, the suite runs 974 tests across two engines,
      and Firefox 153.0 passed all 487 on the first attempt with no source
      change and no browser-conditional assertion. `<dialog>` and `showModal()`
      behave, which is what this item was really about. What remains:
      **WebKit has never been run once.** It downloads but will not launch here
      without system libraries (`libicu74` and others) that
      `sudo npx playwright install-deps` installs — a change to the machine
      rather than the repository. No `webkit` project is defined on purpose, so
      that CI is not the first place it ever runs; see the reasoning in
      `playwright.config.ts`. The by-hand Firefox pass in §8 also stays, because
      a passing assertion is not a judgement about whether the page reads right
- [ ] §9: target size (SC 2.5.8). Automated in `tests/target-size.spec.ts` for every route at 305px and 1280px, measuring each target's own box — the SC 2.5.8 spacing exception is deliberately not implemented, because relying on it makes the gap between two controls load-bearing for conformance
- [ ] Rewrite ACCESSIBILITY.md §6 and gap 4 with what was heard, in which browser, at which versions
