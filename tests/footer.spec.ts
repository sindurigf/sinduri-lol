import { expect, test } from '@playwright/test';
import { SOCIAL_PROFILES } from '../src/lib/profiles';
import { gotoSettled } from './settle';

/**
 * The footer: Lepus Ridet with the profiles as sticker tiles under it, the
 * pages and the policies, and a bottom line with the copyright and the gold
 * hare in its tuft.
 *
 * Most of what can go wrong here is geometry, and none of it is visible to a
 * rule engine. The tuft can slide over a link and axe will not say so; a
 * tile's name can go missing behind its icon; the equal gaps between the
 * columns can drift apart and every page still renders. So this measures the
 * rendered footer at each of its three layouts: a phone (390), `md` to `lg`
 * (820), and `lg` up (1440).
 *
 * Verified 2026-09-15 on chromium, in two builds, each failure checked
 * against its own message. The first build, four breaks at once:
 *
 *   the sr-only label removed from the tiles   names fail at all 3 widths
 *   .footer-name made an <h2>                  the name test fails at all 3
 *   the tuft given margin-top: -200px          "drawn over" fails at all 3,
 *                                              "covered" at 820
 *   `lg` inset 32px -> 0                       the inset test fails at 1440
 *
 * The second, two breaks the first would have masked:
 *
 *   .footer-policies given margin-left: 40px   the gap test fails at 820,
 *                                              52.1 against 92.1, and 1440
 *   the tuft given margin-left: 30px           the centring test fails at 390,
 *                                              210.0 against 195.0
 */

const ROUTE = '/about';
const WIDTHS = [390, 820, 1440] as const;
/* Where global.css spreads the footer into columns: `md`. */
const COLUMNS_FROM = 768;
/* Where the tiles grow from 48px to 56px and the footer is inset: `lg`. */
const WIDE_FROM = 1024;
const WIDE_INSET = 32;
/* Sub-pixel layout rounding, and nothing more. */
const TOLERANCE = 1;

const EXPECTED_PROFILES = [
  ...SOCIAL_PROFILES.map((profile) => ({
    name: profile.label as string,
    href: profile.href as string,
  })),
  { name: 'Email', href: 'mailto:' },
];

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
      const size = width < WIDE_FROM ? 48 : 56;
      expect(measured.tiles).toEqual(EXPECTED_PROFILES.map(() => [size, size]));
    });

    test('Lepus Ridet is Latin text, not a heading', async ({ page }) => {
      const name = page.locator('footer .footer-name');
      await expect(name).toHaveText('Lepus Ridet');
      await expect(name).toHaveAttribute('lang', 'la');
      expect(await name.evaluate((el) => el.tagName)).toBe('DIV');
      await expect(page.locator('footer').getByRole('heading')).toHaveCount(0);
    });

    test('the tuft is decoration and sits clear of the text', async ({
      page,
    }) => {
      const m = await page.evaluate(() => {
        const tuft = document.querySelector('.footer-tuft') as SVGElement;
        const box = tuft.getBoundingClientRect();
        const column = (
          document.querySelector('footer .max-w-page') as Element
        ).getBoundingClientRect();
        const overlapping = [
          ...document.querySelectorAll('footer a, .footer-copyright'),
        ]
          .filter((el) => {
            const other = el.getBoundingClientRect();
            return !(
              other.right <= box.left ||
              other.left >= box.right ||
              other.bottom <= box.top ||
              other.top >= box.bottom
            );
          })
          .map((el) => el.textContent?.trim() || el.outerHTML.slice(0, 60));
        return {
          hidden: tuft.getAttribute('aria-hidden'),
          focusable: tuft.querySelectorAll('[tabindex], a').length,
          overlapping,
          middle: (box.left + box.right) / 2,
          columnMiddle: (column.left + column.right) / 2,
        };
      });

      expect(m.hidden, '.footer-tuft must be aria-hidden').toBe('true');
      expect(m.focusable, 'something focusable inside the tuft').toBe(0);
      expect(m.overlapping, 'text the tuft is drawn over').toEqual([]);

      if (width < COLUMNS_FROM) {
        expect(
          Math.abs(m.middle - m.columnMiddle),
          `the tuft's middle is ${m.middle.toFixed(1)}, the column's is ` +
            `${m.columnMiddle.toFixed(1)}`,
        ).toBeLessThanOrEqual(TOLERANCE);
      }
    });

    test('the layout for this width', async ({ page }) => {
      const m = await page.evaluate(() => {
        const rect = (selector: string) =>
          (document.querySelector(selector) as Element).getBoundingClientRect();
        /* A list's box is as wide as its column; its links are not. */
        const inkRight = (selector: string) =>
          Math.max(
            ...[...document.querySelectorAll(selector)].map(
              (el) => el.getBoundingClientRect().right,
            ),
          );
        const column = rect('footer .max-w-page');
        const name = rect('.footer-name');
        const stickers = rect('.footer-stickers');
        return {
          column: { left: column.left, right: column.right },
          name: { left: name.left, right: name.right, top: name.top },
          nameMiddle: (name.left + name.right) / 2,
          identityRight: Math.max(name.right, stickers.right),
          stickersTop: stickers.top,
          pages: {
            left: rect('.footer-pages').left,
            right: inkRight('.footer-pages a'),
            top: rect('.footer-pages').top,
          },
          policies: {
            left: rect('.footer-policies').left,
            right: inkRight('.footer-policies a'),
            top: rect('.footer-policies').top,
          },
          copyrightTop: rect('.footer-copyright').top,
          tuft: rect('.footer-tuft'),
        };
      });

      if (width < COLUMNS_FROM) {
        /* The phone stack, in source order: nothing is reordered. */
        const tops = [
          m.name.top,
          m.pages.top,
          m.policies.top,
          m.stickersTop,
          m.copyrightTop,
          m.tuft.top,
        ];
        expect(tops, 'the phone stack is out of order').toEqual(
          [...tops].sort((a, b) => a - b),
        );
        expect(
          Math.abs(m.nameMiddle - (m.column.left + m.column.right) / 2),
          'Lepus Ridet should be centred',
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(
          Math.abs(m.pages.left - m.column.left),
          'the links should start at the column edge, as full-width rows',
        ).toBeLessThanOrEqual(TOLERANCE);
        return;
      }

      const inset = width >= WIDE_FROM ? WIDE_INSET : 0;
      expect(
        Math.abs(m.name.left - (m.column.left + inset)),
        `Lepus Ridet should start ${inset}px inside the column`,
      ).toBeLessThanOrEqual(TOLERANCE);
      expect(
        Math.abs(m.policies.right - (m.column.right - inset)),
        `the policies should end ${inset}px inside the column`,
      ).toBeLessThanOrEqual(TOLERANCE);
      expect(
        Math.abs(m.tuft.right - (m.column.right - inset)),
        `the tuft should end ${inset}px inside the column`,
      ).toBeLessThanOrEqual(TOLERANCE);

      const firstGap = m.pages.left - m.identityRight;
      const secondGap = m.policies.left - m.pages.right;
      expect(
        Math.abs(firstGap - secondGap),
        `the column gaps are ${firstGap.toFixed(1)} and ${secondGap.toFixed(1)}`,
      ).toBeLessThanOrEqual(TOLERANCE);
    });

    test('the copyright line', async ({ page }) => {
      const copyright = page.locator('.footer-copyright');
      await expect(copyright).toHaveText(/^© \d{4} sinduri\.lol$/);
      await expect(copyright).toHaveCSS('font-size', '20px');
      await expect(copyright).toHaveCSS(
        'text-align',
        width < COLUMNS_FROM ? 'center' : 'left',
      );
      await expect(page.locator('footer img')).toHaveCount(0);
    });
  });
}
