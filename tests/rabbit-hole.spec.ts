import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { serveUnderShippedCsp } from './csp';
import { NODE } from './tags';
import { TEXT_SCALE_KEY, TEXT_SCALE_STEPS } from '../src/lib/text-scale';

const CURIOUSER_TRIES = 25;
const WIDE_ROUTES = ['/', '/about/', '/blog/', '/credits/', '/career/'];
const SCRIPTS = ['src/scripts/curiouser.ts', 'src/scripts/text-size.ts'];

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

const curiouser = (page: Page) => page.locator('[data-curiouser]');
const landing = (page: Page) => page.locator('[data-curiouser-result] a');

const sidewaysPx = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe('Curiouser and Drink Me, Eat Me', () => {
  test('without a script Curiouser and the size buttons are not drawn', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/about/');
    await expect(
      curiouser(page),
      'a dead button shows without a script',
    ).toBeHidden();
    await expect(
      page.locator('.footer-size'),
      'a size control shows without a script',
    ).toBeHidden();
    await context.close();
  });

  test('Curiouser never lands on the page it is on', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, '/about/');
    for (let i = 0; i < CURIOUSER_TRIES; i += 1) {
      await curiouser(page).click();
      await expect(landing(page)).toBeVisible();
      expect(await landing(page).getAttribute('href')).not.toBe('/about/');
    }
  });

  test('a slide deck has no Curiouser or size buttons, to keep its script budget', async ({
    page,
  }) => {
    await gotoSettled(page, '/talks/open-source-is-not-just-code/');
    await expect(page.locator('[data-on-demand]')).toHaveCount(0);
  });

  test('the reel runs, then lands and offers the link', async ({ page }) => {
    await gotoSettled(page, '/about/');
    await curiouser(page).click();
    await expect(page.locator('[data-curiouser-result] span')).not.toHaveText(
      '',
    );
    await expect(landing(page)).toBeVisible({ timeout: 4000 });
    await expect(landing(page)).toHaveText(/^Go to /);
  });

  test('with reduced motion Curiouser lands at once, with no reel', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, '/about/');
    await curiouser(page).click();
    await expect(landing(page)).toBeVisible({ timeout: 300 });
    await expect(page.locator('[data-curiouser-status]')).toContainText(
      'Landed on',
    );
  });

  test('Drink Me and Eat Me step the text size, stop at the ends and say so, and the size is remembered', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoSettled(page, '/about/');
    const base = await bodyPx(page);
    const group = page.locator('[data-text-size="site"]');
    const status = group.locator('[data-size-status]');
    const drink = group.getByRole('button', { name: 'Drink Me' });
    const eat = group.getByRole('button', { name: 'Eat Me' });
    const right = group.getByRole('button', { name: 'Just Right' });
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
    const group = page.locator('[data-text-size="site"]');
    const eat = group.getByRole('button', { name: 'Eat Me' });
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
    await curiouser(page).click();
    await expect(landing(page)).toBeVisible({ timeout: 4000 });
    await page.getByRole('button', { name: 'Eat Me' }).click();
    await expect.poll(() => rootSize(page)).toBe('1.25');
    await page.getByRole('button', { name: 'Drink Me' }).click();
    await page.getByRole('button', { name: 'Drink Me' }).click();
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
