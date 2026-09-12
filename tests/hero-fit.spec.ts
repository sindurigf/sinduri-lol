import { test, expect, type Page } from '@playwright/test';

/*
 * The homepage hero fits the screen, and still grows rather than clipping.
 *
 * The two halves pull against each other, which is why they are one file.
 * Fitting alone is easy, `height: 100svh` plus `overflow: hidden` passes
 * everywhere, and it would go green on a section that cuts its own heading off
 * at 200% text zoom. Everything in the hero has to be on screen: nothing in it
 * is meant to be scrolled to.
 *
 *   - `the hero fits the viewport` asserts the name block's bottom edge is on
 *     screen. Not the section's own height: it carries a `min-height`, so its
 *     box is the larger of the two and measuring it compares a number with
 *     itself and always passes.
 *
 *   - `the hero grows instead of clipping` applies the SC 1.4.12 text-spacing
 *     override, the cheapest way to make everything taller at once, and
 *     asserts the section grew to hold it. `content` is built from the two
 *     columns' content heights, not the row's rendered height: the row is
 *     `flex-1`, so its height is whatever the section has left after padding
 *     and comparing it with the section is vacuous the same way.
 *
 * 200% text-only zoom (SC 1.4.4) is not covered here. Playwright emulates page
 * zoom, which scales the layout viewport and `svh` with it, and doubling the
 * root font size proves nothing when the type scale is in `px` and `vw`. It
 * stays a by-hand check in docs/MANUAL_TESTING.md section 7.
 *
 * Proven able to fail, chromium:
 *
 *   - 2026-09-11: `.hero-stack`'s inset raised from `clamp(8px, 9svh, 100px)`
 *     to a flat `60svh` fails `the hero fits the viewport` at 5 of the 12
 *     viewports, worst "the hero name block's bottom edge is at 434px, below
 *     the 375px fold at 667x375, over by 59px".
 *   - 2026-09-11: `.hero`'s `min-height` changed to `height` fails `the hero
 *     grows instead of clipping` at 6 of the 12, each by 11.5px to 56.3px,
 *     with SUBPIXEL_TOLERANCE in the comparison.
 *   - 2026-09-10: `.hero-marks` given `position: absolute; inset-inline-start:
 *     0; top: 0`, a plausible way to place a decoration, fails `no sticker
 *     covers text` at every viewport that rendered stickers then, worst
 *     '"Ridet" overlaps <h1> by 127x36px' at 1440x900.
 */

/**
 * Viewports as [width, height], chosen for the height: a tall desktop, three
 * laptop heights, the `lg` breakpoint, a short landscape window, a tablet, two
 * phones, the 305px reflow width the rest of the suite uses, and two phones
 * held sideways.
 *
 * A short, wide screen is its own case. With the brand stickers in a row under
 * the name, 844x390 ran the hero 36px past the fold and took the pause control
 * off screen with it, while every portrait and desktop viewport passed
 * (2026-09-11).
 *
 * How much is in the hero is the largest single input to whether it fits, and
 * the one least under the layout's control.
 */
const VIEWPORTS = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 640],
  [900, 500],
  [768, 1024],
  [390, 844],
  [320, 568],
  [305, 800],
  [844, 390],
  [667, 375],
] as const;

/**
 * The SC 1.4.12 text-spacing override, in the form the criterion specifies.
 * Same declarations as tests/reflow.spec.ts uses; duplicated rather than shared
 * because the two files stress different things with it and neither should
 * quietly change the other's input.
 */
const TEXT_SPACING = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p, li, h1, h2, h3, h4, h5, h6 { margin-bottom: 2em !important; }
`;

/**
 * How far below the content the section may measure before it counts as
 * clipping, in CSS px.
 *
 * The layout engine sizes boxes in fractions of a pixel and this file adds
 * several of them up in floating point. Measured 2026-09-11 at 1366x768 under
 * the text-spacing override: section 683.48px, content 683.52px, with the
 * section's scrollHeight equal to its clientHeight, so nothing was clipped.
 * Rounding each side on its own turned that 0.04px into "content 684px,
 * section 683px". Half a pixel is well below any clip that could hide a glyph,
 * and the mutation recorded above fails by at least 11.5px.
 */
const SUBPIXEL_TOLERANCE = 0.5;

/**
 * The field is a `client:load` island and its pause control renders only once
 * it has mounted, so waiting for the button is waiting for hydration. The
 * layout does not depend on it, the canvases being absolutely positioned and
 * out of flow, but measuring a page mid-hydration measures a page no reader
 * sees.
 */
const heroReady = async (page: Page): Promise<void> => {
  await expect(page.locator('.hero-motion-toggle')).toBeVisible();
};

interface HeroBox {
  /** The section's own rendered height, which its `min-height` floors. */
  section: number;
  /**
   * What the section has to hold: the taller of its two columns' content, plus
   * the row's padding and the section's own. Deliberately not the row's
   * rendered height; see the note at the top of this file.
   */
  content: number;
  /** The sticky header's height, measured rather than read from the token. */
  header: number;
  /** Whether the name block's bottom edge is inside the section's box. */
  nameInside: boolean;
  /**
   * The name block's bottom edge, in viewport coordinates. This is the thing
   * that has to be on screen: it is the last line of type in the hero.
   */
  nameBottom: number;
}

const measureHero = (page: Page): Promise<HeroBox> =>
  page.evaluate(() => {
    const hero = document.querySelector('section.hero');
    if (!hero) {
      throw new Error(
        'the homepage has no section.hero. If the hero stopped using the ' +
          'class, this whole file is measuring nothing.',
      );
    }

    const stack = hero.querySelector('.hero-stack');
    const plate = hero.querySelector('.hero-plate');
    const marks = hero.querySelector('.hero-marks');
    const header = document.querySelector('header');
    if (!stack || !plate || !header) {
      throw new Error(
        'the hero is missing its row, its type block or the page header, so ' +
          'the measurement below would be of the wrong thing.',
      );
    }

    const heroStyle = getComputedStyle(hero);
    const stackStyle = getComputedStyle(stack);
    const padding =
      parseFloat(heroStyle.paddingTop) +
      parseFloat(heroStyle.paddingBottom) +
      parseFloat(stackStyle.paddingTop) +
      parseFloat(stackStyle.paddingBottom);

    /*
     * Two layouts, added up differently.
     *
     * From `sm` up the stickers are a column beside the name block. That
     * column is `justify-between` inside a stretched row, so its own box is
     * the row's height and says nothing; what it needs is the sum of its
     * children, and the section has to hold the taller of the two columns.
     *
     * On a phone the stickers are a row under the name block, so the two stack
     * and the section has to hold both plus the gap. Comparing them there
     * would understate the content by the whole height of the row.
     */
    const plateHeight = plate.getBoundingClientRect().height;
    let stacked = plateHeight;
    if (marks !== null && getComputedStyle(marks).display !== 'none') {
      if (getComputedStyle(marks).flexDirection === 'column') {
        /*
         * Layout heights, not `getBoundingClientRect()`. The stickers are
         * rotated six degrees, so the client rect is the axis-aligned box
         * around them and is taller than the space they take in the column.
         * The column's own row gap and padding count too. The name block is
         * the taller column at every viewport here, so this changes no result
         * today; the sum has to be right on the day the stickers outgrow it.
         */
        const marksStyle = getComputedStyle(marks);
        const heights = [...marks.children].map((child) =>
          parseFloat(getComputedStyle(child).height),
        );
        const marksContent =
          heights.reduce((total, height) => total + height, 0) +
          (parseFloat(marksStyle.rowGap) || 0) *
            Math.max(0, heights.length - 1) +
          parseFloat(marksStyle.paddingTop) +
          parseFloat(marksStyle.paddingBottom);
        stacked = Math.max(plateHeight, marksContent);
      } else {
        stacked =
          plateHeight +
          parseFloat(stackStyle.rowGap) +
          marks.getBoundingClientRect().height;
      }
    }

    const box = hero.getBoundingClientRect();

    return {
      section: box.height,
      content: stacked + padding,
      header: header.getBoundingClientRect().height,
      nameInside: plate.getBoundingClientRect().bottom <= box.bottom + 0.5,
      nameBottom: plate.getBoundingClientRect().bottom,
    };
  });

test.describe('the homepage hero is sized to the viewport', () => {
  for (const [width, height] of VIEWPORTS) {
    test(`the hero fits the viewport at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await heroReady(page);

      const hero = await measureHero(page);

      /*
       * Against the viewport's own bottom edge, not against the section. The
       * name block's rect is already in viewport coordinates and the sticky
       * header is above it, so this is the honest question: can you read the
       * whole name without scrolling?
       */
      expect(
        Math.round(hero.nameBottom),
        `the hero name block's bottom edge is at ` +
          `${Math.round(hero.nameBottom)}px, below the ${height}px fold at ` +
          `${width}x${height}, over by ` +
          `${Math.round(hero.nameBottom - height)}px. Nothing in this hero ` +
          'is allowed below the fold any more: the button and the badge that ' +
          'used to be are gone.',
      ).toBeLessThanOrEqual(height);
    });
  }

  for (const [width, height] of VIEWPORTS) {
    test(`the hero grows instead of clipping at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await heroReady(page);
      await page.addStyleTag({ content: TEXT_SPACING });

      const hero = await measureHero(page);

      expect(
        hero.section + SUBPIXEL_TOLERANCE,
        'the hero must grow to hold its own content under the SC 1.4.12 ' +
          'text-spacing override, not clip it: content ' +
          `${hero.content.toFixed(2)}px, section ` +
          `${hero.section.toFixed(2)}px`,
      ).toBeGreaterThanOrEqual(hero.content);

      expect(
        hero.nameInside,
        'the hero name must still be inside the section under the ' +
          'text-spacing override. The section is overflow-hidden, so a ' +
          'name outside its box is copy painted nowhere.',
      ).toBe(true);
    });
  }
});

/*
 * The hero fills the screen it opens on, exactly.
 *
 * Header and hero together are the viewport's height to the pixel: no strip of
 * the next section showing underneath, and nothing past the fold. `fits the
 * viewport` above only asks whether the name is on screen, which a hero 36px
 * too tall passes. The pause control has to be on screen with it, because SC
 * 2.2.2's control must be findable while the motion is playing.
 *
 * Under the text-spacing override the hero is required to grow instead, which
 * is why this block runs with default text settings only.
 */
test.describe('the hero fills the screen it opens on', () => {
  for (const [width, height] of VIEWPORTS) {
    test(`header and hero fill ${width}x${height} exactly`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await heroReady(page);

      const measured = await page.evaluate(() => ({
        heroBottom: document
          .querySelector('section.hero')!
          .getBoundingClientRect().bottom,
        control: document
          .querySelector('.hero-motion-toggle')!
          .getBoundingClientRect().bottom,
      }));

      const gap = Math.round(height - measured.heroBottom);
      expect(
        gap,
        gap > 0
          ? `the hero stops ${gap}px short of the bottom of ${width}x${height}, ` +
              'so the next section shows underneath it'
          : `the hero runs ${-gap}px past the bottom of ${width}x${height}`,
      ).toBe(0);
      expect(
        measured.control,
        `the pause control is below the fold at ${width}x${height}`,
      ).toBeLessThanOrEqual(height);
    });
  }

  /*
   * One screen really is too short. At 568x320, a small phone held sideways,
   * the name alone needs a few pixels more than the screen has, so the hero
   * grows past the fold, correctly. The pause control must not follow it:
   * under `sm` it sits in the hero's top corner, which is on screen whatever
   * the hero's height.
   *
   * The first assertion is the precondition. If this screen ever does fit, the
   * rest proves nothing and should say so rather than pass.
   */
  test('on a screen too short to fit, the pause control still stays on it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto('/');
    await heroReady(page);

    const measured = await page.evaluate(() => ({
      heroBottom: document
        .querySelector('section.hero')!
        .getBoundingClientRect().bottom,
      control: document
        .querySelector('.hero-motion-toggle')!
        .getBoundingClientRect(),
    }));

    expect(
      measured.heroBottom,
      'the hero fits 568x320 now, so this test no longer exercises the ' +
        'overflow fallback; pick a shorter screen',
    ).toBeGreaterThan(320);
    expect(
      measured.control.bottom,
      'the pause control followed the overflowing hero below the fold',
    ).toBeLessThanOrEqual(320);
    expect(measured.control.top).toBeGreaterThanOrEqual(0);
  });
});

/*
 * The pause control never covers the name.
 *
 * Found by the WCAG-EM audit on 2026-09-11 at 320x256, a 1280x1024 screen at
 * 400%, under the text-spacing override: the control was pinned to the hero's
 * bottom corner, lifted to the fold when the hero grew, and landed on the last
 * letter of the name where no scrolling could uncover it.
 *
 * Measured against the glyphs, not the heading's box. Each line of the name is
 * a block span as wide as the column, so a box test would report an overlap
 * wherever the two merely share a row.
 *
 * Proven able to fail, 2026-09-11: against the previous placement, the bottom
 * corner at every width, exactly two cases failed, chromium and firefox at
 * 320x256 with text spacing, reproducing the audit's finding. With the control
 * in the top corner below `sm` all pass.
 */
const SHORTEST_ZOOMED = [320, 256] as const;

test.describe('the pause control never covers the name', () => {
  for (const [width, height] of [...VIEWPORTS, SHORTEST_ZOOMED]) {
    for (const spacing of [false, true]) {
      test(`the pause control clears the name at ${width}x${height}${
        spacing ? ' with text spacing' : ''
      }`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        await heroReady(page);
        if (spacing) await page.addStyleTag({ content: TEXT_SPACING });

        const measured = await page.evaluate(() => {
          const control = document
            .querySelector('.hero-motion-toggle')!
            .getBoundingClientRect();
          const name = document.querySelector('section.hero h1')!;
          const walker = document.createTreeWalker(name, NodeFilter.SHOW_TEXT);
          let glyphRuns = 0;
          const hits: string[] = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.trim() ?? '';
            if (!text) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const run of range.getClientRects()) {
              glyphRuns += 1;
              const x =
                Math.min(run.right, control.right) -
                Math.max(run.left, control.left);
              const y =
                Math.min(run.bottom, control.bottom) -
                Math.max(run.top, control.top);
              if (x > 0 && y > 0) {
                hits.push(`"${text}" by ${Math.round(x)}x${Math.round(y)}px`);
              }
            }
          }
          return { glyphRuns, hits };
        });

        expect(
          measured.glyphRuns,
          'no line of the name was measured, so nothing below means anything',
        ).toBeGreaterThan(0);
        expect(
          measured.hits,
          `the hero pause control is drawn over the name at ${width}x${height}` +
            `${spacing ? ' with text spacing' : ''}: ${measured.hits.join('; ')}`,
        ).toEqual([]);
      });
    }
  }
});

/*
 * The stickers do not cover the text they sit beside.
 *
 * The defect this catches shipped in the working tree and no other test
 * noticed: a sticker was painted straight across a line of the hero paragraph
 * at every `lg` width while the hero fitted, the contrast was fine, the tab
 * order was fine and the target sizes were fine. Nothing else in tests/ reads
 * whether one element is drawn on top of another's text.
 *
 * Bounding boxes, and both stickers are rotated, so each box is the
 * axis-aligned rectangle around the rotated element and is larger than the
 * sticker. That errs toward reporting an overlap that is not quite there,
 * which is the safe direction here.
 *
 * Proven able to fail 2026-09-10; the mutation is recorded at the top of this
 * file.
 */
test.describe('the hero stickers do not overlap the hero text', () => {
  for (const [width, height] of VIEWPORTS) {
    test(`no sticker covers text at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await heroReady(page);

      const overlaps = await page.evaluate(() => {
        const hero = document.querySelector('section.hero');
        if (!hero) throw new Error('the homepage has no section.hero');

        const stickers = [...hero.querySelectorAll('.hero-sticker')].filter(
          (el) => el.getBoundingClientRect().width > 0,
        );
        const text = [...hero.querySelectorAll('h1')];

        const hits: string[] = [];
        for (const sticker of stickers) {
          const s = sticker.getBoundingClientRect();
          for (const target of text) {
            const t = target.getBoundingClientRect();
            const x = Math.min(s.right, t.right) - Math.max(s.left, t.left);
            const y = Math.min(s.bottom, t.bottom) - Math.max(s.top, t.top);
            if (x > 0 && y > 0) {
              hits.push(
                `"${sticker.textContent?.trim()}" overlaps ` +
                  `<${target.tagName.toLowerCase()}> by ` +
                  `${Math.round(x)}x${Math.round(y)}px`,
              );
            }
          }
        }
        return { count: stickers.length, hits };
      });

      expect(
        overlaps.hits,
        `a hero sticker is painted over hero text at ${width}x${height}. ` +
          'The stickers are decoration and the text is not: ' +
          overlaps.hits.join('; '),
      ).toEqual([]);
    });
  }

  /*
   * The pause control and the stickers do not collide.
   *
   * Found by eye on 2026-09-11 at 844x390, a phone held sideways: a sticker
   * sat directly under the pause button. The walk above cannot see it, because
   * it compares the stickers against text and the button is not text. The
   * button is drawn on top, so nothing an accessibility engine asks about
   * changed, and it is still two things in the same corner, one of them the
   * control that stops the motion.
   *
   * Proven able to fail, 2026-09-11: against the build before the fix it
   * failed at three viewports rather than the one seen by eye, 844x390,
   * 667x375 and 900x500. The fix is the `padding-block-end` on `.hero-marks`.
   */
  for (const [width, height] of VIEWPORTS) {
    test(`the pause control clears both stickers at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await heroReady(page);

      const hits = await page.evaluate(() => {
        const control = document
          .querySelector('.hero-motion-toggle')!
          .getBoundingClientRect();
        return [...document.querySelectorAll('.hero-sticker')]
          .map((el) => {
            const s = el.getBoundingClientRect();
            const x =
              Math.min(s.right, control.right) - Math.max(s.left, control.left);
            const y =
              Math.min(s.bottom, control.bottom) - Math.max(s.top, control.top);
            return x > 0 && y > 0
              ? `"${el.textContent?.trim()}" is under the pause control by ` +
                  `${Math.round(x)}x${Math.round(y)}px`
              : null;
          })
          .filter((hit): hit is string => hit !== null);
      });

      expect(
        hits,
        `a sticker and the pause control overlap at ${width}x${height}: ` +
          hits.join('; '),
      ).toEqual([]);
    });
  }

  /*
   * The walk above passes trivially on a viewport that renders no stickers, so
   * deleting both from the markup would turn green tests greener. This checks
   * they are there at all.
   */
  test('the stickers actually render somewhere the walk covers', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await heroReady(page);

    await expect(page.locator('.hero-sticker')).toHaveCount(2);
    for (const sticker of await page.locator('.hero-sticker').all()) {
      await expect(sticker).toBeVisible();
    }
  });

  /*
   * They render on phones and tablets, and in the right place on each.
   *
   * The overlap walk above passes on a viewport with no stickers to overlap,
   * so the brand words can go missing below a breakpoint unnoticed. This asks
   * directly, at a phone and at the narrow end of the tablet band, and checks
   * the layout each one gets: a row under the name on the phone, the column
   * beside the name on the tablet.
   */
  for (const [width, height, layout] of [
    [390, 844, 'row under the name'],
    [768, 1024, 'column beside the name'],
    [844, 390, 'column beside the name'],
  ] as const) {
    test(`the stickers render as a ${layout} at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await heroReady(page);

      const stickers = page.locator('.hero-sticker');
      await expect(stickers).toHaveCount(2);
      for (const sticker of await stickers.all()) {
        await expect(
          sticker,
          `the brand stickers are missing at ${width}x${height}`,
        ).toBeVisible();
      }

      const placed = await page.evaluate(() => {
        const plate = document
          .querySelector('.hero-plate')!
          .getBoundingClientRect();
        const boxes = [...document.querySelectorAll('.hero-sticker')].map(
          (el) => el.getBoundingClientRect(),
        );
        return {
          belowName: boxes.every((b) => b.top >= plate.bottom),
          besideName: boxes.every((b) => b.left >= plate.right),
        };
      });

      if (layout === 'row under the name') {
        expect(
          placed.belowName,
          'on a phone the stickers belong in a row under the name',
        ).toBe(true);
      } else {
        expect(
          placed.besideName,
          'on a tablet the stickers belong in the column beside the name',
        ).toBe(true);
      }
    });
  }
});
