/* Pure: ranks the site's pages by how close their address is to a mistyped one. */

export interface MatchablePage {
  readonly title: string;
  readonly path: string;
}

/* Lower is closer: 0 is the same address, 1 shares nothing. */
const FAR = 1;
/* A distance above this is no match at all. */
export const MATCH_LIMIT = 0.6;
/* How much a word shared with the page title brings it closer. */
const TITLE_WORD_PULL = 0.15;

const levenshtein = (a: string, b: string): number => {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(
        row[j]! + 1,
        next[j - 1]! + 1,
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    row = next;
  }
  return row[b.length]!;
};

const closeness = (a: string, b: string): number =>
  a.length + b.length === 0
    ? 0
    : levenshtein(a, b) / Math.max(a.length, b.length);

const segments = (path: string): string[] =>
  path
    .toLowerCase()
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export const rankPages = <T extends MatchablePage>(
  pages: readonly T[],
  requested: string,
): T[] => {
  let wanted = requested;
  try {
    wanted = decodeURIComponent(requested);
  } catch {
    /* A malformed escape is matched as typed. */
  }
  const asked = segments(wanted);
  const askedWords = new Set(asked.flatMap(words));
  const scored = pages.map((page) => {
    const own = segments(page.path);
    const whole = closeness(asked.join('/'), own.join('/'));
    const last =
      asked.length && own.length ? closeness(asked.at(-1)!, own.at(-1)!) : FAR;
    const shared = words(page.title).filter((word) =>
      [...askedWords].some((askedWord) => closeness(askedWord, word) <= 0.25),
    ).length;
    return { page, score: Math.min(whole, last) - shared * TITLE_WORD_PULL };
  });
  return scored
    .filter(({ score }) => score <= MATCH_LIMIT)
    .sort((a, b) => a.score - b.score)
    .map(({ page }) => page);
};
