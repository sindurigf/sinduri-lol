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
const pagesList = (page: import('@playwright/test').Page) =>
  page.getByRole('list', { name: /^Down the .* Way$/ });

test.describe('the 404 signpost', () => {
  test('the White Rabbit’s section starts chosen and its pick is the page a misspelled address meant', async ({
    page,
  }) => {
    await page.goto(ADDRESS, { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('button', { pressed: true }),
      'the rabbit’s section is not chosen first',
    ).toHaveAccessibleName(/^Blog \(the White Rabbit went this way\)$/);
    const pick = page.getByRole('link', { name: /White Rabbit’s pick/ });
    await expect(pick).toHaveAccessibleName(/^Five Years in Drupal/);
    await expect(pick).toHaveAttribute('href', '/blog/five-years-in-drupal/');
  });

  test('choosing a section lists its pages, announces it and keeps focus on the sign', async ({
    page,
  }) => {
    await page.goto(ADDRESS, { waitUntil: 'networkidle' });
    const career = page.getByRole('button', { name: 'Career', exact: true });
    await career.focus();
    await page.keyboard.press('Enter');
    await expect(career).toHaveAttribute('aria-pressed', 'true');
    await expect(career, 'focus left the sign').toBeFocused();
    await expect(pagesList(page)).toHaveAccessibleName('Down the Career Way');
    await expect(pagesList(page).getByRole('link')).toHaveText([
      'Career',
      'CV',
    ]);
    await expect(page.locator('#crossroads [aria-live="polite"]')).toHaveText(
      '2 pages down the Career way.',
    );
    await expect(
      page.getByRole('button', { pressed: true }),
      'more than one section is chosen',
    ).toHaveCount(1);
  });

  for (const width of [390, 1280]) {
    test(`at ${width}px every sign and page is at least 44px tall and the page does not scroll sideways`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ADDRESS, { waitUntil: 'networkidle' });
      const heights = await page
        .locator('.crossroads-sign, .crossroads-page')
        .evaluateAll((targets) =>
          targets.map((target) => target.getBoundingClientRect().height),
        );
      expect(heights.length, 'no signs drawn').toBeGreaterThan(2);
      for (const height of heights) {
        expect(
          height,
          'a target under 44px tall (SC 2.5.5)',
        ).toBeGreaterThanOrEqual(44);
      }
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        'the signpost makes the page scroll sideways',
      ).toBeLessThanOrEqual(0);
    });
  }
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
