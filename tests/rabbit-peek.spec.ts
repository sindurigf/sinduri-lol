import { expect, test } from './test';
import { gotoSettled } from './settle';

/* 320 to 1280 wide, plus 400% zoom of a 1280x1024 window (SC 1.4.10). */
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 900 },
  { width: 320, height: 256 },
] as const;

/** CSS px: fractional boxes, so half a pixel of contact is not an overlap. */
const TOLERANCE = 0.5;

test.describe('the peeking rabbit', () => {
  for (const viewport of VIEWPORTS) {
    test(`covers no text or card at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoSettled(page, '/');
      const peek = page.locator('.rabbit-peek');
      await expect(peek).toHaveCount(1);
      await expect(peek).toBeVisible();

      const hits = await peek.evaluate((svg, tolerance) => {
        const box = svg.getBoundingClientRect();
        const overlaps = (r: DOMRect) =>
          Math.min(r.right, box.right) - Math.max(r.left, box.left) >
            tolerance &&
          Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top) > tolerance;
        const found: string[] = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = (node as Text).data.trim();
          if (!text || node.parentElement?.closest('.sr-only, script, style'))
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          if ([...range.getClientRects()].some(overlaps))
            found.push(text.slice(0, 40));
        }
        for (const card of document.querySelectorAll('.card'))
          if (overlaps(card.getBoundingClientRect())) found.push('a card');
        const section = svg.closest('section')!.getBoundingClientRect();
        if (box.bottom > section.bottom + tolerance)
          found.push('below its section');
        return found;
      }, TOLERANCE);

      expect(hits, 'the peeking rabbit covers content').toEqual([]);
    });
  }

  test('is hidden from assistive technology and never moves', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    const peek = page.locator('.rabbit-peek');
    await expect(peek).toHaveAttribute('aria-hidden', 'true');
    expect(
      await peek.evaluate((svg) => svg.getAnimations({ subtree: true }).length),
      'the peeking rabbit animates',
    ).toBe(0);
  });
});
