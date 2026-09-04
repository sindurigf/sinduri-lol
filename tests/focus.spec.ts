import { expect, test, type Page } from '@playwright/test';
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
 * WHY BOTH DIRECTIONS, WHICH IS THE WHOLE POINT OF THE FILE.
 *
 * A forward pass over every route reported nothing wrong while SC 2.4.11 was
 * being failed on six controls. Tabbing forward, Chromium scrolls the next
 * control up from the bottom edge of the viewport, so it never approaches a
 * header pinned to the top. Shift-Tabbing back is the direction that fails,
 * because there the browser scrolls the control to the TOP of the viewport —
 * which is exactly where the sticky header is. A test that only walks forward
 * is a test that cannot see the bug this file exists for.
 *
 * WHY HIT-TESTING RATHER THAN GEOMETRY. The obvious check is whether the
 * focused element's box intersects the header's box, and it is wrong in both
 * directions. It reports the skip link as obscured on every route — the skip
 * link deliberately overlaps the header band and is painted over it, `z-60`
 * against the header's `z-50` — and it would miss anything obscured by an
 * element that is not the header. `document.elementFromPoint` answers the
 * question actually being asked: is something else painted on top of this.
 *
 * SC 2.4.11 IS THE *MINIMUM* CRITERION, so the bar is that the control is not
 * ENTIRELY hidden. Partial obscuring is SC 2.4.12 Focus Not Obscured (Enhanced)
 * at AAA, which this site does not claim. Both numbers are reported on failure,
 * because a control that is 80% covered is worth looking at even though it
 * passes AA.
 *
 * VERIFIED NOT TO BE VACUOUS, by reverting the fix rather than by assertion.
 * With the `scroll-margin-top` rule in global.css put back to naming only
 * `:target, [id]`, 9 of these 46 tests fail: `/` at both widths, and at 305px
 * `/blog`, `/blog/page/2` and all five category routes. Every failure reports
 * controls with 5/5 probe points covered — for example, on `/blog` at 305px,
 * `a "Ut enim ad"` covered by the header's logo tile and `a "personal
 * thoughts"` covered by the header container. Restored, all 46 pass.
 *
 * The shape of that failure list is itself the argument for walking backwards
 * at a narrow width: eight of the nine are at 305px, where the header eats a
 * larger share of the viewport, and none of them is reachable by tabbing
 * forward.
 */

const WIDTHS = [
  { width: 305, height: 720, note: '400% zoom, classic scrollbar' },
  { width: 1280, height: 900, note: 'desktop' },
] as const;

/** Enough to walk the longest page; /blog is 31 stops. */
const MAX_STOPS = 120;

interface Stop {
  selector: string;
  text: string;
  /** Probe points that had something else painted on top. */
  covered: number;
  probed: number;
  /** What was on top, if anything. */
  by: string | null;
  hasRing: boolean;
  outline: string;
}

/**
 * Read the currently focused element: whether anything is painted over it, and
 * whether it carries a focus indicator.
 *
 * Both are read while the element still has focus. `getComputedStyle` returns a
 * live declaration, so an outline read after a blur is the resting value.
 */
const readFocused = (page: Page): Promise<Stop | null> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (
      el === null ||
      el === document.body ||
      el === document.documentElement
    ) {
      return null;
    }

    const describe = (node: Element): string => {
      const cls =
        typeof node.className === 'string' && node.className.trim() !== ''
          ? `.${node.className.trim().split(/\s+/).slice(0, 2).join('.')}`
          : '';
      return `${node.tagName.toLowerCase()}${cls}`;
    };

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    /*
     * Four corners and the centre, inset by 2px so a corner probe lands on the
     * element rather than on whatever abuts it.
     */
    const points: [number, number][] = [
      [rect.left + 2, rect.top + 2],
      [rect.right - 2, rect.top + 2],
      [rect.left + 2, rect.bottom - 2],
      [rect.right - 2, rect.bottom - 2],
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
    ];

    let covered = 0;
    let probed = 0;
    let by: string | null = null;

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
      if (by === null) by = describe(hit);
    }

    return {
      selector: describe(el),
      text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 36),
      covered,
      probed,
      by,
      hasRing:
        style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
    };
  });

/** Walk the tab order in one direction, collecting every stop. */
const walk = async (page: Page, key: 'Tab' | 'Shift+Tab'): Promise<Stop[]> => {
  const stops: Stop[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < MAX_STOPS; i += 1) {
    const stop = await readFocused(page);
    if (stop === null) break;

    // The tab order wraps to the browser chrome and back; stop on a repeat.
    const key_ = `${stop.selector}|${stop.text}`;
    if (seen.has(key_) && stops.length > 1) break;
    seen.add(key_);
    stops.push(stop);

    await page.keyboard.press(key);
  }

  return stops;
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
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response?.status(), `${route} should serve a 200`).toBe(200);
        await page.evaluate(() => document.fonts.ready);

        /* Forward, from the top of the document. */
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator('body').press('Tab');
        const forward = await walk(page, 'Tab');

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

        const stops = [...forward, ...backward];

        /*
         * Non-vacuity. Without this the assertions below pass on an empty walk
         * — which is what a broken selector, a failed focus() or a page that
         * never hydrated all look like from here.
         */
        expect(
          forward.length,
          `${route} exposed no tab stops walking forward at ${width}px`,
        ).toBeGreaterThan(3);
        expect(
          backward.length,
          `${route} exposed no tab stops walking backward at ${width}px`,
        ).toBeGreaterThan(3);

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
      });
    }
  });
}
