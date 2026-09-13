import { expect, test, type Page } from '@playwright/test';
import { gotoSettled } from './settle';
import { ROUTES } from './routes';
import { MIN_TARGET } from './wcag';

/**
 * SC 2.5.8 Target Size (Minimum), on every interactive element on every route.
 *
 * ACCESSIBILITY.md section 4 claims every target passes on its own size and
 * that the spacing exception is not relied on anywhere. This is what stands
 * behind that claim.
 *
 * The spacing exception is deliberately not implemented. SC 2.5.8 offers it:
 * an undersized target passes if a 24px circle centred on it does not
 * intersect another target's circle. Depending on it makes the gap between two
 * controls load-bearing for conformance, so an unrelated spacing change breaks
 * 2.5.8 silently and a long way from the edit. Measuring the target's own box
 * is the whole check.
 *
 * Two exceptions are implemented, because they are in the criterion itself:
 *
 *   Inline. A link inside a sentence is exempt, because the line it sits in
 *   determines its size and the author cannot enlarge it without breaking the
 *   paragraph. The prose links in a blog post, the 404 copy and the Contact
 *   standfirst rely on it. Detected structurally rather than by class: an
 *   element whose computed display is inline, in a container that has text of
 *   its own around it.
 *
 *   Not rendered. An element with a zero box is not a target. That covers the
 *   mobile menu's contents at desktop widths and the desktop nav below `md`,
 *   both display:none rather than merely offscreen.
 *
 * The skip link is not excluded. It is translated off the top of the viewport
 * rather than hidden, so it has a real box, and it is the first control a
 * keyboard user meets.
 *
 * Two widths, because the controls that change size are the ones at risk: the
 * nav collapses to the menu trigger below `md`, and the filter and pager wrap.
 * 305px is the real 400%-zoom width; 1280px is the desktop layout.
 */

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
     * The SC 2.5.8 inline exception: the element renders inline and the
     * container it sits in carries text of its own around it, which is what
     * "in a sentence or block of text" means. A link that is the only content
     * of its paragraph is not in a sentence and is not exempt.
     *
     * The ancestor walk is load-bearing. Reading `el.parentElement` once was a
     * defect: Markdown wraps a bold prose link, as in
     * `<li><strong><a>…</a></strong>, which give people…</li>`, so the
     * sentence is a sibling of the `strong` rather than of the `a`, and the
     * single-step version reported exempt links as failures.
     *
     * The walk climbs only while each ancestor is itself inline, which is the
     * run of formatting elements between the link and the line of text it sits
     * in. It stops at the first block container, so a link alone in its own
     * `li` or `p` still finds no text around it and stays subject to the
     * criterion.
     */
    const isInlineInText = (el: Element): boolean => {
      if (getComputedStyle(el).display !== 'inline') return false;

      for (
        let node: Element | null = el;
        node !== null;
        node = node.parentElement
      ) {
        const parent = node.parentElement;
        if (parent === null) return false;

        const around = [...parent.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => (n.textContent ?? '').trim())
          .join('');
        if (around !== '') return true;

        // Past the innermost block container there is no sentence to be in.
        if (getComputedStyle(parent).display !== 'inline') return false;
      }

      return false;
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
        const response = await gotoSettled(page, route);
        expect(response?.status(), `${route} should serve a 200`).toBe(200);

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
 * Without it the whole file passes on an empty list the moment the selector
 * breaks, or the inline exception is widened far enough to swallow
 * everything, and that looks exactly like a clean run.
 */
test('the target-size walk actually finds the controls on a page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoSettled(page, '/blog');

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
   * /blog carries the header, the skip link, the filter options, nine card
   * headings, a pager and the footer's links and profile tiles. The floor sits
   * well under that: this asserts the walk is not empty, not the exact shape
   * of the page.
   */
  expect(
    counted,
    'the target-size selector matched almost nothing on /blog, so a clean ' +
      'run above would mean the walk is broken rather than the page is fine',
  ).toBeGreaterThan(20);
});
