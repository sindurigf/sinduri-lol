import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ROUTES, builtPages } from './routes';
import { gotoSettled } from './settle';

/**
 * Three of WAVE's alerts, as a gate. Not a WCAG check.
 *
 * WebAIM's WAVE reports "Possible heading", "Redundant link" and "Noscript
 * element" as alerts: things for a person to look at, not failures. The first
 * two are WebAIM's own heuristics, encoded here as WebAIM documents them, so a
 * WAVE run on this site stays quiet and a new alert stands out rather than
 * joining a list everyone has learned to ignore.
 *
 * This is not an SC 1.3.1 check and must not be read as one. WCAG fails fake
 * headings through F2, which is a judgement and sets no size, weight or length
 * threshold; the numbers below are WAVE's. So this file is wrong in both
 * directions against WCAG: a short, large, bold `<p>` that is not a heading
 * conforms and fails here, and a fake heading built from a `<div>` or from
 * large regular-weight text fails 1.3.1 and passes here.
 *
 * A failure here asks whether the flagged text is a heading. If it is, the fix
 * is a heading element at the right level; if it is not, the fix is an element
 * that is not a paragraph. This file cannot tell those apart and both make it
 * pass, so never change a tag to quiet it without deciding that question
 * first.
 *
 * It sits apart from tests/a11y.spec.ts for the reason BEST_PRACTICE_TAGS sits
 * apart from AXE_TAGS there: a failure should name what broke, and what breaks
 * here is a tool's heuristic, not the WCAG 2.2 AA target.
 *
 * "Noscript element" fires on the presence of any `<noscript>` and maps to no
 * success criterion. The one this site had was the no-JavaScript navigation,
 * now shown through `@media (scripting: none)` in global.css;
 * tests/no-script.spec.ts keeps that working and the check at the bottom of
 * this file only asks that no page ships a `<noscript>` again.
 *
 * Proven able to fail, 2026-09-11, chromium. Against `main` before the changes
 * this was written with, all 75 tests failed: the footer copyright on every
 * route at both widths, the header logo followed by the desktop nav's Home
 * item on every route, and the two hero stickers on `/`. With the adjacency
 * rule in its final form, Home back in the desktop nav fails all 25
 * redundant-link tests on `"sinduri.lol" then "Home"`, and "Previous page" and
 * "Next page" back in the pager fail exactly 2, `/blog` and `/blog/page/2`.
 * The pager pairs and the "404" label on /404 were found by this file, not by
 * WAVE, which had only been run on `/`.
 */

/**
 * WAVE's "Possible heading" rule, from its documentation: a `<p>` of fewer than
 * 50 characters that is 20px or larger, or 16px or larger and bold or italic.
 *
 * `BOLD_WEIGHT` is this file's reading of "bold", not a number WebAIM
 * publishes: 700 is the CSS keyword `bold`. The rule reads the paragraph's own
 * computed style, so a `<p>` whose only content is a `<strong>` is not caught.
 * Whether WAVE counts that case has not been checked.
 */
const POSSIBLE_HEADING = {
  maxChars: 50,
  largeSize: 20,
  emphasisedSize: 16,
  boldWeight: 700,
} as const;

/**
 * Both ends of the site's measured range, because the rule depends on computed
 * size and most sizes here are fluid. The hero stickers bottom out at 18px on
 * a phone, under the 20px arm and over the 16px bold one, so a single width
 * would test one arm of the rule and not the other.
 */
const HEADING_WIDTHS = [305, 1280] as const;

/**
 * Link order is a fact about the DOM and not the viewport: every link is
 * server-rendered at every width, including the desktop nav below `md` and the
 * mobile dialog above it. One width is enough, and it is the one WAVE was run
 * at when these alerts were found.
 */
const LINK_WIDTH = 1280;

const VIEWPORT_HEIGHT = 800;

interface HeadingScan {
  readonly checked: number;
  readonly flagged: string[];
}

/**
 * Every `<p>` in the document, rendered or not and exposed or not. WAVE
 * flagged the hero stickers while they were `aria-hidden`, so the
 * accessibility tree is not what it reads, and neither is this.
 */
const scanParagraphs = async (page: Page): Promise<HeadingScan> =>
  page.evaluate(({ maxChars, largeSize, emphasisedSize, boldWeight }) => {
    const paragraphs = [...document.querySelectorAll('p')];

    const flagged = paragraphs.flatMap((paragraph) => {
      const text = (paragraph.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length === 0 || text.length >= maxChars) return [];

      const style = getComputedStyle(paragraph);
      const size = Number.parseFloat(style.fontSize);
      const emphasised =
        Number(style.fontWeight) >= boldWeight || style.fontStyle !== 'normal';

      if (size < largeSize && !(size >= emphasisedSize && emphasised)) {
        return [];
      }

      const where = paragraph.className
        ? `p.${paragraph.className.split(/\s+/)[0]}`
        : 'p';
      return [
        `${where} "${text}": ${size}px, weight ${style.fontWeight}, ${style.fontStyle}`,
      ];
    });

    return { checked: paragraphs.length, flagged };
  }, POSSIBLE_HEADING);

/**
 * WAVE's "Redundant link" rule: two adjacent links that go to the same URL.
 *
 * Adjacent means consecutive with no text between them. That is this
 * repository's reading, decided 2026-09-11, not a definition WebAIM publishes,
 * and whether WAVE also flags a pair with text between them has not been
 * checked. WebAIM's fix for the alert is to "combine the redundant links into
 * one link", which only makes sense for two links with nothing between them.
 *
 * Ignoring everything that was not a link flagged two pairs that are not that:
 * the email address linked once under each of two headings on /privacy, and an
 * "All posts" link on /blog/page/2 with the page's <h1> between it and the
 * filter's "All posts". Text inside either link does not count as between
 * them. The URL is compared as the browser resolves it, so `/` and
 * `https://…/` are one destination.
 */
const scanAdjacentLinks = async (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')];
    const name = (link: HTMLAnchorElement): string =>
      (link.textContent ?? '').replace(/\s+/g, ' ').trim() ||
      (link.querySelector('img')?.alt ?? '');
    const textBetween = (first: Element, second: Element): string => {
      const range = document.createRange();
      range.setStartAfter(first);
      range.setEndBefore(second);
      return range.toString().trim();
    };

    return links.slice(1).flatMap((link, index) => {
      const previous = links[index];
      return previous.href === link.href && textBetween(previous, link) === ''
        ? [`"${name(previous)}" then "${name(link)}", both to ${link.href}`]
        : [];
    });
  });

test.describe('WAVE alerts: possible heading', () => {
  for (const width of HEADING_WIDTHS) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

      for (const route of ROUTES) {
        test(`${route} has no paragraph WAVE reads as a heading`, async ({
          page,
        }) => {
          await gotoSettled(page, route);
          const scan = await scanParagraphs(page);

          expect(
            scan.checked,
            `${route} has no <p> at all, so the check below passes by having ` +
              'nothing to look at',
          ).toBeGreaterThan(0);

          expect(
            scan.flagged,
            `WAVE will report these on ${route} at ${width}px as possible ` +
              'headings. Decide whether each one is a heading before changing ' +
              'anything; see the comment at the top of this file.',
          ).toEqual([]);
        });
      }
    });
  }
});

test.describe('WAVE alerts: redundant link', () => {
  test.use({ viewport: { width: LINK_WIDTH, height: VIEWPORT_HEIGHT } });

  for (const route of ROUTES) {
    test(`${route} has no adjacent links to the same URL`, async ({ page }) => {
      await gotoSettled(page, route);

      expect(
        await page.locator('a[href]').count(),
        `${route} has fewer than two links, so there is no pair to compare`,
      ).toBeGreaterThan(1);

      expect(
        await scanAdjacentLinks(page),
        `WAVE will report these adjacent pairs on ${route} as redundant links`,
      ).toEqual([]);
    });
  }
});

/**
 * WAVE's "Noscript element" rule: any `<noscript>` at all.
 *
 * Read from the built HTML rather than through a browser. With scripting on a
 * browser never parses `<noscript>` content, but the element itself is what
 * WAVE counts, and it is in the markup either way. The build carries no
 * authored comments (tests/seo.spec.ts), so a match is the element itself.
 */
test.describe('WAVE alerts: noscript element', () => {
  test('no built page contains a <noscript> element', () => {
    const pages = builtPages();

    expect(
      pages.length,
      'the build has no pages, so the check below passes by reading nothing',
    ).toBeGreaterThan(0);

    const offenders = pages
      .filter(({ file }) => /<noscript[\s>]/i.test(readFileSync(file, 'utf8')))
      .map(({ route }) => route)
      .sort();

    expect(
      offenders,
      'WAVE will report "Noscript element" on these pages. The no-JavaScript ' +
        'navigation is shown by @media (scripting: none) in global.css; read ' +
        'the comment above it in Header.astro before adding a <noscript> back.',
    ).toEqual([]);
  });
});
