import { expect, test } from './test';
import { POST_ROUTES, ROUTES } from './routes';
import { gotoSettled } from './settle';

/**
 * PageHero's wall of cast blocks, measured on the rendered page.
 *
 * The wall is the only thing that ends the hero, so the promises it makes are
 * geometric and nothing else checks them: it covers the hero edge to edge,
 * it ends on a whole row rather than a cut block, a phone gets three
 * columns rather than six slivers, and Contact's roundel sits on a joint
 * crossing rather than near one. Each is a number here.
 *
 * Proven able to fail, 2026-09-19: with the rule that hides the second nine
 * blocks on a phone removed, all 21 phone walls failed on "3 columns by 3
 * rows"; with the roundel moved to four sixths across, the crossing test
 * failed. Restored, 43 passed.
 */

/** Sub-pixel rounding between grid tracks, in CSS px. */
const TOLERANCE = 1;

const LAYOUTS = [
  { label: 'desktop', width: 1280, columns: 6 },
  { label: 'phone', width: 390, columns: 3 },
] as const;

const ROWS = 3;

/** Home keeps its canvas hero, 404 its joke page, and a post its article. */
const HERO_ROUTES = ROUTES.filter(
  (route) => !['/', '/404', ...POST_ROUTES].includes(route),
);

for (const { label, width, columns } of LAYOUTS) {
  test.describe(`the cast-block wall at ${label}`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const route of HERO_ROUTES) {
      test(`${route} ends its hero on a whole row of blocks`, async ({
        page,
      }) => {
        await gotoSettled(page, route);

        const wall = await page.evaluate(() => {
          const hero = document.querySelector('main .page-hero');
          const blocks = hero?.querySelector('.cast-blocks');
          if (!hero || !blocks) return null;
          const box = (el: Element) => el.getBoundingClientRect();
          const shown = [...blocks.children].filter(
            (block) => getComputedStyle(block).display !== 'none',
          );
          return {
            hero: box(hero).toJSON() as DOMRect,
            wall: box(blocks).toJSON() as DOMRect,
            count: shown.length,
            lastBottom: Math.max(...shown.map((block) => box(block).bottom)),
            rows: new Set(shown.map((block) => Math.round(box(block).top)))
              .size,
          };
        });

        expect(wall, `${route} does not open with PageHero`).not.toBeNull();
        if (wall === null) return;

        expect(
          Math.abs(wall.wall.top - wall.hero.top),
          'the wall starts at the top of the hero',
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(
          Math.abs(wall.wall.bottom - wall.hero.bottom),
          'the wall ends where the hero ends, so the blocks are its edge',
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(
          Math.abs(wall.wall.width - wall.hero.width),
          'the wall runs the full width of the hero',
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(wall.count, `${columns} columns by ${ROWS} rows`).toBe(
          columns * ROWS,
        );
        expect(wall.rows, `${ROWS} rows`).toBe(ROWS);
        expect(
          Math.abs(wall.lastBottom - wall.wall.bottom),
          'the last row ends on the wall edge rather than being cut',
        ).toBeLessThanOrEqual(TOLERANCE);
      });
    }
  });
}

test.describe('the roundel on Contact', () => {
  /* From `lg` it sits on a crossing; below that it is in the flow. */
  test.use({ viewport: { width: 1280, height: 900 } });

  test('sits where two joints cross', async ({ page }) => {
    await gotoSettled(page, '/contact');

    const found = await page.evaluate(() => {
      const hero = document.querySelector('main .page-hero')!;
      const roundel = hero.querySelector('.cast-blocks-crossing')!;
      const blocks = [...hero.querySelectorAll('.cast-blocks > span')];
      const box = (el: Element) => el.getBoundingClientRect();
      const r = box(roundel);
      /* Row one, columns five and six; and column five, rows one and two. */
      const [fifth, sixth] = [box(blocks[4]), box(blocks[5])];
      const below = box(blocks[10]);
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        jointX: (fifth.right + sixth.left) / 2,
        jointY: (fifth.bottom + below.top) / 2,
      };
    });

    expect(Math.abs(found.x - found.jointX)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(found.y - found.jointY)).toBeLessThanOrEqual(TOLERANCE);
  });
});
