import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { DESKTOP_VIEWPORT, MIN_TARGET, REFLOW_VIEWPORT } from './wcag';

/**
 * The building rabbit and Knock It Down (src/scripts/rabbit-builder.ts):
 * the page stays complete without motion, every move ends within five seconds
 * (SC 2.2.2), reduced motion stops it (SC 2.3.3), and focus never waits on it.
 */

const ROUTE = '/';
/* SC 2.2.2: motion that starts by itself ends within five seconds. */
const MOTION_LIMIT_MS = 5_000;
const KNOCK_NAME = 'Knock It Down';

const WAITING = '[data-build="waiting"]';
const BUILDING = '[data-build]';
const MOVING =
  ':is([data-build="push"], [data-build="tumble"], .builder-rabbit)';

test.use({ viewport: DESKTOP_VIEWPORT });

/* Tagged, because a `[data-build]` locator moves on to the next brick once this one lands. */
const lastWaitingBrick = async (page: Page) => {
  await expect(
    page.locator(WAITING).first(),
    'no brick below the fold waits to be built',
  ).toBeAttached();
  await page
    .locator(WAITING)
    .last()
    .evaluate((brick) => {
      brick.dataset.testid = 'watched-brick';
    });
  return page.getByTestId('watched-brick');
};

const expectAtRest = async (page: Page, because: string) => {
  await expect
    .poll(() => page.locator(MOVING).count(), {
      message: because,
      timeout: MOTION_LIMIT_MS,
    })
    .toBe(0);
};

test('a brick below the fold lands within five seconds and rests in place', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  const brick = await lastWaitingBrick(page);
  await brick.scrollIntoViewIfNeeded();

  await expect(brick, 'the brick never started its build').not.toHaveAttribute(
    'data-build',
    'waiting',
  );
  await expect
    .poll(() => brick.getAttribute('data-build'), {
      message: 'the brick still moves after five seconds',
      timeout: MOTION_LIMIT_MS,
    })
    .toBeNull();
  const rest = await brick.evaluate((element) => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, translate: style.translate };
  });
  expect(rest, 'the brick did not come to rest whole and in place').toEqual({
    opacity: '1',
    translate: 'none',
  });
});

test('the rabbit is hidden from assistive technology', async ({ page }) => {
  await gotoSettled(page, ROUTE);
  const brick = await lastWaitingBrick(page);
  await brick.scrollIntoViewIfNeeded();
  const rabbit = brick.locator('.builder-rabbit');
  await expect(rabbit, 'no rabbit pushed the brick').toBeAttached();
  await expect(rabbit).toHaveAttribute('aria-hidden', 'true');
});

test('a brick that takes keyboard focus lands at once', async ({ page }) => {
  await gotoSettled(page, ROUTE);
  const brick = await lastWaitingBrick(page);
  await brick.getByRole('link').first().focus();

  await expect(
    brick,
    'the focused brick is still waiting or moving',
  ).not.toHaveAttribute('data-build');
  expect(
    await brick.evaluate((element) => getComputedStyle(element).opacity),
  ).toBe('1');
});

test('reduced motion builds nothing and hides Knock It Down', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoSettled(page, ROUTE);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));

  await expect(page.locator(`${BUILDING}, .builder-rabbit`)).toHaveCount(0);
  await expect(page.getByRole('button', { name: KNOCK_NAME })).toBeHidden();
});

test('turning on reduced motion mid-page lands every brick', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  await lastWaitingBrick(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await expect(page.locator(BUILDING)).toHaveCount(0);
  await expect(page.getByRole('button', { name: KNOCK_NAME })).toBeHidden();
});

test('print shows every brick', async ({ page }) => {
  await gotoSettled(page, ROUTE);
  const brick = await lastWaitingBrick(page);
  await page.emulateMedia({ media: 'print' });
  expect(
    await brick.evaluate((element) => getComputedStyle(element).opacity),
  ).toBe('1');
});

test('Knock It Down works from the keyboard, keeps focus and ends within five seconds', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  const knock = page.getByRole('button', { name: KNOCK_NAME });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(knock, 'Knock It Down is not offered').toBeVisible();
  await knock.scrollIntoViewIfNeeded();
  await expectAtRest(page, 'the page was still building before the press');

  const box = await knock.boundingBox();
  expect(box, 'Knock It Down has no box').not.toBeNull();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(MIN_TARGET);

  await knock.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.locator('[data-build="tumble"]').first(),
    'pressing Knock It Down moved nothing',
  ).toBeAttached();
  await expect(knock, 'the press moved focus off the button').toBeFocused();
  await expectAtRest(page, 'the tumble still moves after five seconds');
});

test('without JavaScript Knock It Down is not offered', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(page.getByRole('button', { name: KNOCK_NAME })).toBeHidden();
  await expect(page.locator(BUILDING)).toHaveCount(0);
  await context.close();
});

test('a jump that reveals every brick at once lands them all within five seconds', async ({
  page,
}) => {
  await gotoSettled(page, '/blog');
  await expect(page.locator(WAITING).first()).toBeAttached();
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: DESKTOP_VIEWPORT.width, height: tall });

  await expect(
    page.locator(WAITING),
    'a revealed brick never started',
  ).toHaveCount(0);
  await expectAtRest(
    page,
    'bricks revealed together still move after five seconds',
  );
});

test('a tumble at 320px never widens or lengthens the page', async ({
  page,
}) => {
  await page.setViewportSize(REFLOW_VIEWPORT);
  await gotoSettled(page, ROUTE);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const knock = page.getByRole('button', { name: KNOCK_NAME });
  await expect(knock).toBeVisible();
  await expectAtRest(page, 'the page was still building before the press');
  const before = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );

  await knock.click();
  const samples = await page.evaluate(async (ms) => {
    const seen: { width: number; client: number; height: number }[] = [];
    const end = performance.now() + ms;
    while (performance.now() < end) {
      const root = document.documentElement;
      seen.push({
        width: root.scrollWidth,
        client: root.clientWidth,
        height: root.scrollHeight,
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return seen;
  }, MOTION_LIMIT_MS);
  expect(
    samples.filter((s) => s.width > s.client || s.height !== before),
    'a falling brick widened or lengthened the page (SC 1.4.10)',
  ).toEqual([]);
});

test('focusing a falling brick ends the tumble clip', async ({ page }) => {
  await gotoSettled(page, ROUTE);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const knock = page.getByRole('button', { name: KNOCK_NAME });
  await expect(knock).toBeVisible();
  await expectAtRest(page, 'the page was still building before the press');

  await knock.click();
  const falling = page.locator('[data-build="tumble"]');
  await expect(
    falling.first(),
    'pressing Knock It Down moved nothing',
  ).toBeAttached();
  /* Focus lands one falling brick and a press lands the rest, all before their animations end. */
  await page
    .locator('[data-build="tumble"] a, a[data-build="tumble"]')
    .first()
    .focus();
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLElement>('[data-build="tumble"]')
      .forEach((brick) =>
        brick.dispatchEvent(new Event('pointerdown', { bubbles: true })),
      ),
  );

  await expect(falling).toHaveCount(0);
  await expect(
    page.locator('html'),
    'main and footer stay clipped after the last brick landed early',
  ).not.toHaveAttribute('data-tumbling');
});
