import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './test';
import { NODE } from './tags';
import { DIST_DIR } from './routes';
import { slideCountLabel } from '../src/lib/slides';

const TALKS_INDEX = join(DIST_DIR, 'talks', 'index.html');
const CARD_LABEL =
  /<li class="card[^"]*">[\s\S]*?<span class="label[^"]*">([^<]*)<\/span>/g;
const COUNT_LABEL = /^\d+ slides?$/;

test.describe('talk slide count label', NODE, () => {
  test('uses the singular for one slide and the plural otherwise', () => {
    expect(slideCountLabel(1), 'one slide reads "1 slide"').toBe('1 slide');
    expect(slideCountLabel(2), 'two slides read "2 slides"').toBe('2 slides');
    expect(slideCountLabel(0), 'zero slides read "0 slides"').toBe('0 slides');
  });
});

test.describe('talk index built HTML', NODE, () => {
  test('shows a slide count on every talk card', () => {
    expect(
      existsSync(TALKS_INDEX),
      `${TALKS_INDEX} is missing; run npm run build`,
    ).toBe(true);
    const html = readFileSync(TALKS_INDEX, 'utf8');
    const labels = [...html.matchAll(CARD_LABEL)].map((match) =>
      (match[1] ?? '').trim(),
    );
    expect(labels.length, 'the talks index lists no cards').toBeGreaterThan(0);
    for (const label of labels) {
      expect(label, `card label "${label}" lacks a slide count`).toMatch(
        COUNT_LABEL,
      );
    }
  });
});
