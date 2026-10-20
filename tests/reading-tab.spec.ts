import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { serveUnderShippedCsp } from './csp';
import { NODE } from './tags';
import { TEXT_SCALE_KEY, TEXT_SCALE_STEPS } from '../src/lib/text-scale';

const WIDE_ROUTES = ['/', '/about/', '/blog/', '/credits/', '/career/'];
const SCRIPTS = ['src/scripts/text-size.ts'];

/** The requested scale as the root holds it: '' (100%), '1.25' ... '2'. */
const rootSize = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--text-scale'),
  );

/** The first body paragraph's size in px: the size --text-scale multiplies. */
const bodyPx = (page: Page) =>
  page.evaluate(() =>
    parseFloat(
      getComputedStyle(document.querySelector('main .text-body')!).fontSize,
    ),
  );

const tab = (page: Page) => page.locator('[data-reading-tab]');
const openTab = async (page: Page) => {
  await tab(page).locator('summary').click();
  await expect(
    tab(page).getByRole('button', { name: /Drink Me/ }),
  ).toBeVisible();
};

const sidewaysPx = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe('The reading tab: Drink Me, Eat Me and Just Right', () => {
  test('without a script the reading tab is not drawn', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/about/');
    await expect(
      page.locator('[data-reading-tab]'),
      'the reading tab shows without a script',
    ).toBeHidden();
    await context.close();
  });

  test('a slide deck has no reading tab, to keep its script budget', async ({
    page,
  }) => {
    await gotoSettled(page, '/talks/open-source-is-not-just-code/');
    await expect(page.locator('[data-reading-tab]')).toHaveCount(0);
    await expect(page.locator('[data-on-demand]')).toHaveCount(0);
  });

  test('Drink Me and Eat Me step the text size, stop at the ends and say so, and the size is remembered', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoSettled(page, '/about/');
    const base = await bodyPx(page);
    const group = tab(page);
    await openTab(page);
    const status = group.locator('[data-size-status]');
    const drink = group.getByRole('button', { name: /^Drink Me/ });
    const eat = group.getByRole('button', { name: /^Eat Me/ });
    const right = group.getByRole('button', { name: /^Just Right/ });
    await expect(right).toBeVisible();
    for (const size of TEXT_SCALE_STEPS.filter((step) => step > 100)) {
      await eat.click();
      await expect(status).toHaveText(`Text is ${size}%.`);
      await expect.poll(() => rootSize(page)).toBe(String(size / 100));
      expect(await bodyPx(page)).toBeCloseTo((size / 100) * base, 1);
    }
    await expect(eat).toHaveAttribute('aria-disabled', 'true');
    await eat.click({ force: true });
    await expect(status).toContainText('already the largest');
    expect(await rootSize(page), 'Eat Me went past the top step').toBe('2');
    await page.reload();
    expect(await rootSize(page), 'the size was not remembered').toBe('2');
    await openTab(page);
    await right.click();
    await expect.poll(() => rootSize(page)).toBe('');
    expect(await bodyPx(page)).toBeCloseTo(base, 1);
    await expect(right).toHaveAttribute('aria-disabled', 'true');
    for (let i = 0; i < 3; i += 1) await drink.click({ force: true });
    await expect(status).toContainText('already the smallest');
    expect(await rootSize(page), 'Drink Me went below the lowest step').toBe(
      '0.75',
    );
    await expect(drink).toHaveAttribute('aria-disabled', 'true');
    await page.evaluate((key) => localStorage.removeItem(key), TEXT_SCALE_KEY);
  });

  for (const width of [320, 390, 1280]) {
    for (const saved of [75, 200]) {
      test(`a saved ${saved}% leaves nothing scrolling sideways at ${width}px (SC 1.4.4, 1.4.10)`, async ({
        page,
      }) => {
        await page.addInitScript(
          ([key, value]) => localStorage.setItem(key!, value!),
          [TEXT_SCALE_KEY, String(saved)],
        );
        await page.setViewportSize({ width, height: 800 });
        for (const route of WIDE_ROUTES) {
          await gotoSettled(page, route);
          expect(Number((await rootSize(page)) || 1)).toBeLessThanOrEqual(
            saved / 100,
          );
          const over = await sidewaysPx(page);
          expect(
            over,
            `${route} scrolls sideways by ${over}px`,
          ).toBeLessThanOrEqual(0);
        }
      });
    }
  }

  test('a size the page cannot hold is taken back and Eat Me says so', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoSettled(page, '/credits/');
    const group = tab(page);
    await openTab(page);
    const eat = group.getByRole('button', { name: /^Eat Me/ });
    for (let i = 0; i < TEXT_SCALE_STEPS.length; i += 1) {
      await eat.click({ force: true });
    }
    await expect(group.locator('[data-size-status]')).toContainText(
      'the most this page fits',
    );
    await expect(eat).toHaveAttribute('aria-disabled', 'true');
    expect(await sidewaysPx(page)).toBeLessThanOrEqual(0);
    await page.evaluate((key) => localStorage.removeItem(key), TEXT_SCALE_KEY);
  });

  test('the reading tab is a native disclosure with a named summary, three named buttons and 44px targets (SC 2.5.3, 2.5.5, 4.1.2)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await gotoSettled(page, '/about/');
    const summary = tab(page).locator('summary');
    await expect(summary).toHaveAccessibleName('Aa Text Size');
    await openTab(page);
    const buttons = tab(page).getByRole('button');
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toHaveAccessibleName('Drink Me');
    await expect(buttons.nth(0)).toHaveAccessibleDescription('Smaller text');
    await expect(buttons.nth(1)).toHaveAccessibleName('Eat Me');
    await expect(buttons.nth(1)).toHaveAccessibleDescription('Larger text');
    await expect(buttons.nth(2)).toHaveAccessibleName('Just Right');
    await expect(buttons.nth(2)).toHaveAccessibleDescription(
      'Back to 100 percent',
    );
    for (const box of await Promise.all([
      summary.boundingBox(),
      ...(await buttons.all()).map((b) => b.boundingBox()),
    ])) {
      expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
    }
    await expect(
      tab(page).getByRole('group', { name: 'Text Size' }),
    ).toBeVisible();
  });

  test('the keyboard opens the reading tab and Escape closes it and returns focus to the summary (SC 2.1.1, 2.4.3)', async ({
    page,
  }) => {
    await gotoSettled(page, '/about/');
    const summary = tab(page).locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(tab(page)).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    await expect(
      tab(page).getByRole('button', { name: /^Drink Me/ }),
    ).toBeFocused();
    /* The key handler arrives with the script the first press loads. */
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(tab(page)).not.toHaveAttribute('open', '', { timeout: 300 });
    }).toPass();
    await expect(summary).toBeFocused();
  });

  test('a control under the tab that takes keyboard focus is never hidden by it (SC 2.4.11, 2.4.12)', async ({
    page,
  }) => {
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of WIDE_ROUTES) {
        await gotoSettled(page, route);
        await page.keyboard.press('Tab');
        const hidden = await page.evaluate(() => {
          const tabEl = document.querySelector('[data-reading-tab]')!;
          const meets = (a: DOMRect, b: DOMRect) =>
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top;
          const under = [
            ...document.querySelectorAll<HTMLElement>('main a, main button'),
          ].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && meets(r, tabEl.getBoundingClientRect());
          });
          const out: string[] = [];
          for (const el of under) {
            el.focus();
            const shown = getComputedStyle(tabEl).visibility !== 'hidden';
            if (
              shown &&
              meets(el.getBoundingClientRect(), tabEl.getBoundingClientRect())
            ) {
              out.push(el.textContent?.trim().slice(0, 30) ?? '');
            }
          }
          return out;
        });
        expect(
          hidden,
          `${route} at ${width}px: the tab covers a focused control`,
        ).toEqual([]);
      }
    }
  });

  test('the reading tab is not printed', async ({ page }) => {
    await gotoSettled(page, '/about/');
    await page.emulateMedia({ media: 'print' });
    await expect(tab(page)).toBeHidden();
  });

  test(
    'the size multiplies the reading tokens, so browser zoom and font settings still apply',
    NODE,
    () => {
      expect(readFileSync('src/styles/global.css', 'utf8')).toMatch(
        /--text-body: calc\([^;]*\* var\(--text-scale, 1\)\);/,
      );
    },
  );

  test('every feature works under the CSP the site ships, with no violation or script error', async ({
    page,
  }) => {
    const problems = await serveUnderShippedCsp(page);
    await gotoSettled(page, '/about/');
    await openTab(page);
    await page.getByRole('button', { name: /^Eat Me/ }).click();
    await expect.poll(() => rootSize(page)).toBe('1.25');
    await page.getByRole('button', { name: /^Drink Me/ }).click();
    await page.getByRole('button', { name: /^Drink Me/ }).click();
    await expect.poll(() => rootSize(page)).toBe('0.75');
    expect(problems, 'a violation or script error').toEqual([]);
  });

  test(
    'the scripts write no HTML and build no script source (Trusted Types)',
    NODE,
    () => {
      for (const file of SCRIPTS) {
        const source = readFileSync(file, 'utf8');
        expect(source, `${file} writes HTML or loads a script`).not.toMatch(
          /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.src\s*=|setAttribute\(\s*['"]src['"]|eval\(|new Function/,
        );
      }
    },
  );
});
