## What this changes

<!-- One or two sentences. What is different after this merges, and why. -->

## Accessibility

Every PR answers this section, including ones that touch no markup. "Not
applicable" is a valid answer; leaving it blank is not.

- [ ] Any new interactive element is a native element, or the PR says why an
      ARIA pattern was unavoidable.
- [ ] Any new interactive element has a visible focus indicator, and no focus
      outline was removed without a replacement.
- [ ] Every new target meets SC 2.5.8 on its own size (24x24 CSS px), without
      relying on the spacing exception.
- [ ] No size, colour, shadow, or radius is an arbitrary value. Any new colour
      is a token from `src/styles/global.css`, measured against all three
      surfaces (`#131313`, `#1A1A1A`, `#0E0E0E`), with the ratios recorded in
      [ACCESSIBILITY.md](../ACCESSIBILITY.md) §5.
- [ ] No heading floor was raised without re-running `tests/reflow.spec.ts`.

## What CI did not check

`npm run build`, `npm run typecheck`, `npm run format:check`, and
`npm run test:a11y` run on every pull request, and the branch ruleset will not
merge a branch that fails them. Re-attesting to them here would be noise, so
this section is only what no machine decides.

- [ ] Documentation this change makes wrong is corrected in the same PR,
      including [ACCESSIBILITY.md](../ACCESSIBILITY.md) if this change closes a
      gap, opens one, or invalidates a statement in it.

If a manual check from [docs/MANUAL_TESTING.md](../docs/MANUAL_TESTING.md) was
actually performed, say which one and what the result was. If none was, say
that. Untested means untested.

## Notes for the reviewer

<!-- Anything deliberately left out, anything you are unsure about, anything
     that needs a decision rather than a review. -->
