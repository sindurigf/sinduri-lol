import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from './routes';

/**
 * The gold surface exception.
 *
 * Every foreground token in this palette was chosen against #131313, #1A1A1A
 * and #0E0E0E. The Career hero uses `gold` as a *ground* rather than as an
 * accent, and measured against #FFC000 not one of those tokens passes: `text`
 * is 1.27, `muted` 1.03, `subtle` 1.31, `pinkText` 1.48, `border` 2.34, `pink`
 * 2.31, `cyan` 1.01. An inverted set lives in @theme and `.surface-gold` in
 * global.css applies it; the reasoning is in both places and in the design
 * system skill.
 *
 * WHAT THIS FILE IS FOR. The rule "do not use a dark-surface token on a gold
 * background" is not something the cascade can enforce, because an explicit
 * utility always beats a subtree default. So it is enforced by measurement,
 * from the rendered DOM, in three tests:
 *
 *   1. The documented ratios still hold. Reads the live CSS variables and
 *      re-measures each against gold. This fails if any token is retoned, in
 *      either direction, and it is what keeps the tables in AI.md,
 *      ACCESSIBILITY.md and the skill from going quietly out of date.
 *   2. Nothing on a real gold background is unreadable. Walks every built
 *      route, resolves each element's *effective* background through
 *      transparent ancestors, and checks the text colour of anything sitting
 *      on #FFC000.
 *   3. `.surface-gold` supplies the inverted set. A fixture mounted into a
 *      real built page, because no page uses the class yet.
 *
 * ON TEST 3 BEING A FIXTURE. It is a weaker test than one driven by real
 * markup and it is deliberate: the class has to be right *before* the Career
 * page is written against it, which is the whole reason this session exists.
 * Delete the fixture and point this at the real section once that page ships.
 *
 * Test 2 is not vacuous today even though no gold section exists: `.skip-link`,
 * `.btn-primary` on /404, the header logo tile and the 404 mark tile are all
 * gold grounds with a foreground on them, and they are what it walks now.
 * Measured: `/` finds one element (`.skip-link`, 11.32:1) and `/404` finds two
 * (`.skip-link` and `.btn-primary`, both 11.32:1).
 *
 * VERIFIED NOT TO BE VACUOUS. Each assertion was broken on purpose and the
 * failure checked:
 *
 *   change `.skip-link` to `text-muted`      test 2 fails on all 12 routes,
 *                                            reporting 1.03:1
 *   delete the `.surface-gold a` rule        test 3 fails at 1.00:1
 *   delete only its `text-decoration`        test 3 fails on the underline
 *   delete `.surface-gold :focus-visible`    test 3 fails on the focus ring
 *   delete the border re-default             test 3 fails at 2.34:1
 *   retone gold-border to #2C4A63 (5.64)     test 1 fails on the drift
 *
 * With the files as committed, all 14 pass.
 */

const GOLD = '#FFC000';

/** WCAG thresholds. Body text, and non-text boundaries under SC 1.4.11. */
const AA_TEXT = 4.5;
const AAA_TEXT = 7;
const NON_TEXT = 3;

/**
 * The measured table, as it appears in the docs. Keyed by CSS custom property.
 * `expected` is the ratio against #FFC000; `floor` is the threshold that
 * applies to the token's job on *this* surface, or null where the token has no
 * job here and is listed only to pin the number the docs quote.
 */
const RATIOS: ReadonlyArray<{
  variable: string;
  expected: number;
  floor: number | null;
}> = [
  // The inverted set. These have a job on gold and must clear it.
  { variable: '--color-gold-text', expected: 11.32, floor: AAA_TEXT },
  { variable: '--color-gold-muted', expected: 7.88, floor: AAA_TEXT },
  { variable: '--color-gold-border', expected: 7.27, floor: NON_TEXT },
  { variable: '--color-darkcyan', expected: 8.0, floor: AAA_TEXT },
  // The dark set. Listed to pin the numbers the docs quote as the reason the
  // exception exists. No floor: on this surface they have no job at all.
  { variable: '--color-text', expected: 1.27, floor: null },
  { variable: '--color-muted', expected: 1.03, floor: null },
  { variable: '--color-subtle', expected: 1.31, floor: null },
  { variable: '--color-pink-text', expected: 1.48, floor: null },
  { variable: '--color-border', expected: 2.34, floor: null },
  { variable: '--color-pink', expected: 2.31, floor: null },
  { variable: '--color-cyan', expected: 1.01, floor: null },
];

/**
 * Everything below runs in the page, so the contrast maths is installed there
 * rather than marshalled back and forth. Colours come out of
 * `getComputedStyle` as `rgb()` / `rgba()`, which is why this parses that
 * rather than hex.
 */
const PAGE_HELPERS = `
  const parse = (value) => {
    const m = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  const fromHex = (hex) => {
    const h = hex.trim().replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  };

  const channel = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const luminance = (c) =>
    0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  /*
   * The effective background of an element: its own, or the nearest ancestor
   * with a non-transparent one. Returns null rather than guessing when an
   * image or gradient is in the way, or when a partly transparent layer would
   * make the answer a composite rather than a colour.
   */
  const effectiveBackground = (element) => {
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null;
      const colour = parse(style.backgroundColor);
      if (!colour) return null;
      if (colour.a === 0) continue;
      if (colour.a < 1) return null;
      return colour;
    }
    return null;
  };

  const isGold = (colour) =>
    colour !== null && colour.r === 255 && colour.g === 192 && colour.b === 0;

  const describe = (element) => {
    const id = element.id ? '#' + element.id : '';
    const cls = element.className && typeof element.className === 'string'
      ? '.' + element.className.trim().split(/\\s+/).join('.')
      : '';
    return element.tagName.toLowerCase() + id + cls;
  };

  const hasOwnText = (element) =>
    [...element.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
    );
`;

/** Every element whose own text sits directly on a gold background. */
const textOnGold = (page: Page) =>
  page.evaluate(`(() => {
    ${PAGE_HELPERS}
    const out = [];
    for (const element of document.querySelectorAll('*')) {
      if (!hasOwnText(element)) continue;
      const background = effectiveBackground(element);
      if (!isGold(background)) continue;
      const colour = parse(getComputedStyle(element).color);
      if (!colour) continue;
      out.push({
        selector: describe(element),
        colour: getComputedStyle(element).color,
        ratio: Number(ratio(colour, background).toFixed(2)),
        text: (element.textContent ?? '').trim().slice(0, 40),
      });
    }
    return out;
  })()`) as Promise<
    { selector: string; colour: string; ratio: number; text: string }[]
  >;

test.describe('the gold surface exception', () => {
  test('the documented ratios against #FFC000 still hold', async ({ page }) => {
    await page.goto('/');

    const measured = (await page.evaluate(
      `(([gold, variables]) => {
        ${PAGE_HELPERS}
        const root = getComputedStyle(document.documentElement);
        const ground = fromHex(gold);
        return variables.map((variable) => {
          const value = root.getPropertyValue(variable).trim();
          const colour = value.startsWith('#') ? fromHex(value) : parse(value);
          return {
            variable,
            value,
            ratio: colour === null ? null : Number(ratio(colour, ground).toFixed(2)),
          };
        });
      })(${JSON.stringify([GOLD, RATIOS.map((r) => r.variable)])})`,
    )) as { variable: string; value: string; ratio: number | null }[];

    for (const [index, row] of measured.entries()) {
      const documented = RATIOS[index];

      expect(
        row.value,
        `${row.variable} is not defined in the @theme block`,
      ).not.toBe('');

      expect(
        row.ratio,
        `${row.variable} is ${row.value}, which measures ${row.ratio} against ` +
          `${GOLD}. The docs say ${documented.expected}. Every gold-surface ` +
          `table in AI.md, ACCESSIBILITY.md and the design system skill quotes ` +
          `that number; re-measure and update all of them in this commit.`,
      ).toBeCloseTo(documented.expected, 1);

      if (documented.floor !== null) {
        expect(
          row.ratio,
          `${row.variable} has a job on the gold surface and must clear ` +
            `${documented.floor}:1 against ${GOLD}`,
        ).toBeGreaterThanOrEqual(documented.floor);
      }
    }
  });

  for (const route of ROUTES) {
    test(`no text on a gold background is unreadable on ${route}`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'networkidle' });

      const found = await textOnGold(page);

      /*
       * Proves this route was actually walked rather than matching nothing.
       * `.skip-link` is `bg-gold` with text on it and it is the first
       * focusable element on every page, so the floor is one on every route;
       * /404 also has `.btn-primary`. Without this guard the assertion below
       * would pass on an empty list forever if the background resolver broke.
       */
      expect(
        found.length,
        `no element with text on a gold ground was found on ${route}. Every ` +
          `route has .skip-link, so this means the background resolver in ` +
          `this file stopped matching, not that the page is clean.`,
      ).toBeGreaterThan(0);

      const failing = found.filter((entry) => entry.ratio < AA_TEXT);

      expect(
        failing,
        `text sitting on ${GOLD} below ${AA_TEXT}:1 (SC 1.4.3). A dark-surface ` +
          `token has been used on a gold ground; the inverted set is ` +
          `gold-text / gold-muted / gold-border, applied by .surface-gold:\n` +
          failing
            .map(
              (e) =>
                `  ${e.selector}\n    color ${e.colour} at ${e.ratio}:1 — "${e.text}"`,
            )
            .join('\n'),
      ).toEqual([]);
    });
  }

  /**
   * The class contract. Mounted rather than found, because no page uses it
   * yet; see the note at the top of this file.
   */
  test('.surface-gold supplies the inverted set', async ({ page }) => {
    await page.goto('/');

    const result = (await page.evaluate(`(() => {
      ${PAGE_HELPERS}

      const host = document.createElement('div');
      host.className = 'surface-gold';
      /*
       * Inline styles, not utilities. Tailwind only emits a utility it finds
       * in a scanned source, and no page uses text-gold-muted yet, so a
       * class here would test whether Tailwind scans this file rather than
       * whether the token is right. The class under test, .surface-gold, is
       * authored CSS in @layer components and is always emitted.
       */
      host.innerHTML =
        '<p data-role="body">Body copy</p>' +
        '<p data-role="muted" style="color: var(--color-gold-muted)">Secondary copy</p>' +
        '<a data-role="link" href="/">A link</a>' +
        '<div data-role="bordered" style="border-width:8px;border-style:solid">Bordered box</div>';
      document.querySelector('main').append(host);

      const pick = (role) => host.querySelector('[data-role="' + role + '"]');
      const ground = effectiveBackground(pick('body'));

      const link = pick('link');
      link.focus();
      const linkStyle = getComputedStyle(link);

      const against = (colour) => {
        const parsed = parse(colour);
        return parsed === null ? null : Number(ratio(parsed, ground).toFixed(2));
      };

      const readout = {
        groundIsGold: isGold(ground),
        ground: getComputedStyle(pick('body')).backgroundColor,
        body: against(getComputedStyle(pick('body')).color),
        muted: against(getComputedStyle(pick('muted')).color),
        link: against(linkStyle.color),
        linkUnderline: linkStyle.textDecorationLine,
        linkVsBody: (() => {
          const a = parse(linkStyle.color);
          const b = parse(getComputedStyle(pick('body')).color);
          return a && b ? Number(ratio(a, b).toFixed(2)) : null;
        })(),
        outline: against(linkStyle.outlineColor),
        bordered: against(getComputedStyle(pick('bordered')).borderTopColor),
      };

      host.remove();
      return readout;
    })()`)) as {
      groundIsGold: boolean;
      ground: string;
      body: number | null;
      muted: number | null;
      link: number | null;
      linkUnderline: string;
      linkVsBody: number | null;
      outline: number | null;
      bordered: number | null;
    };

    expect(
      result.groundIsGold,
      `.surface-gold did not paint ${GOLD}; it resolved to ${result.ground}`,
    ).toBe(true);

    expect(result.body, 'body copy on .surface-gold').toBeGreaterThanOrEqual(
      AAA_TEXT,
    );
    expect(
      result.muted,
      'text-gold-muted on .surface-gold',
    ).toBeGreaterThanOrEqual(AAA_TEXT);

    expect(
      result.link,
      'links on .surface-gold. The base layer paints every <a> gold, which is ' +
        '1.00 on this ground, so the override in .surface-gold is the only ' +
        'thing making them visible.',
    ).toBeGreaterThanOrEqual(AAA_TEXT);

    /*
     * The link colour is only 1.42 against the body colour, far under the 3:1
     * that would let colour carry the distinction on its own, so SC 1.4.1
     * needs the underline. Asserted rather than trusted because removing it is
     * a one-word edit that changes nothing visible to whoever makes it.
     */
    expect(
      result.linkVsBody,
      'link colour versus body colour on .surface-gold',
    ).toBeLessThan(NON_TEXT);
    expect(
      result.linkUnderline,
      'links on .surface-gold must be underlined: their colour alone does not ' +
        'distinguish them from body copy (SC 1.4.1)',
    ).toContain('underline');

    expect(
      result.outline,
      'the focus ring on .surface-gold. The site-wide ring is gold, 1.00 on ' +
        'this ground, and the 3px offset does not save it here the way it does ' +
        'on a dark page: the offset gap is gold too.',
    ).toBeGreaterThanOrEqual(NON_TEXT);

    expect(
      result.bordered,
      'the default border colour inside .surface-gold (SC 1.4.11). The base ' +
        'layer defaults every border to `border` #5A87A8, which is 2.34 on ' +
        'gold; .surface-gold has to re-default the subtree.',
    ).toBeGreaterThanOrEqual(NON_TEXT);
  });
});
