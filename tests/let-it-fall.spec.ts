import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { TALK_ROUTES } from './routes';
import { ENGINE_INVARIANT } from './tags';
import { timedScan } from './axe';

/**
 * Let It Fall (src/scripts/let-it-fall.ts): the pile never covers the button (SC 2.5.5) or scrolls sideways (1.4.10),
 * each change is announced (4.1.3), Esc and keyboard focus elsewhere restore (2.4.11), reduced motion never animates (2.3.3),
 * and a link in the pile still works.
 */

const ROUTE = '/career';
const FALL = { name: 'Let It Fall' };
const BACK = { name: 'Put It Back' };
const FELL = 'The page fell down. Press Put It Back to rebuild it.';
const RESTORED = 'The page is back in place.';
/* CSS px at 400% zoom of a 1280 window, a phone, and a desktop. */
const WIDTHS = [320, 390, 1280] as const;
const HEIGHT = 900;
/* px of page above the button kept on screen, so some blocks are there to fall. */
const BUTTON_FROM_BOTTOM = 120;
const MAX_INSTANT_MS = 1;
/* px: the SC 2.5.8 minimum square; live targets are probed finer than let-it-fall.ts, buried ones on its grid. */
const MIN_TARGET = 24;
const FINE_STEP = 2;
const PROBE_STEP = 6;

const fallen = (page: Page) => page.locator('[data-fell]');
/* Every fall and climb back has landed. */
const landed = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => document.getAnimations().length))
    .toBe(0);
/* let-it-fall.ts has checked which pile targets take clicks. */
const checked = (page: Page) =>
  expect(page.locator('[data-let-it-fall]')).toHaveAttribute(
    'data-fall-checked',
  );
const status = (page: Page) => page.locator('footer').getByRole('status');

/* The button near the bottom of the screen with the page above it, then one press. */
const press = async (page: Page) => {
  const button = page.getByRole('button', FALL);
  await button.evaluate((el, gap) => {
    scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight + gap);
  }, BUTTON_FROM_BOTTOM);
  await button.click();
  await expect(status(page)).toHaveText(FELL);
  return page.getByRole('button', BACK);
};

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await gotoSettled(page, ROUTE);
    });

    test('blocks fall into a pile above the button, which keeps focus and stays the hit target', async ({
      page,
    }) => {
      const button = await press(page);
      await expect(button).toBeFocused();
      await expect(fallen(page)).not.toHaveCount(0);
      await expect(
        page.locator('.header-slab'),
        'the header stayed up',
      ).toHaveAttribute('data-fell');
      await landed(page);
      const pile = await page.evaluate(() => {
        const target = document.querySelector('[data-let-it-fall]')!;
        const r = target.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        const covered = [...document.querySelectorAll('[data-fell]')]
          /* Only blocks that started above the button fall onto it. */
          .filter(
            (el) =>
              el.compareDocumentPosition(target) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          )
          .filter((el) => el.getBoundingClientRect().bottom > r.top + 1);
        return { hit: hit === target, covered: covered.length };
      });
      expect(pile, 'a fallen block covers the button').toEqual({
        hit: true,
        covered: 0,
      });
      await checked(page);
      const squares = await page.evaluate(
        ({ side, fine, coarse }) => {
          const clear = (el: Element, step: number) => {
            const box = el.getBoundingClientRect();
            const on = (x: number, y: number) => {
              const hit = document.elementFromPoint(x, y);
              return hit !== null && el.contains(hit);
            };
            for (let y = box.top; y + side <= box.bottom; y += step) {
              for (let x = box.left; x + side <= box.right; x += step) {
                let whole = true;
                for (let dy = 0; whole && dy <= side; dy += step) {
                  for (let dx = 0; whole && dx <= side; dx += step) {
                    whole = on(x + dx, y + dy);
                  }
                }
                if (whole) return true;
              }
            }
            return false;
          };
          const targets = [
            ...document.querySelectorAll(
              '[data-fell] :is(a[href], button), [data-fell]:is(a[href], button)',
            ),
          ].filter((el) => el.checkVisibility());
          const live = targets.filter(
            (el) => !el.hasAttribute('data-fall-buried'),
          );
          /* Buried targets take no pointer, so probes pass through them; check them with it back on. */
          const buried = targets.filter((el) =>
            el.hasAttribute('data-fall-buried'),
          );
          const unclear = live.filter((el) => !clear(el, fine)).length;
          for (const el of buried) el.removeAttribute('data-fall-buried');
          const clearBuried = buried.filter((el) => clear(el, coarse)).length;
          for (const el of buried) el.setAttribute('data-fall-buried', '');
          return { live: live.length, unclear, clearBuried };
        },
        { side: MIN_TARGET, fine: FINE_STEP, coarse: PROBE_STEP },
      );
      expect(
        squares.live,
        'no target in the pile takes clicks',
      ).toBeGreaterThan(0);
      expect(
        squares,
        'a live target lacks a clear 24px square, or a buried one has it (SC 2.5.8)',
      ).toMatchObject({ unclear: 0, clearBuried: 0 });
      const { violations } = await timedScan(page, 'fallen /career');
      /* False positive: axe sizes a tilted pile target by upright boxes, so it overstates cover; the square probe above measures the drawn shape. */
      const found: string[] = [];
      for (const { id, nodes } of violations) {
        const left = [];
        for (const node of nodes) {
          const inPile =
            id === 'target-size' &&
            (await page
              .locator(node.target.join(' '))
              .evaluate((el) => el.closest('[data-fell]') !== null));
          if (!inPile) left.push(node);
        }
        if (left.length) found.push(`${id}: ${left.length} node(s)`);
      }
      expect(
        found,
        'axe found WCAG 2.2 AA violations in the fallen pile',
      ).toEqual([]);
      await button.focus();
      await expect(
        fallen(page),
        'focus on the button itself put the page back',
      ).not.toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        ),
        'the fallen page scrolls sideways (SC 1.4.10)',
      ).toBe(false);
    });

    test('the same button, Esc, or keyboard focus entering the page puts it back', async ({
      page,
    }) => {
      const button = await press(page);
      await landed(page);
      await button.click();
      await expect(status(page)).toHaveText(RESTORED);
      await expect(page.getByRole('button', FALL)).toBeFocused();
      await expect(fallen(page)).toHaveCount(0);
      await landed(page);
      await expect(
        page.locator('[data-fall-block]'),
        'a block home again keeps the fall transition',
      ).toHaveCount(0);

      await press(page);
      await landed(page);
      await page.keyboard.press('Escape');
      await expect(status(page)).toHaveText(RESTORED);
      await expect(page.getByRole('button', FALL)).toBeFocused();
      await expect(fallen(page)).toHaveCount(0);
      await landed(page);

      await press(page);
      await page.keyboard.press('Shift+Tab');
      await expect(
        fallen(page),
        'a control moved by the fall took keyboard focus out of place',
      ).toHaveCount(0);
    });
  });
}

/* The pile is random; a fixed sequence makes the same one every run. */
const seedRandom = (page: Page, seed: number) =>
  page.addInitScript((start) => {
    let state = start;
    /* mulberry32 */
    Math.random = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    };
  }, seed);
const PILE_SEED = 7;

test('a click on a link in the pile follows it', async ({ page }) => {
  await seedRandom(page, PILE_SEED);
  await page.setViewportSize({ width: 390, height: HEIGHT });
  await gotoSettled(page, ROUTE);
  await press(page);
  await landed(page);
  await checked(page);
  const href = await page.evaluate(() => {
    const top = [
      ...document.querySelectorAll<HTMLAnchorElement>(
        '[data-fell] a[href^="/"]:not([data-fall-buried])',
      ),
    ].find((link) => {
      if (link.pathname === location.pathname) return false;
      const r = link.getBoundingClientRect();
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      return hit !== null && link.contains(hit);
    });
    top?.setAttribute('data-test-target', '');
    return top?.getAttribute('href');
  });
  expect(href, 'no link in the pile is on top').toBeTruthy();
  await page.locator('[data-test-target]').click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test('the fallen header scrolls with the page and is sticky again once back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: HEIGHT });
  await gotoSettled(page, ROUTE);
  await press(page);
  await landed(page);
  const slab = page.locator('.header-slab');
  const top = () => slab.evaluate((el) => el.getBoundingClientRect().top);
  const before = await top();
  const SCROLL = 200;
  await page.evaluate((by) => scrollBy(0, -by), SCROLL);
  expect(await top(), 'the fallen header stayed on screen').toBeCloseTo(
    before + SCROLL,
    0,
  );
  /* Esc, not the button: a click would scroll the button back into view first. */
  await page.keyboard.press('Escape');
  await expect(status(page)).toHaveText(RESTORED);
  await landed(page);
  const header = page.locator('.site-header');
  await expect(header).toHaveCSS('position', 'sticky');
  await expect(header, 'the header kept a pinned style').not.toHaveAttribute(
    'style',
    /./,
  );
  expect(
    await slab.evaluate((el) => {
      const { top } = el.getBoundingClientRect();
      return top >= 0 && top < innerHeight / 2;
    }),
    'the header climbed home off screen',
  ).toBe(true);
});

/* ms: longer than let-it-fall.ts REPEAT_MS, shorter than --fall-time, so the second press lands mid-climb. */
const PRESS_AGAIN_MS = 400;

test('pressing again while the blocks climb home drops them again', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: HEIGHT });
  await gotoSettled(page, ROUTE);
  const button = await press(page);
  await landed(page);
  await button.click();
  await expect(status(page)).toHaveText(RESTORED);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForTimeout(PRESS_AGAIN_MS);
  await page.getByRole('button', FALL).click();
  await expect(status(page)).toHaveText(FELL);
  await expect(fallen(page)).not.toHaveCount(0);
  expect(errors, 'cutting the climb short threw').toEqual([]);
});

test('under reduced motion the blocks move at once, never animated', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: HEIGHT });
  await gotoSettled(page, ROUTE);
  await press(page);
  await expect(fallen(page)).not.toHaveCount(0);
  /* reduced-motion.css cuts every transition to 0.01ms under reduced motion. */
  expect(
    await fallen(page)
      .first()
      .evaluate(
        (el) => parseFloat(getComputedStyle(el).transitionDuration) * 1000,
      ),
    'a fallen block animates under reduced motion',
  ).toBeLessThanOrEqual(MAX_INSTANT_MS);
});

test('without JavaScript there is no button', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(page.getByRole('button', FALL)).toHaveCount(0);
  await context.close();
});

test(
  'a talk deck has no button (script budget)',
  ENGINE_INVARIANT,
  async ({ request }) => {
    for (const route of TALK_ROUTES) {
      const html = await (await request.get(`${route}/`)).text();
      expect(html, `${route} ships Let It Fall`).not.toContain(
        'data-let-it-fall',
      );
    }
  },
);
