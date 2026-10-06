import { expect, test } from './test';
import { categoryLabel } from '../src/lib/labels';
import { NODE } from './tags';

const EXPECTED: ReadonlyArray<readonly [slug: string, label: string]> = [
  ['open-source', 'Open Source'],
  ['travel', 'Travel'],
  ['what-to-look-for', 'What to Look For'],
  ['things-to-do-in', 'Things to Do In'],
  ['a-day-in-the-life-of-a-maintainer', 'A Day in the Life of a Maintainer'],
  ['women-in-drupal', 'Women in Drupal'],
  ['the-end-with', 'The End With'],
  ['from-here-to-there', 'From Here to There'],
  ['look-at-it-but-never-by-me', 'Look at It but Never by Me'],
  ['neither-here-nor-there', 'Neither Here nor There'],
  ['thrive-vs-decay', 'Thrive vs Decay'],
];

const startsUpper = (word: string): boolean => /^\p{Lu}/u.test(word);

test.describe('categoryLabel', NODE, () => {
  for (const [slug, label] of EXPECTED) {
    test(`${slug} is "${label}"`, () => {
      expect(categoryLabel(slug)).toBe(label);
    });

    test(`capitalises the first and last word of ${slug}`, () => {
      const words = categoryLabel(slug).split(' ');
      expect(startsUpper(words[0]!), 'first word is lower case.').toBe(true);
      expect(startsUpper(words.at(-1)!), 'last word is lower case.').toBe(true);
    });
  }
});
