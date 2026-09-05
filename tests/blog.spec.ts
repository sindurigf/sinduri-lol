import { expect, test, type Page } from '@playwright/test';
import { CATEGORY_ROUTES, POSTS_PER_PAGE, POST_ROUTES } from './routes';

/**
 * The blog index: pagination, and the category filter.
 *
 * Both are things a single placeholder post could not verify, which is why
 * eleven were seeded. With one post there is no second page to be unreachable
 * and no category to be inactive, so every assertion below would have passed
 * against a listing that did neither.
 *
 * WHAT THIS ASSERTS THAT READING THE COMPONENT CANNOT.
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

/** SC 2.5.8 asks 24x24 CSS px of a target on its own size. */
const MIN_TARGET = 24;

const POST_COUNT = POST_ROUTES.length;
const LAST_PAGE_COUNT = POST_COUNT - POSTS_PER_PAGE;

/** The href of every post card on the page, in render order. */
const cardHrefs = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('article.card h2 a')].map(
      (a) => new URL((a as HTMLAnchorElement).href).pathname,
    ),
  );

test.describe('the blog index paginates', () => {
  test('page one holds exactly one page of posts', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' });

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
    await page.goto('/blog', { waitUntil: 'networkidle' });
    const first = await cardHrefs(page);

    await page.goto('/blog/page/2', { waitUntil: 'networkidle' });
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
    ).toEqual([...POST_ROUTES].sort());
  });

  test('page two is reachable by keyboard from page one', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' });

    const pager = page.getByRole('navigation', { name: /pagination/i });
    await expect(
      pager,
      'the pager must be a named landmark; there are three navs on this page',
    ).toBeVisible();

    const next = pager.getByRole('link', { name: /next page/i });
    await next.focus();
    await expect(next).toBeFocused();
    await expect(
      next,
      'every control needs a visible focus indicator (SC 2.4.7)',
    ).toHaveCSS('outline-style', 'solid');

    await page.keyboard.press('Enter');
    await page.waitForURL('**/blog/page/2');

    expect(
      await cardHrefs(page),
      'following "Next page" should land on the second page of posts',
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
    await page.goto('/blog', { waitUntil: 'networkidle' });

    const links = page
      .getByRole('navigation', { name: /pagination/i })
      .getByRole('link');
    const count = await links.count();
    expect(count, 'the pager should expose links').toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const box = await links.nth(i).boundingBox();
      const name = await links.nth(i).textContent();
      expect(box?.width, `pager link "${name?.trim()}" width`).toBeGreaterThan(
        MIN_TARGET,
      );
      expect(
        box?.height,
        `pager link "${name?.trim()}" height`,
      ).toBeGreaterThan(MIN_TARGET);
    }
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
    await page.goto('/blog', { waitUntil: 'networkidle' });

    const state = await activeOption(page);
    expect(state, '/blog has no category filter').not.toBeNull();
    const filter = state as NonNullable<typeof state>;

    expect(
      filter.total,
      'the filter should offer every category plus "All posts"',
    ).toBe(CATEGORY_ROUTES.length + 1);
    expect(filter.currentCount, 'exactly one option is current').toBe(1);
    expect(filter.href, '"All posts" is current on /blog').toBe('/blog');

    expect(
      filter.markers.filter(Boolean).length,
      'the non-colour marker must appear on the current option and on no ' +
        'other. If every option has one, or none does, the active state is ' +
        'being carried by the gold fill alone (SC 1.4.1).',
    ).toBe(1);
    expect(filter.currentHasMarker).toBe(true);
  });

  for (const route of CATEGORY_ROUTES) {
    test(`${route} marks its own option, and its posts are all in that category`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'networkidle' });

      const state = await activeOption(page);
      const filter = state as NonNullable<typeof state>;

      expect(filter.currentCount, 'exactly one option is current').toBe(1);
      expect(filter.href, `${route} should mark its own filter option`).toBe(
        route,
      );
      expect(filter.currentHasMarker).toBe(true);

      /*
       * Every card on a category page carries that category's label. This is
       * what makes the filter a filter rather than six links to the same list.
       */
      const label = route.replace('/blog/', '').replaceAll('-', ' ');
      const labels = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            'article.card p.label > span:first-child',
          ),
        ].map((el) => (el.textContent ?? '').trim().toLowerCase()),
      );

      expect(
        labels.length,
        `${route} should list at least one post`,
      ).toBeGreaterThan(0);
      expect(
        [...new Set(labels)],
        `${route} listed a post from another category`,
      ).toEqual([label]);
    });
  }

  test('a filter option is followed by pressing a key on it', async ({
    page,
  }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' });

    const filter = page.getByRole('navigation', {
      name: /filter posts by category/i,
    });
    const target = CATEGORY_ROUTES[0] as string;
    const option = filter.locator(`a[href="${target}"]`);

    await option.focus();
    await expect(option).toBeFocused();
    await expect(
      option,
      'every control needs a visible focus indicator (SC 2.4.7)',
    ).toHaveCSS('outline-style', 'solid');

    /* A key press, not click(). click() would pass against a div. */
    await page.keyboard.press('Enter');
    await page.waitForURL(`**${target}`);

    expect((await activeOption(page))?.href).toBe(target);
  });

  test('every filter target passes SC 2.5.8 on its own size', async ({
    page,
  }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' });

    const links = page
      .getByRole('navigation', { name: /filter posts by category/i })
      .getByRole('link');
    const count = await links.count();
    expect(count).toBe(CATEGORY_ROUTES.length + 1);

    for (let i = 0; i < count; i += 1) {
      const box = await links.nth(i).boundingBox();
      const name = await links.nth(i).textContent();
      expect(box?.width, `filter "${name?.trim()}" width`).toBeGreaterThan(
        MIN_TARGET,
      );
      expect(box?.height, `filter "${name?.trim()}" height`).toBeGreaterThan(
        MIN_TARGET,
      );
    }
  });
});
