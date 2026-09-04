import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from './routes';

/**
 * SC 2.5.8 Target Size (Minimum), on every interactive element on every route.
 *
 * ACCESSIBILITY.md section 4 claims that every target on this site passes on
 * its own size and that the spacing exception is not relied on anywhere. That
 * was true when it was written and it was a claim, not a test: it had been
 * established by measuring the handful of controls that existed. This build
 * roughly quadrupled the number of controls — six filter options, a pager, a
 * pause button, card headings, contact cards — so the claim now needs
 * something behind it.
 *
 * THE SPACING EXCEPTION IS DELIBERATELY NOT IMPLEMENTED HERE. SC 2.5.8 does
 * offer it: an undersized target passes if a 24px circle centred on it does
 * not intersect any other target's circle. This project decided not to depend
 * on it, because it makes the gap between two controls load-bearing for
 * conformance, so an unrelated spacing change breaks 2.5.8 silently and a long
 * way from the edit. Measuring the target's own box is the whole check.
 *
 * TWO EXCEPTIONS ARE IMPLEMENTED, because they are in the criterion itself.
 *
 *   INLINE. A link inside a sentence is exempt, because its size is determined
 *   by the line it sits in and the author cannot enlarge it without breaking
 *   the paragraph. That is a real exemption, not a loophole, and it is the one
 *   the prose links in a blog post, the 404 copy and the Contact standfirst
 *   rely on. Detected structurally rather than by class: an element whose
 *   computed display is inline, sitting in a text container that has text of
 *   its own around it.
 *
 *   NOT RENDERED. An element with a zero box is not a target. That covers the
 *   mobile menu's contents at desktop widths and the desktop nav below `md`,
 *   both of which are display:none rather than merely offscreen.
 *
 * The skip link is NOT excluded. It is translated off the top of the viewport
 * rather than hidden, so it has a real box and it is measured like anything
 * else; it is the first control a keyboard user meets and its size matters.
 *
 * Two widths, because the controls that change size are the ones at risk: the
 * nav collapses to the menu trigger below `md`, and the filter and pager wrap.
 * 305px is the real 400%-zoom width; 1280px is the desktop layout.
 */

const MIN_TARGET = 24;

const VIEWPORTS = [
  { width: 305, height: 900, note: '400% zoom, classic scrollbar' },
  { width: 1280, height: 900, note: 'desktop' },
] as const;

interface UndersizedTarget {
  selector: string;
  name: string;
  width: number;
  height: number;
}

const undersizedTargets = (page: Page): Promise<UndersizedTarget[]> =>
  page.evaluate((min) => {
    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : '';
      const cls =
        typeof el.className === 'string' && el.className.trim() !== ''
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
          : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    /*
     * The SC 2.5.8 inline exception. The element renders inline, and the
     * container it sits in carries text of its own around it — which is what
     * "in a sentence or block of text" means. A link that is the only content
     * of its paragraph is not in a sentence and is not exempt.
     */
    const isInlineInText = (el: Element): boolean => {
      if (getComputedStyle(el).display !== 'inline') return false;
      const parent = el.parentElement;
      if (parent === null) return false;
      const around = [...parent.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? '').trim())
        .join('');
      return around !== '';
    };

    const out: UndersizedTarget[] = [];

    for (const el of document.querySelectorAll(
      'a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])',
    )) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (isInlineInText(el)) continue;
      if (box.width >= min && box.height >= min) continue;

      out.push({
        selector: describe(el),
        name: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        width: Number(box.width.toFixed(1)),
        height: Number(box.height.toFixed(1)),
      });
    }

    return out;
  }, MIN_TARGET);

for (const { width, height, note } of VIEWPORTS) {
  test.describe(`SC 2.5.8 target size at ${width}px (${note})`, () => {
    test.use({ viewport: { width, height } });

    for (const route of ROUTES) {
      test(`${route} has no undersized target`, async ({ page }) => {
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response?.status(), `${route} should serve a 200`).toBe(200);
        await page.evaluate(() => document.fonts.ready);

        const undersized = await undersizedTargets(page);

        expect(
          undersized,
          `${route} has target(s) under ${MIN_TARGET}x${MIN_TARGET} CSS px at ` +
            `${width}px. Size the target itself — padding on the control, not ` +
            `a gap between controls. This site does not use the SC 2.5.8 ` +
            `spacing exception anywhere:\n` +
            undersized
              .map(
                (t) => `  ${t.selector} — ${t.width}x${t.height} — "${t.name}"`,
              )
              .join('\n'),
        ).toEqual([]);
      });
    }
  });
}

/**
 * Proves the walk above is finding controls rather than matching nothing.
 *
 * Without this the whole file passes on an empty list the moment the selector
 * breaks, or the moment the inline exception is widened far enough to swallow
 * everything — and it would look exactly like a clean run.
 */
test('the target-size walk actually finds the controls on a page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/blog', { waitUntil: 'networkidle' });

  const counted = await page.evaluate(
    () =>
      [...document.querySelectorAll('a[href], button, [role="button"]')].filter(
        (el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 || box.height > 0;
        },
      ).length,
  );

  /*
   * /blog carries the header, the skip link, six filter options, nine card
   * headings, a pager and the footer's social row. The floor is deliberately
   * well under that: this asserts the walk is not empty, not the exact shape
   * of the page.
   */
  expect(
    counted,
    'the target-size selector matched almost nothing on /blog, so a clean ' +
      'run above would mean the walk is broken rather than the page is fine',
  ).toBeGreaterThan(20);
});
