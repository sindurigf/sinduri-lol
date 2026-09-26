import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';

/**
 * Below 30rem of viewport height (a landscape phone, or 960px at 200% zoom) the
 * 96px header would cover up to half the view (SC 2.4.12), so it scrolls away and
 * the scroll padding drops to `--spacing(4)`. docs/STYLEGUIDE.md "Navigation".
 */

/* The view and route the focus walk runs on: the most controls in the least height. */
const WALK_LABEL = '320 by 180 (1280 by 720 at 400%)';
const WALK_ROUTE = '/about';

/* A viewport, and whether the header should stick in it. */
const VIEWS = [
  {
    label: 'a landscape phone at 200% zoom',
    width: 422,
    height: 195,
    scale: 2,
    sticky: false,
  },
  {
    label: WALK_LABEL,
    width: 320,
    height: 180,
    scale: 4,
    sticky: false,
  },
  {
    label: 'a 1280 by 720 window at 200%',
    width: 640,
    height: 360,
    scale: 2,
    sticky: false,
  },
  {
    label: 'a landscape phone',
    width: 844,
    height: 390,
    scale: 1,
    sticky: false,
  },
  { label: 'a phone', width: 390, height: 844, scale: 1, sticky: true },
  { label: 'a laptop', width: 1280, height: 800, scale: 1, sticky: true },
] as const;

/* Two frames, so a scroll into view has been laid out before it is measured. */
const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

for (const view of VIEWS) {
  test.describe(`the header on ${view.label}`, () => {
    test.use({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.scale,
    });

    test(`is ${view.sticky ? '' : 'not '}sticky`, async ({ page }) => {
      await gotoSettled(page, '/about');
      const found = await page.evaluate(() => {
        const header = document.querySelector('header.page-gutter')!;
        return {
          position: getComputedStyle(header).position,
          padding: parseFloat(
            getComputedStyle(document.documentElement).scrollPaddingTop,
          ),
          header: header.getBoundingClientRect().height,
        };
      });
      expect(found.position).toBe(view.sticky ? 'sticky' : 'static');
      if (view.sticky) {
        expect(
          found.padding,
          'scroll padding shorter than the sticky header lets focus land under it',
        ).toBeGreaterThanOrEqual(found.header);
      }
    });

    if (view.label === WALK_LABEL) {
      test(`${WALK_ROUTE} leaves no focused control under the header`, async ({
        page,
      }) => {
        await gotoSettled(page, WALK_ROUTE);
        await page.locator('body').press('Tab');
        await nextFrames(page);
        const under: string[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < 200; i += 1) {
          const stop = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            const key =
              (el as HTMLElement).dataset.walk ?? String(Math.random());
            (el as HTMLElement).dataset.walk = key;
            const header = document.querySelector('header.page-gutter')!;
            const box = el.getBoundingClientRect();
            const edge = header.getBoundingClientRect().bottom;
            const drawnAbove = getComputedStyle(el).position !== 'static';
            return {
              key,
              under:
                !header.contains(el) &&
                !drawnAbove &&
                edge > 0 &&
                box.top < edge &&
                box.bottom > 0,
              text: (el.textContent ?? '').trim().slice(0, 30),
            };
          });
          if (!stop || seen.has(stop.key)) break;
          seen.add(stop.key);
          if (stop.under) under.push(stop.text);
          await page.keyboard.press('Tab');
          await nextFrames(page);
        }
        expect(seen.size, 'the walk reached nothing').toBeGreaterThan(1);
        expect(under, 'focused while partly under the header').toEqual([]);
      });
    }
  });
}
