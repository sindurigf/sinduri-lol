import { expect, test } from './test';
import { ROUTES } from './routes';
import { gotoSettled } from './settle';

/**
 * A heading's size says its level. One h1, no skipped level, nothing at label
 * size, and inside a post each level a clear step below the one above it.
 *
 * The floor is the smallest heading token, --text-post-h3 at 19px: anything
 * smaller reads as a label, and a label is not a heading. "In this post" and
 * "Tags" were h2s at the 14px label size, and a post's h3 was 32px under a
 * 36px h2.
 *
 * Proven able to fail, 2026-09-19, chromium: against the previous markup,
 * /blog/five-years-in-drupal failed "In this post: h2 at 14px" and
 * /blog/open-source-is-not-just-code failed "1. Governance: h3 at 32px is not
 * a step under its h2 at 36px".
 */
const HEADING_FLOOR = 19;
const STEP = 0.8;

for (const route of ROUTES) {
  test(`${route} has a heading outline that matches its sizes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoSettled(page, route);
    const headings = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter((h) => !h.closest('dialog, [hidden]'))
        .map((h) => ({
          level: Number(h.tagName[1]),
          text: (h.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
          size: parseFloat(getComputedStyle(h).fontSize),
          inPost: h.closest('.post-layout .prose') !== null,
        })),
    );

    const problems: string[] = [];
    if (headings.filter((h) => h.level === 1).length !== 1) {
      problems.push('not exactly one h1');
    }
    headings.forEach((h, i) => {
      const prev = headings[i - 1];
      if (prev && h.level > prev.level + 1) {
        problems.push(`${h.text}: h${h.level} after h${prev.level}`);
      }
      if (h.size < HEADING_FLOOR) {
        problems.push(`${h.text}: h${h.level} at ${h.size}px`);
      }
      if (h.inPost && h.level > 2) {
        const parent = headings
          .slice(0, i)
          .reverse()
          .find((p) => p.level === h.level - 1);
        if (parent && h.size > parent.size * STEP) {
          problems.push(
            `${h.text}: h${h.level} at ${h.size}px is not a step under its h${parent.level} at ${parent.size}px`,
          );
        }
      }
    });
    expect(problems).toEqual([]);
  });
}
