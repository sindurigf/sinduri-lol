import { expect, test } from './test';
import { chasePages } from '../src/lib/chase-pages';
import { NODE } from './tags';

/* The 404 page's White Rabbit: it guides a lost reader, hop by hop along a real breadcrumb, to the page the address meant. */

const PAGES = [
  { title: 'Home', path: '/' },
  { title: 'Career', path: '/career/' },
  { title: 'Brand', path: '/brand/' },
  { title: 'Color', path: '/brand/#color' },
  { title: 'Blog', path: '/blog/' },
  { title: 'Open Source', path: '/blog/open-source/' },
  { title: 'A Post', path: '/blog/a-post/' },
  { title: 'CV', path: '/sinduri-guntupalli-cv.pdf' },
  { title: 'A Talk', path: '/talks/a-talk/' },
];

test.describe('the rabbit map', NODE, () => {
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

const followAll = async (page: import('@playwright/test').Page) => {
  const follow = page.getByRole('button', { name: 'Follow the Rabbit' });
  let hops = 0;
  while ((await follow.isVisible()) && hops < 10) {
    await follow.click();
    hops += 1;
  }
  return hops;
};

test.describe('the White Rabbit on a 404', () => {
  test('hops along the breadcrumb to the page a misspelled address meant, then offers it', async ({
    page,
  }) => {
    await page.goto('/blgo/five-yaers-in-drupal', { waitUntil: 'networkidle' });
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail, 'the chase did not start').toBeVisible();

    const hops = await followAll(page);
    expect(hops, 'the rabbit took the wrong number of hops').toBe(3);
    await expect(trail.getByRole('link')).toHaveText([
      'Home',
      'Blog',
      /^Five Years in Drupal/,
    ]);
    await expect(trail.getByRole('link').last()).toHaveAttribute(
      'aria-current',
      'location',
    );

    const go = page.getByRole('link', { name: /^Go to Five Years in Drupal/ });
    await expect(go, 'focus did not move to the result').toBeFocused();
    await expect(go).toHaveAttribute('href', '/blog/five-years-in-drupal/');
    await expect(page.locator('#rabbit-chase [aria-live="polite"]')).toHaveText(
      /stops at Five Years in Drupal/,
    );
  });

  test('with no match it tours the main pages and offers the homepage', async ({
    page,
  }) => {
    await page.goto(`/xyzzy-${crypto.randomUUID()}`, {
      waitUntil: 'networkidle',
    });
    await followAll(page);
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail.getByRole('link').first()).toHaveText('Home');
    const go = page.locator('#rabbit-chase [data-result] a');
    await expect(go).toHaveText('Go to the Homepage');
    await expect(go, 'focus did not move to the result').toBeFocused();
  });

  test('the Follow button is a native button at least 44px tall', async ({
    page,
  }) => {
    await page.goto('/blgo', { waitUntil: 'networkidle' });
    const box = await page
      .getByRole('button', { name: 'Follow the Rabbit' })
      .boundingBox();
    expect(
      box!.height,
      'Follow is under 44px tall (SC 2.5.5)',
    ).toBeGreaterThanOrEqual(44);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the chase stays hidden and the plain links lead out', async ({
    page,
  }) => {
    await page.goto('/blgo');
    await expect(page.locator('#rabbit-chase')).toBeHidden();
    await expect(
      page.getByRole('link', { name: 'Go to the Homepage' }),
      'the hero links are the way out without JavaScript',
    ).toBeVisible();
  });
});
