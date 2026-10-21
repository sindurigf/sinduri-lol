import { expect, test } from './test';
import { NODE } from './tags';
import { rankPages } from '../src/lib/page-match';
import { builtHtml } from './routes';

/** The 404 finder's ranking (src/lib/page-match.ts): the page a typo meant comes first. */

const PAGES = [
  { title: 'Home', path: '/' },
  { title: 'About', path: '/about/' },
  { title: 'Career', path: '/career/' },
  { title: 'Blog', path: '/blog/' },
  { title: 'Contact', path: '/contact/' },
  { title: 'Contrast', path: '/brand/#contrast' },
  { title: 'Open Source', path: '/blog/open-source/' },
  {
    title: 'Open Source Is Not Just Code',
    path: '/talks/open-source-is-not-just-code/',
  },
  { title: 'CV', path: '/sinduri-guntupalli-cv.pdf' },
  { title: 'Drupal', path: '/blog/tag/drupal/' },
  {
    title: 'Five Years in Drupal: A Sinduri Before and a Sinduri After',
    path: '/blog/five-years-in-drupal/',
  },
  { title: 'RSS Feed', path: '/rss.xml' },
];

const CASES: readonly (readonly [string, string])[] = [
  ['/blgo/', '/blog/'],
  ['/contcat', '/contact/'],
  ['/abuot', '/about/'],
  ['/talks/', '/talks/open-source-is-not-just-code/'],
  ['/tlks/open-source/', '/talks/open-source-is-not-just-code/'],
  ['/cv', '/sinduri-guntupalli-cv.pdf'],
  ['/opensource', '/blog/open-source/'],
  ['/blog/tags/drupal/', '/blog/tag/drupal/'],
  ['/blog/tag/drupl/', '/blog/tag/drupal/'],
  ['/rss', '/rss.xml'],
  ['/feed', '/rss.xml'],
];

test.describe('404 page ranking', NODE, () => {
  for (const [typo, meant] of CASES) {
    test(`${typo} finds ${meant} first`, () => {
      expect(rankPages(PAGES, typo)[0]?.path).toBe(meant);
    });
  }

  test('an address like nothing on the site finds nothing', () => {
    expect(rankPages(PAGES, '/xyzzy/')).toEqual([]);
  });
});

test('the 404 page matches against tag pages and the feed', NODE, () => {
  const html = builtHtml().get('/404') ?? '';
  const data = /<script[^>]*id="site-pages"[^>]*>([\s\S]*?)<\/script>/.exec(
    html,
  )?.[1];
  const paths = (JSON.parse(data ?? '[]') as { path: string }[]).map(
    (page) => page.path,
  );
  expect(paths, 'the 404 page lists no tag page').toContainEqual(
    expect.stringMatching(/^\/blog\/tag\/[^/]+\/$/),
  );
  expect(paths, 'the 404 page lists no feed').toContain('/rss.xml');
});
