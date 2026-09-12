import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gotoSettled } from './settle';
import { AXE_TAGS } from './wcag';
import {
  AA_LARGE,
  AA_TEXT,
  LARGE_TEXT_BOLD_PX,
  LARGE_TEXT_PX,
  PAGE_HELPERS,
} from './contrast';
import { ROUTES } from './routes';

/**
 * The nodes axe could not measure.
 *
 * Why this file exists. `analyze()` returns four buckets, violations, passes,
 * incomplete and inapplicable, and tests/a11y.spec.ts asserts on the first one
 * only. `incomplete` is the bucket axe uses when a rule applied but could not
 * be decided; nothing read it, so nothing knew it was not empty.
 *
 * It was not empty. Measured 2026-09-05, before this file existed: eleven
 * color-contrast nodes across `/`, `/about` and `/contact` came back
 * undecided, three of them ordinary content. The contrast of a paragraph of
 * body copy and of the main call to action on the front page was checked by
 * nothing, and the suite reported a clean sweep with no asterisk. That is
 * worse than a red test: it is a green one that was never asked the question.
 * ACCESSIBILITY.md holds that measurement and records that the nodes on `/`
 * today are fewer and different, the hero those three sat in having gone.
 *
 * The two reasons axe gives up, and what this does about each:
 *
 *   "Element's background color could not be determined because it is
 *   overlapped by another element". A decoration layer painted over text makes
 *   axe refuse to guess, which is the right call for a rule engine and the
 *   wrong answer for this suite, because the question is answerable: walk the
 *   paint stack, prove every layer in front of the text paints nothing, and
 *   the ancestor background is then what the reader actually sees. If a layer
 *   in front does paint, that is a real finding and this fails naming it.
 *
 *   "Element content contains only non-text characters". Glyphs: the pause
 *   control's ❚❚, the contact cards' →, the section numerals. axe declines to
 *   score them. This measures them anyway rather than exempting them, and
 *   deliberately does not lean on `aria-hidden` to wave them through: SC 1.4.3
 *   is about what a sighted reader can make out, and hiding a glyph from the
 *   accessibility tree does not make it legible. Large glyphs get the
 *   criterion's own relaxed floor, never an exemption invented here.
 *
 * What this asserts that tests/a11y.spec.ts cannot: every node axe left
 * undecided is decided, against a floor, with the number in the failure
 * message. And any incomplete result from a rule *other* than color-contrast
 * fails outright, so a new undecided rule appearing later has to be looked at
 * rather than absorbed.
 *
 * Verified 2026-09-05 at 1280px, and the proof is the whole argument for the
 * file: forcing `color: #2a2a2a` onto the homepage standfirst gave axe zero
 * color-contrast violations, because the overlay in front of it kept the node
 * in `incomplete` and tests/a11y.spec.ts stayed green, while this file
 * measured 1.29:1 and failed. A real contrast defect on body copy, invisible
 * to the suite as it stood, caught here.
 *
 * Why not just assert `incomplete` is empty: because it is not, it should not
 * be, and it is not in this project's gift to make it so. Decoration is a
 * design decision and the glyphs are content, so axe will keep declining both.
 * A test that demanded an empty bucket could only be satisfied by deleting the
 * decoration or by an exclusion list, and an exclusion list is the thing that
 * put three unmeasured nodes on the front page in the first place.
 */
/** The one rule this file knows how to decide. Anything else is a new question. */
const DECIDABLE = 'color-contrast';

const WIDTHS = [
  { label: 'desktop', width: 1280 },
  /*
   * 320px is the SC 1.4.10 reflow width. The layout is a different one there,
   * so decoration covers different text and axe gives up on a different set of
   * nodes. Running one width would leave the other set unmeasured, which is
   * the failure this whole file is about.
   */
  { label: '320px', width: 320 },
] as const;

type Decided = {
  selector: string;
  text: string;
  ratio: number | null;
  floor: number;
  large: boolean;
  foreground: string;
  background: string | null;
  blockedBy: string | null;
};

/**
 * Resolve, in the page, what a reader actually sees behind each node axe could
 * not score. One evaluate for the whole list rather than one per node.
 */
const decide = (page: Page, selectors: string[]): Promise<Decided[]> =>
  page.evaluate(`(() => {
    ${PAGE_HELPERS}

    const LARGE_PX = ${LARGE_TEXT_PX};
    const LARGE_BOLD_PX = ${LARGE_TEXT_BOLD_PX};
    const AA_TEXT = ${AA_TEXT};
    const AA_LARGE = ${AA_LARGE};

    const rgb = (c) => (c === null ? null : 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')');

    return ${JSON.stringify(selectors)}.map((selector) => {
      const element = document.querySelector(selector);
      const base = { selector, text: '', ratio: null, floor: AA_TEXT, large: false, foreground: '', background: null, blockedBy: null };
      if (!element) return { ...base, blockedBy: 'element not found' };

      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();

      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const large = size >= LARGE_PX || (size >= LARGE_BOLD_PX && weight >= 700);
      const floor = large ? AA_LARGE : AA_TEXT;
      const text = (element.textContent ?? '').trim().slice(0, 60);
      const head = { ...base, text, large, floor, foreground: style.color };

      /*
       * Everything painted in front of this text, topmost first.
       * elementsFromPoint is the whole stack at a point, which is exactly the
       * question axe declines to answer. A layer that paints nothing leaves
       * the ancestor background correct; a layer that paints anything makes it
       * the wrong answer, and that gets reported rather than guessed at.
       */
      const x = Math.min(Math.max(box.left + box.width / 2, 1), window.innerWidth - 1);
      const y = Math.min(Math.max(box.top + box.height / 2, 1), window.innerHeight - 1);
      const stack = document.elementsFromPoint(x, y);
      const index = stack.findIndex((node) => node === element || node.contains(element));
      const inFront = index === -1 ? [] : stack.slice(0, index);

      const painting = inFront.find((node) => {
        const s = getComputedStyle(node);
        if (s.backgroundImage !== 'none') return true;
        const c = parse(s.backgroundColor);
        return c !== null && c.a > 0;
      });
      if (painting) return { ...head, blockedBy: describe(painting) };

      const foreground = parse(style.color);
      const background = effectiveBackground(element);
      if (!foreground) return { ...head, blockedBy: 'foreground colour did not parse' };
      if (!background) {
        return { ...head, blockedBy: 'no opaque ancestor background (image, gradient or alpha)' };
      }

      return {
        ...head,
        background: rgb(background),
        ratio: ratio(over(foreground, background), background),
      };
    });
  })()`) as Promise<Decided[]>;

const report = (route: string, failures: Decided[]): string =>
  [
    `${failures.length} node(s) axe left undecided did not clear their floor on ${route}:`,
    ...failures.map((f) =>
      [
        `  selector:   ${f.selector}`,
        `  text:       ${JSON.stringify(f.text)}`,
        `  foreground: ${f.foreground}`,
        `  background: ${f.background ?? '(unresolved)'}`,
        `  measured:   ${f.ratio === null ? 'could not be decided' : `${f.ratio.toFixed(2)}:1`}`,
        `  floor:      ${f.floor}:1 (SC 1.4.3, ${f.large ? 'large text' : 'body text'})`,
        f.blockedBy ? `  blocked by: ${f.blockedBy}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n\n');

for (const { label, width } of WIDTHS) {
  test.describe(`nothing is left unmeasured at ${label}`, () => {
    test.use({ viewport: { width, height: 720 } });

    for (const route of ROUTES) {
      test(`${route} decides every incomplete contrast node`, async ({
        page,
      }) => {
        await gotoSettled(page, route);
        const results = await new AxeBuilder({ page })
          .withTags(AXE_TAGS)
          .analyze();

        const unknown = [
          ...new Set(
            results.incomplete
              .map((entry) => entry.id)
              .filter((id) => id !== DECIDABLE),
          ),
        ];
        expect(
          unknown,
          `axe left ${unknown.join(', ')} undecided on ${route}, and this file ` +
            `only knows how to decide ${DECIDABLE}. Work out what the rule ` +
            `could not determine, then either decide it here or write down why ` +
            `it cannot be. Do not widen DECIDABLE to silence this.`,
        ).toEqual([]);

        const selectors = results.incomplete
          .filter((entry) => entry.id === DECIDABLE)
          .flatMap((entry) =>
            entry.nodes.map((node) => String(node.target[0])),
          );
        if (selectors.length === 0) return;

        const decided = await decide(page, selectors);
        const failures = decided.filter(
          (entry) => entry.ratio === null || entry.ratio < entry.floor,
        );

        expect(failures, report(route, failures)).toEqual([]);
      });
    }
  });
}
