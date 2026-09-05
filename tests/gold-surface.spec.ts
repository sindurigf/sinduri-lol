import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { AAA_TEXT, AA_TEXT, NON_TEXT, PAGE_HELPERS } from './contrast';
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
 * from the rendered DOM:
 *
 *   1. The documented ratios still hold. Reads the live CSS variables and
 *      re-measures each against gold. This fails if any token is retoned, in
 *      either direction, and it is what keeps the tables in AI.md,
 *      ACCESSIBILITY.md and the skill from going quietly out of date.
 *   2. Nothing on a gold background is unreadable, on every built route.
 *      Resolves each element's *effective* background through transparent
 *      ancestors and checks the text colour of anything sitting on #FFC000.
 *   3. `.surface-gold` supplies the inverted set, on a mounted fixture.
 *   4. Every control in a gold section is delimited against the ground — by
 *      its opaque fill, or, when the fill is transparent, by its border. Also
 *      a fixture; see `invisibleControls` for why it is two arms.
 *   5. `.btn-gold-primary` keeps a visible focus ring whatever the offset
 *      does. Its ring colour is its own fill colour, so the ring is two rings.
 *   6. THE REAL ROUTE. `/career` renders the only `.surface-gold` section on
 *      the site, and it is measured at 305px and 320px: both buttons' focus
 *      indicators in situ, their target sizes, every string on the gold
 *      ground, the content box, and whether the watermark scrolls the page.
 *
 * ON 3, 4 AND 5 STILL BEING FIXTURES NOW THAT 6 EXISTS. They are kept rather
 * than replaced, and the pair is deliberate. A fixture can be broken on
 * purpose to prove an assertion still bites without editing a shipped route,
 * and it keeps the class honest for the next page written against it — which
 * is the situation this file was originally written for. Only test 6 can fail
 * on a mistake made in career.astro: a `text-muted` written inside the
 * section, `.btn-primary` reached for out of habit, the watermark taken out of
 * its clip. Neither covers the other.
 *
 * Test 2 was never vacuous even before a gold section existed: `.skip-link`,
 * `.btn-primary` on /404, the header logo tile and the 404 mark tile are all
 * gold grounds with a foreground on them. Its companion — the invisible-control
 * walk it carries — WAS vacuous on every route, because it short-circuits when
 * a page has no gold section, so every route in `GOLD_ROUTES` is now asserted
 * to have one with the expected number of controls in it.
 *
 * VERIFIED NOT TO BE VACUOUS. Each assertion was broken on purpose and the
 * failure checked:
 *
 *   change `.skip-link` to `text-muted`      test 2 fails on every route,
 *                                            reporting 1.03:1
 *   delete the `.surface-gold a` rule        test 3 fails at 1.00:1
 *   delete only its `text-decoration`        test 3 fails on the underline
 *   delete `.surface-gold :focus-visible`    test 3 fails on the focus ring
 *   delete the border re-default             test 3 fails at 2.34:1
 *   retone gold-border to #2C4A63 (5.64)     test 1 fails on the drift
 *
 * The button test was checked the same way, nine breakages, each caught by the
 * assertion meant for it:
 *
 *   primary label -> gold-muted             1.55 on the #131313 fill
 *   primary border -> gold-border           the "correction" the docs warn of
 *   primary fill -> gold                    the .btn-primary mistake
 *   py-0 on either button                   23.6px tall, under SC 2.5.8
 *   outline-offset: 0 on .surface-gold      ring invisible against the fill
 *   delete the text-decoration: none rule   underlined button label
 *   secondary given a fill                  label no longer measured on gold
 *   secondary border removed                nothing delimits it
 *   delete .surface-gold :focus-visible     ring back to gold, 1.00
 *
 * The invisible-control check's FILL arm was verified against a real page
 * rather than a fixture: a temporary route with a .surface-gold hero was
 * built, added to ROUTES, and run both ways. With .btn-gold-primary it passed;
 * with .btn-primary swapped in it failed, reporting
 * `a.btn-primary — fill rgb(255, 192, 0) on rgb(255, 192, 0)`. The same page
 * in the same state returned "No accessibility violations found" from
 * AccessLint with AAA enabled, which is the whole reason this check exists.
 *
 * Its BORDER arm was verified the same way, on the fixture in test 4, twice:
 *
 *   secondary border -> border-gold      all four edges reported,
 *                                        `border-top/right/bottom/left
 *                                        rgb(255, 192, 0) on rgb(255, 192, 0)
 *                                        at 1.00:1, needs 3`
 *   secondary border-bottom-color only   `border-bottom rgb(255, 192, 0) …`
 *
 * THE SECOND BREAKAGE IS WHY ALL FOUR EDGES ARE TESTED RATHER THAN ONE. With
 * only the bottom edge painted gold, every other assertion in this file
 * passed, the button test included: its `borderOnGold` reads borderTopColor
 * and the top edge was still #131313. Test 4 was the only thing that failed.
 *
 * The two-tone ring in test 5 was verified two ways, and the pair of results
 * is the whole point of that phase:
 *
 *   delete .btn-gold-primary:focus-visible   test 5 fails on its first
 *                                            assertion, reporting
 *                                            `outline rgb(19, 19, 19) —
 *                                            1.00:1` at zero offset. That is
 *                                            the state this file was in
 *                                            before the inner ring existed.
 *   outline-offset: 0 on .surface-gold       the button test's offset
 *                                            assertion fails, and TEST 5
 *                                            PASSES, because the inner ring
 *                                            is still 18.58 against the fill.
 *
 * The second result is what "the offset assertion is now redundant rather
 * than load-bearing" means, measured rather than asserted in prose.
 *
 * TWO WAYS TEST 6 CAN LIE, BOTH FOUND WHILE WRITING IT AND BOTH GUARDED IN THE
 * CODE. `getComputedStyle` returns a LIVE declaration, so a value read after
 * the element is blurred is the resting value: the first version reported
 * `outline-offset: 0` on a button whose offset is 3px. And
 * `document.activeElement === el` evaluated in the returned object literal is
 * evaluated after the blur, which reported that a focused button had not taken
 * focus. Both are read into plain numbers while the element still has focus.
 */

const GOLD = '#FFC000';

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
 * One control that is invisible as a shape against the ground behind it,
 * whether because its opaque fill matches that ground or because the border
 * that is its only boundary does.
 */
type InvisibleControl = { selector: string; detail: string; label: string };

const invisibleControlMessage = (found: InvisibleControl[]) =>
  `a control inside .surface-gold is invisible as a shape against the ground ` +
  `behind it, however well its label contrasts. Either its opaque fill is the ` +
  `same colour as the ground (.btn-primary is bg-gold and does exactly this; ` +
  `use .btn-gold-primary), or its fill is transparent and the border that is ` +
  `its only boundary is under ${NON_TEXT}:1 against the ground (SC 1.4.11) — ` +
  `which is .btn-gold-secondary's failure mode, and just as invisible:\n` +
  found.map((e) => `  ${e.selector} — ${e.detail} — "${e.label}"`).join('\n');

/**
 * The route that renders a real `.surface-gold` section, and how many controls
 * it puts on that ground.
 *
 * Both halves are asserted. The route-level invisible-control check below
 * short-circuits to an empty list when a page has no gold section, which was
 * correct while none existed and is a trap now that one does: if the Career
 * hero lost the class, or the two buttons were swapped for something else,
 * every route would keep returning `[]` and the check would go quietly
 * vacuous rather than fail. This is the guard against that.
 */
/**
 * The routes that render a `.surface-gold` section, and how many controls each
 * puts on the gold ground.
 *
 * A map rather than the single `GOLD_ROUTE` this used to be. /career was the
 * only such route for as long as only one page used the class; /contact now
 * ends with a gold band too, and a constant naming one route would have gone
 * quietly out of date while every assertion kept passing — the non-vacuity
 * guard below only fires on routes named here, so an unnamed gold route is
 * simply not guarded.
 *
 * `goldRoutesFromBuild` checks these keys against the built HTML, so adding a
 * gold section without adding it here fails rather than going unwatched.
 */
const GOLD_ROUTES: Record<string, number> = {
  '/career': 2,
  '/contact': 1,
};

/** The route the reflow checks at the bottom of this file use. */
const GOLD_ROUTE = '/career';

/**
 * Routes whose built HTML contains a `.surface-gold` section.
 *
 * Derived from `dist/` rather than trusted from the literal above, which is
 * the same guard `islandRoutesFromBuild` in tests/routes.ts applies to island
 * routes and for the same reason: a literal listing a subset of routes keeps
 * passing when a new one appears, and the new one has no coverage at all.
 */
const goldRoutesFromBuild = (): string[] =>
  ROUTES.filter((route) => {
    const file =
      route === '/'
        ? 'dist/index.html'
        : route === '/404'
          ? 'dist/404.html'
          : `dist${route}/index.html`;

    try {
      return /class="[^"]*\bsurface-gold\b/.test(readFileSync(file, 'utf8'));
    } catch {
      return false;
    }
  });

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

/**
 * THE PROSE COPIES OF THE TABLE ABOVE, AND WHY THEY ARE CHECKED HERE.
 *
 * The same token/hex/ratio table is written out in three Markdown files. Three
 * copies is three chances to retone a colour in the CSS and update two of them,
 * and nothing about the third going stale is visible: it is a number in a
 * sentence that still reads correctly. The failure this repo has already had
 * once, in a different form, is a documented fact that no longer described the
 * code.
 *
 * There is exactly one enforced source of truth and it is not this file's
 * RATIOS array — it is the live CSS custom properties, which RATIOS is itself
 * measured against by the test below. So the Markdown is checked the same way:
 * read the variable out of the running page, measure it against #FFC000, and
 * require every documented row to agree on both the hex and the ratio.
 *
 * Every table keyed "on `#FFC000`" is covered, not only the gold inverted set:
 * the dark-set tables in ACCESSIBILITY.md and the design system skill quote
 * the failing ratios that are the whole justification for the exception, and
 * they are duplicated across two files just as readily.
 *
 * `pinkText` in ACCESSIBILITY.md is camelCase where the CSS variable is
 * `--color-pink-text`; the token name is normalised rather than the document
 * being made to match, because both spellings appear in the comps.
 */
const GOLD_TABLE_DOCS = [
  'AI.md',
  'ACCESSIBILITY.md',
  '.claude/skills/sinduri-design-system/SKILL.md',
] as const;

interface DocumentedRatio {
  doc: string;
  line: number;
  token: string;
  variable: string;
  hex: string;
  ratio: number;
}

/**
 * `#fff` and `#FFFFFF` are the same colour, and which one comes back is not a
 * fact about this project: the browser returns a custom property in whatever
 * form the CSS pipeline left it in, and Tailwind shortens where it can. Compare
 * the colours, not the spellings.
 */
const normaliseHex = (value: string): string => {
  const hex = value.trim().toLowerCase();
  const short = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  return short === null
    ? hex
    : `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
};

/**
 * Rows of the shape `| \`token\` | \`#hex\` | 1.23 | …` inside a table whose
 * header names `#FFC000` as the ground.
 *
 * Scoped to those tables rather than to every row in the file, so the artwork
 * table in AI.md — which measures one colour against four grounds and puts two
 * values in its first cell — is not misread as a token row.
 */
const documentedRatios = (doc: string): DocumentedRatio[] => {
  const lines = readFileSync(doc, 'utf8').split('\n');
  const out: DocumentedRatio[] = [];

  let inTable = false;

  for (const [index, line] of lines.entries()) {
    if (!line.startsWith('|')) {
      inTable = false;
      continue;
    }

    if (line.includes('on `#FFC000`')) {
      inTable = true;
      continue;
    }

    if (!inTable) continue;

    const row = line.match(
      /^\|\s*`([A-Za-z-]+)`\s*\|\s*`(#[0-9a-fA-F]{6})`\s*\|\s*([0-9]+\.[0-9]+)\s*\|/,
    );
    if (row === null) continue;

    const token = (row[1] as string).replace(
      /[A-Z]/g,
      (c) => `-${c.toLowerCase()}`,
    );

    out.push({
      doc,
      line: index + 1,
      token,
      variable: `--color-${token}`,
      hex: normaliseHex(row[2] as string),
      ratio: Number(row[3]),
    });
  }

  return out;
};

test.describe('the gold surface exception', () => {
  /**
   * The Markdown copies, measured against the same live CSS the RATIOS table
   * below is measured against. Verified not to be vacuous: changing
   * `gold-muted` to `#3A3021` in AI.md alone fails this test naming that file
   * and line, and the parser's own floor fails if the tables stop being found.
   */
  test('every documented gold ratio matches the live CSS', async ({ page }) => {
    await page.goto('/');

    const documented = GOLD_TABLE_DOCS.flatMap(documentedRatios);

    /*
     * The floor. If a heading is reworded, or the table is reformatted, the
     * parser silently matches nothing and every assertion below passes on an
     * empty list — which is exactly the shape of vacuity this file guards
     * against everywhere else.
     */
    expect(
      documented.length,
      `no "on #FFC000" token rows were parsed out of ${GOLD_TABLE_DOCS.join(
        ', ',
      )}. The tables were reformatted or moved, so this check is reading ` +
        `nothing rather than finding them clean.`,
    ).toBeGreaterThan(0);

    for (const doc of GOLD_TABLE_DOCS) {
      expect(
        documented.filter((row) => row.doc === doc).length,
        `${doc} contributed no rows, so it is no longer being checked`,
      ).toBeGreaterThan(0);
    }

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
            value: value.toLowerCase(),
            ratio: colour === null ? null : Number(ratio(colour, ground).toFixed(2)),
          };
        });
      })(${JSON.stringify([GOLD, [...new Set(documented.map((r) => r.variable))]])})`,
    )) as { variable: string; value: string; ratio: number | null }[];

    const live = new Map(measured.map((row) => [row.variable, row]));

    const wrong: string[] = [];

    for (const row of documented) {
      const actual = live.get(row.variable);

      if (actual === undefined || actual.value === '') {
        wrong.push(
          `${row.doc}:${row.line}  \`${row.token}\` — ${row.variable} is not ` +
            `defined in global.css`,
        );
        continue;
      }

      if (normaliseHex(actual.value) !== row.hex) {
        wrong.push(
          `${row.doc}:${row.line}  \`${row.token}\` — documented ${row.hex}, ` +
            `CSS says ${actual.value}`,
        );
      }

      if (actual.ratio === null || Math.abs(actual.ratio - row.ratio) > 0.05) {
        wrong.push(
          `${row.doc}:${row.line}  \`${row.token}\` — documented ${row.ratio} ` +
            `against ${GOLD}, measured ${actual.ratio}`,
        );
      }
    }

    expect(
      wrong,
      `a gold-surface table has drifted from the CSS. The live custom ` +
        `properties are the source of truth and the prose is a copy of them, ` +
        `so fix the Markdown, not the token — unless the token really did ` +
        `change, in which case every row below is a file that still needs ` +
        `updating in this commit:\n  ${wrong.join('\n  ')}`,
    ).toEqual([]);
  });

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

      /*
       * The one failure on this surface that measuring text cannot find.
       * .btn-primary is `bg-gold`, so on a gold ground it is a 1.00:1 fill —
       * an invisible control. Its LABEL still passes: `.surface-gold a` repaints
       * it darkcyan, 8.00 on gold. So every text-contrast rule, this file's own
       * route check above, and AccessLint at AAA all report it clean.
       *
       * Verified: a page with .btn-primary inside .surface-gold returned "No
       * accessibility violations found" from AccessLint with AAA enabled. The
       * boundary of a control is not something a text rule evaluates, and no
       * rule engine knows that this project's gold is a surface as well as an
       * accent. Hence this check, by measurement rather than by class name.
       */
      const walked = (await page.evaluate(`(() => {
        ${PAGE_HELPERS}
        const section = document.querySelector('.surface-gold');
        if (section === null) return { section: false, controls: 0, invisible: [] };
        return {
          section: true,
          controls: section.querySelectorAll('a, button, [role="button"]').length,
          invisible: invisibleControls(section),
        };
      })()`)) as {
        section: boolean;
        controls: number;
        invisible: InvisibleControl[];
      };

      /*
       * Non-vacuity, on every route that has a gold section. Without this the
       * assertion below passes on an empty list for every route forever,
       * which is exactly what it did for the whole time no page used the
       * class.
       */
      if (route in GOLD_ROUTES) {
        expect(
          walked.section,
          `${route} has no .surface-gold section. It is listed in ` +
            `GOLD_ROUTES, so losing it makes the invisible-control check ` +
            `below vacuous on this route rather than failing anywhere.`,
        ).toBe(true);
        expect(
          walked.controls,
          `${route} should put ${GOLD_ROUTES[route]} controls on the gold ` +
            `ground for this check to walk`,
        ).toBe(GOLD_ROUTES[route]);
      }

      expect(
        walked.invisible,
        invisibleControlMessage(walked.invisible),
      ).toEqual([]);

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

  /**
   * The two buttons the comps specify for the gold hero. Mounted for the same
   * reason as the fixture above: the Career page does not exist yet.
   *
   * Each colour is measured against what it is actually adjacent to, which is
   * not the same ground for both buttons. The primary button's label sits on
   * the button's own #131313 fill, not on gold; its fill is what sits on gold.
   * The secondary button is transparent, so its label and border both sit on
   * gold directly.
   */
  test('.surface-gold buttons clear their thresholds and their target size', async ({
    page,
  }) => {
    await page.goto('/');

    const result = (await page.evaluate(`(() => {
      ${PAGE_HELPERS}

      const host = document.createElement('div');
      host.className = 'surface-gold';
      host.innerHTML =
        '<a data-role="primary" class="btn-gold-primary" href="/cv.pdf">Download CV</a> ' +
        '<a data-role="secondary" class="btn-gold-secondary" href="/contact">Get in touch</a>';
      document.querySelector('main').append(host);

      const pick = (role) => host.querySelector('[data-role="' + role + '"]');
      const primary = pick('primary');
      const secondary = pick('secondary');
      const gold = fromHex('${GOLD}');

      const measure = (element) => {
        const style = getComputedStyle(element);
        element.focus();
        const focused = getComputedStyle(element);
        const box = element.getBoundingClientRect();

        const fill = parse(style.backgroundColor);
        const label = parse(style.color);
        const border = parse(style.borderTopColor);
        const ring = parse(focused.outlineColor);

        // A transparent fill means the label sits on whatever is behind it.
        const ground = fill !== null && fill.a === 1 ? fill : gold;

        return {
          fillIsTransparent: fill === null || fill.a === 0,
          fillCss: style.backgroundColor,
          borderCss: style.borderTopColor,
          labelCss: style.color,
          borderWidth: parseFloat(style.borderTopWidth),
          underline: style.textDecorationLine,
          width: Number(box.width.toFixed(1)),
          height: Number(box.height.toFixed(1)),
          outlineOffset: parseFloat(focused.outlineOffset),
          outlineWidth: parseFloat(focused.outlineWidth),
          // The label against the surface it actually sits on.
          labelOnGround: Number(ratio(label, ground).toFixed(2)),
          // What identifies the control against the gold surface: the fill for
          // a filled button, the border for a transparent one.
          boundaryOnGold: Number(
            ratio(fill !== null && fill.a === 1 ? fill : border, gold).toFixed(2),
          ),
          borderOnGold: Number(ratio(border, gold).toFixed(2)),
          ringOnGold: Number(ratio(ring, gold).toFixed(2)),
          borderMatchesFill:
            fill !== null && border !== null && fill.a === 1
              ? fill.r === border.r && fill.g === border.g && fill.b === border.b
              : null,
        };
      };

      const readout = {
        groundIsGold: isGold(effectiveBackground(host)),
        primary: measure(primary),
        secondary: measure(secondary),
      };

      host.remove();
      return readout;
    })()`)) as {
      groundIsGold: boolean;
      primary: Record<string, number | string | boolean | null>;
      secondary: Record<string, number | string | boolean | null>;
    };

    expect(result.groundIsGold, 'the fixture is not on a gold ground').toBe(
      true,
    );

    for (const [name, button] of [
      ['btn-gold-primary', result.primary],
      ['btn-gold-secondary', result.secondary],
    ] as const) {
      expect(
        button.borderWidth,
        `.${name} lost its border. It is what delimits the secondary button ` +
          `against gold, and what makes the primary read as one solid block.`,
      ).toBe(4);

      expect(
        button.labelOnGround,
        `.${name} label against the surface it actually sits on (SC 1.4.3)`,
      ).toBeGreaterThanOrEqual(AAA_TEXT);

      expect(
        button.boundaryOnGold,
        `.${name} against the gold ground (SC 1.4.11). This is what identifies ` +
          `the control: its fill if it has one, its border if it does not. ` +
          `The pink offset shadow is decoration and measures 2.31 on gold, so ` +
          `it must never be the thing carrying this.`,
      ).toBeGreaterThanOrEqual(NON_TEXT);

      /*
       * SC 2.5.8, on the target's own size. The spacing exception is not
       * relied on anywhere on this site and is not going to start here.
       */
      expect(
        button.height,
        `.${name} target height (SC 2.5.8)`,
      ).toBeGreaterThanOrEqual(24);
      expect(
        button.width,
        `.${name} target width (SC 2.5.8)`,
      ).toBeGreaterThanOrEqual(24);

      expect(
        button.ringOnGold,
        `.${name} focus ring against the gold ground (SC 1.4.11)`,
      ).toBeGreaterThanOrEqual(NON_TEXT);

      /*
       * The ring is `gold-text`, which is exactly the primary button's fill
       * and both buttons' border colour. Flush against the element it would
       * measure 1.00, and the 3px offset is what puts gold on either side of
       * it.
       *
       * KEPT, AND DELIBERATELY REDUNDANT ON THE PRIMARY. This used to be the
       * only thing standing between .btn-gold-primary and a completely
       * invisible focus indicator, which is a lot of weight for an assertion
       * on a single numeric property to carry. The two-tone ring took that
       * weight off it: verified by setting outline-offset: 0 on
       * .surface-gold :focus-visible, where this assertion fails and the
       * two-tone ring test passes, because the inner #FFFFFF ring is still
       * 18.58 against the fill. The offset is still right and is still
       * asserted; it is no longer load-bearing.
       */
      expect(
        button.outlineOffset,
        `.${name} focus ring offset. The ring colour is the same as this ` +
          `button's border, so with no offset it sits flush against a colour ` +
          `it matches. On .btn-gold-primary the inner ring now covers that ` +
          `case; this assertion keeps the offset honest rather than carrying ` +
          `the indicator on its own.`,
      ).toBeGreaterThan(0);
      expect(button.outlineWidth, `.${name} focus ring width`).toBeGreaterThan(
        0,
      );

      expect(
        button.underline,
        `.${name} must not be underlined. The base .surface-gold rule ` +
          `underlines links, which is right in prose and wrong under a ` +
          `0.1em-tracked uppercase label inside a bordered box.`,
      ).not.toContain('underline');
    }

    /*
     * The deliberate exception to the subtree border default, asserted so it
     * cannot be "corrected" back to gold-border by someone reading the rule
     * and not the reason. A navy outline around a solid dark block is an
     * outline this design does not have.
     */
    expect(
      result.primary.borderMatchesFill,
      '.btn-gold-primary border must match its own fill, not gold-border. ' +
        `Measured border ${result.primary.borderCss} against fill ` +
        `${result.primary.fillCss}.`,
    ).toBe(true);

    expect(
      result.secondary.fillIsTransparent,
      '.btn-gold-secondary must be transparent so the gold ground shows ' +
        'through; its label and border are measured against gold, not against ' +
        'a fill of its own.',
    ).toBe(true);
  });

  /**
   * .btn-gold-primary's focus ring, which is two rings.
   *
   * The ring colour on this surface is `gold-text` #131313, which is exactly
   * this button's fill and border. Ring against fill is 1.00, and only the 3px
   * gold offset gap made it visible, at 11.32. That put the entire indicator
   * on one property staying non-zero, on the one control where getting it
   * wrong hides the indicator rather than weakening it. An inner #FFFFFF ring
   * flush to the fill (18.58) removes the dependency: whatever the offset
   * does, one ring still has something to contrast against.
   *
   * The offset assertion in the button test above stays, and is now redundant
   * rather than load-bearing. This test is what makes it redundant.
   */
  test('.btn-gold-primary keeps a visible focus ring whatever the offset does', async ({
    page,
  }) => {
    await page.goto('/');

    const result = (await page.evaluate(`(() => {
      ${PAGE_HELPERS}

      const host = document.createElement('div');
      host.className = 'surface-gold';
      host.innerHTML =
        '<a data-role="primary" class="btn-gold-primary" href="/cv.pdf">Download CV</a>';
      document.querySelector('main').append(host);

      const button = host.querySelector('[data-role="primary"]');
      const root = getComputedStyle(document.documentElement);
      const pink = fromHex(root.getPropertyValue('--color-pink').trim());
      const gold = fromHex('${GOLD}');

      button.focus();
      const focused = getComputedStyle(button);
      const fill = parse(focused.backgroundColor);
      const layers = shadowLayers(focused.boxShadow);
      const inner = layers.find((layer) => layer.inset) ?? null;
      const offsetShadow = layers.find((layer) => !layer.inset) ?? null;
      const outline = parse(focused.outlineColor);

      /*
       * The failure this whole rule exists to prevent. Forced on the element
       * rather than assumed, so what is asserted is the rendered result of
       * outline-offset: 0 and not a description of it.
       */
      button.style.outlineOffset = '0px';
      const atZeroOffset = focusRingsAgainstFill(button, fill);
      button.style.outlineOffset = '';

      const readout = {
        fillCss: focused.backgroundColor,
        boxShadowCss: focused.boxShadow,
        layerCount: layers.length,

        innerRingCss: inner === null ? null : inner.text,
        innerRingOnFill:
          inner === null || inner.colour === null
            ? null
            : Number(ratio(inner.colour, fill).toFixed(2)),

        offsetShadowCss: offsetShadow === null ? null : offsetShadow.text,
        offsetShadowIsPink:
          offsetShadow === null || offsetShadow.colour === null
            ? false
            : offsetShadow.colour.r === pink.r &&
              offsetShadow.colour.g === pink.g &&
              offsetShadow.colour.b === pink.b,

        outlineWidth: parseFloat(focused.outlineWidth),
        outlineOnGold:
          outline === null ? null : Number(ratio(outline, gold).toFixed(2)),
        outlineOnFill:
          outline === null ? null : Number(ratio(outline, fill).toFixed(2)),

        atZeroOffset,
        bestAtZeroOffset: atZeroOffset.reduce(
          (best, layer) => (layer.ratio > best ? layer.ratio : best),
          0,
        ),
      };

      host.remove();
      return readout;
    })()`)) as {
      fillCss: string;
      boxShadowCss: string;
      layerCount: number;
      innerRingCss: string | null;
      innerRingOnFill: number | null;
      offsetShadowCss: string | null;
      offsetShadowIsPink: boolean;
      outlineWidth: number;
      outlineOnGold: number | null;
      outlineOnFill: number | null;
      atZeroOffset: { layer: string; ratio: number }[];
      bestAtZeroOffset: number;
    };

    /*
     * THE HEADLINE CLAIM, ASSERTED FIRST ON PURPOSE. Every other assertion in
     * this test is a detail of how it is achieved, and any of them failing
     * would also break this one. Ordering it first means the failure a reader
     * sees names the actual consequence — the indicator is invisible against
     * the control it marks — rather than an intermediate fact about how many
     * box-shadow layers there are.
     */
    expect(
      result.bestAtZeroOffset,
      `with outline-offset forced to 0, no layer of .btn-gold-primary's focus ` +
        `indicator reaches ${NON_TEXT}:1 against the button's own fill ` +
        `(SC 1.4.11), so the ring is invisible against the control it marks. ` +
        `This is the failure the inner ring exists to prevent. Measured:\n` +
        result.atZeroOffset
          .map((layer) => `  ${layer.layer} — ${layer.ratio.toFixed(2)}:1`)
          .join('\n'),
    ).toBeGreaterThanOrEqual(NON_TEXT);

    /*
     * BOTH RINGS AND THE PINK SHADOW, ALL THREE AT ONCE. box-shadow is one
     * property, so a :focus-visible rule that names only the ring silently
     * deletes the resting decoration for as long as the button has focus.
     */
    expect(
      result.layerCount,
      `.btn-gold-primary on focus must carry two box-shadow layers, the inner ` +
        `ring and the pink offset shadow. Measured: ${result.boxShadowCss}`,
    ).toBe(2);

    expect(
      result.innerRingCss,
      `.btn-gold-primary has no inset ring on focus. It is the half of the ` +
        `indicator that does not depend on outline-offset. Measured ` +
        `box-shadow: ${result.boxShadowCss}`,
    ).not.toBeNull();

    expect(
      result.offsetShadowIsPink,
      `.btn-gold-primary lost its pink offset shadow on focus. The ring folds ` +
        `into box-shadow rather than replacing it, or the resting decoration ` +
        `disappears at exactly the moment someone is looking at the control. ` +
        `Measured: ${result.boxShadowCss}`,
    ).toBe(true);

    expect(
      result.outlineWidth,
      '.btn-gold-primary lost its outer ring on focus',
    ).toBeGreaterThan(0);

    /*
     * The two documented numbers, pinned the way the token table above is
     * pinned, so retoning either colour fails here as well as in the docs.
     */
    expect(
      result.innerRingOnFill,
      `the inner ring against .btn-gold-primary's own fill ${result.fillCss}`,
    ).toBeCloseTo(18.58, 1);
    expect(result.innerRingOnFill).toBeGreaterThanOrEqual(NON_TEXT);

    expect(
      result.outlineOnGold,
      'the outer ring against the gold ground, which is what the 3px offset ' +
        'gap shows',
    ).toBeCloseTo(11.32, 1);
    expect(result.outlineOnGold).toBeGreaterThanOrEqual(NON_TEXT);

    /*
     * The reason this test exists. The outer ring is the same colour as the
     * fill, so on its own it measures 1.00 against the control it is marking
     * and the offset is the only thing saving it. Asserted so that the number
     * is on the record rather than described.
     */
    expect(
      result.outlineOnFill,
      'the outer ring against the fill. It is `gold-text`, the same colour as ' +
        'the fill and the border, so this is expected to be 1.00 — which is ' +
        'why a second ring is needed and why the offset used to be the whole ' +
        'indicator.',
    ).toBeCloseTo(1.0, 1);
  });

  /**
   * THE GOLD SURFACE ON REAL MARKUP, at the two reflow widths.
   *
   * Everything above this point that exercises the class contract does it
   * against a fixture mounted into `/`, because until the Career page landed
   * no route used `.surface-gold` at all. This is the same set of questions
   * asked of the shipped hero: the buttons a reader actually reaches, at the
   * viewport a reader actually has, with the focus indicator the browser
   * actually paints.
   *
   * It is not a duplicate of the fixture tests and neither replaces the
   * other. The fixture keeps the class honest for the next page built against
   * it, and can be broken deliberately without touching a route. This one is
   * the only thing that can fail on a mistake made in career.astro — a
   * `text-muted` written inside the section, `.btn-primary` used by habit, the
   * watermark scrolling the page sideways — none of which the fixture can see.
   *
   * THE WATERMARK IS WHY OVERFLOW IS CHECKED HERE AS WELL AS IN
   * reflow.spec.ts. It is 700px wide at `right: -150px`, so the section's own
   * scrollWidth genuinely exceeds its clientWidth by 150px at every viewport.
   * That is the comp's design and it is contained by `overflow-hidden` on the
   * section; the assertion is that the *document* does not scroll, and the
   * 150px is asserted too, so removing `overflow-hidden` fails here rather
   * than becoming someone's horizontal scrollbar.
   */
  const GOLD_ROUTE_WIDTHS = [
    { width: 305, contentBox: 273 },
    { width: 320, contentBox: 288 },
  ] as const;

  for (const { width, contentBox } of GOLD_ROUTE_WIDTHS) {
    test(`the ${GOLD_ROUTE} gold section holds up at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(GOLD_ROUTE, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);

      const result = (await page.evaluate(`(() => {
        ${PAGE_HELPERS}
        const gold = fromHex('${GOLD}');
        const section = document.querySelector('.surface-gold');
        if (section === null) return null;

        const main = document.querySelector('main');
        const mainStyle = getComputedStyle(main);

        const controls = [...section.querySelectorAll('a, button')].map((el) => {
          const resting = getComputedStyle(el);
          const fill = parse(resting.backgroundColor);
          el.focus();
          // Read while the element still has focus. Moving this below the
          // blur() is how the first version of this test reported that a
          // focused button had not taken focus.
          const tookFocus = document.activeElement === el;
          /*
           * getComputedStyle returns a LIVE declaration, so every value that
           * exists only under :focus-visible has to be read into a plain
           * number before the blur below. Reading them after it is how the
           * first version of this test reported an outline-offset of 0 on a
           * button whose offset is 3px.
           */
          const focused = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          const outline = parse(focused.outlineColor);
          const outlineWidth = parseFloat(focused.outlineWidth);
          const outlineOffset = parseFloat(focused.outlineOffset);
          const inner = shadowLayers(focused.boxShadow).find((l) => l.inset) ?? null;
          el.blur();

          return {
            selector: describe(el),
            focused: tookFocus,
            width: Number(box.width.toFixed(1)),
            height: Number(box.height.toFixed(1)),
            fillIsOpaque: fill !== null && fill.a === 1,
            // What identifies the control against gold: its fill, or its border.
            boundaryOnGold: Number(
              ratio(
                fill !== null && fill.a === 1 ? fill : parse(resting.borderTopColor),
                gold,
              ).toFixed(2),
            ),
            outlineWidth,
            outlineOffset,
            // The outer ring against the gold the 3px offset gap exposes.
            outlineOnGold:
              outline === null ? null : Number(ratio(outline, gold).toFixed(2)),
            // The outer ring against the control it marks. 1.00 on the
            // primary, which is the entire reason the inner ring exists.
            outlineOnFill:
              outline === null || fill === null || fill.a !== 1
                ? null
                : Number(ratio(outline, fill).toFixed(2)),
            innerRingOnFill:
              inner === null || inner.colour === null || fill === null || fill.a !== 1
                ? null
                : Number(ratio(inner.colour, fill).toFixed(2)),
          };
        });

        return {
          controls,
          textOnGold: (() => {
            const out = [];
            for (const el of section.querySelectorAll('*')) {
              if (!hasOwnText(el)) continue;
              const bg = effectiveBackground(el);
              if (!isGold(bg)) continue;
              const colour = parse(getComputedStyle(el).color);
              if (colour === null) continue;
              out.push({
                selector: describe(el),
                ratio: Number(ratio(colour, bg).toFixed(2)),
                text: (el.textContent ?? '').trim().slice(0, 40),
              });
            }
            return out;
          })(),
          documentScrollWidth: document.documentElement.scrollWidth,
          documentClientWidth: document.documentElement.clientWidth,
          sectionScrollWidth: section.scrollWidth,
          sectionClientWidth: section.clientWidth,
          sectionOverflowX: getComputedStyle(section).overflowX,
          contentBox:
            main.clientWidth -
            parseFloat(mainStyle.paddingLeft) -
            parseFloat(mainStyle.paddingRight),
        };
      })()`)) as {
        controls: {
          selector: string;
          focused: boolean;
          width: number;
          height: number;
          fillIsOpaque: boolean;
          boundaryOnGold: number;
          outlineWidth: number;
          outlineOffset: number;
          outlineOnGold: number | null;
          outlineOnFill: number | null;
          innerRingOnFill: number | null;
        }[];
        textOnGold: { selector: string; ratio: number; text: string }[];
        documentScrollWidth: number;
        documentClientWidth: number;
        sectionScrollWidth: number;
        sectionClientWidth: number;
        sectionOverflowX: string;
        contentBox: number;
      } | null;

      expect(
        result,
        `${GOLD_ROUTE} has no .surface-gold section to measure`,
      ).not.toBeNull();
      const measured = result as NonNullable<typeof result>;

      expect(
        measured.controls.length,
        `${GOLD_ROUTE} should render ${GOLD_ROUTES[GOLD_ROUTE]} controls on gold`,
      ).toBe(GOLD_ROUTES[GOLD_ROUTE]);

      /* Reflow. The document must not scroll; the section is allowed to clip. */
      expect(
        measured.contentBox,
        `${GOLD_ROUTE} content box at ${width}px`,
      ).toBe(contentBox);
      expect(
        measured.documentScrollWidth,
        `${GOLD_ROUTE} scrolls sideways at ${width}px (SC 1.4.10)`,
      ).toBeLessThanOrEqual(measured.documentClientWidth);

      expect(
        measured.sectionOverflowX,
        'the gold hero must clip its own overflow. The watermark sits at ' +
          'right: -150px by design, so without this the page scrolls sideways.',
      ).toBe('hidden');
      expect(
        measured.sectionScrollWidth - measured.sectionClientWidth,
        "the watermark's 150px overhang, asserted so that moving it is a " +
          'deliberate edit rather than a silent one',
      ).toBe(150);

      /* Every string on the gold ground, from the real markup. */
      expect(
        measured.textOnGold.length,
        `nothing with text was found on the gold ground on ${GOLD_ROUTE}`,
      ).toBeGreaterThan(0);
      const unreadable = measured.textOnGold.filter((e) => e.ratio < AA_TEXT);
      expect(
        unreadable,
        `text on #FFC000 below ${AA_TEXT}:1 in the real Career hero:\n` +
          unreadable
            .map((e) => `  ${e.selector} at ${e.ratio}:1 — "${e.text}"`)
            .join('\n'),
      ).toEqual([]);

      for (const control of measured.controls) {
        expect(
          control.focused,
          `${control.selector} did not take focus, so its indicator was never ` +
            `measured`,
        ).toBe(true);

        expect(
          control.boundaryOnGold,
          `${control.selector} against the gold ground (SC 1.4.11)`,
        ).toBeGreaterThanOrEqual(NON_TEXT);

        expect(
          control.height,
          `${control.selector} target height (SC 2.5.8)`,
        ).toBeGreaterThanOrEqual(24);
        expect(
          control.width,
          `${control.selector} target width (SC 2.5.8)`,
        ).toBeGreaterThanOrEqual(24);

        expect(
          control.outlineWidth,
          `${control.selector} has no focus ring in situ (SC 2.4.7)`,
        ).toBeGreaterThan(0);
        expect(
          control.outlineOffset,
          `${control.selector} focus ring offset`,
        ).toBeGreaterThan(0);
        expect(
          control.outlineOnGold,
          `${control.selector} focus ring against the gold the offset gap ` +
            `exposes (SC 1.4.11)`,
        ).toBeGreaterThanOrEqual(NON_TEXT);

        /*
         * The primary button is the one whose ring colour equals its own
         * opaque fill. Asserted on the real control, not on the fixture: the
         * outer ring measures 1.00 against the thing it is marking, and the
         * inner white ring is what makes the indicator survive that.
         */
        if (control.fillIsOpaque) {
          expect(
            control.outlineOnFill,
            `${control.selector} outer ring against its own fill. Expected ` +
              `1.00 — the ring is gold-text and so is the fill — which is why ` +
              `there has to be a second ring.`,
          ).toBeCloseTo(1.0, 1);
          expect(
            control.innerRingOnFill,
            `${control.selector} has no inner ring, so its entire focus ` +
              `indicator rests on outline-offset staying non-zero`,
          ).toBeCloseTo(18.58, 1);
        }
      }
    });
  }

  /**
   * The invisible-control check, run against a fixture as well as against the
   * real route above.
   *
   * The fixture is kept rather than deleted now that `/career` exists. It is
   * the only place the check is exercised against a control it was written
   * for but no page uses — and it can be broken on purpose to prove the check
   * still bites without editing a shipped route.
   *
   * Both delimiting mechanisms are in the fixture on purpose, because the
   * check dispatches on which one applies: .btn-gold-primary is delimited by
   * an opaque #131313 fill (11.32 on gold) and .btn-gold-secondary by a 4px
   * #131313 border over a transparent fill (also 11.32). A prose link is in
   * there as the negative case — transparent, no border, delimited by colour
   * and an underline rather than by a boundary — because a check that flagged
   * every link on the surface would be worse than no check.
   */
  test('every control inside .surface-gold is delimited against the ground', async ({
    page,
  }) => {
    await page.goto('/');

    const found = (await page.evaluate(`(() => {
      ${PAGE_HELPERS}

      const host = document.createElement('div');
      host.className = 'surface-gold';
      host.innerHTML =
        '<a data-role="primary" class="btn-gold-primary" href="/cv.pdf">Download CV</a> ' +
        '<a data-role="secondary" class="btn-gold-secondary" href="/contact">Get in touch</a> ' +
        '<p>Prose with <a href="/about">a link</a> in it.</p>';
      document.querySelector('main').append(host);

      const readout = {
        groundIsGold: isGold(effectiveBackground(host)),
        controls: host.querySelectorAll('a').length,
        invisible: invisibleControls(host),
      };

      host.remove();
      return readout;
    })()`)) as {
      groundIsGold: boolean;
      controls: number;
      invisible: InvisibleControl[];
    };

    expect(found.groundIsGold, 'the fixture is not on a gold ground').toBe(
      true,
    );

    /*
     * Proves the walk saw the controls rather than matching nothing, the same
     * guard the route test carries. Without it this assertion would pass on an
     * empty list forever if the selector or the background resolver broke.
     */
    expect(
      found.controls,
      'the fixture mounted no controls for the check to walk',
    ).toBe(3);

    expect(found.invisible, invisibleControlMessage(found.invisible)).toEqual(
      [],
    );
  });
});

/**
 * The gold-route literal matches the build.
 *
 * GOLD_ROUTES turns the non-vacuity guard on, route by route. A gold section
 * added to a page nobody listed there is a section with no guard, and every
 * other assertion in this file keeps passing, so nothing says so. This reads
 * the built HTML and compares.
 */
test('GOLD_ROUTES lists exactly the routes that render a gold section', () => {
  expect(goldRoutesFromBuild().sort()).toEqual(Object.keys(GOLD_ROUTES).sort());
});
