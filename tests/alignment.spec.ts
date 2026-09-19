import { expect, test, type Page } from './test';
import { ROUTES } from './routes';

/**
 * The header, <main> and the footer put their content on the same two vertical
 * lines.
 *
 * Why this file exists: it did not hold, and no assertion in the suite could
 * see it. The header applied `.page-gutter` INSIDE its max-width box while
 * <main> and the footer applied it OUTSIDE theirs. Below the column width the
 * max-width is not binding, so all three resolve to viewport-minus-gutter and
 * agree exactly; above it they diverge by one gutter. Measured on /about
 * before the fix: the header's content sat 24px inside main's at 1440px, and
 * 0px apart at 1280px and below.
 *
 * Reflow is a narrow-viewport criterion, so `tests/reflow.spec.ts` watches the
 * band where this bug is invisible. Hence the widths below: all are wider than
 * `--container-page`, because that is the only region where these three
 * elements can disagree.
 *
 * What is asserted: the rendered left and right content edges, not the CSS
 * that produces them, and the column is found by its used max-width rather
 * than by a class name, so renaming the utility does not blind the test. A
 * change to the gutter, the token or the markup structure fails here on the
 * outcome. The column WIDTH is not the invariant: once the three landmarks
 * share a structure any width keeps them aligned, so this asserts the
 * agreement and the absolute pin at the bottom of the file asserts the width.
 *
 * This is deliberately NOT a reflow test. It says nothing about overflow and
 * nothing about the 273px box.
 */

/**
 * Wider than `--container-page` (80rem / 1280px) plus its gutter, which is the
 * condition for the max-width to bind on all three landmarks at once. Below
 * that the column fills the padding box and they agree trivially, which is
 * exactly the band where the bug this file exists for was invisible.
 *
 * 1280px is deliberately NOT in this list. The column is 1280px, so at a
 * 1280px viewport the max-width does not bind and the test would assert
 * nothing.
 *
 * 1600 and 1920 were dropped on 2026-09-09 because they could not fail
 * independently of 1440: above 1280px the layout is a fixed column centred in
 * whatever room is left, and the three widths differed in nothing but that
 * centring offset. Re-checked against src/ on 2026-09-12: the widest Tailwind
 * variant used anywhere is `lg:` at 1024px, there is no `xl:` or `2xl:`, no
 * custom breakpoint in the theme, no container query, and the width media
 * queries are at 40rem, 48rem and 64rem. `--container-page` is a fixed 80rem
 * with no responsive override, `.page-gutter` steps once at `sm`, and no
 * script branches on viewport width: both `matchMedia` calls in src/ read
 * `prefers-reduced-motion`.
 *
 * That is a property of today's stylesheet, not a permanent fact. A `2xl:`
 * utility binds at 1536px, between 1440 and 1920, so one anywhere in src/
 * would make the dropped widths able to fail where 1440 cannot. So would any
 * media query above 64rem, or a breakpoint added to the theme. If you add one,
 * put 1600 and 1920 back, and measure rather than assume which side of the new
 * breakpoint each lands.
 *
 * 1440 is the one kept because the absolute pin at the foot of this file
 * measures /about at 1440px.
 */
const WIDE_VIEWPORTS = [1440] as const;
const VIEWPORT_HEIGHT = 900;

/**
 * Half a CSS pixel, to absorb subpixel rounding when a centred column lands on
 * a fractional offset. A real misalignment is one whole gutter, 16px or 24px
 * (`.page-gutter` is `px-4 sm:px-6`), nowhere near small enough to hide here.
 */
const EPSILON = 0.5;

type Edges = { left: number; right: number };
type RegionColumns = {
  page: Edges | null;
  hasRegion: boolean;
};

/**
 * The page column inside a landmark. Every route has one: blog posts used to
 * set a narrower measure instead, and now centre their reading column inside
 * the page column like everything else.
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
    if (!region) return { page: null, hasRegion: false };

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
      hasRegion: true,
    };
  }, selector);

type Report = (m: Edges) => string;

const reportFor =
  (width: number, route: string, hdr: Edges, ftr: Edges): Report =>
  (m) =>
    `at ${width}px on ${route}: ` +
    `header ${hdr.left.toFixed(1)}..${hdr.right.toFixed(1)}, ` +
    `main ${m.left.toFixed(1)}..${m.right.toFixed(1)}, ` +
    `footer ${ftr.left.toFixed(1)}..${ftr.right.toFixed(1)}`;

const expectEdgesMatchHeader = (
  name: 'footer' | 'main',
  edges: Edges,
  hdr: Edges,
  report: Report,
): void => {
  expect(
    Math.abs(edges.left - hdr.left),
    `${name} and header disagree on the left edge, ${report(edges)}`,
  ).toBeLessThanOrEqual(EPSILON);
  expect(
    Math.abs(edges.right - hdr.right),
    `${name} and header disagree on the right edge, ${report(edges)}`,
  ).toBeLessThanOrEqual(EPSILON);
};

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
        const report = reportFor(width, route, hdr, ftr);

        expectEdgesMatchHeader('footer', ftr, hdr, report);

        expect(
          main.page,
          `${route} <main> has no page column at ${width}px`,
        ).not.toBeNull();
        expectEdgesMatchHeader('main', main.page as Edges, hdr, report);
      });
    }
  });
}

/**
 * The guard on the guard.
 *
 * Every comparison above is between measurements, so it passes just as happily
 * if all of them are wrong together, including if the column stopped binding
 * and the three agreed on the full viewport width. This pins the absolute
 * numbers at one width: `--container-page` is 80rem / 1280px, so at a 1440px
 * viewport the column is centred and the content runs 80..1360.
 *
 * If this fails while the comparisons pass, the column moved on purpose and
 * this number moves with it in the same edit.
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
