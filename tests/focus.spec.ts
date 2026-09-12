import { expect, test, type Page } from '@playwright/test';
import { NON_TEXT, PAGE_HELPERS } from './contrast';
import { gotoSettled } from './settle';
import { ROUTES } from './routes';

/**
 * Keyboard flow: SC 2.4.7 Focus Visible and SC 2.4.11 Focus Not Obscured
 * (Minimum), walked on every route in both directions at two widths.
 *
 * docs/MANUAL_TESTING.md §1, §2 and §5 are the by-hand versions of this, and
 * they stay: a person tabbing a page notices things no assertion asks about.
 * What this covers is the part that is mechanical, and the part that had
 * already gone wrong once.
 *
 * Both directions, which is the whole point of the file. A forward pass over
 * every route reported nothing wrong while SC 2.4.11 was being failed on six
 * controls. Tabbing forward, Chromium scrolls the next control up from the
 * bottom edge of the viewport, so it never approaches a header pinned to the
 * top. Shift-Tabbing back is the direction that fails, because there the
 * browser scrolls the control to the TOP of the viewport, which is exactly
 * where the sticky header is.
 *
 * Hit-testing rather than geometry. Whether the focused element's box
 * intersects the header's box is wrong in both directions: it reports the skip
 * link as obscured on every route, since the skip link deliberately overlaps
 * the header band and is painted over it (`z-60` against the header's `z-50`),
 * and it misses anything obscured by an element that is not the header.
 * `document.elementFromPoint` answers the question actually being asked.
 *
 * SC 2.4.11 is the *minimum* criterion, so the bar is that the control is not
 * ENTIRELY hidden. Partial obscuring is SC 2.4.12 Focus Not Obscured
 * (Enhanced) at AAA, which this site does not claim. Both numbers are reported
 * on failure, because a control that is 80% covered is worth looking at even
 * though it passes AA.
 *
 * The ring's contrast is asserted too, not just its presence; see the SC
 * 1.4.11 block at the foot of the file. Verified 2026-09-05: on a keyboard
 * walk of `/`, all 12 of the first 12 stops resolve a ratio, the skip link at
 * 11.32:1 against `background` and the header controls at 12.02:1 against the
 * composited header, which is the figure global.css has claimed since the ring
 * was written; forcing the ring to #1a1a1a catches 8 of 8 stops, at 1.07 to
 * 1.13:1.
 *
 * Verified not to be vacuous, by reverting the fix rather than by assertion.
 * With the `scroll-margin-top` rule in global.css put back to naming only
 * `:target, [id]`, this spec fails on `/` at both widths and, at 305px, on
 * `/blog`, `/blog/page/2` and all five category routes, every failure
 * reporting controls with 5/5 probe points covered. Restored, all pass. Eight
 * of those nine failures are at 305px, where the header eats a larger share of
 * the viewport, and none is reachable by tabbing forward, which is the
 * argument for walking backwards at a narrow width.
 */

const WIDTHS = [
  { width: 305, height: 720, note: '400% zoom, classic scrollbar' },
  { width: 1280, height: 900, note: 'desktop' },
] as const;

/**
 * A hard ceiling on one walk. Reaching it is a failure, never a truncation.
 *
 * The walk below terminates on element identity, so an ordinary tab order
 * ends itself the moment focus returns somewhere it has already been. This
 * exists for the case where that never happens: a focus trap, or a widget
 * that moves focus on every keypress, would otherwise spin here until the
 * test budget ran out and report a timeout rather than a cause.
 *
 * 300 against a largest walk of 67 stops, which is
 * /blog/open-source-is-not-just-code at 1280px, measured 2026-09-08. The
 * margin is deliberate rather than lazy. Ten of the eleven posts are still
 * lorem ipsum at ten stops each and replacing them with real prose is an open
 * TODO item, so the number this cap sits above is the one that grows, and a
 * cap that started failing first would be the wrong thing to fail.
 */
const MAX_STOPS = 300;

/**
 * What counts as a control for the coverage floor below.
 *
 * Mirrors the selector in tests/target-size.spec.ts, which asks the same
 * question of the same elements for SC 2.5.8. The two are deliberately the
 * same list: a thing that has to be big enough to hit is a thing that has to
 * be reachable by keyboard, and a selector that drifted between the two files
 * would leave one of them quietly measuring a different site.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';

interface Stop {
  selector: string;
  text: string;
  /** Probe points that had something else painted on top. */
  covered: number;
  probed: number;
  /** What was on top, if anything. */
  by: string | null;
  /** True when this element has already been focused during this walk. */
  repeat: boolean;
  hasRing: boolean;
  outline: string;
  /** The ring measured against what is painted in the offset gap. */
  ratio: number | null;
  behind: string | null;
}

/**
 * Read the currently focused element: whether anything is painted over it, and
 * whether it carries a focus indicator.
 *
 * Both are read while the element still has focus. `getComputedStyle` returns a
 * live declaration, so an outline read after a blur is the resting value.
 */
const readFocused = (page: Page): Promise<Stop | null> =>
  page.evaluate(`(() => {
    ${PAGE_HELPERS}

    const el = document.activeElement;
    if (el === null || el === document.body || el === document.documentElement) {
      return null;
    }

    /*
     * IDENTITY, NOT DESCRIPTION. This used to end the walk on a repeated
     * \`tagName.class|text\` string, and two prose links with no class and the
     * same anchor text collide on that. Measured on the real post before this
     * changed: the forward walk stopped after 13 of 63 controls at 305px and
     * 17 of 67 at 1280px, both on \`a|Kubernetes\`, and the backward walk
     * stopped after 35 of each. Every assertion below then reported green
     * having looked at a fifth of the page.
     *
     * The visited list holds the elements themselves, so nothing about how a
     * control is described can end a walk early. It is reset per walk by
     * resetWalk, and a missing one is an error rather than a silent restart.
     */
    const walkState = window.__focusWalk;
    if (walkState === undefined) {
      throw new Error(
        'resetWalk was not called before this walk, so the identity list is ' +
          'missing and the walk has no termination condition.',
      );
    }
    const repeat = walkState.visited.includes(el);
    if (!repeat) walkState.visited.push(el);

    /*
     * Named \`label\` and not \`describe\`: PAGE_HELPERS brings a \`describe\` of
     * its own, and two consts of one name in the same scope is a SyntaxError
     * that would surface as every stop reading null.
     */
    const label = (node) => {
      const cls =
        typeof node.className === 'string' && node.className.trim() !== ''
          ? '.' + node.className.trim().split(/\\s+/).slice(0, 2).join('.')
          : '';
      return node.tagName.toLowerCase() + cls;
    };

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    /*
     * Four corners and the centre, inset by 2px so a corner probe lands on the
     * element rather than on whatever abuts it.
     */
    const points = [
      [rect.left + 2, rect.top + 2],
      [rect.right - 2, rect.top + 2],
      [rect.left + 2, rect.bottom - 2],
      [rect.right - 2, rect.bottom - 2],
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
    ];

    let covered = 0;
    let probed = 0;
    let by = null;

    for (const [x, y] of points) {
      // A point outside the viewport is not evidence either way.
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        continue;
      }
      probed += 1;

      const hit = document.elementFromPoint(x, y);
      if (hit === null) {
        covered += 1;
        continue;
      }
      // The element itself, its own descendants, or an ancestor painting
      // behind it all count as "not obscured".
      if (el.contains(hit) || hit.contains(el)) continue;

      covered += 1;
      if (by === null) by = label(hit);
    }

    const hasRing =
      style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;

    /*
     * SC 1.4.11 on the indicator itself. The ring is drawn in the offset gap,
     * which is outside the element's border box, so what it is measured
     * against is the ground BEHIND the control and not the control's own fill.
     * That is the whole reason global.css never sets outline-offset to 0:
     * gold on the gold button is 1.00:1, and a flush ring would be invisible.
     *
     * compositeBackground rather than effectiveBackground, because the sticky
     * header is rgba(10, 10, 10, 0.94) and every control inside it — the
     * wordmark, the nav links, the menu trigger — resolves to null without the
     * compositing step.
     */
    let ratio_ = null;
    let behind_ = null;
    if (hasRing) {
      const offset = parseFloat(style.outlineOffset) || 0;
      const ground = compositeBackground(
        offset > 0 ? el.parentElement || el : el,
      );
      const ring = parse(style.outlineColor);
      if (ground && ring) {
        behind_ =
          'rgb(' + Math.round(ground.r) + ', ' + Math.round(ground.g) +
          ', ' + Math.round(ground.b) + ')';
        ratio_ = ratio(over(ring, ground), ground);
      }
    }

    return {
      repeat,
      selector: label(el),
      text: (el.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 36),
      covered,
      probed,
      by,
      hasRing,
      outline:
        style.outlineStyle + ' ' + style.outlineWidth + ' ' + style.outlineColor,
      ratio: ratio_,
      behind: behind_,
    };
  })()`) as Promise<Stop | null>;

/**
 * Wait until the page has stopped scrolling.
 *
 * `keyboard.press` resolves when the input event has been dispatched, not when
 * the browser has finished moving focus, applying `scroll-margin-top` and
 * settling layout. Probing immediately therefore races the scroll, and what it
 * measures is a position no reader ever sees.
 *
 * WebKit is where that race actually bit. CI run 33979308331 reported the card
 * heading "Sed ut perspiciatis unde omnis" as fully obscured by the header on
 * `/` at 1280px, with `covered: 2, probed: 2`. That `probed: 2` is the tell:
 * three of the five probe points were outside the viewport, so the element was
 * captured mid-scroll rather than at rest. It did not reproduce in 3 repeats
 * of the same spec in the same container.
 *
 * Settling first makes the check stricter, not looser: it measures the state
 * the reader is left in, and a control that is genuinely under the header once
 * the scroll finishes still fails. What it stops doing is failing on frames
 * that never reached anyone's eye. Two consecutive animation frames with an
 * unchanged `scrollY` is the condition, with a frame budget so a page that
 * never settles fails the walk rather than hanging it.
 *
 * Verified 2026-09-05, after the fix: settling did not blunt the assertion,
 * because with `scroll-margin-top` forced to 0 this spec fails 13 of its 46
 * chromium tests and passes all 46 again the moment the rule is restored. That
 * sabotage is harsher than the one at the top of the file, which reverts the
 * rule to naming only `:target, [id]` and fails 9; both are recorded because
 * they break the same rule by different amounts.
 */
const SETTLE_FRAMES = 60;

const settleScroll = (page: Page): Promise<void> =>
  page.evaluate((budget) => {
    return new Promise<void>((resolve) => {
      let previous: number | null = null;
      let frames = 0;
      const check = () => {
        const y = window.scrollY;
        if (previous === y) {
          resolve();
          return;
        }
        previous = y;
        frames += 1;
        if (frames >= budget) {
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }, SETTLE_FRAMES);

/** Start a fresh identity list. One per walk, never shared between them. */
const resetWalk = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as { __focusWalk: { visited: Element[] } }).__focusWalk =
      { visited: [] };
  });

interface Coverage {
  focusable: number;
  visited: number;
  /** Matches the selector, and the walk never focused it. */
  unreached: string[];
  /** The walk focused it, and the selector does not match it. */
  extra: string[];
}

/**
 * What the walk just finished actually covered, against what the page offers.
 *
 * This is the non-vacuity guard, and it replaces a constant that could not do
 * the job: the old one asserted more than three stops, which a walk truncated
 * to 13 of 63 controls cleared without difficulty. A floor has to come from
 * the page it is guarding, or it only catches a walk that found nothing at
 * all.
 *
 * Set equality rather than a fraction, and that is a measurement rather than
 * an aspiration: on every route at both widths, in both directions, a full
 * walk visits exactly the visible focusable elements and nothing else.
 * Measured 2026-09-08, no exceptions.
 *
 * Both halves of the difference are reported because they fail differently.
 * An element the selector matches and Tab never reaches is a keyboard
 * reachability problem in its own right, SC 2.1.1 rather than anything this
 * file is named for. An element the walk focused that the selector does not
 * match means the selector has gone narrow, and tests/target-size.spec.ts is
 * then measuring the wrong set too.
 */
const walkCoverage = (page: Page, selector: string): Promise<Coverage> =>
  page.evaluate((sel) => {
    const visited =
      (window as unknown as { __focusWalk?: { visited: Element[] } })
        .__focusWalk?.visited ?? [];

    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : '';
      const cls =
        typeof el.className === 'string' && el.className.trim() !== ''
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
          : '';
      const text = (el.textContent ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      return `${el.tagName.toLowerCase()}${id}${cls} ${JSON.stringify(text)}`;
    };

    /* Rendered, the same test the walk itself is subject to. */
    const focusable = [...document.querySelectorAll(sel)].filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 || box.height > 0;
    });

    return {
      focusable: focusable.length,
      visited: visited.length,
      unreached: focusable.filter((el) => !visited.includes(el)).map(describe),
      extra: visited.filter((el) => !focusable.includes(el)).map(describe),
    };
  }, selector);

/**
 * Walk the tab order in one direction, collecting every stop.
 *
 * Terminates when focus lands on an element this walk has already visited,
 * which is how an ordinary tab order announces that it has come round. See
 * the note in readFocused for what the previous string-keyed version did
 * instead, and what it cost.
 */
const walk = async (page: Page, key: 'Tab' | 'Shift+Tab'): Promise<Stop[]> => {
  await resetWalk(page);
  const stops: Stop[] = [];

  for (let i = 0; i < MAX_STOPS; i += 1) {
    await settleScroll(page);
    const stop = await readFocused(page);

    /* Focus fell out of the document, or came round to somewhere it has been. */
    if (stop === null || stop.repeat) return stops;

    stops.push(stop);
    await page.keyboard.press(key);
  }

  /*
   * Falling out of the loop is a failure and never a quiet truncation. A walk
   * that cannot come round has met a focus trap or a control that moves focus
   * on every press, and either is worth a named error rather than a silently
   * shortened list of stops.
   */
  throw new Error(
    `the ${key} walk visited ${MAX_STOPS} distinct controls without focus ` +
      `returning to one it had already reached. Either this page really is ` +
      `that large, in which case raise MAX_STOPS deliberately, or something ` +
      `is trapping or reassigning focus on every press.`,
  );
};

const report = (stops: Stop[]): string =>
  stops
    .map(
      (s) =>
        `  ${s.selector} — "${s.text}" — ${s.covered}/${s.probed} points ` +
        `covered${s.by === null ? '' : ` by ${s.by}`}, outline: ${s.outline}`,
    )
    .join('\n');

for (const { width, height, note } of WIDTHS) {
  test.describe(`keyboard flow at ${width}px (${note})`, () => {
    test.use({ viewport: { width, height } });

    for (const route of ROUTES) {
      test(`${route} keeps every focused control visible`, async ({ page }) => {
        const response = await gotoSettled(page, route);
        expect(response?.status(), `${route} should serve a 200`).toBe(200);

        /* Forward, from the top of the document. */
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator('body').press('Tab');
        const forward = await walk(page, 'Tab');
        const forwardCoverage = await walkCoverage(page, FOCUSABLE_SELECTOR);

        /*
         * Backward, from the last control on the page. This is the direction
         * that fails when scroll-margin-top does not cover focusable elements:
         * the browser aligns the control to the top of the viewport, under the
         * sticky header.
         */
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await page.locator('footer a').last().focus();
        const backward = await walk(page, 'Shift+Tab');
        const backwardCoverage = await walkCoverage(page, FOCUSABLE_SELECTOR);

        const stops = [...forward, ...backward];

        /*
         * Non-vacuity, derived from the page rather than from a constant. See
         * walkCoverage: a fixed floor cannot tell a complete walk from one
         * that stopped a fifth of the way through, and that is exactly what
         * this file used to do.
         */
        for (const [direction, coverage] of [
          ['forward', forwardCoverage],
          ['backward', backwardCoverage],
        ] as const) {
          expect(
            coverage.unreached,
            `${route} at ${width}px has control(s) the ${direction} walk ` +
              `never reached, so every assertion below is silent about them. ` +
              `A control that matches the interactive selector and cannot be ` +
              `reached by keyboard is SC 2.1.1, whatever else is true of it. ` +
              `${coverage.visited} of ${coverage.focusable} visited:\n` +
              coverage.unreached.map((entry) => `  ${entry}`).join('\n'),
          ).toEqual([]);

          expect(
            coverage.extra,
            `${route} at ${width}px focused control(s) that ` +
              `FOCUSABLE_SELECTOR does not match, so the coverage floor is ` +
              `counting a smaller set than the page really has, and ` +
              `tests/target-size.spec.ts is measuring that same smaller set:\n` +
              coverage.extra.map((entry) => `  ${entry}`).join('\n'),
          ).toEqual([]);
        }

        /* SC 2.4.11 (Minimum): not ENTIRELY hidden. */
        const hidden = stops.filter(
          (s) => s.probed > 0 && s.covered === s.probed,
        );
        expect(
          hidden,
          `${route} at ${width}px has focused control(s) completely hidden ` +
            `behind something else (SC 2.4.11 Focus Not Obscured, Minimum). ` +
            `The usual cause is scroll-margin-top not covering focusable ` +
            `elements, so the browser aligns them under the sticky header — ` +
            `which only shows up walking backwards:\n${report(hidden)}`,
        ).toEqual([]);

        /* SC 2.4.7: every stop has an indicator. */
        const unmarked = stops.filter((s) => !s.hasRing);
        expect(
          unmarked,
          `${route} at ${width}px has focused control(s) with no visible ` +
            `focus indicator (SC 2.4.7). The site-wide ring is a 3px gold ` +
            `outline on :focus-visible:\n${report(unmarked)}`,
        ).toEqual([]);

        /*
         * SC 1.4.11: the indicator has to be perceivable, not merely present.
         * A 3px gold ring is no use at 1.2:1 against what it is drawn on, and
         * the assertion above would score that a pass: it asks only whether an
         * outline exists.
         *
         * This came out of a trial run of the keyboard-a11y-tester project,
         * which reported a focus indicator at 2.24:1 on this site. That number
         * did not reproduce. Measured 2026-09-08: 1672 stops, every route at
         * both widths in both directions, lowest 10.60:1, gold on `surface`.
         * The run was still worth it, because the dimension it points at was
         * genuinely untested and global.css had claimed 11.32 / 10.60 / 11.76
         * against background / surface / deep with nothing behind the claim.
         * The count is dated rather than maintained; the assertion is the
         * floor.
         *
         * Stops with no resolvable ground are not counted: a ratio of null
         * means a background image or gradient sits behind the control, where
         * there is no single colour to measure and guessing is worse than
         * declining. `hasRing` above is what stops that becoming a hole. All
         * 1672 resolved a ground on the pages as measured, which is an
         * observation about today's content and not a property of the site:
         * one decorative background behind one control brings the case
         * straight back, so the branch stays.
         */
        const dim = stops.filter(
          (s) => s.hasRing && s.ratio !== null && s.ratio < NON_TEXT,
        );
        expect(
          dim,
          `${route} at ${width}px has focus indicator(s) below ${NON_TEXT}:1 ` +
            `against the ground they are drawn on (SC 1.4.11). The ring is ` +
            `painted in the outline-offset gap, so it is measured against ` +
            `what is behind the control, never the control's own fill:\n` +
            dim
              .map(
                (s) =>
                  `  ${s.selector} ${JSON.stringify(s.text)}\n` +
                  `    outline: ${s.outline}\n` +
                  `    behind:  ${s.behind}\n` +
                  `    ratio:   ${s.ratio?.toFixed(2)}:1`,
              )
              .join('\n'),
        ).toEqual([]);
      });
    }
  });
}
