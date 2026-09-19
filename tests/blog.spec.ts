import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import {
  CATEGORY_ROUTES,
  POSTS_PER_PAGE,
  POST_ROUTES,
  postCountByCategory,
  TAG_ROUTES,
} from './routes';
import { MIN_TARGET } from './wcag';

/**
 * The blog index: pagination, and the category filter.
 *
 * Pagination cannot be verified while every post fits on one page, so its
 * block skips itself until there are more than POSTS_PER_PAGE posts, and the
 * block after it asserts the single page instead. The placeholder posts that
 * used to fill a second page were removed on 2026-09-14; two real posts remain.
 * Empty categories are checked for their empty state, against the count the
 * Markdown says each category should hold.
 *
 * Proven able to fail, 2026-09-14, chromium: with `data-empty-listing` removed
 * from BlogListing.astro, /blog/skincare, /blog/travel and
 * /blog/personal-thoughts failed "has no posts and should say so".
 *
 * What this asserts that reading the component cannot:
 *
 *   - The page size the built pages actually render, against the copy of
 *     POSTS_PER_PAGE in tests/routes.ts. That copy exists because Playwright
 *     collects test files in plain Node and cannot import anything that
 *     reaches `astro:content`; this is what stops it drifting.
 *   - That the two pages between them show every post exactly once. Off-by-one
 *     slicing loses or repeats a post without changing any count that a
 *     per-page assertion would notice.
 *   - That page two is reachable by pressing a key on a focused control,
 *     rather than only by knowing its URL.
 *   - That the active filter is marked by something other than colour
 *     (SC 1.4.1), and by `aria-current="page"`.
 *   - SC 2.5.8 on every filter and pager target, on its own size.
 */

const POST_COUNT = POST_ROUTES.length;
const LAST_PAGE_COUNT = POST_COUNT - POSTS_PER_PAGE;
const PAGINATES = POST_COUNT > POSTS_PER_PAGE;

/** The href of every post card on the page, in render order. */
const cardHrefs = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('article.card h2 a')].map(
      (a) => new URL((a as HTMLAnchorElement).href).pathname,
    ),
  );

test.describe('the blog index paginates', () => {
  test.skip(
    !PAGINATES,
    `every post fits on one page (${POST_COUNT} of ${POSTS_PER_PAGE}), so there is no second page to test`,
  );

  test('page one holds exactly one page of posts', async ({ page }) => {
    await gotoSettled(page, '/blog');

    const hrefs = await cardHrefs(page);
    expect(
      hrefs.length,
      `/blog should render ${POSTS_PER_PAGE} cards. If this is ` +
        `${POST_COUNT} the listing is not paginating at all; if it is some ` +
        `other number, POSTS_PER_PAGE in tests/routes.ts has drifted from ` +
        `src/lib/blog.ts.`,
    ).toBe(POSTS_PER_PAGE);
  });

  test('page two holds the remainder, and nothing is lost or repeated', async ({
    page,
  }) => {
    await gotoSettled(page, '/blog');
    const first = await cardHrefs(page);

    await gotoSettled(page, '/blog/page/2');
    const second = await cardHrefs(page);

    expect(second.length, '/blog/page/2 post count').toBe(LAST_PAGE_COUNT);

    const shown = [...first, ...second];
    expect(
      new Set(shown).size,
      `a post is repeated across the two pages: ${shown.join(', ')}`,
    ).toBe(shown.length);

    /*
     * The set, not just the count. A slice that drops one post and repeats
     * another keeps both page counts correct and every other assertion here
     * green.
     */
    expect(
      shown.sort(),
      'the two pages between them must show every post exactly once',
    ).toEqual(POST_ROUTES.map((route) => `${route}/`).sort());
  });

  test('page two is reachable by keyboard from page one', async ({ page }) => {
    await gotoSettled(page, '/blog');

    const pager = page.getByRole('navigation', { name: /pagination/i });
    await expect(
      pager,
      'the pager must be a named landmark; there are three navs on this page',
    ).toBeVisible();

    /*
     * By page number: the pager has no "Next page" link, because it sat beside
     * this one and went to the same place. See BlogListing.astro.
     */
    const pageTwo = pager.getByRole('link', { name: /page\s*2/i });
    await pageTwo.focus();
    await expect(pageTwo).toBeFocused();
    await expect(
      pageTwo,
      'every control needs a visible focus indicator (SC 2.4.7)',
    ).toHaveCSS('outline-style', 'solid');

    await page.keyboard.press('Enter');
    await page.waitForURL('**/blog/page/2/');

    expect(
      await cardHrefs(page),
      'following the "Page 2" link should land on the second page of posts',
    ).toHaveLength(LAST_PAGE_COUNT);

    /* The current page is marked, and it is still a link. */
    const current = page
      .getByRole('navigation', { name: /pagination/i })
      .locator('a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAccessibleName(/page\s*2/i);
  });

  test('every pager target passes SC 2.5.8 on its own size', async ({
    page,
  }) => {
    await gotoSettled(page, '/blog');

    const links = page
      .getByRole('navigation', { name: /pagination/i })
      .getByRole('link');
    const count = await links.count();
    expect(count, 'the pager should expose links').toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const box = await links.nth(i).boundingBox();
      const name = await links.nth(i).textContent();
      expect(
        box?.width,
        `pager link "${name?.trim()}" width`,
      ).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(
        box?.height,
        `pager link "${name?.trim()}" height`,
      ).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });
});

test.describe('the blog index while every post fits on one page', () => {
  test.skip(PAGINATES, 'the index paginates; the block above covers it');

  test('lists every post exactly once, with no pager', async ({ page }) => {
    await gotoSettled(page, '/blog');

    const hrefs = await cardHrefs(page);
    expect(
      hrefs.sort(),
      '/blog should list every post once while they fit on one page',
    ).toEqual(POST_ROUTES.map((route) => `${route}/`).sort());

    await expect(
      page.getByRole('navigation', { name: /pagination/i }),
      'a pager with one page offers a single link to the page you are on',
    ).toHaveCount(0);
  });
});

test.describe('the category filter', () => {
  /**
   * The active option, and how it is marked.
   *
   * `aria-current` is the machine-readable half. The `marker` is the
   * `aria-hidden` square that appears only on the active option: it is the
   * non-colour half of the visual signal, and the reason the inverted gold
   * fill is not on its own carrying the state (SC 1.4.1). Reading both means a
   * change that dropped either one fails here.
   */
  const activeOption = (page: Page) =>
    page.evaluate(() => {
      const nav = document.querySelector(
        'nav[aria-label="Filter posts by category"]',
      );
      if (nav === null) return null;
      const links = [...nav.querySelectorAll('a')];
      const current = links.filter(
        (a) => a.getAttribute('aria-current') === 'page',
      );
      return {
        total: links.length,
        currentCount: current.length,
        href: current[0] ? new URL(current[0].href).pathname : null,
        // The square is aria-hidden, so it is found in the DOM, not the tree.
        markers: links.map((a) => a.querySelector('[aria-hidden]') !== null),
        currentHasMarker:
          current[0] !== undefined &&
          current[0].querySelector('[aria-hidden]') !== null,
      };
    });

  test('exactly one option is current on the unfiltered index', async ({
    page,
  }) => {
    await gotoSettled(page, '/blog');

    const state = await activeOption(page);
    expect(state, '/blog has no category filter').not.toBeNull();
    const filter = state as NonNullable<typeof state>;

    expect(
      filter.total,
      'the filter should offer every category with a post, plus "All posts"',
    ).toBe(LISTED_ROUTES.length + 1);
    expect(filter.currentCount, 'exactly one option is current').toBe(1);
    expect(filter.href, '"All posts" is current on /blog').toBe('/blog/');

    expect(
      filter.markers.filter(Boolean).length,
      'the non-colour marker must appear on the current option and on no ' +
        'other. If every option has one, or none does, the active state is ' +
        'being carried by the gold fill alone (SC 1.4.1).',
    ).toBe(1);
    expect(filter.currentHasMarker).toBe(true);
  });

  const counts = postCountByCategory();

  /*
   * The categories the filter offers from /blog: only those with a post. An
   * empty category's page still exists and still marks its own option, so
   * the per-route test below walks every CATEGORY_ROUTES entry.
   */
  const LISTED_ROUTES = CATEGORY_ROUTES.filter(
    (route) => (counts.get(route.replace('/blog/', '')) ?? 0) > 0,
  );

  const cardCategoryLabels = (page: Page): Promise<string[]> =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll('article.card p.label > span:first-child'),
      ].map((el) => (el.textContent ?? '').trim().toLowerCase()),
    );

  for (const route of CATEGORY_ROUTES) {
    test(`${route} marks its own option, and lists its posts or says it has none`, async ({
      page,
    }) => {
      await gotoSettled(page, route);

      const state = await activeOption(page);
      const filter = state as NonNullable<typeof state>;

      expect(filter.currentCount, 'exactly one option is current').toBe(1);
      expect(filter.href, `${route} should mark its own filter option`).toBe(
        `${route}/`,
      );
      expect(filter.currentHasMarker).toBe(true);

      /*
       * Every card on a category page carries that category's label. This is
       * what makes the filter a filter rather than six links to the same list.
       */
      const label = route.replace('/blog/', '').replaceAll('-', ' ');
      const labels = await cardCategoryLabels(page);

      const expected = counts.get(route.replace('/blog/', '')) ?? 0;
      expect(
        labels.length,
        `${route} should list the ${expected} post(s) its Markdown files it under`,
      ).toBe(expected);

      const empty = page.locator('[data-empty-listing]');
      if (expected === 0) {
        await expect(
          empty,
          `${route} has no posts and should say so`,
        ).toBeVisible();
        await expect(empty).toContainText(/no posts yet/i);
        return;
      }

      await expect(
        empty,
        `${route} lists posts and shows the empty state as well`,
      ).toHaveCount(0);
      expect(
        [...new Set(labels)],
        `${route} listed a post from another category`,
      ).toEqual([label]);
    });
  }

  test('a filter option is followed by pressing a key on it', async ({
    page,
  }) => {
    await gotoSettled(page, '/blog');

    const filter = page.getByRole('navigation', {
      name: /filter posts by category/i,
    });
    const target = LISTED_ROUTES[0] as string;
    const option = filter.locator(`a[href="${target}/"]`);

    await option.focus();
    await expect(option).toBeFocused();
    await expect(
      option,
      'every control needs a visible focus indicator (SC 2.4.7)',
    ).toHaveCSS('outline-style', 'solid');

    /* A key press, not click(). click() would pass against a div. */
    await page.keyboard.press('Enter');
    await page.waitForURL(`**${target}/`);

    expect((await activeOption(page))?.href).toBe(`${target}/`);
  });

  test('every filter target passes SC 2.5.8 on its own size', async ({
    page,
  }) => {
    await gotoSettled(page, '/blog');

    const links = page
      .getByRole('navigation', { name: /filter posts by category/i })
      .getByRole('link');
    const count = await links.count();
    expect(count).toBe(LISTED_ROUTES.length + 1);

    for (let i = 0; i < count; i += 1) {
      const box = await links.nth(i).boundingBox();
      const name = await links.nth(i).textContent();
      expect(
        box?.width,
        `filter "${name?.trim()}" width`,
      ).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(
        box?.height,
        `filter "${name?.trim()}" height`,
      ).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });
});

/**
 * A category is one colour everywhere it appears: its homepage tile, every
 * post card, and the category link above a post title. Three surfaces used to
 * keep three maps, and four of the five categories disagreed between them.
 *
 * The expected colours are copied here because src/lib/blog.ts reaches
 * `astro:content`, which Playwright cannot import.
 *
 * Proven able to fail, 2026-09-16, chromium: with personal-thoughts mapped to
 * gold in src/lib/blog.ts, "each homepage tile uses its category colour"
 * failed expecting rgb(255, 0, 122) and receiving rgb(255, 192, 0).
 */
const GOLD = { text: 'rgb(255, 192, 0)', fill: 'rgb(255, 192, 0)' };
const CYAN = { text: 'rgb(0, 220, 253)', fill: 'rgb(0, 220, 253)' };
const PINK = { text: 'rgb(255, 121, 182)', fill: 'rgb(255, 0, 122)' };

const CATEGORY_COLOURS: Record<string, typeof GOLD> = {
  'open-source': GOLD,
  'professional-journey': GOLD,
  skincare: CYAN,
  travel: CYAN,
  'personal-thoughts': PINK,
};

/*
 * Every card casts the same pink shadow whatever its category: colour on a
 * card now says "this stands off the page", and the category is carried by the
 * glyph tile and the label. Proven able to fail, 2026-09-19, chromium: the
 * gold and cyan category shadows failed here as rgb(255, 192, 0) and
 * rgb(0, 220, 253) before .card took the one shadow.
 */
const CARD_SHADOW = 'rgb(255, 0, 122)';

const shadowColour = (boxShadow: string): string =>
  boxShadow.match(/rgb\([^)]*\)/)?.[0] ?? boxShadow;

const categoryOf = (href: string): string =>
  href.replace(/^\/blog\//, '').replace(/\/$/, '');

test.describe('category colours', () => {
  test('every category has an expected colour', () => {
    expect(Object.keys(CATEGORY_COLOURS).sort()).toEqual(
      CATEGORY_ROUTES.map(categoryOf).sort(),
    );
  });

  test('each homepage tile uses its category colour', async ({ page }) => {
    await gotoSettled(page, '/');

    const counts = postCountByCategory();

    for (const [category, colour] of Object.entries(CATEGORY_COLOURS)) {
      const tile = page.locator('li.card', {
        has: page.locator(`h3 a[href="/blog/${category}/"]`),
      });

      /* A category with no post is not offered on the homepage at all. */
      if ((counts.get(category) ?? 0) === 0) {
        await expect(
          tile,
          `${category} has no posts but has a tile`,
        ).toHaveCount(0);
        continue;
      }

      await expect(tile, `${category} tile`).toHaveCount(1);

      const shadow = await tile.evaluate(
        (el) => getComputedStyle(el).boxShadow,
      );
      expect(shadowColour(shadow), `${category} tile shadow`).toBe(CARD_SHADOW);

      await expect(
        tile.locator('span[aria-hidden="true"]').first(),
        `${category} glyph tile`,
      ).toHaveCSS('background-color', colour.fill);
    }
  });

  for (const route of POST_ROUTES) {
    test(`${route} and its card use its category colour`, async ({ page }) => {
      await gotoSettled(page, route);

      const link = page.locator(
        'main nav[aria-label="Breadcrumb"] li:last-child a',
      );
      const category = categoryOf((await link.getAttribute('href')) ?? '');
      const colour = CATEGORY_COLOURS[category];
      expect(colour, `unknown category "${category}"`).toBeDefined();
      await expect(link, 'category link above the title').toHaveCSS(
        'color',
        colour!.text,
      );

      await gotoSettled(page, `/blog/${category}`);
      const card = page.locator('article.card', {
        has: page.locator(`h2 a[href^="${route}"]`),
      });
      await expect(card, `card for ${route}`).toHaveCount(1);

      const shadow = await card.evaluate(
        (el) => getComputedStyle(el).boxShadow,
      );
      expect(shadowColour(shadow), 'card shadow').toBe(CARD_SHADOW);
      await expect(card.locator('p.label').first(), 'card label').toHaveCSS(
        'color',
        colour!.text,
      );
    });
  }
});

/**
 * Tag listings. Every tag on a post is a link to a page listing the posts that
 * carry it, which is what makes the tags on a post worth rendering at all.
 *
 * Proven able to fail, 2026-09-18, chromium: with the tags rendered as plain
 * <li> text again, "a post's tags are links to their listings" failed with 0
 * links found.
 */
test.describe('tag listings', () => {
  test('every tag route matches a tag on a post', () => {
    expect(TAG_ROUTES.length, 'no tag routes are listed').toBeGreaterThan(0);
  });

  test("a post's tags are links to their listings", async ({ page }) => {
    await gotoSettled(page, POST_ROUTES[0]);

    const tags = page.locator('main a[href^="/blog/tag/"]');
    const count = await tags.count();
    expect(count, `${POST_ROUTES[0]} should render its tags as links`).toBe(4);

    const href = await tags.first().getAttribute('href');
    expect(
      TAG_ROUTES.map((route) => `${route}/`),
      `${href} is not a built tag route`,
    ).toContain(href);

    await tags.first().focus();
    await expect(
      tags.first(),
      'every control needs a visible focus indicator (SC 2.4.7)',
    ).toHaveCSS('outline-style', 'solid');

    await page.keyboard.press('Enter');
    await page.waitForURL(`**${href}`);

    const hrefs = await cardHrefs(page);
    expect(
      hrefs,
      'the tag listing should hold the post the tag was followed from',
    ).toContain(`${POST_ROUTES[0]}/`);
  });

  test('a tag listing marks no category filter option current', async ({
    page,
  }) => {
    await gotoSettled(page, TAG_ROUTES[1]);

    await expect(
      page
        .getByRole('navigation', { name: /filter posts by category/i })
        .locator('a[aria-current="page"]'),
      'no filter option points at a tag listing, so none may claim to be ' +
        'the page you are on',
    ).toHaveCount(0);

    await expect(
      page.getByRole('navigation', { name: /filter posts by category/i }),
      'the filter is still offered, as the way back to the categories',
    ).toBeVisible();
  });
});
