import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from './routes';

/**
 * SC 1.4.10 Reflow: content must not require scrolling in two directions at a
 * 320px viewport (1280px at 400% zoom). SC 1.4.12 Text Spacing: the same has to
 * hold once a user overrides line height, letter spacing, and word spacing.
 *
 * The failure this guards against is a single long word in an uppercased
 * heading. Nothing wraps it, so it paints past the content box and the whole
 * document scrolls sideways. Three rules in global.css prevent it; this asserts
 * the outcome rather than the rules, so any future heading, token, or layout
 * change that reintroduces the overflow fails here.
 *
 * TWO WIDTHS, BECAUSE HEADLESS LIES ABOUT ONE OF THEM. A 320px CSS viewport is
 * what SC 1.4.10 asks for, but what the page actually gets depends on the
 * scrollbar. Headless Chromium overlays its scrollbar, so a 320px viewport
 * gives a 320px layout box. Headed Chrome 152 and Chromium 151 draw a classic
 * 15px scrollbar and give 305px, and that is what a desktop user at 400% zoom
 * gets. Running only 320px makes this suite permanently 15px more forgiving
 * than reality, which is a gap that has to be remembered rather than one the
 * suite closes.
 *
 * So 305px runs as a fixed viewport width alongside it. It is not a second
 * device; it is the same requirement measured without the 15px the headless
 * browser hands back. The heading floors are calibrated against the 273px
 * content box it leaves, so this is the case that actually exercises them.
 */
const REFLOW_HEIGHT = 720;

const REFLOW_WIDTHS = [
  {
    width: 320,
    contentBox: 288,
    note: 'overlay scrollbar, what headless gives',
  },
  {
    width: 305,
    contentBox: 273,
    note: 'classic 15px scrollbar, what a real browser gives',
  },
] as const;

/** The override from WCAG SC 1.4.12, applied verbatim. */
const TEXT_SPACING_OVERRIDE = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p, li, h1, h2, h3, h4, h5, h6 { margin-bottom: 2em !important; }
`;

/**
 * Names the element that overflows, so a failure says which heading broke
 * rather than only that the document is 40px too wide.
 */
const overflowReport = async (page: Page): Promise<string> => {
  const offenders = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('body, body *')) {
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 0.5) {
        const text = (el.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 48);
        out.push(
          `${el.tagName.toLowerCase()}: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}: "${text}"`,
        );
      }
    }
    return out;
  });

  return offenders.length ? `\n  ${offenders.join('\n  ')}` : '';
};

/**
 * The content box the heading floors were calibrated against. Asserting it
 * here is what stops the floors and the box drifting apart silently: a gutter
 * added to a page container, or removed from `.page-gutter`, changes this
 * number and fails on the width rather than waiting for a heading long enough
 * to overflow the new box.
 */
const expectContentBox = async (
  page: Page,
  route: string,
  expected: number,
): Promise<void> => {
  const measured = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return null;
    const style = getComputedStyle(main);
    return (
      main.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight)
    );
  });

  expect(measured, `${route} has no <main> to measure`).not.toBeNull();
  expect(
    measured,
    `${route} content box is ${measured}px, not the ${expected}px the ` +
      `heading floors in global.css are calibrated against`,
  ).toBe(expected);
};

/**
 * No heading word is wider than the box it sits in.
 *
 * This is the assertion the heading floors actually need, and the suite did
 * not have it. `expectNoHorizontalOverflow` cannot fail on a floor that is
 * too high, because `overflow-wrap: break-word` in the base layer guarantees
 * the document never scrolls sideways: an oversized word is silently cut
 * mid-word instead, with no hyphen.
 *
 * Re-measured on 2026-09-05 with `--text-h1` put back to a 36px floor: all 92
 * overflow assertions still passed, and the only two failures anywhere in the
 * run were this heading-word-fit assertion, on /blog/professional-journey and
 * /blog/quis-nostrud-exercitation-ullamco at 305px, reporting `"exercitation"
 * is 277.41px in a 273.00px box`. So the floors were documented as locked down
 * by a test that could not see them.
 *
 * UNIT: overflow assertions, meaning calls to `expectNoHorizontalOverflow`,
 * which is one per route per width per spacing mode in this file. This figure
 * used to read "69", which was not that: 69 was the size of the entire suite
 * at the commit that wrote it, where the overflow assertions numbered 44. A
 * count in a comment states what it counts and when it was taken, or it is
 * worse than no count.
 *
 * This measures each heading word at its own max-content width and compares
 * it to the heading's content box, which is exactly the arithmetic in the
 * @theme comment in global.css, run against the real render rather than a
 * table. Words are split on the soft hyphen too, since an author-placed
 * U+00AD is a legitimate break point; each leading segment is measured with
 * the hyphen glyph the break would draw.
 */
const SOFT_HYPHEN = '\u00AD';

const expectHeadingWordsFit = async (
  page: Page,
  route: string,
): Promise<void> => {
  const tooWide = await page.evaluate((softHyphen) => {
    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'nowrap';
    probe.style.width = 'max-content';
    document.body.appendChild(probe);

    const out: string[] = [];

    for (const heading of document.querySelectorAll('h1, h2, h3')) {
      const style = getComputedStyle(heading);
      const box =
        heading.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      if (box <= 0) continue;

      probe.style.font = style.font;
      probe.style.letterSpacing = style.letterSpacing;
      probe.style.textTransform = style.textTransform;
      probe.style.fontWeight = style.fontWeight;

      for (const word of (heading.textContent ?? '').split(/\s+/)) {
        if (!word) continue;
        const segments = word.split(softHyphen);
        segments.forEach((segment, i) => {
          if (!segment) return;
          // A break at a soft hyphen paints a hyphen on the leading segment.
          probe.textContent = i < segments.length - 1 ? `${segment}-` : segment;
          const width = probe.getBoundingClientRect().width;
          if (width > box + 0.5) {
            out.push(
              `${heading.tagName.toLowerCase()} at ${style.fontSize}: ` +
                `"${probe.textContent}" is ${width.toFixed(2)}px in a ` +
                `${box.toFixed(2)}px box`,
            );
          }
        });
      }
    }

    probe.remove();
    return out;
  }, SOFT_HYPHEN);

  expect(
    tooWide,
    `${route} has a heading word wider than its box, so overflow-wrap: ` +
      `break-word is cutting it mid-word with no hyphen. Lower the floor in ` +
      `global.css or give the word a soft hyphen:\n  ${tooWide.join('\n  ')}`,
  ).toEqual([]);
};

const expectNoHorizontalOverflow = async (
  page: Page,
  route: string,
  viewportWidth: number,
  applySpacingOverride: boolean,
): Promise<void> => {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.status(), `${route} should serve a 200`).toBe(200);

  if (applySpacingOverride) {
    await page.addStyleTag({ content: TEXT_SPACING_OVERRIDE });
  }

  // Headings are the thing at risk, so measure only after the webfont swaps in.
  await page.evaluate(() => document.fonts.ready);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    scrollWidth,
    `${route} scrolls horizontally at ${viewportWidth}px: ` +
      `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}` +
      (await overflowReport(page)),
  ).toBeLessThanOrEqual(clientWidth);
};

for (const { width, contentBox, note } of REFLOW_WIDTHS) {
  test.describe(`reflow at ${width}px (${contentBox}px content box, ${note})`, () => {
    test.use({ viewport: { width, height: REFLOW_HEIGHT } });

    for (const route of ROUTES) {
      test(`${route} does not scroll sideways`, async ({ page }) => {
        await expectNoHorizontalOverflow(page, route, width, false);
        await expectContentBox(page, route, contentBox);
        await expectHeadingWordsFit(page, route);
      });
    }
  });

  test.describe(`reflow at ${width}px with the SC 1.4.12 text-spacing override`, () => {
    test.use({ viewport: { width, height: REFLOW_HEIGHT } });

    for (const route of ROUTES) {
      test(`${route} does not scroll sideways`, async ({ page }) => {
        await expectNoHorizontalOverflow(page, route, width, true);
      });
    }
  });
}
