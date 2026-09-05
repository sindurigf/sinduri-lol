import { expect, test, type Page } from '@playwright/test';
import { islandRoutesFromBuild, ROUTES } from './routes';

/**
 * The spinning badge and its pause control (SC 2.2.2 Pause, Stop, Hide).
 *
 * The badge starts automatically, runs indefinitely, and sits alongside other
 * content, which is the exact shape the criterion covers: motion that begins
 * on its own, lasts more than five seconds, and is presented in parallel with
 * other content needs a mechanism to pause, stop or hide it. A
 * `prefers-reduced-motion` media query is not that mechanism — it helps only
 * a reader who has already configured the preference, and does nothing for
 * someone distracted by the movement in the moment.
 *
 * WHAT THIS FILE ASSERTS THAT READING THE COMPONENT CANNOT.
 *
 *  1. Something is actually moving. `animation-play-state: running` on a real
 *     `slowspin` animation, read from the rendered DOM. Without this the rest
 *     of the file would pass just as happily against a badge that never
 *     animated, which is the state the server-rendered HTML is deliberately
 *     in — and then the control would be theatre.
 *  2. The control is operable from the keyboard, by pressing a key rather
 *     than by calling click(). A control that only responds to a mouse fails
 *     the criterion for exactly the people it exists for.
 *  3. Pressing it stops the motion, measured as `animation-play-state`, not
 *     as a class name or a data attribute.
 *  4. Its accessible name says what it will do next, and changes when the
 *     state does. The state is carried by the name and by nothing else; see
 *     the note in SpinBadge.vue about not doing this twice.
 *  5. SC 2.5.8: the control passes target size on its own dimensions.
 *  6. Under `prefers-reduced-motion: reduce` there is neither animation nor
 *     button, rather than a dead button beside a neutralised animation.
 *
 * Every route carrying a badge is exercised. The comps put one on the homepage
 * at 24s and one on Contact at 28s.
 *
 * BADGE_ROUTES IS A LITERAL WITH A GUARD, NOT A LITERAL ON TRUST. It has to be
 * a literal, because Playwright collects this file before the `webServer`
 * command builds the site, so deriving it here would generate its tests from an
 * absent or stale `dist/`. The guard below closes the gap that leaves: it reads
 * the real build and fails when a badge exists on a route this list does not
 * name. Without it, this file spent the whole of the Contact page's existence
 * covering one of the two badges and reporting green.
 */

/** The island whose presence in the built HTML defines "this route has a badge". */
const BADGE_COMPONENT = 'SpinBadge';

const BADGE_ROUTES = ['/', '/contact'] as const;

test('BADGE_ROUTES names every route that renders a badge', () => {
  const built = islandRoutesFromBuild(BADGE_COMPONENT);

  /*
   * The floor first. If the marker ever stops matching, `built` goes empty and
   * the comparison below would pass against an emptied BADGE_ROUTES rather than
   * failing — the same vacuity the route walks in gold-surface.spec.ts guard
   * with their own `length > 0` assertions.
   */
  expect(
    built.length,
    `no route in dist/ carries a ${BADGE_COMPONENT} island. Either the site ` +
      `stopped rendering the badge, or Astro changed the \`component-url\` ` +
      `attribute that islandRoutesFromBuild matches on — in which case this ` +
      `whole file is measuring nothing.`,
  ).toBeGreaterThan(0);

  expect(
    built,
    `BADGE_ROUTES is out of sync with the build. Every route that renders a ` +
      `${BADGE_COMPONENT} needs SC 2.2.2 coverage, and this file only walks ` +
      `the routes named in that list, so a badge on an unlisted route has no ` +
      `pause-control test at all.`,
  ).toEqual([...BADGE_ROUTES].sort());
});

/** SC 2.5.8 asks 24x24 CSS px of a target on its own size. */
const MIN_TARGET = 24;

const PAUSE_NAME = /pause the spinning badge/i;
const PLAY_NAME = /play the spinning badge/i;

/** The rendered animation state of the badge frame, straight from the DOM. */
const animationState = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('.spin-badge');
    if (frame === null) return { present: false, name: null, state: null };
    const style = getComputedStyle(frame);
    return {
      present: true,
      name: style.animationName,
      state: style.animationPlayState,
    };
  });

for (const route of BADGE_ROUTES) {
  test.describe(`the spinning badge on ${route}`, () => {
    test('auto-starts, and a keyboard press pauses and resumes it', async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'networkidle' });

      const running = await animationState(page);
      expect(
        running.present,
        `${route} has no .spin-badge. The animation is applied by the island ` +
          `on mount, so this failing means the island did not hydrate — which ` +
          `is also why the pause control would be missing.`,
      ).toBe(true);
      expect(running.name, 'the badge should run the slowspin keyframes').toBe(
        'slowspin',
      );
      expect(
        running.state,
        'the badge should be moving before anything is pressed. If it is not, ' +
          'every assertion below is about a control that pauses nothing.',
      ).toBe('running');

      const control = page.getByRole('button', { name: PAUSE_NAME });
      await expect(control).toBeVisible();

      /*
       * SC 2.5.8, on the control's own size rather than on the spacing
       * exception, which nothing on this site relies on.
       */
      const box = await control.boundingBox();
      expect(box?.width, 'pause control target width').toBeGreaterThanOrEqual(
        MIN_TARGET,
      );
      expect(box?.height, 'pause control target height').toBeGreaterThanOrEqual(
        MIN_TARGET,
      );

      /*
       * Operated by a real key press on a focused control, not by click().
       * click() would pass against a div with a mouse handler on it.
       */
      await control.focus();
      await expect(control).toBeFocused();
      await expect(
        control,
        'the control must show a focus indicator; :focus-visible is what the ' +
          'site-wide gold ring hangs off',
      ).toHaveCSS('outline-style', 'solid');

      await page.keyboard.press('Enter');

      const paused = await animationState(page);
      expect(
        paused.state,
        'pressing the control must stop the motion, not merely re-label itself',
      ).toBe('paused');

      /*
       * The name now says what the button will do next. It is the only
       * carrier of the state, so it has to change, and there is deliberately
       * no aria-pressed to contradict it.
       */
      const resume = page.getByRole('button', { name: PLAY_NAME });
      await expect(resume).toBeFocused();
      await expect(
        page.getByRole('button', { name: PAUSE_NAME }),
        'the paused control must not still be named "Pause"',
      ).toHaveCount(0);

      await page.keyboard.press('Enter');

      expect(
        (await animationState(page)).state,
        'pressing it again must resume the motion',
      ).toBe('running');
      await expect(
        page.getByRole('button', { name: PAUSE_NAME }),
      ).toBeFocused();
    });

    /*
     * The preference is emulated with `page.emulateMedia` rather than with
     * `test.use({ reducedMotion })`, and called before `goto` so the island
     * reads the right answer on its first mount.
     *
     * On @playwright/test 1.62.1 the fixture form silently did not apply
     * inside a nested describe here: `matchMedia('(prefers-reduced-motion:
     * reduce)').matches` came back `false` and the badge animated, so the test
     * would have passed against a page that had never been asked the question.
     * **Fixed in 1.63.0** — re-measured on the upgrade, `test.use` reports true
     * in chromium 153 and firefox 153 alike. The same bug affected
     * `forcedColors`; see tests/forced-colors.spec.ts, which has the longer
     * version of this note.
     *
     * `emulateMedia` is kept because it is the form that was never broken, and
     * the assertion below that the preference actually matched is kept because
     * it is what made the bug visible rather than silent.
     */
    test('under reduced motion there is no motion and no control', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route, { waitUntil: 'networkidle' });

      expect(
        await page.evaluate(
          () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        ),
        'the preference was not emulated, so this test proves nothing',
      ).toBe(true);

      expect(
        (await animationState(page)).present,
        'the badge must not be given the animation class at all under ' +
          'reduced motion. Relying on the global media query to neutralise ' +
          'it to 0.01ms would leave the animation nominally running.',
      ).toBe(false);

      await expect(
        page.getByRole('button', { name: /the spinning badge/i }),
        'a control that pauses nothing is one more stop in the tab order ' +
          'that changes nothing a reader can perceive',
      ).toHaveCount(0);
    });
  });
}

/**
 * The same preference, swept across every route rather than the two that
 * render a badge.
 *
 * WHY BOTH. The tests above are about the badge and the criterion it has to
 * satisfy; they run on BADGE_ROUTES, which is `/` and `/contact`. Twenty-one
 * other routes have no badge, so nothing above looks at them at all. An
 * animation added to a blog post, a card hover that grows a transition, or a
 * keyframe that escapes the global block through `!important` would move for a
 * reader who asked the operating system for stillness, and every test in this
 * file would stay green.
 *
 * WHAT COUNTS AS MOVING. A running animation, or a transition, whose duration
 * survives the reduce block — which neutralises to 0.01ms, so anything above a
 * millisecond did not get neutralised. An infinite iteration count is caught
 * whatever its duration, because that is motion that never stops on its own.
 *
 * VERIFIED ABLE TO FAIL, and the second case is why the iteration-count check
 * is not redundant. An `animation: drift 3s linear infinite !important` added
 * to an <h1> is caught — and it is caught on the iteration count alone,
 * because the reduce block still won on duration and computed it to 1e-05s. A
 * check that looked only at duration would have called that still. A
 * `transition: color 900ms !important` on <p> is caught on 21 elements.
 * Measured 2026-09-05.
 *
 * UNIT: elements still moving under the preference, across all of ROUTES, when
 * this was written on 2026-09-05 — zero. Recorded so a later non-zero reads as
 * a change rather than as the way it has always been.
 */
test('nothing anywhere still moves under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const moving: string[] = [];
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });

    expect(
      await page.evaluate(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
      `the preference was not emulated on ${route}, so this proves nothing`,
    ).toBe(true);

    const found = await page.evaluate(() => {
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
        const endless =
          animated && style.animationIterationCount === 'infinite';

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
