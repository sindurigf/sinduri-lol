import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { serveUnderShippedCsp } from './csp';
import { POST_ROUTES, PUBLISHED_POST_ROUTES } from './routes';
import { NODE } from './tags';
import { TEXT_SCALE_KEY, TEXT_SCALE_STEPS } from '../src/lib/text-scale';

const DOWN = '/down/';
const NARROW = 320;
const ROOT_PERCENT = /^(\d+)%$/;
const TARGET_PX = 44;
const CURIOUSER_TRIES = 25;
const SCRIPTS = ['src/scripts/curiouser.ts', 'src/scripts/text-size.ts'];

const rootSize = (page: Page) =>
  page.evaluate(() => document.documentElement.style.fontSize);

const curiouser = (page: Page) => page.locator('[data-curiouser]');

test.describe('the rabbit hole', () => {
  test('/down/ shelves come from the site content and the door leads to Contact', async ({
    page,
  }) => {
    await gotoSettled(page, DOWN);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Down the Rabbit Hole',
    );
    const hrefs = await page
      .locator('#fall-heading ~ ol a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    for (const route of PUBLISHED_POST_ROUTES) {
      expect(hrefs, `${route} is not on a shelf`).toContain(`${route}/`);
    }
    expect(hrefs).toContain('/about/');
    expect(hrefs).toContain('/credits/');
    expect(hrefs.some((href) => href?.startsWith('/talks/'))).toBe(true);
    await expect(
      page.locator('#door').getByRole('link', { name: /Knock/ }),
    ).toHaveAttribute('href', '/contact/');
    void POST_ROUTES;
  });

  test('every shelf link and door control is at least 44px', async ({
    page,
  }) => {
    await gotoSettled(page, DOWN);
    const small = await page.evaluate(
      (target) =>
        [
          ...document.querySelectorAll('main ol a, #door a, #door button'),
        ].flatMap((el) => {
          const box = el.getBoundingClientRect();
          return box.height < target || box.width < target
            ? [el.textContent?.trim()]
            : [];
        }),
      TARGET_PX,
    );
    expect(small).toEqual([]);
  });

  test('Curiouser is a plain link to /down/ without a script', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(curiouser(page)).toHaveAttribute('href', DOWN);
    await expect(
      page.getByRole('link', { name: 'Down the Rabbit Hole' }),
    ).toHaveAttribute('href', DOWN);
    await expect(
      page.locator('[data-text-size]'),
      'a size control shows without a script',
    ).toBeHidden();
    await context.close();
  });

  for (const path of ['/about/', DOWN]) {
    test(`Curiouser never lands on ${path}, the page it is on`, async ({
      page,
    }) => {
      await gotoSettled(page, path);
      for (let i = 0; i < CURIOUSER_TRIES; i += 1) {
        await curiouser(page).click();
        const go = page.locator('[data-curiouser-result] a');
        await expect(go).toBeVisible({ timeout: 4000 });
        expect(await go.getAttribute('href')).not.toBe(path);
      }
    });
  }

  test('with reduced motion Curiouser lands at once, with no reel', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, '/about/');
    await curiouser(page).click();
    await expect(page.locator('[data-curiouser-result] a')).toBeVisible({
      timeout: 300,
    });
    await expect(page.locator('[data-curiouser-status]')).toContainText(
      'Landed on',
    );
  });

  test('Drink Me and Eat Me step the root size, stop at the ends, and the size is remembered', async ({
    page,
  }) => {
    await gotoSettled(page, '/about/');
    const group = page.locator('[data-text-size="site"]');
    const drink = group.getByRole('button', { name: 'Drink Me' });
    const eat = group.getByRole('button', { name: 'Eat Me' });
    const right = group.getByRole('button', { name: 'Just Right' });
    await expect(right).toHaveAttribute('aria-disabled', 'true');
    for (const size of TEXT_SCALE_STEPS.filter((step) => step > 100)) {
      await eat.click();
      await expect(group.locator('[data-size-status]')).toHaveText(
        `Text is ${size}%.`,
      );
      expect(await rootSize(page)).toBe(`${size}%`);
    }
    await expect(eat).toHaveAttribute('aria-disabled', 'true');
    await eat.click();
    expect(await rootSize(page), 'Eat Me went past the top step').toBe('200%');
    await page.reload();
    expect(await rootSize(page), 'the size was not remembered').toBe('200%');
    expect(
      ROOT_PERCENT.test(await rootSize(page)),
      'the size is not a percent, so it would fight browser zoom',
    ).toBe(true);
    await right.click();
    expect(await rootSize(page)).toBe('');
    await expect(right).toHaveAttribute('aria-disabled', 'true');
    for (let i = 0; i < 3; i += 1) await drink.click();
    expect(await rootSize(page), 'Drink Me went below the lowest step').toBe(
      '75%',
    );
    await expect(drink).toHaveAttribute('aria-disabled', 'true');
    await page.evaluate((key) => localStorage.removeItem(key), TEXT_SCALE_KEY);
  });

  test('on /down/ the door scales the page only and nothing is remembered', async ({
    page,
  }) => {
    await gotoSettled(page, DOWN);
    await expect(
      page.locator('[data-text-size="site"]'),
      'the footer control shows on /down/',
    ).toHaveCount(0);
    await page.locator('#door').getByRole('button', { name: 'Eat Me' }).click();
    expect(await rootSize(page)).toBe('125%');
    await gotoSettled(page, '/about/');
    expect(await rootSize(page), 'the door size leaked to another page').toBe(
      '',
    );
  });

  for (const size of [75, 200]) {
    for (const route of ['/', '/about/', '/blog/', DOWN]) {
      test(`${route} does not scroll sideways at ${size}% text and ${NARROW}px (SC 1.4.4, 1.4.10)`, async ({
        page,
      }) => {
        await page.addInitScript(
          ([key, value]) => localStorage.setItem(key!, value!),
          [TEXT_SCALE_KEY, String(size)],
        );
        await page.setViewportSize({ width: NARROW, height: 800 });
        await gotoSettled(page, route);
        expect(await rootSize(page)).toBe(`${size}%`);
        const over = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(
          over,
          `${route} scrolls sideways by ${over}px`,
        ).toBeLessThanOrEqual(0);
      });
    }
  }

  test('every feature works under the CSP the site ships, with no violation or script error', async ({
    page,
  }) => {
    const problems = await serveUnderShippedCsp(page);
    await gotoSettled(page, '/about/');
    await curiouser(page).click();
    await expect(page.locator('[data-curiouser-result] a')).toBeVisible({
      timeout: 4000,
    });
    await page.getByRole('button', { name: 'Eat Me' }).click();
    expect(await rootSize(page)).toBe('125%');
    await page.getByRole('button', { name: 'Just Right' }).click();
    await gotoSettled(page, DOWN);
    await page
      .locator('#door')
      .getByRole('button', { name: 'Drink Me' })
      .click();
    expect(await rootSize(page)).toBe('75%');
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
