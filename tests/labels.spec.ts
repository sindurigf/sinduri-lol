import { expect, test } from './test';
import { categoryLabel, TITLE_CASE_SMALL_WORDS } from '../src/lib/labels';
import { NODE } from './tags';

const SLUGS = [
  'open-source',
  'what-to-look-for',
  'things-to-do-in',
  'a-day-in-the-life-of-a-maintainer',
  'women-in-drupal',
  'travel',
  'the-end-with',
  'from-here-to-there',
  'look-at-it-but-never-by-me',
];

const startsUpper = (word: string): boolean => /^\p{Lu}/u.test(word);

test.describe('categoryLabel', NODE, () => {
  for (const slug of SLUGS) {
    test(`capitalises the first and last word of ${slug}`, () => {
      const words = categoryLabel(slug).split(' ');
      expect(startsUpper(words[0]!), 'first word is lower case.').toBe(true);
      expect(startsUpper(words.at(-1)!), 'last word is lower case.').toBe(true);
    });

    test(`keeps inner small words of ${slug} lower case and capitalises the rest`, () => {
      const words = categoryLabel(slug).split(' ');
      words.slice(1, -1).forEach((word) => {
        expect(startsUpper(word), `"${word}" in "${slug}".`).toBe(
          !TITLE_CASE_SMALL_WORDS.has(word.toLowerCase()),
        );
      });
    });
  }
});
