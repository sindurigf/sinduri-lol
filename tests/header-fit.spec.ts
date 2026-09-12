import { expect, test, type Page } from '@playwright/test';
import { CTA } from '../src/lib/nav';
import { gotoSettled } from './settle';

/**
 * The header row fits the column at the narrow end of the desktop band.
 *
 * The primary nav appears at `md`, 768px, and what it holds needed 730px
 * inside a 720px column. On /about at 768px before the fix the wordmark
 * touched "Home" and the call to action wrapped onto two lines.
 *
 * No other spec visits that band (checked 2026-09-11): reflow runs at 305,
 * 320, 640 and 1280px, target-size and focus at 305 and 1280px, alignment at
 * 1440px only, for a defect invisible below the column width.
 *
 * Measured against the column, not the viewport. The row spills out of the
 * gutter the header, <main> and the footer share without scrolling the page,
 * so tests/reflow.spec.ts cannot see it.
 *
 * Wrapping is asserted by comparison with the control's height at 1280px,
 * where it is on one line. Pinning a pixel height here would fail on a font
 * metric changing rather than on this defect returning.
 *
 * Proven able to fail, 2026-09-10, chromium: reverting the band's three
 * spacing trims at once (`gap-3` on the list, `px-4` on the links, `px-6` on
 * the call to action) fails 768px and 800px with "the call to action is
 * 15.6px taller than its single-line height"; 1023px passes.
 *
 * The wrap is asserted first because it is the symptom a person would see,
 * and an expect() ends its test. The column-overflow assertion under it
 * (13.6px past the column at 768px with the wrap suppressed by
 * `whitespace-nowrap` alone, 2026-09-10) stops a fix that prevents wrapping
 * without making room.
 */

/**
 * Widths where the desktop nav is visible and the room is tightest. 768px is
 * the breakpoint, 1023px the last width before `lg` hands the row its full
 * spacing back, and 800px sits between them because the failure was not
 * uniform: at 800px the row fitted while the call to action still wrapped.
 */
const CROWDED_WIDTHS = [768, 800, 1023] as const;

/**
 * A width where the row has room, the reference for an unwrapped control.
 */
const ROOMY_WIDTH = 1280;

/**
 * The least space that may sit between the wordmark and the first nav link.
 *
 * A floor rather than the measured value, because "fits" and "reads as a row"
 * are not the same state: a fix that stopped the wrapping still left the two
 * 2.4px apart in chromium, which passes "greater than zero" and reads as one
 * run of text. 16px is half the gutter at this width. Measured at 34.4px in
 * chromium and 35.2px in firefox, 2026-09-10.
 */
const MIN_WORDMARK_GAP = 16;

const VIEWPORT_HEIGHT = 800;

/**
 * The route the band was measured on, and the one with the longest nav label
 * lit.
 */
const ROUTE = '/about';

interface RowMetrics {
  readonly ctaHeight: number;
  readonly ctaRight: number;
  readonly columnRight: number;
  readonly logoRight: number;
  readonly navLeft: number;
}

const measureRow = async (page: Page): Promise<RowMetrics> =>
  page.evaluate((ctaHref) => {
    const column = document.querySelector('header > div');
    /*
     * The header's own call to action, not the mobile dialog's copy. Both
     * carry `.nav-cta` and both are in the DOM at every width, because the
     * island server-renders its whole panel.
     */
    const cta = [
      ...document.querySelectorAll(`header a[href="${ctaHref}"]`),
    ].find((element) => !element.closest('#mobile-menu-panel'));
    const logo = document.querySelector('header a[href="/"]');
    const nav = document.querySelector('header nav[aria-label="Primary"]');

    if (!column || !cta || !logo || !nav) {
      throw new Error(
        'The header row is not shaped the way this spec measures it. One of ' +
          'the column, the call to action, the logo link or the primary nav ' +
          'was not found, which is a structural change rather than a fit ' +
          'failure: update the selectors here in the same commit.',
      );
    }

    /*
     * The wordmark rather than the link box. The link is a flex container its
     * parent can stretch, so its right edge says nothing about where the ink
     * stops.
     */
    const wordmark = logo.lastElementChild ?? logo;

    return {
      ctaHeight: cta.getBoundingClientRect().height,
      ctaRight: cta.getBoundingClientRect().right,
      columnRight: column.getBoundingClientRect().right,
      logoRight: wordmark.getBoundingClientRect().right,
      navLeft: nav.getBoundingClientRect().left,
    };
  }, CTA.href);

test.describe('the header row at the narrow end of the desktop band', () => {
  test.use({ viewport: { width: ROOMY_WIDTH, height: VIEWPORT_HEIGHT } });

  /*
   * One test per width, not one test walking the widths. A single test stops
   * at the first failing assertion, and for a band defect the set of widths
   * that fail is the finding.
   */
  for (const width of CROWDED_WIDTHS) {
    test(`the row fits the column and nothing wraps at ${width}px`, async ({
      page,
    }) => {
      /*
       * The reference is taken at ROOMY_WIDTH in the same page: the control's
       * single-line height depends on the engine and the loaded font, so it
       * is not a number to write down here.
       */
      await gotoSettled(page, ROUTE);
      const roomy = await measureRow(page);

      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, ROUTE);
      const row = await measureRow(page);

      expect(
        row.ctaHeight,
        `at ${width}px the call to action is ${(row.ctaHeight - roomy.ctaHeight).toFixed(1)}px ` +
          `taller than its single-line height, so its label has wrapped. It ` +
          `is the widest thing in the row and the first to give way when the ` +
          `row does not fit.`,
      ).toBeCloseTo(roomy.ctaHeight, 1);

      expect(
        row.ctaRight,
        `at ${width}px the header row ends ${(row.ctaRight - row.columnRight).toFixed(1)}px ` +
          `outside the column that the header, <main> and the footer share, ` +
          `so the header's content no longer lines up with the page's. This ` +
          `does not scroll the viewport and tests/reflow.spec.ts will not ` +
          `see it.`,
      ).toBeLessThanOrEqual(row.columnRight);

      expect(
        row.navLeft - row.logoRight,
        `at ${width}px the wordmark and the first nav link are ` +
          `${(row.navLeft - row.logoRight).toFixed(1)}px apart. They read as ` +
          `one run of text at anything near zero, which is what a row that ` +
          `has run out of room looks like before anything wraps.`,
      ).toBeGreaterThanOrEqual(MIN_WORDMARK_GAP);
    });
  }
});
