import { expect, test } from './test';
import { NODE } from './tags';
import { rankPages } from '../src/lib/page-match';

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
];

const CASES: readonly (readonly [string, string])[] = [
  ['/blgo/', '/blog/'],
  ['/contcat', '/contact/'],
  ['/abuot', '/about/'],
  ['/talks/', '/talks/open-source-is-not-just-code/'],
  ['/tlks/open-source/', '/talks/open-source-is-not-just-code/'],
  ['/cv', '/sinduri-guntupalli-cv.pdf'],
  ['/opensource', '/blog/open-source/'],
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
