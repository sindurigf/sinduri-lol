import { expect, test, type Page } from '@playwright/test';
import { POST_ROUTES, ROUTES } from './routes';

/**
 * The header, <main> and the footer put their content on the same two vertical
 * lines.
 *
 * WHY THIS FILE EXISTS. It did not hold, and no assertion in the suite could
 * see it. The header applied `.page-gutter` INSIDE its max-width box while
 * <main> and the footer applied it OUTSIDE theirs. Below the column width the
 * max-width is not binding, so all three resolve to viewport-minus-gutter and
 * agree exactly; above it they diverge by one gutter. Measured on /about
 * before the fix: the header's content sat 24px inside main's at 1440px,
 * 1600px and 1920px, and 0px apart at 1280px and below.
 *
 * Every other spec in this suite runs at 305px, 320px or 1280px, which is the
 * whole band where the bug is invisible. Reflow is a narrow-viewport
 * criterion, so that band is the right one for `tests/reflow.spec.ts` to
 * watch; it does mean a wide-viewport layout defect had nowhere to fail. Hence
 * the widths below: all are wider than `--container-page`, because that is the
 * only region where these three elements can disagree.
 *
 * WHAT IS ASSERTED. The rendered left and right content edges, not the CSS
 * that produces them, and the column is found by its used max-width rather
 * than by a class name, so renaming the utility does not blind the test. A
 * future change to the gutter, the token or the markup structure fails here on
 * the outcome. The column WIDTH is not the invariant and never was: once the
 * three landmarks share a structure any width keeps them aligned, so this
 * asserts the agreement, and the absolute pin at the bottom of the file
 * asserts the width separately.
 *
 * This is deliberately NOT a reflow test. It says nothing about overflow and
 * nothing about the 273px box.
 */

/**
 * All wider than `--container-page` (80rem / 1280px) plus its gutter, which is
 * the condition for the max-width to bind on all three elements at once. Below
 * that the column fills the padding box and the three agree trivially, which
 * is exactly the band where the bug this file exists for was invisible.
 *
 * 1280px is deliberately NOT in this list any more. The column is 1280px, so
 * at a 1280px viewport the max-width does not bind and the test would assert
 * nothing. It was in the list while the column was 74rem.
 */
const WIDE_VIEWPORTS = [1440, 1600, 1920] as const;
const VIEWPORT_HEIGHT = 900;

/**
 * Half a CSS pixel, to absorb subpixel rounding when a centred column lands on
 * a fractional offset. A real misalignment is one whole gutter (16, 32 or 48px
 * depending on the breakpoint), nowhere near small enough to hide in here.
 */
const EPSILON = 0.5;

/**
 * Blog posts set their own, narrower measure.
 *
 * `src/pages/blog/[slug].astro` wraps its body in a prose column rather than
 * the page column, because a full-width column is the wrong line length for
 * continuous reading. So these routes have no page column in <main> at all and
 * cannot be asserted against the header the way the others are. They get the
 * containment assertion below instead, which is the property that actually
 * matters for them: the narrow column sits inside the page column and centred
 * on it, rather than wandering off its own way.
 *
 * The list is imported rather than retyped, and the "exception list matches
 * the build" test below derives the real set from the rendered pages and
 * compares, so a page that silently loses its column fails there rather than
 * quietly skipping the alignment assertion forever.
 */
const PROSE_COLUMN_ROUTES: readonly string[] = POST_ROUTES;

type Edges = { left: number; right: number };
type RegionColumns = {
  page: Edges | null;
  innermost: Edges | null;
  hasRegion: boolean;
};

/**
 * The page column inside a landmark, plus the innermost column of any width.
 *
 * The page column is identified by its used max-width matching
 * `--container-page`, resolved through the root font size because the token is
 * authored in rem and `getComputedStyle` reports max-width in px. Matching on
 * the number rather than on `.max-w-page` means the assertion survives a
 * rename of the utility and still fails if the value drifts.
 */
const columnsIn = async (
  page: Page,
  selector: string,
): Promise<RegionColumns> =>
  page.evaluate((sel) => {
    const region = document.querySelector(sel);
    if (!region) return { page: null, innermost: null, hasRegion: false };

    const rootPx = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const declared = getComputedStyle(document.documentElement)
      .getPropertyValue('--container-page')
      .trim();
    const pageColumnPx =
      parseFloat(declared) * (declared.endsWith('rem') ? rootPx : 1);

    const edgesOf = (el: Element): Edges => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        left: box.left + parseFloat(style.paddingLeft),
        right: box.right - parseFloat(style.paddingRight),
      };
    };

    const bounded = [...region.querySelectorAll('*')].filter((el) => {
      const max = getComputedStyle(el).maxWidth;
      return max !== 'none' && max !== '' && Number.isFinite(parseFloat(max));
    });

    const pageColumn = bounded.find(
      (el) =>
        Math.abs(parseFloat(getComputedStyle(el).maxWidth) - pageColumnPx) <
        0.5,
    );

    return {
      page: pageColumn ? edgesOf(pageColumn) : null,
      innermost: bounded.length ? edgesOf(bounded[0]) : null,
      hasRegion: true,
    };
  }, selector);

for (const width of WIDE_VIEWPORTS) {
  test.describe(`content columns line up at ${width}px`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    for (const route of ROUTES) {
      test(`${route} header, main and footer share one column`, async ({
        page,
      }) => {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);

        const header = await columnsIn(page, 'header');
        const main = await columnsIn(page, 'main');
        const footer = await columnsIn(page, 'footer');

        expect(header.hasRegion, `${route} has no <header>`).toBe(true);
        expect(main.hasRegion, `${route} has no <main>`).toBe(true);
        expect(footer.hasRegion, `${route} has no <footer>`).toBe(true);

        expect(
          header.page,
          `${route} header has no page column at ${width}px`,
        ).not.toBeNull();
        expect(
          footer.page,
          `${route} footer has no page column at ${width}px`,
        ).not.toBeNull();

        const hdr = header.page as Edges;
        const ftr = footer.page as Edges;

        const report = (m: Edges): string =>
          `at ${width}px on ${route}: ` +
          `header ${hdr.left.toFixed(1)}..${hdr.right.toFixed(1)}, ` +
          `main ${m.left.toFixed(1)}..${m.right.toFixed(1)}, ` +
          `footer ${ftr.left.toFixed(1)}..${ftr.right.toFixed(1)}`;

        expect(
          Math.abs(ftr.left - hdr.left),
          `footer and header disagree on the left edge, ${report(ftr)}`,
        ).toBeLessThanOrEqual(EPSILON);
        expect(
          Math.abs(ftr.right - hdr.right),
          `footer and header disagree on the right edge, ${report(ftr)}`,
        ).toBeLessThanOrEqual(EPSILON);

        if (PROSE_COLUMN_ROUTES.includes(route)) {
          /*
           * A prose route: main deliberately has no page column, so the
           * assertion is containment rather than equality. The measure must
           * sit inside the page column and be centred on it, which is what
           * says it is a narrower column of the same layout rather than a
           * column that has drifted out of it.
           */
          expect(
            main.page,
            `${route} is listed as a prose route but <main> has a page ` +
              `column; either the page changed or PROSE_COLUMN_ROUTES is stale`,
          ).toBeNull();

          const prose = main.innermost as Edges;
          expect(prose, `${route} <main> has no bounded column`).not.toBeNull();

          expect(
            prose.left,
            `prose column starts left of the page column, ${report(prose)}`,
          ).toBeGreaterThanOrEqual(hdr.left - EPSILON);
          expect(
            prose.right,
            `prose column ends right of the page column, ${report(prose)}`,
          ).toBeLessThanOrEqual(hdr.right + EPSILON);
          expect(
            Math.abs(prose.left - hdr.left - (hdr.right - prose.right)),
            `prose column is not centred in the page column, ${report(prose)}`,
          ).toBeLessThanOrEqual(EPSILON);
          return;
        }

        expect(
          main.page,
          `${route} <main> has no page column at ${width}px`,
        ).not.toBeNull();
        const mn = main.page as Edges;

        expect(
          Math.abs(mn.left - hdr.left),
          `main and header disagree on the left edge, ${report(mn)}`,
        ).toBeLessThanOrEqual(EPSILON);
        expect(
          Math.abs(mn.right - hdr.right),
          `main and header disagree on the right edge, ${report(mn)}`,
        ).toBeLessThanOrEqual(EPSILON);
      });
    }
  });
}

/**
 * The guard on the exception list.
 *
 * PROSE_COLUMN_ROUTES turns an assertion off, so it has to be impossible to
 * widen by accident. This walks every route and derives the real set of pages
 * whose <main> carries no page column, then compares. A page that lost its
 * column through an editing mistake lands in the derived set, does not match
 * the literal, and fails here — instead of silently skipping the alignment
 * assertion for the rest of the repository's life.
 */
test.describe('the exception list matches the build', () => {
  test.use({ viewport: { width: 1440, height: VIEWPORT_HEIGHT } });

  test('only blog posts opt out of the page column', async ({ page }) => {
    const withoutPageColumn: string[] = [];

    for (const route of ROUTES) {
      await page.goto(route);
      const main = await columnsIn(page, 'main');
      if (!main.page) withoutPageColumn.push(route);
    }

    expect(withoutPageColumn.sort()).toEqual([...PROSE_COLUMN_ROUTES].sort());
  });
});

/**
 * The guard on the guard.
 *
 * Every comparison above is between measurements, so it passes just as happily
 * if all of them are wrong together — including if the column stopped binding
 * and the three agreed on the full viewport width. This pins the absolute
 * numbers at one width: `--container-page` is 80rem / 1280px, so at a 1440px
 * viewport the column is centred and the content runs 80..1360.
 *
 * If this fails while the comparisons pass, the column moved on purpose and
 * this number needs updating with it. It has moved once already, from 1184px
 * back to 1280px, and this assertion is what made that a one-line, deliberate
 * edit rather than a silent drift.
 */
test.describe('the column is where the token says it is', () => {
  test.use({ viewport: { width: 1440, height: VIEWPORT_HEIGHT } });

  test('/about content runs 80..1360 at 1440px', async ({ page }) => {
    await page.goto('/about');
    await page.evaluate(() => document.fonts.ready);

    const main = await columnsIn(page, 'main');
    const edges = main.page as Edges;

    expect(edges, '/about <main> has no page column').not.toBeNull();
    expect(edges.left).toBeCloseTo(80, 0);
    expect(edges.right).toBeCloseTo(1360, 0);
  });
});
