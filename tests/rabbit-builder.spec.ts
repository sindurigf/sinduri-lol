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
  const rabbit = page.locator('.builder-rabbit').first();
  await expect(async () => {
    await page.evaluate(() => scrollBy(0, innerHeight / 2));
    await expect(rabbit, 'no rabbit came to build').toBeAttached({
      timeout: 500,
    });
  }).toPass({ timeout: MOTION_LIMIT_MS * 2 });
  await expect(rabbit).toHaveAttribute('aria-hidden', 'true');
  const drawn = await rabbit.evaluate((element) => {
    const art = element.querySelector('svg')!;
    const box = art.getBBox();
    const shown = art.getBoundingClientRect();
    return (
      box.width > 0 && box.height > 0 && shown.width > 0 && shown.height > 0
    );
  });
  expect(drawn, 'the cloned rabbit draws nothing').toBe(true);
});

test('a brick that takes keyboard focus lands at once and stays landed', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  const brick = await lastWaitingBrick(page);
  /* Focused before it is on screen; scrolling it in then hands the observer an entry for a landed wall. */
  const after = await brick.evaluate(async (element) => {
    element
      .querySelector<HTMLElement>('a, button')
      ?.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'center' });
    for (let i = 0; i < 3; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      build: element.getAttribute('data-build'),
      opacity: getComputedStyle(element).opacity,
    };
  });
  expect(after, 'the focused brick moved again').toEqual({
    build: null,
    opacity: '1',
  });
});

test('nested walls build as one, and nothing waits or moves after a jump', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  expect(
    await page.evaluate(
      () =>
        document.querySelectorAll(
          '[data-build] [data-build], [data-build] .builder-rabbit',
        ).length,
    ),
    'a wall inside a wall was armed on its own',
  ).toBe(0);
  for (const jump of [
    () =>
      page.evaluate(() => document.querySelector('footer')!.scrollIntoView()),
    () => page.evaluate(() => scrollTo(0, 0)),
  ]) {
    await jump();
    await page.waitForTimeout(MOTION_LIMIT_MS);
    await expect(
      page.locator(MOVING),
      'a wall still moves after five seconds',
    ).toHaveCount(0);
  }
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
      scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  await page.waitForTimeout(MOTION_LIMIT_MS);
  await expect(page.locator(MOVING)).toHaveCount(0);
  await expect(
    page.locator(WAITING),
    'a wall scrolled past fast still waits unseen',
  ).toHaveCount(0);
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

test('print shows every brick whole and in place, even mid-build', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  const brick = await lastWaitingBrick(page);
  const building = page.locator('[data-build="push"]').first();
  await brick.scrollIntoViewIfNeeded();
  await expect(building, 'no brick started building').toBeAttached();
  await page.emulateMedia({ media: 'print' });
  for (const element of [brick, building]) {
    expect(
      await element.evaluate((node) => {
        const style = getComputedStyle(node);
        return { opacity: style.opacity, translate: style.translate };
      }),
    ).toEqual({ opacity: '1', translate: 'none' });
  }
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
  /* main and footer clip while bricks fall; the focus ring must stay whole inside the footer. */
  const ring = await knock.evaluate((button) => {
    const style = getComputedStyle(button);
    const reach =
      parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
    const box = button.getBoundingClientRect();
    const footer = button.closest('footer')!.getBoundingClientRect();
    return (
      box.left - reach >= footer.left &&
      box.right + reach <= footer.right &&
      box.top - reach >= footer.top &&
      box.bottom + reach <= footer.bottom
    );
  });
  expect(ring, 'the tumble clip cuts the focus ring').toBe(true);
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

/*
 * Scrolls the route in viewport-sized steps and checks every frame of the
 * builds: the page never gets wider than the screen (SC 1.4.10), and no
 * visible rabbit box meets a text box.
 */
const sampleBuilds = (page: Page) =>
  page.evaluate(async (limit) => {
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    const texts: Text[] = [];
    const walker = document.createTreeWalker(
      document.querySelector('main')!,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) texts.push(node as Text);
    }
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 1 &&
      b.left < a.right - 1 &&
      a.top < b.bottom - 1 &&
      b.top < a.bottom - 1;
    const wide: number[] = [];
    const covered: string[] = [];
    let rabbitFrames = 0;
    const root = document.documentElement;
    const sampleUntil = async (end: number) => {
      while (performance.now() < end) {
        if (root.scrollWidth > root.clientWidth) {
          wide.push(root.scrollWidth - root.clientWidth);
        }
        const painted = [...document.querySelectorAll('main *')].filter(
          (part) =>
            !part.closest('.builder-rabbit') &&
            !part.closest('[data-build="push"]') &&
            ['IMG', 'PICTURE', 'svg', 'CANVAS'].includes(part.tagName),
        );
        for (const rabbit of document.querySelectorAll('.builder-rabbit')) {
          if (Number(getComputedStyle(rabbit).opacity) === 0) continue;
          rabbitFrames += 1;
          const box = rabbit.getBoundingClientRect();
          for (const part of painted) {
            if (overlaps(box, part.getBoundingClientRect())) {
              covered.push(`<${part.tagName.toLowerCase()}>`);
            }
          }
          for (const text of texts) {
            /* A building wall is clipped to its own box, which no rabbit stands in. */
            if (text.parentElement?.closest('[data-build="push"]')) continue;
            const range = document.createRange();
            range.selectNodeContents(text);
            for (const rect of range.getClientRects()) {
              if (overlaps(box, rect)) covered.push(text.textContent!.trim());
            }
          }
        }
        await frame();
      }
    };
    while (root.scrollTop + innerHeight < root.scrollHeight - 1) {
      scrollBy(0, innerHeight * 0.6);
      await sampleUntil(performance.now() + limit / 3);
    }
    await sampleUntil(performance.now() + limit);
    return { wide, covered: [...new Set(covered)], rabbitFrames };
  }, MOTION_LIMIT_MS);

/* Rabbits stand only where a wall has an empty gap above it; / and /career have such walls. */
const RABBIT_ROUTES = new Set(['/', '/career']);

for (const route of ['/', '/career', '/blog', '/credits']) {
  for (const viewport of [REFLOW_VIEWPORT, DESKTOP_VIEWPORT]) {
    test(`${route} at ${viewport.width}px builds inside the page and never over text`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await gotoSettled(page, route);
      const { wide, covered, rabbitFrames } = await sampleBuilds(page);
      if (RABBIT_ROUTES.has(route)) {
        expect(
          rabbitFrames,
          'no rabbit was on screen to check',
        ).toBeGreaterThan(0);
      }
      expect(wide, 'a build widened the page (SC 1.4.10)').toEqual([]);
      expect(covered, 'a rabbit crossed this text or picture').toEqual([]);
    });
  }
}
