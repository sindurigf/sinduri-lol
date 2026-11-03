import { test, expect, type Page } from './test';
import { fontsSettled, gotoSettled } from './settle';

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

/** Steps through a full rise of the printed things: 40 frames 1.5s apart cover a 60s cycle. */
const DRIFT_SAMPLES = 40;
const DRIFT_STEP_MS = 1500;

/** 250ms steps rise the jar about 8px; 240 cover the 60s cycle. */
const EDGE_STEP_MS = 250;
const EDGE_SEARCH_STEPS = 240;

/** CSS px: boxes are fractional; half a pixel hides nothing. */
const SUBPIXEL_TOLERANCE = 0.5;

const open = async (page: Page, width: number, height: number) => {
  await page.setViewportSize({ width, height });
  await page.clock.install();
  await gotoSettled(page, '/');
  await fontsSettled(page);
  /* The meadow strip ignores the pointer; hit-testing it here makes `elementFromPoint` follow paint order. */
  await page.addStyleTag({
    content:
      '[data-home-band], [data-home-band] *, [data-home-mouth], [data-home-prop], [data-home-prop] * { pointer-events: auto !important; }',
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
          'a, button:not([hidden]):not([data-home-jar])',
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
    test(`the name clears the header at ${width}x${height} (SC 2.4.11)`, async ({
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

    test(`the grass, the rabbit and the hole cover no text or control at ${width}x${height} (SC 1.4.3, 2.4.11)`, async ({
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
            '[data-home-band], [data-home-mouth]',
          )),
        );
        await page.clock.runFor(DRIFT_STEP_MS);
      }
      expect(
        hits,
        'meadow decoration sits on top of text or a control',
      ).toEqual([]);
    });
  }
});

test.describe('the printed things in the fall', () => {
  for (const [width, height] of VIEWPORTS) {
    test(`pass behind every word and control at ${width}x${height} (SC 1.4.3, 2.4.11)`, async ({
      page,
    }) => {
      await open(page, width, height);
      await page.locator('[data-home-drift]').scrollIntoViewIfNeeded();
      const hits: string[] = [];
      for (let step = 0; step < DRIFT_SAMPLES; step += 1) {
        hits.push(...(await coveredBy(page, '.home-fall', '[data-home-prop]')));
        await page.clock.runFor(DRIFT_STEP_MS);
      }
      expect(hits, 'a printed thing sits on top of text or a control').toEqual(
        [],
      );
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
        await page.clock.runFor(DRIFT_STEP_MS);
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
      await page.clock.runFor(EDGE_STEP_MS);
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
    expect(count, 'the fall has no printed things to check').toBeGreaterThan(1);
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

test.describe('the homepage in forced colors', () => {
  test('the meadow, the hole, both pause controls and the jar keep an edge, and the rabbit stays drawn (SC 1.4.11)', async ({
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
      const one = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`${selector} is not on the page.`);
        return el;
      };
      const pauses = [...document.querySelectorAll('[data-home-pause]')];
      return {
        meadow: edged(one('.home-meadow')),
        mouth: edged(one('[data-home-mouth]')),
        jar: edged(one('[data-home-jar]')),
        pauses: pauses.length,
        pausesEdged: pauses.every(
          (button) => !(button as HTMLElement).hidden && edged(button),
        ),
        rabbit: getComputedStyle(one('.home-bun > i')).backgroundImage,
      };
    });

    expect(found.meadow, 'the meadow loses its edge').toBe(true);
    expect(found.mouth, 'the hole loses its edge').toBe(true);
    expect(found.jar, 'the jar has no boundary as a control').toBe(true);
    expect(found.pauses, 'the homepage does not have two pause controls').toBe(
      2,
    );
    expect(found.pausesEdged, 'a pause control is hidden or has no edge').toBe(
      true,
    );
    expect(found.rabbit, 'the rabbit is not drawn').not.toBe('none');
  });
});
