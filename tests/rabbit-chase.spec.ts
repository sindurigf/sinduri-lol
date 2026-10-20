import { expect, test } from './test';
import { chasePages } from '../src/lib/chase-pages';
import { NODE } from './tags';

/* The 404 page's Cheshire crossroads: the reader chooses each way through the site, the White Rabbit marks the likely one. */

const PAGES = [
  { title: 'Home', path: '/' },
  { title: 'Career', path: '/career/' },
  { title: 'Brand', path: '/brand/' },
  { title: 'Color', path: '/brand/#color' },
  { title: 'Blog', path: '/blog/' },
  { title: 'A Post', path: '/blog/a-post/' },
  { title: 'CV', path: '/sinduri-guntupalli-cv.pdf' },
  { title: 'A Talk', path: '/talks/a-talk/' },
];

test.describe('the crossroads map', NODE, () => {
  test('each page trails from Home through the pages above it', () => {
    const map = chasePages(PAGES);
    const trailOf = (path: string) =>
      map.find((page) => page.path === path)!.trail.map((i) => map[i]!.title);
    expect(trailOf('/')).toEqual(['Home']);
    expect(
      trailOf('/brand/#color'),
      'a brand section sits under Brand',
    ).toEqual(['Home', 'Brand', 'Color']);
    expect(trailOf('/blog/a-post/')).toEqual(['Home', 'Blog', 'A Post']);
    expect(
      trailOf('/sinduri-guntupalli-cv.pdf'),
      'the CV sits under Career',
    ).toEqual(['Home', 'Career', 'CV']);
    expect(
      trailOf('/talks/a-talk/'),
      'a talk with no /talks/ page hangs off Home',
    ).toEqual(['Home', 'A Talk']);
  });
});

const ADDRESS = '/blgo/five-yaers-in-drupal';
const rabbitSign = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /the White Rabbit went this way/ });

test.describe('the Cheshire crossroads on a 404', () => {
  test('the White Rabbit marks the way to the page a misspelled address meant', async ({
    page,
  }) => {
    await page.goto(ADDRESS, { waitUntil: 'networkidle' });
    await expect(rabbitSign(page), 'no sign marks the rabbit’s way').toHaveText(
      /^Blog/,
    );
    await rabbitSign(page).click();
    await expect(rabbitSign(page)).toHaveText(/^Five Years in Drupal/);
    await rabbitSign(page).click();

    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail.getByRole('link')).toHaveText([
      'Home',
      'Blog',
      /^Five Years in Drupal/,
    ]);
    const go = page.getByRole('link', { name: /^Go to Five Years in Drupal/ });
    await expect(go, 'focus did not move to the end of the way').toBeFocused();
    await expect(go).toHaveAttribute('href', '/blog/five-years-in-drupal/');
    await expect(page.locator('#crossroads [aria-live="polite"]')).toHaveText(
      /The end of this way/,
    );
    await expect(page.locator('.crossroads-watch')).toHaveText(/2 hops/);
  });

  test('any sign can be taken, focus moves to the next fork, and Climb Back Up returns', async ({
    page,
  }) => {
    await page.goto(ADDRESS, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Brand', exact: true }).click();
    await expect(
      page.locator('.crossroads-sign').first(),
      'focus did not move to the first sign of the new fork',
    ).toBeFocused();
    await expect(page.getByRole('link', { name: 'Go to Brand' })).toBeVisible();
    await page.getByRole('button', { name: 'Climb Back Up' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link'),
    ).toHaveText(['Home']);
  });

  test('every sign is a native button at least 44px tall', async ({ page }) => {
    await page.goto(ADDRESS, { waitUntil: 'networkidle' });
    const heights = await page
      .locator('.crossroads-sign')
      .evaluateAll((signs) =>
        signs.map((sign) => [
          sign.tagName,
          sign.getBoundingClientRect().height,
        ]),
      );
    expect(heights.length, 'no signs at the first fork').toBeGreaterThan(1);
    for (const [tag, height] of heights) {
      expect(tag).toBe('BUTTON');
      expect(
        height as number,
        'a sign under 44px tall (SC 2.5.5)',
      ).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the main pages are plain links and no crossroads is drawn', async ({
    page,
  }) => {
    await page.goto(ADDRESS);
    await expect(page.locator('.crossroads-sign')).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Main pages' }).getByRole('link'),
      'the main pages are the way out without JavaScript',
    ).toHaveText(['Home', 'About', 'Career', 'Blog']);
  });
});
