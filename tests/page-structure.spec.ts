import { expect, test } from './test';
import { ROUTES } from './routes';
import { gotoSettled } from './settle';

/**
 * The page rules in ARCHITECTURE.md > Page rules, where a machine can see them.
 *
 * Each rule exists because pages drifted apart one reasonable edit at a time:
 * the 2026-09-18 audit found five openings, H1s in two colours and cards with
 * and without shadows, none of which any other spec measured. Measured on the
 * rendered page rather than by class name, so a card built by hand without
 * `.card-title` still has to cast its shadow.
 *
 * Proven able to fail, 2026-09-18, all three at once: the shadow removed
 * from one Credits card failed /credits; the Accessibility PageHero swapped
 * for a bare `h1` failed /accessibility; PageHero's `h1` set to `text-text`
 * failed all 23 routes that use it. The assertions are soft so that one
 * broken rule does not hide another on the same route. Restored, 25 passed.
 *
 * Since 2026-09-19 a page opens one of two ways: PageHero's wall of cast
 * blocks with a gold `h1`, or, on a blog post, the article opening with its
 * title in the text colour, toned down so a post reads as an article.
 * Proven able to fail the same day: a post title set to `text-gold` failed
 * both posts on "h1 text that is not the text colour". Restored, 25 passed.
 */

/** Home keeps its canvas hero and 404 its joke page; see ARCHITECTURE.md. */
const OWN_OPENING = ['/', '/404'] as const;

/** `--color-gold` and `--color-text`, as the browser reports them. */
const GOLD = 'rgb(255, 192, 0)';
const TEXT = 'rgb(229, 226, 225)';

for (const route of ROUTES) {
  test(`${route} follows the page rules`, async ({ page }) => {
    await gotoSettled(page, route);

    const found = await page.evaluate(() => {
      const main = document.querySelector('main');
      const first = main?.firstElementChild ?? null;
      const cards = [...document.querySelectorAll('main .card')];
      return {
        opensWith: first?.matches('.page-hero')
          ? 'hero'
          : first?.matches('article') && first.querySelector('.post-layout')
            ? 'post'
            : 'nothing recognised',
        h1Colours: [...document.querySelectorAll('main h1 *, main h1')]
          .filter((el) =>
            [...el.childNodes].some(
              (node) =>
                node.nodeType === Node.TEXT_NODE &&
                (node.textContent ?? '').trim() !== '',
            ),
          )
          .map((el) => getComputedStyle(el).color),
        flatCards: cards
          .filter((card) => getComputedStyle(card).boxShadow === 'none')
          .map((card) => card.textContent?.trim().slice(0, 40) ?? ''),
      };
    });

    if (!(OWN_OPENING as readonly string[]).includes(route)) {
      expect
        .soft(
          found.opensWith,
          `${route} opens with neither PageHero nor a post's article opening`,
        )
        .not.toBe('nothing recognised');
      const expected = found.opensWith === 'post' ? TEXT : GOLD;
      expect
        .soft(
          found.h1Colours.filter((colour) => colour !== expected),
          `${route} has h1 text that is not ${found.opensWith === 'post' ? 'the text colour' : 'gold'}`,
        )
        .toEqual([]);
    }

    expect
      .soft(found.flatCards, `${route} has cards without a shadow`)
      .toEqual([]);
  });
}
