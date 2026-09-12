import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  FIELD_OUTPUT,
  TOKEN_SOURCE,
  fieldSvg,
  readPalette,
} from '../src/lib/footer-field';
import { SOCIAL_PROFILES } from '../src/lib/profiles';
import { gotoSettled } from './settle';

/**
 * The footer: the field and the sleeping hare, the badge standing in the
 * stems, the pages and the policies, and the profiles as sticker tiles.
 *
 * Most of what can go wrong here is geometry, and none of it is visible to a
 * rule engine. A 250px badge lifted into the field by a negative margin can
 * end up on top of a link and axe will not say so; a tile's name can go
 * missing behind its icon; the grid that lines the links up with the stickers
 * can drift by a tile and every page still renders. So this measures the
 * rendered footer at each of its three layouts: a phone (390), `sm` to `lg`
 * (820), and `lg` up (1440).
 *
 * Verified 2026-09-11 on chromium. All five broken at once in one build, each
 * failure checked against its own message:
 *
 *   SEED 4211 -> 4212 in src/lib/footer-field.ts  the drift test fails
 *   the sr-only label removed from the tiles      names fail at all 3 widths
 *   an overlay on .footer-field, z-index 5        "covered" fails, all 3 widths
 *   274px -> 300px in .footer-hare at `lg`        the hare test fails at 1440,
 *                                                 middle 1060.0 against 1086.0
 *   the policies track 222px -> 212px             the grid test fails at 1440
 */

const ROUTE = '/about';
const WIDTHS = [390, 820, 1440] as const;
/* Where global.css puts the links on the stickers' grid: `lg`. */
const GRID_FROM = 1024;
/* Where the tiles grow from 48px to 56px: `sm`. */
const TILE_GROWS_AT = 640;

const EXPECTED_PROFILES = [
  ...SOCIAL_PROFILES.map((profile) => ({
    name: profile.label as string,
    href: profile.href as string,
  })),
  { name: 'Email', href: 'mailto:' },
];

test('the committed footer field matches its generator', () => {
  const expected = fieldSvg(readPalette(readFileSync(TOKEN_SOURCE, 'utf8')));
  const committed = readFileSync(FIELD_OUTPUT, 'utf8');

  /*
   * A boolean, not `toEqual`, because the file is 52KB on one line and a diff
   * of it says nothing a person can act on. The message says what to do.
   */
  expect(
    committed === expected,
    `${FIELD_OUTPUT} is out of date with src/lib/footer-field.ts or with the ` +
      `colour tokens it reads. Run: node scripts/footer-field.mjs`,
  ).toBe(true);
});

for (const width of WIDTHS) {
  test.describe(`the footer at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, ROUTE);
    });

    test('every profile is a named link to the right place', async ({
      page,
    }) => {
      const links = page
        .getByRole('navigation', { name: 'Social' })
        .getByRole('link');
      await expect(links).toHaveCount(EXPECTED_PROFILES.length);

      for (const [index, profile] of EXPECTED_PROFILES.entries()) {
        const link = links.nth(index);
        /*
         * The name comes from the visually hidden label alone. An icon that
         * lost its aria-hidden, or a label that went missing, changes it.
         */
        await expect(link).toHaveAccessibleName(profile.name);
        const href = (await link.getAttribute('href')) ?? '';
        expect(
          profile.href === 'mailto:'
            ? href.startsWith('mailto:')
            : href === profile.href,
          `${profile.name} links to ${href}`,
        ).toBe(true);
      }

      await expect(
        page.locator('.footer-sticker svg:not([aria-hidden="true"])'),
      ).toHaveCount(0);
    });

    test('the tiles are full size and nothing covers a footer link', async ({
      page,
    }) => {
      const measured = await page.evaluate(() => {
        const covered: string[] = [];
        for (const link of document.querySelectorAll('footer a')) {
          link.scrollIntoView({ block: 'center' });
          const box = link.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          if (!hit || !link.contains(hit)) {
            covered.push(
              `${link.textContent?.trim()} is under ` +
                `${hit ? hit.outerHTML.slice(0, 80) : 'nothing'}`,
            );
          }
        }
        const tiles = [
          ...document.querySelectorAll<HTMLElement>('.footer-sticker'),
        ].map((tile) => [tile.offsetWidth, tile.offsetHeight]);
        return { covered, tiles };
      });

      expect(
        measured.covered,
        'footer links with something drawn over them',
      ).toEqual([]);
      const size = width < TILE_GROWS_AT ? 48 : 56;
      expect(measured.tiles).toEqual(EXPECTED_PROFILES.map(() => [size, size]));
    });

    test('the field is decoration, and the hare lies in it clear of the badge', async ({
      page,
    }) => {
      const m = await page.evaluate(() => {
        const rect = (el: Element | null) => {
          const box = (el as Element).getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        };
        const field = document.querySelector('.footer-field');
        const hare = rect(document.querySelector('.footer-hare'));
        const tiles = [...document.querySelectorAll('.footer-stickers li')].map(
          (li) => li.getBoundingClientRect(),
        );
        return {
          hidden: field?.getAttribute('aria-hidden'),
          focusable: field?.querySelectorAll(
            'a, button, input, select, textarea, [tabindex]',
          ).length,
          field: rect(field),
          hare,
          /* The hare's own x = 0 is 60 of its 114 units from the left. */
          hareMiddle: hare.left + ((hare.right - hare.left) * 60) / 114,
          badge: rect(document.querySelector('.footer-badge img')),
          rowMiddle:
            (Math.min(...tiles.map((tile) => tile.left)) +
              Math.max(...tiles.map((tile) => tile.right))) /
            2,
        };
      });

      expect(m.hidden, '.footer-field must be aria-hidden').toBe('true');
      expect(m.focusable, 'something focusable inside the field').toBe(0);

      expect(
        m.hare.left,
        'the hare runs off the left of the field',
      ).toBeGreaterThanOrEqual(m.field.left);
      expect(
        m.hare.right,
        'the hare runs off the right of the field',
      ).toBeLessThanOrEqual(m.field.right);
      expect(
        m.hare.top,
        'the hare pokes out of the top of the field',
      ).toBeGreaterThanOrEqual(m.field.top);

      const apart =
        m.hare.right <= m.badge.left ||
        m.hare.left >= m.badge.right ||
        m.hare.bottom <= m.badge.top ||
        m.hare.top >= m.badge.bottom;
      expect(apart, 'the hare overlaps the badge').toBe(true);

      if (width >= GRID_FROM) {
        expect(
          Math.abs(m.hareMiddle - m.rowMiddle),
          `the hare's middle is ${m.hareMiddle.toFixed(1)}, the sticker ` +
            `row's is ${m.rowMiddle.toFixed(1)}`,
        ).toBeLessThanOrEqual(1);
      }
    });

    test("the links sit on the stickers' grid", async ({ page }) => {
      test.skip(width < GRID_FROM, 'the shared grid is the `lg` layout');

      const m = await page.evaluate(() => {
        const left = (selector: string) =>
          (document.querySelector(selector) as Element).getBoundingClientRect()
            .left;
        return {
          pages: left('.footer-pages'),
          policies: left('.footer-policies'),
          first: left('.footer-stickers li:nth-child(1)'),
          fifth: left('.footer-stickers li:nth-child(5)'),
        };
      });

      expect(
        Math.abs(m.pages - m.first),
        'the pages should start above the first sticker',
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(m.policies - m.fifth),
        'the policies should start above the fifth sticker',
      ).toBeLessThanOrEqual(1);
    });

    test('the copyright line and the badge', async ({ page }) => {
      const copyright = page.locator('.footer-copyright');
      await expect(copyright).toHaveText(/^© \d{4} sinduri\.lol$/);
      await expect(copyright).toHaveCSS('font-size', '20px');
      await expect(copyright).toHaveCSS(
        'text-align',
        width < TILE_GROWS_AT ? 'center' : 'left',
      );

      /*
       * alt="" is a decision, not an omission: the copyright line names the
       * site in the same footer. See the design system skill, Alt text.
       */
      const badge = page.locator('footer img');
      await expect(badge).toHaveCount(1);
      await expect(badge).toHaveAttribute('alt', '');
    });
  });
}
