import { expect, test, type Locator, type Page } from './test';
import { gotoSettled, sweepTimeout } from './settle';
import { readFileSync } from 'node:fs';
import { builtPages, ROUTES } from './routes';
import { MIN_TARGET } from './wcag';

/**
 * The hero's field of stems and its hopping hare, and SC 2.2.2 Pause, Stop,
 * Hide: it starts on its own, runs indefinitely and sits alongside other
 * content. A `prefers-reduced-motion` query is not the mechanism the
 * criterion asks for; it helps only a reader who has already set the
 * preference.
 *
 * A canvas has no `animation-play-state` to read. The motion here is a `requestAnimationFrame` loop painting pixels, so the
 * only honest question is whether the pixels change. This fingerprints a
 * horizontal strip of the middle layer, the one carrying the hare and the
 * stems nearest it, and compares two samples taken a few hundred milliseconds
 * apart. Running, they differ, because the wind moves every stem on every
 * frame. Paused, they must be identical.
 *
 * `data-hero-motion` is still asserted, for the sweep at the bottom of this
 * file: it reads computed styles, which a canvas is invisible to, and the
 * attribute is what puts the field in its view. It is written from the same
 * predicate the animation frame is gated on, so the two cannot disagree.
 */
const HERO_ROUTE = '/';
const HERO_PAUSE_NAME = /pause the hero animation/i;
const HERO_PLAY_NAME = /play the hero animation/i;

/** How long to let the field run between the two samples. */
const HERO_SAMPLE_MS = 350;

/** How long a running field has to show a repaint, polled, before it fails. */
const HERO_REPAINT_TIMEOUT_MS = 5_000;

/** The frame-rate test offers the field one second of frames at this rate. */
const HERO_PUMP_HZ = 60;
const HERO_PUMP_FRAMES = 60;

/**
 * `MAX_FRAME_RATE` in HeroField.vue is 30, so that second draws 30 of the 60.
 * One either side allows for where the first drawn frame falls.
 */
const HERO_DRAWN_MIN = 29;
const HERO_DRAWN_MAX = 31;

/**
 * Where a mouse or a finger has to be able to reach the hero's pause control.
 *
 * 390x844 is a phone, where a tap is the only pointer. 1280x720 is the Desktop
 * Chrome and Desktop Safari default, and the width the content column stops
 * growing at. Both put the control inside the column's box, which is where it
 * was unreachable. At 1440px it sat outside the column and took a click all
 * along (measured 2026-09-11), so a wide viewport would prove nothing.
 */
const POINTER_VIEWPORTS = [
  { width: 390, height: 844, note: 'phone' },
  { width: 1280, height: 720, note: 'desktop' },
] as const;

/**
 * A cheap signature of what the middle canvas is currently painting.
 *
 * A strip rather than the whole canvas, because `getImageData` over a
 * full-viewport backing store at device resolution is slow enough to matter
 * when it runs twice per assertion in two browsers. The strip is taken at 55%
 * of the height, which is below the horizon and inside the band the hare runs
 * through at every viewport this suite uses.
 */
const fieldFingerprint = (page: Page) =>
  page.evaluate(() => {
    const layers =
      document.querySelectorAll<HTMLCanvasElement>('.hero-field-layer');
    const canvas = layers[1];
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const top = Math.floor(canvas.height * 0.55);
    const rows = Math.min(48, canvas.height - top);
    if (rows < 1) return null;

    const { data } = ctx.getImageData(0, top, canvas.width, rows);
    let ink = 0;
    let signature = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      ink += alpha;
      /* Position-weighted, so ink that merely moved still registers. */
      signature = (signature + alpha * ((i >> 2) % 7919)) % 2147483647;
    }
    return { ink, signature };
  });

const expectFieldPaintsAndRepaints = async (page: Page) => {
  const first = await fieldFingerprint(page);
  expect(first, 'the hero field canvases are not in the page').not.toBeNull();
  expect(
    first!.ink,
    'the middle canvas is empty. Every assertion below would pass against a ' +
      'field that never drew anything, which is the state the palette read ' +
      'failing quietly would leave it in.',
  ).toBeGreaterThan(0);

  /*
   * Polled, not sampled once after HERO_SAMPLE_MS. The first frame after the
   * field starts can be late in WebKit, and a fixed wait turned that into a
   * failure about repainting when nothing had stopped. It still has to
   * repaint within five seconds: the wind moves every stem on every frame.
   */
  await expect
    .poll(async () => (await fieldFingerprint(page))!.signature, {
      message: 'the field is not repainting',
      timeout: HERO_REPAINT_TIMEOUT_MS,
    })
    .not.toBe(first!.signature);
};

const expectHeroTargetSize = async (control: Locator) => {
  const box = await control.boundingBox();
  expect(
    box?.width,
    'hero pause control target width (SC 2.5.8)',
  ).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(
    box?.height,
    'hero pause control target height (SC 2.5.8)',
  ).toBeGreaterThanOrEqual(MIN_TARGET);
};

const expectFieldResumes = async (page: Page) => {
  const resumed = await fieldFingerprint(page);
  /*
   * Polled for the reason the first repaint is: resuming goes through the
   * same `start()`, and its first drawn frame can be late in WebKit. A fixed
   * HERO_SAMPLE_MS sample failed here in CI, twice in a row, on a branch
   * that did not touch the homepage (2026-09-14).
   *
   * Proven able to fail, 2026-09-14, chromium: with `toggle()` no longer
   * calling `start()`, it failed "pressing play did not restart the field".
   * Restored, chromium and firefox passed.
   */
  await expect
    .poll(async () => (await fieldFingerprint(page))!.signature, {
      message: 'pressing play did not restart the field',
      timeout: HERO_REPAINT_TIMEOUT_MS,
    })
    .not.toBe(resumed!.signature);
};

const installFramePump = (page: Page) =>
  page.addInitScript(() => {
    const queue: FrameRequestCallback[] = [];
    window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
      queue.push(callback);
    window.cancelAnimationFrame = (): void => {};
    (window as unknown as { pumpFrame: (now: number) => void }).pumpFrame = (
      now,
    ) => {
      for (const callback of queue.splice(0)) callback(now);
    };
  });

const countDrawnFrames = (page: Page) =>
  page.evaluate(
    ({ hz, frames }) => {
      const pump = (window as unknown as { pumpFrame: (now: number) => void })
        .pumpFrame;
      const canvas =
        document.querySelectorAll<HTMLCanvasElement>('.hero-field-layer')[1]!;
      const ctx = canvas.getContext('2d')!;
      const top = Math.floor(canvas.height * 0.55);
      const rows = Math.min(48, canvas.height - top);
      const signature = (): number => {
        const { data } = ctx.getImageData(0, top, canvas.width, rows);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum = (sum + data[i + 3] * ((i >> 2) % 7919)) % 2147483647;
        }
        return sum;
      };

      let last = signature();
      let changes = 0;
      let now = performance.now();
      for (let i = 0; i < frames; i += 1) {
        now += 1000 / hz;
        pump(now);
        const next = signature();
        if (next !== last) {
          changes += 1;
          last = next;
        }
      }
      return changes;
    },
    { hz: HERO_PUMP_HZ, frames: HERO_PUMP_FRAMES },
  );

test.describe('the hero field on /', () => {
  test('the server sends a still hero, not a moving one', () => {
    const home = builtPages().find((page) => page.route === HERO_ROUTE);
    expect(home, 'no built homepage to read').toBeDefined();
    const html = readFileSync(home!.file, 'utf8');

    /*
     * The island renders server-side with `mounted` false, so the markup that
     * leaves the server says "paused" and carries no control. If it ever says
     * "running", the field animates in a browser where the island failed to
     * hydrate and the button that stops it does not exist: motion with no
     * mechanism, which is the failure SC 2.2.2 names.
     */
    expect(
      html,
      'the hero field must not be marked as running in server-rendered HTML',
    ).toContain('data-hero-motion="paused"');
    expect(
      html.includes('data-hero-motion="running"'),
      'the server-rendered hero claims to be running before any script has ' +
        'had the chance to render its pause control',
    ).toBe(false);
    expect(
      html.includes('pause the hero animation'),
      'the pause control must not be server-rendered either: it does nothing ' +
        'until the island hydrates, and a dead button is worse than no button',
    ).toBe(false);
  });

  test('paints, keeps moving, and a keyboard press stops it', async ({
    page,
  }) => {
    await gotoSettled(page, HERO_ROUTE);

    const field = page.locator('.hero-field');
    await expect(field).toHaveAttribute('data-hero-motion', 'running');
    await expectFieldPaintsAndRepaints(page);

    /* By keyboard, not by click(). */
    const control = page.getByRole('button', { name: HERO_PAUSE_NAME });
    await expect(control).toBeVisible();
    await expectHeroTargetSize(control);

    await control.focus();
    await expect(control).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(field).toHaveAttribute('data-hero-motion', 'paused');
    await expect(
      page.getByRole('button', { name: HERO_PLAY_NAME }),
      'the name has to say what the button will do next, and change when the ' +
        'state does. See Motion in the design system skill about not stating ' +
        'it twice.',
    ).toBeFocused();

    /* And the pixels actually stopped, not just the attribute. */
    const held = await fieldFingerprint(page);
    await page.waitForTimeout(HERO_SAMPLE_MS);
    expect(
      (await fieldFingerprint(page))!.signature,
      'the attribute says paused and the canvas is still repainting',
    ).toBe(held!.signature);

    await page.keyboard.press('Enter');
    await expect(field).toHaveAttribute('data-hero-motion', 'running');
    await expectFieldResumes(page);
  });

  /*
   * At most thirty drawn frames a second, whatever the display offers.
   *
   * HeroField.vue skips animation frames that arrive before the next drawn
   * frame is due, because every drawn frame repaints three full-viewport
   * canvases; see `MAX_FRAME_RATE` there.
   *
   * The test drives the animation frames itself. Counting real ones measured
   * nothing under load: inside the full suite the machine offered too few
   * frames a second to tell a cap from none. So `requestAnimationFrame` is
   * replaced before the page loads with a queue this test empties at exact
   * 60Hz timestamps. The resize test below stubs it the same way.
   *
   * Drawn frames are counted as pixels, like everything else in this block:
   * the middle canvas is sampled after every frame with the same strip and
   * weighting as `fieldFingerprint`, and each change of signature is a draw.
   *
   * Proven able to fail, 2026-09-11: with the frame gate in `tick()` removed,
   * chromium and firefox failed at the upper bound with "the field drew 60 of
   * 60 frames offered at 60Hz, so the frame cap is not working". With the gate
   * restored both drew exactly 30.
   */
  test('draws at most thirty frames a second', async ({ page }) => {
    await installFramePump(page);
    await page.goto(HERO_ROUTE);
    await expect(page.locator('.hero-field')).toHaveAttribute(
      'data-hero-motion',
      'running',
    );

    const drawn = await countDrawnFrames(page);

    const said = `the field drew ${drawn} of ${HERO_PUMP_FRAMES} frames offered at ${HERO_PUMP_HZ}Hz`;
    expect(drawn, `${said}, so it is not animating`).toBeGreaterThanOrEqual(
      HERO_DRAWN_MIN,
    );
    expect(
      drawn,
      `${said}, so the frame cap is not working`,
    ).toBeLessThanOrEqual(HERO_DRAWN_MAX);
  });

  /*
   * By pointer too, measured as a hit test and not only as a click.
   *
   * The keyboard test cannot see this failure: focus does not hit-test, so a
   * control buried under another element still takes Enter. This one was
   * buried, by a stacking context that ranked the button only among the
   * canvases while the whole field sat under `.hero-stack`.
   *
   * `elementFromPoint` first, because it names what is on top, which is what
   * the failure's reader needs; `locator.click()` waits for the element to
   * receive events and spends the whole test budget before saying so. Then a
   * real `mouse.click` at the same point, so the assertion is about what a
   * press does and not only about geometry.
   *
   * Proven able to fail, 2026-09-11: against the build with `.hero-field`
   * still at `z-0`, all four cases failed at the hit test in chromium and
   * firefox, each reporting the press "lands on <div class="hero-stack
   * mx-auto max-w-page"> instead". With the `z-index` removed and `.hero` made
   * `isolate`, all four pass.
   */
  for (const { width, height, note } of POINTER_VIEWPORTS) {
    test(`a pointer press on the control stops it at ${width}px (${note})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await gotoSettled(page, HERO_ROUTE);

      const field = page.locator('.hero-field');
      await expect(field).toHaveAttribute('data-hero-motion', 'running');

      const box = await page
        .getByRole('button', { name: HERO_PAUSE_NAME })
        .boundingBox();
      expect(box, 'the hero pause control has no box').not.toBeNull();
      const point = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };

      const hit = await page.evaluate(({ x, y }) => {
        const top = document.elementFromPoint(x, y);
        if (!top) return { reaches: false, what: 'nothing: it is off screen' };
        return {
          reaches: top.closest('.hero-motion-toggle') !== null,
          what: `<${top.tagName.toLowerCase()} class="${top.getAttribute('class') ?? ''}">`,
        };
      }, point);
      expect(
        hit.reaches,
        `a press at the centre of the hero pause control lands on ${hit.what} ` +
          'instead. The control is visible and takes the keyboard, and does ' +
          'nothing for a mouse or a finger.',
      ).toBe(true);

      await page.mouse.click(point.x, point.y);
      await expect(field).toHaveAttribute('data-hero-motion', 'paused');
      await expect(
        page.getByRole('button', { name: HERO_PLAY_NAME }),
      ).toBeVisible();
    });
  }

  /*
   * A resize while a frame is pending must leave the field drawn.
   *
   * Setting a canvas's size clears it. `relayout()` resizes all three, and
   * redrawing only when no animation frame was pending left the field blank
   * until a late frame landed: the "middle canvas is empty" failure CI
   * reported on webkit on 2026-09-10.
   *
   * Every frame is held here, so a pending frame never lands and the only
   * paint is the one `relayout()` does itself.
   *
   * Proven able to fail, 2026-09-11: with `relayout()` redrawing only when no
   * frame was pending, this failed in chromium, firefox and webkit with the
   * message below.
   */
  test('a resize while a frame is pending leaves the field drawn', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 1;
    });
    await page.goto(HERO_ROUTE);
    const field = page.locator('.hero-field');
    await expect(field).toHaveAttribute('data-hero-motion', 'running');

    const midWidth = () =>
      page.evaluate(
        () =>
          document.querySelectorAll<HTMLCanvasElement>('.hero-field-layer')[1]
            ?.width ?? 0,
      );
    const before = await midWidth();
    const size = page.viewportSize()!;
    await page.setViewportSize({
      width: size.width - 160,
      height: size.height,
    });
    await expect.poll(midWidth).not.toBe(before);

    const ink = await page.evaluate(() => {
      const mid =
        document.querySelectorAll<HTMLCanvasElement>('.hero-field-layer')[1];
      const { data } = mid
        .getContext('2d')!
        .getImageData(0, 0, mid.width, mid.height);
      let total = 0;
      for (let i = 3; i < data.length; i += 4) total += data[i];
      return total;
    });
    expect(
      ink,
      'the resize cleared the middle canvas and nothing redrew it, so the ' +
        'field stays blank until an animation frame lands',
    ).toBeGreaterThan(0);
  });

  test('under reduced motion it is drawn once and held, with no control', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, HERO_ROUTE);

    expect(
      await page.evaluate(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
      'the preference was not emulated, so this test proves nothing',
    ).toBe(true);

    await expect(page.locator('.hero-field')).toHaveAttribute(
      'data-hero-motion',
      'paused',
    );

    /*
     * Drawn, though. Hiding the field under this preference would take the
     * artwork from someone who asked for less movement, not less picture.
     */
    const still = await fieldFingerprint(page);
    expect(
      still?.ink,
      'the field should still be painted under reduced motion, just not moving',
    ).toBeGreaterThan(0);

    await page.waitForTimeout(HERO_SAMPLE_MS);
    expect(
      (await fieldFingerprint(page))!.signature,
      'the field moved under prefers-reduced-motion',
    ).toBe(still!.signature);

    await expect(
      page.getByRole('button', { name: /the hero animation/i }),
      'a control that pauses nothing is one more stop in the tab order that ' +
        'changes nothing a reader can perceive',
    ).toHaveCount(0);
  });
});

const movingElements = (page: Page) =>
  page.evaluate(() => {
    /* Longest duration in a comma-separated list, in milliseconds. */
    const longest = (value: string) =>
      Math.max(
        0,
        ...value.split(',').map((part) => {
          const seconds = parseFloat(part);
          if (Number.isNaN(seconds)) return 0;
          return part.includes('ms') ? seconds : seconds * 1000;
        }),
      );

    const out: string[] = [];
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element);
      const animated = style.animationName !== 'none';
      const animation = animated ? longest(style.animationDuration) : 0;
      const transition =
        style.transitionProperty === 'none'
          ? 0
          : longest(style.transitionDuration);
      const endless = animated && style.animationIterationCount === 'infinite';

      if (animation <= 1 && transition <= 1 && !endless) continue;
      out.push(
        `<${element.tagName.toLowerCase()} class="${String(
          (element as HTMLElement).className,
        ).slice(0, 48)}"> animation=${style.animationName} ` +
          `${style.animationDuration}/${style.animationIterationCount} ` +
          `transition=${style.transitionProperty} ${style.transitionDuration}`,
      );
    }
    return out;
  });

/**
 * The same preference, swept across every route rather than the homepage.
 *
 * The tests above run on `/`. An animation added to a blog post, a card hover that grows a transition, or a
 * keyframe escaping the global block through `!important` would move for a
 * reader who asked for stillness while every test above stayed green.
 *
 * What counts as moving: a running animation, or a transition, whose duration
 * survives the reduce block, which neutralises to 0.01ms, so anything above a
 * millisecond got past it. An infinite iteration count counts whatever its
 * duration, because that is motion that never stops on its own.
 *
 * Proven able to fail, 2026-09-05. `animation: drift 3s linear infinite
 * !important` on an <h1> is caught on the iteration count alone, because the
 * reduce block still won on duration and computed it to 1e-05s: a check that
 * looked only at duration would have called that still. `transition: color
 * 900ms !important` on <p> is caught on 21 elements.
 *
 * Elements still moving under the preference across ROUTES, 2026-09-05: zero.
 * Recorded so a later non-zero reads as a change.
 */

test('nothing anywhere still moves under reduced motion', async ({ page }) => {
  test.setTimeout(sweepTimeout(ROUTES.length));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const moving: string[] = [];
  for (const route of ROUTES) {
    await gotoSettled(page, route);

    expect(
      await page.evaluate(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
      `the preference was not emulated on ${route}, so this proves nothing`,
    ).toBe(true);

    const found = await movingElements(page);

    moving.push(...found.map((entry) => `${route}  ${entry}`));
  }

  expect(
    moving,
    `element(s) still moving with prefers-reduced-motion: reduce set. The ` +
      `reduce block in global.css neutralises animation and transition ` +
      `duration to 0.01ms, so anything above a millisecond has got past it:\n` +
      moving.map((entry) => `  ${entry}`).join('\n'),
  ).toEqual([]);
});
