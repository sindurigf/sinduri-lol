import { expect, test } from './test';
import { gotoSettled } from './settle';

/**
 * Hover states that were written and never drawn. Both lost a cascade fight
 * nobody saw: a colour set by a utility in a later layer, or by an unlayered
 * scoped rule, beat the hover rule, so the control did nothing under the
 * pointer while the stylesheet said otherwise.
 *
 * Proven able to fail, 2026-09-19, chromium: with `text-text` back on the
 * card link in BlogCard.astro, the card test read rgb(229, 226, 225) on
 * hover; with the scoped colour rule back in MobileMenu.vue, the menu test
 * read the same.
 */
const CYAN = 'rgb(0, 220, 253)';

test.describe('hover is drawn', () => {
  test('a linked card turns its title cyan', async ({ page }) => {
    await gotoSettled(page, '/blog/');
    const card = page.locator('article.card:has(.card-link)').first();
    await card.hover();
    await expect(card.locator('.card-link')).toHaveCSS('color', CYAN);
  });

  test('a mobile menu link turns cyan', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSettled(page, '/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const link = page
      .getByRole('dialog', { name: 'Menu' })
      .getByRole('link', { name: 'Blog' });
    await link.hover();
    await expect(link).toHaveCSS('color', CYAN);
  });

  test('a primary button fills with cyan', async ({ page }) => {
    await gotoSettled(page, '/');
    const button = page.locator('main .btn-primary').first();
    await button.hover();
    await expect(button).toHaveCSS('background-color', CYAN);
  });
});

/**
 * One colour, one job. Gold is what stands on the page, pink what you press
 * and the bunny marks, cyan what you are touching (focus, hover). Where you
 * are is not a colour: the current item is a flat text-colour block, like a
 * badge.
 *
 * Proven able to fail, 2026-09-19, chromium: with the cyan current shadow
 * back in Header.astro, "the current page is a flat text-colour block" read
 * background rgba(0, 0, 0, 0); with the card hover rule removed, "a hovered
 * linked card casts a cyan shadow" read rgb(255, 192, 0).
 */
const GOLD = 'rgb(255, 192, 0)';
const PINK = 'rgb(255, 0, 122)';
const TEXT = 'rgb(229, 226, 225)';
const BACKGROUND = 'rgb(19, 19, 19)';

const shadowColour = async (
  locator: import('@playwright/test').Locator,
): Promise<string> =>
  (await locator.evaluate((el) => getComputedStyle(el).boxShadow))
    .match(/rgb\([^)]*\)/g)
    ?.at(-1) ?? 'none';

test.describe('each colour has one job', () => {
  test('things stand on gold, actions and the bunny on pink', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, '/');
    expect(await shadowColour(page.locator('main .card').first())).toBe(GOLD);
    expect(await shadowColour(page.locator('main .btn-primary').first())).toBe(
      PINK,
    );
    expect(
      await shadowColour(page.locator('header a[href="/"] > span').first()),
    ).toBe(PINK);
  });

  test('the current page is a flat text-colour block', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, '/about/');
    const current = page.locator(
      'header nav[aria-label="Primary"] a[aria-current="page"]',
    );
    await expect(current).toHaveCSS('background-color', TEXT);
    await expect(current).toHaveCSS('color', BACKGROUND);
    expect(await shadowColour(current)).toBe('none');
  });

  test('a hovered linked card casts a cyan shadow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, '/blog/');
    const card = page.locator('article.card:has(.card-link)').first();
    await card.hover();
    expect(await shadowColour(card)).toBe(CYAN);
  });
});

/**
 * A focus ring must sit on the page ground, never touching a neighbour's
 * border or shadow (SC 1.4.11 measures the ring against what it touches).
 * Each chip's ring reaches offset plus width beyond its box; each neighbour
 * reaches its box plus its hard shadow. The two must not meet.
 *
 * Proven able to fail, 2026-09-19, chromium: with the filter list back at
 * gap-3, "Professional journey touches All posts" on /blog/open-source/.
 */
test('a focused chip ring stays clear of the chips beside it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoSettled(page, '/blog/open-source/');
  const overlaps = await page.evaluate(() => {
    const chips = [...document.querySelectorAll<HTMLElement>('main a.chip')];
    const reach = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      /* One entry per shadow layer; an inset layer casts nothing outward. */
      const offsets = s.boxShadow
        .split(/,(?![^(]*\))/)
        .filter((layer) => !layer.includes('inset'))
        .map((layer) => layer.match(/(-?\d+)px (-?\d+)px 0px 0px/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [Number(m[1]), Number(m[2])]);
      const [dx, dy] = offsets.at(-1) ?? [0, 0];
      return {
        l: r.left,
        t: r.top,
        r: r.right + Math.max(0, dx),
        b: r.bottom + Math.max(0, dy),
      };
    };
    const out: string[] = [];
    for (const chip of chips) {
      chip.focus();
      const s = getComputedStyle(chip);
      const ring = parseFloat(s.outlineOffset) + parseFloat(s.outlineWidth);
      const r = chip.getBoundingClientRect();
      const box = {
        l: r.left - ring,
        t: r.top - ring,
        r: r.right + ring,
        b: r.bottom + ring,
      };
      for (const other of chips) {
        if (other === chip) continue;
        const o = reach(other);
        const hit = box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t;
        if (hit)
          out.push(
            `${chip.textContent?.trim()} touches ${other.textContent?.trim()}`,
          );
      }
    }
    return out;
  });
  expect(overlaps).toEqual([]);
});
