/* Chicago title case lowercases these inside a label, never first or last. */
export const TITLE_CASE_SMALL_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'nor',
  'or',
  'the',
  'to',
  'vs',
  'with',
]);

const capitalise = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);

/* The unstyled <title> and link names; visible uses are uppercase CSS. */
export const categoryLabel = (category: string): string => {
  const words = category.split('-');
  const last = words.length - 1;
  return words
    .map((word, index) =>
      index > 0 && index < last && TITLE_CASE_SMALL_WORDS.has(word)
        ? word
        : capitalise(word),
    )
    .join(' ');
};
