import { test, expect, type Page } from './test';
import { fontsSettled, gotoSettled } from './settle';
import { NO_WEBKIT } from './tags';

/** [width, height]: the four layouts the fall has (no lanes, `md`, `lg`, `xl`) and a landscape phone. */
const VIEWPORTS = [
  [1920, 1080],
  [1280, 720],
  [1024, 640],
  [768, 1024],
  [844, 390],
  [390, 844],
  [305, 568],
] as const;

/** The fall is checked at this many scroll positions, a few clock steps at each, so hops and drops are caught midway. */
const FALL_SCROLL_STEPS = 12;
const FALL_FRAMES = 6;
const FALL_FRAME_MS = 150;
/** A focused rabbit is watched over several of its hops. */
const FOCUS_STEPS = 24;
const FOCUS_STEP_MS = 250;
/** Long enough for every hop and drop from the shaft to the last section in home-faller.ts. */
const LANDING_MS = 15_000;
/** Longer than the dive's leap and drop in home-motion.ts. */
const DIVE_MS = 1000;

/** Steps through a full rise of Alice's things: 40 frames 1.5s apart cover a 60s cycle. */
const DRIFT_SAMPLES = 40;
const DRIFT_STEP_MS = 1500;

/** 250ms steps rise the jar about 8px; 240 cover the 60s cycle. */
const EDGE_STEP_MS = 250;
const EDGE_SEARCH_STEPS = 240;

/** CSS px: boxes are fractional; half a pixel hides nothing. */
const SUBPIXEL_TOLERANCE = 0.5;

/** The homepage loop's largest step, MAX_DELTA_MS in home-motion.ts; the two must agree. */
const LOOP_STEP_MS = 100;

/*
 * Moves the page's clock on one loop step at a time: each step runs one frame
 * that advances the motion by exactly that step, as frame-by-frame time would,
 * at a fraction of the cost (the motion is the same at every sample).
 */
const advance = async (page: Page, ms: number) => {
  for (let done = 0; done < ms; done += LOOP_STEP_MS)
    await page.clock.fastForward(Math.min(LOOP_STEP_MS, ms - done));
};

/*
 * Covering is decided by element boxes, never by the stems' pixels: drawing
 * them on every clock step is skipped here so forty steps fit WebKit's timeout.
 */
const skipStemRaster = (page: Page) =>
  page.addInitScript(() => {
    const canvas = CanvasRenderingContext2D.prototype;
    for (const name of ['stroke', 'fill', 'clearRect', 'drawImage'] as const)
      canvas[name] = () => undefined;
  });

const open = async (page: Page, width: number, height: number) => {
  await page.setViewportSize({ width, height });
  await skipStemRaster(page);
  await page.clock.install();
  await gotoSettled(page, '/');
  await fontsSettled(page);
  /* The meadow strip ignores the pointer; hit-testing it here makes `elementFromPoint` follow paint order. */
  await page.addStyleTag({
    content:
      '[data-home-band], [data-home-band] *, [data-home-mouth], .home-hole, .home-hole *, [data-home-faller], [data-home-faller] *, [data-home-prop], [data-home-prop] * { pointer-events: auto !important; }',
  });
};

/*
 * Every text line and control inside `scope`: a point at the center of each
 * must land on the element itself, never on the decoration named by `cover`.
 */
const coveredBy = (page: Page, scope: string, cover: string) =>
  page.evaluate(
    ({ scope, cover }) => {
      const root = document.querySelector(scope);
      if (!root) throw new Error(`${scope} is not on the page.`);
      const targets: Element[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || !node.textContent?.trim()) continue;
        if (parent.closest('.sr-only, [aria-hidden="true"], [hidden]'))
          continue;
        targets.push(parent);
      }
      targets.push(
        ...root.querySelectorAll(
          'a, button:not([hidden]):not([data-home-jar]):not([data-home-follow])',
        ),
      );
      /* Each overlap between a decoration's box and a target's box is checked at its center. */
      const covers = [...document.querySelectorAll(cover)]
        .flatMap((el) => [...el.querySelectorAll('*'), el])
        .map((el) => el.getBoundingClientRect());
      const hits: string[] = [];
      for (const target of new Set(targets)) {
        for (const rect of target.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          for (const box of covers) {
            const left = Math.max(rect.left, box.left);
            const right = Math.min(rect.right, box.right);
            const upper = Math.max(rect.top, box.top);
            const lower = Math.min(rect.bottom, box.bottom);
            if (right - left < 1 || lower - upper < 1) continue;
            const x = (left + right) / 2;
            const y = (upper + lower) / 2;
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
            const top = document.elementFromPoint(x, y);
            if (top?.closest(cover)) {
              hits.push(
                `"${(target.textContent ?? '').trim().slice(0, 32)}" under ${top.className}`,
              );
            }
          }
        }
      }
      return hits;
    },
    { scope, cover },
  );

test.describe('the homepage meadow', () => {
  for (const [width, height] of VIEWPORTS) {
    test(`the name clears the header at ${width}x${height}`, async ({
      page,
    }) => {
      await open(page, width, height);
      const covered = await page.evaluate(() => {
        const header = document.querySelector('header');
        const name = document.querySelector('#home-name');
        if (!header || !name)
          throw new Error('the header or the name is missing.');
        return (
          header.getBoundingClientRect().bottom -
          name.getBoundingClientRect().top
        );
      });
      expect(
        covered,
        `the sticky header covers the top of the name by ${Math.round(covered)}px`,
      ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
    });

    test(`the meadow, the rabbit and the hole cover no text or control at ${width}x${height} (SC 1.4.3, 2.4.11)`, async ({
      page,
    }) => {
      await open(page, width, height);
      await page.locator('[data-home-band]').scrollIntoViewIfNeeded();
      const hits: string[] = [];
      for (let step = 0; step < DRIFT_SAMPLES; step += 1) {
        hits.push(
          ...(await coveredBy(
            page,
            '.home-meadow',
            '[data-home-band], [data-home-mouth], .home-hole',
          )),
        );
        await advance(page, DRIFT_STEP_MS);
      }
      expect(
        hits,
        'meadow decoration sits on top of text or a control',
      ).toEqual([]);
    });
  }
});

test.describe("Alice's things in the fall", () => {
  for (const [width, height] of VIEWPORTS) {
    test(`pass behind every word and control at ${width}x${height} (SC 1.4.3, 2.4.11)`, async ({
      page,
    }) => {
      await open(page, width, height);
      await page.locator('[data-home-drift]').scrollIntoViewIfNeeded();
      const hits: string[] = [];
      for (let step = 0; step < DRIFT_SAMPLES; step += 1) {
        hits.push(...(await coveredBy(page, '.home-fall', '[data-home-prop]')));
        await advance(page, DRIFT_STEP_MS);
      }
      expect(
        hits,
        "one of Alice's things sits on top of text or a control",
      ).toEqual([]);
    });
  }

  for (const [width, height] of [
    [1280, 720],
    [768, 1024],
  ] as const) {
    test(`the focused jar holds still in sight at ${width}x${height} (SC 2.4.11)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await skipStemRaster(page);
      await page.clock.install();
      await gotoSettled(page, '/');
      const jar = page.getByRole('button', { name: 'Let Go of the Jar' });
      await jar.focus();
      await expect(jar).toBeFocused();
      const at = async () => {
        const box = await jar.boundingBox();
        expect(box, 'the focused jar has no box').not.toBeNull();
        return box!;
      };
      const start = await at();
      for (let step = 0; step < DRIFT_SAMPLES; step += 1) {
        await advance(page, DRIFT_STEP_MS);
        const box = await at();
        expect(
          Math.abs(box.y - start.y),
          'the focused jar drifted away from where focus found it',
        ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
      }
      const seen = await jar.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        return top !== null && el.contains(top);
      });
      expect(seen, 'the focused jar is covered or out of sight').toBe(true);
    });
  }

  test('a jar focused as it leaves the top of the fall shows its whole focus ring (SC 2.4.11)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.clock.install();
    await gotoSettled(page, '/');
    const drift = page.locator('[data-home-drift]');
    await drift.scrollIntoViewIfNeeded();
    const jar = page.getByRole('button', { name: 'Let Go of the Jar' });
    const crossingTop = () =>
      jar.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const edge = el
          .closest('[data-home-drift]')!
          .getBoundingClientRect().top;
        return box.top < edge && box.top > edge - box.height;
      });
    let steps = 0;
    while (!(await crossingTop())) {
      steps += 1;
      expect(
        steps,
        'the jar never crossed the top of the fall in one rise',
      ).toBeLessThanOrEqual(EDGE_SEARCH_STEPS);
      await advance(page, EDGE_STEP_MS);
    }
    await jar.focus();
    const clipped = await jar.evaluate((el) => {
      const style = getComputedStyle(el);
      const reach =
        parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
      const ring = el.getBoundingClientRect();
      const fall = el.closest('[data-home-drift]')!.getBoundingClientRect();
      return {
        visible: style.outlineStyle !== 'none' && reach > 0,
        outside: Math.max(
          fall.top - (ring.top - reach),
          ring.bottom + reach - fall.bottom,
          0,
        ),
      };
    });
    expect(clipped.visible, 'the focused jar shows no focus ring').toBe(true);
    expect(
      clipped.outside,
      'the focused jar has its ring cut off by the edge of the fall',
    ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
  });

  test('only the jar is a control; the rest are hidden from assistive technology', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    const things = page.locator('[data-home-prop]');
    const count = await things.count();
    expect(
      count,
      "the fall has none of Alice's things to check",
    ).toBeGreaterThan(1);
    for (let index = 0; index < count; index += 1) {
      const thing = things.nth(index);
      if ((await thing.getAttribute('data-home-jar')) !== null) {
        await expect(thing).toHaveRole('button');
        await expect(thing).toHaveAccessibleName('Let Go of the Jar');
        continue;
      }
      await expect(
        thing,
        'a decorative thing is exposed to assistive technology',
      ).toHaveAttribute('aria-hidden', 'true');
      expect(
        await thing.evaluate((el) => el.matches('a, button, [tabindex]')),
        'a decorative thing takes focus',
      ).toBe(false);
    }
  });
});

/** ms a canvas is left alone before it is read again; longer than two 30fps frames. */
const STILL_CHECK_MS = 600;
/** CSS px: the smallest target outside a sentence (SC 2.5.5). */
const TARGET_PX = 44;

test.describe('the rabbit', () => {
  test('is a named button with a 44px target (SC 4.1.2, 2.5.5)', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    const rabbit = page.locator('[data-home-follow]');
    await expect(rabbit).toHaveRole('button');
    await expect(rabbit).toHaveAccessibleName('Follow the Rabbit');
    const box = await rabbit.boundingBox();
    expect(box, 'the rabbit has no box to press').not.toBeNull();
    expect(
      box?.width ?? 0,
      'the rabbit is narrower than a target',
    ).toBeGreaterThanOrEqual(TARGET_PX);
    expect(
      box?.height ?? 0,
      'the rabbit is shorter than a target',
    ).toBeGreaterThanOrEqual(TARGET_PX);
  });

  for (const path of ['paused', 'moving'] as const) {
    test(`hands focus to the fall's pause control when it dives, ${path} (SC 2.4.3)`, async ({
      page,
    }) => {
      await gotoSettled(page, '/');
      if (path === 'paused')
        await page.locator('[data-home-pause]').first().click();
      const rabbit = page.locator('[data-home-follow]');
      await rabbit.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.home-fall')).toHaveAttribute(
        'data-rabbit-fell',
        '',
      );
      await expect(
        page.locator('.home-fall [data-home-pause]'),
        'focus did not move on to the next control when the rabbit went',
      ).toBeFocused();
    });
  }

  for (const [width, height] of VIEWPORTS) {
    test(`goes down the fall without covering text or a control at ${width}x${height} (SC 1.4.3, 2.4.11)`, async ({
      page,
    }) => {
      await open(page, width, height);
      await page.locator('[data-home-band]').scrollIntoViewIfNeeded();
      /* By keyboard: the forced pointer events above put the stems over the button. */
      await page.locator('[data-home-follow]').focus();
      await page.keyboard.press('Enter');
      await advance(page, DIVE_MS);
      await expect(page.locator('.home-fall')).toHaveAttribute(
        'data-rabbit-fell',
        '',
      );
      const [from, to] = await page.evaluate(() => [
        window.scrollY,
        document.documentElement.scrollHeight - window.innerHeight,
      ]);
      const hits: string[] = [];
      for (let step = 0; step <= FALL_SCROLL_STEPS; step += 1) {
        await page.evaluate(
          (y) => window.scrollTo(0, y),
          from + ((to - from) * step) / FALL_SCROLL_STEPS,
        );
        for (let frame = 0; frame < FALL_FRAMES; frame += 1) {
          await advance(page, FALL_FRAME_MS);
          hits.push(
            ...(await coveredBy(
              page,
              '.home-fall',
              '[data-home-faller], .home-hole',
            )),
          );
        }
      }
      expect(
        hits,
        'the falling rabbit or the shaft sits on top of text or a control',
      ).toEqual([]);
    });
  }

  test('lands on the last section, inside the fall and never over the footer (SC 1.4.3)', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    await page.locator('[data-home-follow]').click();
    await expect(page.locator('.home-fall')).toHaveAttribute(
      'data-rabbit-fell',
      '',
    );
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const where = () =>
      page.evaluate(() => {
        const fall = document.querySelector('.home-fall');
        const rabbit = document.querySelector('.home-faller .home-bun > i');
        const last = document.querySelector('.home-fall > :last-child .card');
        if (!fall || !rabbit || !last)
          throw new Error(
            'the fall, the falling rabbit or the last card is not on the page.',
          );
        const feet = rabbit.getBoundingClientRect().bottom;
        return {
          aboveLast: Math.abs(last.getBoundingClientRect().top - feet),
          overflow: feet - fall.getBoundingClientRect().bottom,
        };
      });
    await expect
      .poll(async () => (await where()).aboveLast, {
        message: 'the rabbit never came down to stand on the last section',
        timeout: LANDING_MS,
      })
      .toBeLessThanOrEqual(SUBPIXEL_TOLERANCE * 2);
    expect(
      (await where()).overflow,
      'the landed rabbit hangs below the fall, over the footer',
    ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
  });

  test('under reduced motion rests at once, without moving (SC 2.3.3)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, '/');
    await page.locator('[data-home-follow]').click();
    await expect(page.locator('.home-fall')).toHaveAttribute(
      'data-rabbit-fell',
      '',
    );
    const read = () =>
      page
        .locator('.home-faller-spin')
        .evaluate((el) => (el as HTMLElement).style.transform);
    const first = await read();
    await page.waitForTimeout(STILL_CHECK_MS);
    expect(await read(), 'the rabbit moved under reduced motion').toBe(first);
  });

  test('under reduced motion sits on its last spot and scrolling never moves it (SC 2.3.3)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, '/');
    await page.locator('[data-home-follow]').click();
    await expect(page.locator('.home-fall')).toHaveAttribute(
      'data-rabbit-fell',
      '',
    );
    const read = () =>
      page.evaluate(() => {
        const spin = document.querySelector<HTMLElement>('.home-faller-spin');
        const art = document.querySelector('.home-faller .home-bun > i');
        const last = document.querySelector('.home-fall > :last-child .card');
        if (!spin || !art || !last)
          throw new Error('the falling rabbit or the last card is missing.');
        return {
          transform: spin.style.transform,
          offLast: Math.abs(
            last.getBoundingClientRect().top -
              art.getBoundingClientRect().bottom,
          ),
        };
      });
    const first = await read();
    expect(
      first.offLast,
      'the rabbit is not resting on the last section under reduced motion',
    ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE * 2);
    for (const share of [0.5, 1, 0]) {
      await page.evaluate(
        (at) =>
          window.scrollTo(
            0,
            (document.documentElement.scrollHeight - window.innerHeight) * at,
          ),
        share,
      );
      await page.waitForTimeout(STILL_CHECK_MS);
      expect(
        (await read()).transform,
        'scrolling moved the rabbit under reduced motion',
      ).toBe(first.transform);
    }
  });

  /* A phone: there the meadow is short enough for a hop to cut the ring. */
  for (const [width, height] of [[390, 844]] as const) {
    test(`holds still with its whole focus ring inside the meadow while focused at ${width}x${height} (SC 2.4.11, 2.4.13)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.clock.install();
      await gotoSettled(page, '/');
      await page.locator('[data-home-band]').scrollIntoViewIfNeeded();
      const rabbit = page.locator('[data-home-follow]');
      await rabbit.focus();
      const outside: number[] = [];
      for (let step = 0; step < FOCUS_STEPS; step += 1) {
        await advance(page, FOCUS_STEP_MS);
        outside.push(
          await rabbit.evaluate((el) => {
            const style = getComputedStyle(el);
            const reach =
              parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
            const ring = el.getBoundingClientRect();
            const band = el
              .closest('[data-home-band]')!
              .getBoundingClientRect();
            return Math.max(
              band.left - (ring.left - reach),
              band.top - (ring.top - reach),
              ring.right + reach - band.right,
              ring.bottom + reach - band.bottom,
              0,
            );
          }),
        );
      }
      expect(
        Math.max(...outside),
        'the focused rabbit hops so its focus ring is cut off by the meadow',
      ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
    });
  }

  test('is no control without JavaScript, nor is the jar', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    /* Not gotoSettled: it waits for the menu script, which cannot run here. */
    await page.goto('/');
    await expect(
      page.locator('[data-home-follow]'),
      'a button that does nothing without its script is shown',
    ).toBeHidden();
    await expect(
      page.locator('[data-home-jar]'),
      'the jar, which does nothing without its script, is shown and takes a Tab stop',
    ).toBeHidden();
    await context.close();
  });
});

test.describe('the homepage without JavaScript', () => {
  for (const [width, height] of VIEWPORTS) {
    test(`the planted meadow covers no text or control at ${width}x${height} (SC 1.4.3)`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width, height },
      });
      const page = await context.newPage();
      /* Not gotoSettled: it waits for the menu script, which cannot run here. Boxes, not evaluate, since no script runs. */
      await page.goto('/');
      const boxes = async (selector: string) =>
        (
          await Promise.all(
            (await page.locator(selector).all()).map((el) => el.boundingBox()),
          )
        ).filter((box) => box !== null && box.width >= 1 && box.height >= 1);
      const plants = await boxes(
        '.home-meadow .home-plant, .home-meadow [data-home-mouth], .home-meadow .home-post',
      );
      const words = await boxes(
        '.home-meadow :is(h1, p, li, a, button:not([hidden]))',
      );
      const overlaps = words.flatMap((word) =>
        plants
          .filter(
            (plant) =>
              Math.min(word!.x + word!.width, plant!.x + plant!.width) -
                Math.max(word!.x, plant!.x) >=
                1 &&
              Math.min(word!.y + word!.height, plant!.y + plant!.height) -
                Math.max(word!.y, plant!.y) >=
                1,
          )
          .map(() => `${Math.round(word!.x)},${Math.round(word!.y)}`),
      );
      expect(
        plants.length,
        'the planted meadow is missing without JavaScript',
      ).toBeGreaterThan(0);
      expect(
        words.length,
        'no text or control in the meadow was found to check',
      ).toBeGreaterThan(0);
      expect(
        overlaps,
        'a planted stem or the hole sits on text or a control without JavaScript',
      ).toEqual([]);
      await context.close();
    });
  }
});

test.describe('the homepage in forced colors', NO_WEBKIT, () => {
  test('both pause controls and the jar keep an edge (SC 1.4.11)', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await gotoSettled(page, '/');
    expect(
      await page.evaluate(() => matchMedia('(forced-colors: active)').matches),
      'forced colors were not emulated, so this proves nothing',
    ).toBe(true);

    const found = await page.evaluate(() => {
      const edged = (el: Element) => {
        const style = getComputedStyle(el);
        return (
          parseFloat(style.borderTopWidth) > 0 &&
          style.borderTopStyle !== 'none' &&
          style.borderTopColor !== style.backgroundColor
        );
      };
      const jar = document.querySelector('[data-home-jar]');
      if (!jar) throw new Error('[data-home-jar] is not on the page.');
      const pauses = [...document.querySelectorAll('[data-home-pause]')];
      return {
        jar: edged(jar),
        pauses: pauses.length,
        pausesEdged: pauses.every(
          (button) => !(button as HTMLElement).hidden && edged(button),
        ),
      };
    });

    expect(found.jar, 'the jar has no boundary as a control').toBe(true);
    expect(found.pauses, 'the homepage does not have two pause controls').toBe(
      2,
    );
    expect(found.pausesEdged, 'a pause control is hidden or has no edge').toBe(
      true,
    );
  });
});
