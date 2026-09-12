import { expect, test, type Page } from '@playwright/test';
import { gotoSettled } from './settle';
import { ROUTES } from './routes';

/*
 * `bypassCSP` because the adapter makes `astro preview` serve through the
 * Worker, so `_headers` and its `style-src` now apply in preview where they
 * did not before, and `addStyleTag` below is blocked.
 *
 * It does not weaken what this file checks. A real text-spacing override comes
 * from a user stylesheet, which CSP does not govern, so injecting one past the
 * policy is the faithful emulation. tests/headers.spec.ts is what asserts the
 * policy itself, under its own server, and it does not bypass anything.
 */
test.use({ bypassCSP: true });

/**
 * SC 1.4.10 Reflow: content must not require scrolling in two directions at a
 * 320px viewport (1280px at 400% zoom). SC 1.4.12 Text Spacing: the same has to
 * hold once a user overrides line height, letter spacing, and word spacing.
 *
 * The failure this guards against is a single long word in an uppercased
 * heading. Nothing wraps it, so it paints past the content box and the whole
 * document scrolls sideways. Three rules in global.css prevent it; this
 * asserts the outcome rather than the rules, so any heading, token or layout
 * change that reintroduces the overflow fails here.
 *
 * Two widths, because headless lies about one of them. Headless Chromium
 * overlays its scrollbar, so a 320px viewport gives a 320px layout box. A
 * headed browser draws a classic 15px scrollbar and gives 305px, which is what
 * a desktop user at 400% zoom gets. Running only 320px would make this suite
 * permanently 15px more forgiving than reality. The heading floors are
 * calibrated against the 273px content box 305px leaves, so that is the case
 * that exercises them.
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
 * Widths above the reflow floor where the page must not scroll sideways
 * either. SC 1.4.10 is measured at 320px, and a horizontal scrollbar at a
 * wider width is the same defect for everyone else. The 2026-09-11 audit found
 * /about 8px too wide at every width from 640px up, and the homepage at 640px,
 * while nothing here looked above 320px. 640px is where `sm` changes the
 * gutter; 1280px is where the column stops growing.
 *
 * Proven able to fail, 2026-09-11: with the About roundel put back to
 * `sm:-right-8`, exactly `/` and `/about` failed at 640px, each "scrolls
 * horizontally at 640px: scrollWidth 648 > clientWidth 640".
 */
const WIDE_WIDTHS = [640, 1280] as const;

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
 * stops the floors and the box drifting apart silently: a gutter added to a
 * page container, or removed from `.page-gutter`, fails here rather than
 * waiting for a heading long enough to overflow the new box.
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
 * The assertion the heading floors need. `expectNoHorizontalOverflow` cannot
 * fail on a floor that is too high, because `overflow-wrap: break-word` in the
 * base layer guarantees the document never scrolls sideways: an oversized word
 * is cut mid-word instead, with no hyphen.
 *
 * Proven able to fail, 2026-09-05: with `--text-h1` put back to a 36px floor,
 * all 92 overflow assertions (calls to `expectNoHorizontalOverflow`, one per
 * route per width per spacing mode) still passed, and the only failures in the
 * run were this assertion on two posts at 305px, `"exercitation" is 277.41px
 * in a 273.00px box`.
 *
 * It measures each heading word at its own max-content width against the
 * heading's content box, which is the arithmetic in the @theme comment in
 * global.css run against the real render. Words are split on the soft hyphen
 * too, since an author-placed U+00AD is a legitimate break point; each leading
 * segment is measured with the hyphen glyph the break would draw.
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
  const response = await gotoSettled(page, route);
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

/**
 * No table cell's text runs out of its cell.
 *
 * Under the text-spacing override a long word in a fixed-layout table can
 * spill across the cell border into the next column without the page itself
 * scrolling, so the document-level check above cannot see it. Found by the
 * 2026-09-11 audit on the real post at 320px.
 *
 * Proven able to fail, 2026-09-11: with `wrap-anywhere` taken off the cells,
 * that post failed at 320px and 305px in chromium and firefox, naming
 * "Communicate the why" (scrollWidth 154 in a 138px cell at 320px) and
 * "Concentrate decisions".
 */
const expectCellsHoldTheirText = async (
  page: Page,
  route: string,
): Promise<void> => {
  const spilled = await page.evaluate(() =>
    [...document.querySelectorAll('.prose :is(th, td)')]
      .filter((cell) => cell.scrollWidth > cell.clientWidth + 0.5)
      .map(
        (cell) =>
          `"${(cell.textContent ?? '').trim().slice(0, 40)}": scrollWidth ` +
          `${cell.scrollWidth} > clientWidth ${cell.clientWidth}`,
      ),
  );
  expect(
    spilled,
    `${route} has table text running out of its cell:\n  ${spilled.join('\n  ')}`,
  ).toEqual([]);
};

for (const width of WIDE_WIDTHS) {
  test.describe(`no sideways scroll at ${width}px`, () => {
    test.use({ viewport: { width, height: REFLOW_HEIGHT } });

    for (const route of ROUTES) {
      test(`${route} does not scroll sideways at ${width}px`, async ({
        page,
      }) => {
        await expectNoHorizontalOverflow(page, route, width, false);
      });
    }
  });
}

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
        await expectCellsHoldTheirText(page, route);
      });
    }
  });
}
