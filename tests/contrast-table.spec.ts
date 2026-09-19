import { expect, test } from './test';
import { documentedTable, renderTable } from '../scripts/contrast-table.mjs';

/**
 * The contrast table in docs/STYLEGUIDE.md is generated from the colour
 * tokens by scripts/contrast-table.mjs. This fails when a token changes and
 * the table does not, or the table is edited by hand. Prettier pads the
 * columns, so rows are compared cell by cell rather than as raw text.
 *
 * Proven able to fail, 2026-09-19: with --color-subtle retoned to #8FA8BA in
 * global.css, the subtle rows differed: 8.62 documented, 7.50 measured.
 */
const cells = (table: string | null): string[][] =>
  (table ?? '')
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|\s*-/.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

test('the documented contrast table matches the colour tokens', () => {
  const documented = documentedTable();
  expect(
    documented,
    'docs/STYLEGUIDE.md has no contrast-table block; run node scripts/contrast-table.mjs --write',
  ).not.toBeNull();
  expect(
    cells(documented),
    'the contrast table has drifted from the tokens; run node scripts/contrast-table.mjs --write',
  ).toEqual(cells(renderTable()));
});

test('every approved pairing meets the ratio its job needs', () => {
  const failing = cells(renderTable()).filter(
    (row) => row.at(-1) === '**FAIL**',
  );
  expect(failing).toEqual([]);
});
