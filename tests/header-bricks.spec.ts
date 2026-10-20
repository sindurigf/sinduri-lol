import { expect, test } from './test';
import { gotoSettled } from './settle';
import { AAA_TEXT, NON_TEXT, PAGE_HELPERS } from './contrast';
import { DESKTOP_VIEWPORT, PHONE_VIEWPORT } from './wcag';

/*
 * The header's joined bricks draw their focus ring inside the brick
 * (docs/STYLEGUIDE.md "Focus"), so the ring must read against the brick's own
 * fill, at rest and hovered, and stay clear of its label (SC 1.4.11, 2.4.13).
 * The logo link has no ring: focused, it turns into an ink block on the bar.
 */

/* A route with a current header link, so a gold brick is walked too. */
const ROUTE = '/about/';
const BRICKS =
  '.header-slab :is(.logo-link, .header-bricks a, .header-bricks button)';
const MAX_STOPS = 12;
/* Past --spacing-header, so the header goes slim. */
const SLIM_SCROLL = 900;

interface Stop {
  name: string;
  ratio: number;
  block: number;
  /** The focused box's area, and a 2px perimeter of it (SC 2.4.13). */
  blockArea: number;
  perimeter: number;
  label: number;
  brick: boolean;
  inside: boolean;
  onBar: boolean;
  clear: boolean;
}

/* The ring against the fill under it, and whether the ring's inner edge clears the label or icon. */
const readStop = `(() => {
  ${PAGE_HELPERS}
  const el = document.activeElement;
  if (!el || !el.matches(${JSON.stringify(BRICKS)})) return null;
  const s = getComputedStyle(el);
  const offset = parseFloat(s.outlineOffset);
  const width = parseFloat(s.outlineWidth);
  const ring = parse(s.outlineColor);
  const fill = effectiveBackground(el);
  const box = el.getBoundingClientRect();
  const slab = el.closest('.header-slab');
  const bar = slab.getBoundingClientRect();
  const edge = parseFloat(getComputedStyle(slab).borderTopWidth);
  const reach = offset + width;
  const onBar = box.left - reach >= bar.left + edge - 0.5 && box.right + reach <= bar.right - edge + 0.5 && box.top - reach >= bar.top + edge - 0.5 && box.bottom + reach <= bar.bottom - edge + 0.5;
  const inset = -offset;
  const inner = { left: box.left + inset, right: box.right - inset, top: box.top + inset, bottom: box.bottom - inset };
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const text = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || node.parentElement.closest('.sr-only')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    text.push(...range.getClientRects());
  }
  const marks = [...text, ...[...el.querySelectorAll('svg, img, .logo-tile')].map((n) => n.getBoundingClientRect())]
    .filter((r) => r.width > 0 && r.height > 0);
  const clear = marks.every((r) => r.left >= inner.left - 0.5 && r.right <= inner.right + 0.5 && r.top >= inner.top - 0.5 && r.bottom <= inner.bottom + 0.5);
  return {
    name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30),
    ratio: ratio(ring, fill),
    block: ratio(parse(s.backgroundColor), effectiveBackground(slab)),
    blockArea: box.width * box.height,
    perimeter: 4 * (box.width + box.height),
    label: [...el.querySelectorAll('.label')].map((n) => ratio(parse(getComputedStyle(n).color), parse(s.backgroundColor)))[0] ?? 0,
    brick: Boolean(el.closest('.header-bricks')),
    onBar,
    inside: offset + width <= 0,
    clear,
  };
})()`;

for (const colorScheme of ['dark', 'light'] as const) {
  for (const [label, viewport] of [
    ['desktop', DESKTOP_VIEWPORT],
    ['phone', PHONE_VIEWPORT],
  ] as const) {
    for (const slim of [false, true]) {
      test.describe(`header bricks, ${colorScheme}, ${label}${slim ? ', slim' : ''}`, () => {
        test.use({ colorScheme, viewport });

        test('each ring sits inside its brick or on the bar, reads on its fill at rest and hovered, and clears the label', async ({
          page,
        }) => {
          await gotoSettled(page, ROUTE);
          if (slim) {
            await page.mouse.wheel(0, SLIM_SCROLL);
            await expect(page.locator('header.site-header')).toHaveAttribute(
              'data-compact',
              '',
            );
          }
          const stops: (Stop & { hover: boolean })[] = [];
          for (let i = 0; i < MAX_STOPS; i += 1) {
            await page.keyboard.press('Tab');
            const rest = (await page.evaluate(readStop)) as Stop | null;
            if (!rest) {
              if (stops.length) break;
              continue;
            }
            stops.push({ ...rest, hover: false });
            await page.evaluate(() => {
              const el = document.activeElement as HTMLElement;
              el.dataset.probe = 'focused';
            });
            await page.locator('[data-probe="focused"]').hover();
            const hovered = (await page.evaluate(readStop)) as Stop | null;
            if (hovered) stops.push({ ...hovered, hover: true });
            await page.evaluate(() =>
              document
                .querySelector('[data-probe]')
                ?.removeAttribute('data-probe'),
            );
            await page.mouse.move(0, 0);
          }

          expect(
            stops.some((stop) => !stop.brick),
            'the walk never reached the logo link',
          ).toBe(true);
          expect(
            stops.filter((stop) => stop.brick).length,
            'the walk reached no header brick',
          ).toBeGreaterThan(0);
          for (const stop of stops) {
            const where = `${stop.name}${stop.hover ? ' (hovered)' : ''}`;
            if (!stop.brick) {
              expect(
                stop.block,
                `${where}: the focus block is under ${NON_TEXT}:1 on the bar`,
              ).toBeGreaterThanOrEqual(NON_TEXT);
              expect(
                stop.blockArea,
                `${where}: the focus block is smaller than a 2px perimeter`,
              ).toBeGreaterThanOrEqual(stop.perimeter);
              expect(
                stop.label,
                `${where}: the name is under ${AAA_TEXT}:1 on the focus block`,
              ).toBeGreaterThanOrEqual(AAA_TEXT);
              continue;
            }
            expect(stop.onBar, `${where}: the ring leaves the bar`).toBe(true);
            expect(
              stop.inside,
              `${where}: the ring is not drawn inside the brick`,
            ).toBe(true);
            expect(
              stop.ratio,
              `${where}: the ring is under ${NON_TEXT}:1 on the brick's fill`,
            ).toBeGreaterThanOrEqual(NON_TEXT);
            expect(
              stop.clear,
              `${where}: the ring covers the label or icon`,
            ).toBe(true);
          }
        });
      });
    }
  }
}

/* Forced colors drop the ink block, so the logo's transparent ring must be painted there instead. */
test.describe('the logo link in forced colors', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('draws a solid ring at least 2px wide when focused', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'webkit reports forced-colors as active but paints the author palette (bug 225281)',
    );
    await page.emulateMedia({ forcedColors: 'active' });
    await gotoSettled(page, ROUTE);
    for (let i = 0; i < MAX_STOPS; i += 1) {
      await page.keyboard.press('Tab');
      if (
        await page.evaluate(() =>
          document.activeElement?.matches('.header-slab .logo-link'),
        )
      )
        break;
    }
    const ring = await page.evaluate(`(() => {
      ${PAGE_HELPERS}
      const el = document.activeElement;
      if (!el || !el.matches('.header-slab .logo-link')) return null;
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), alpha: parse(s.outlineColor).a };
    })()`);
    expect(ring, 'the walk never reached the logo link').not.toBeNull();
    expect(ring, 'the logo ring is not painted in forced colors').toEqual({
      style: 'solid',
      width: expect.any(Number),
      alpha: 1,
    });
    expect((ring as { width: number }).width).toBeGreaterThanOrEqual(2);
  });
});
