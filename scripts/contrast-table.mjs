/*
 * The contrast table in docs/STYLEGUIDE.md, generated from the live colour
 * tokens so it cannot drift from them. Every approved foreground and
 * background pairing is listed with its job, the ratio that job needs, and
 * the ratio measured from the hex values in src/styles/global.css.
 *
 *   node scripts/contrast-table.mjs          print the table
 *   node scripts/contrast-table.mjs --write  replace it in docs/STYLEGUIDE.md
 *
 * tests/contrast-table.spec.ts fails when the document and the tokens differ.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CSS = join(ROOT, 'src/styles/global.css');
const DOC = join(ROOT, 'docs/STYLEGUIDE.md');
export const START = '<!-- contrast-table:start -->';
export const END = '<!-- contrast-table:end -->';

/* WCAG 2.2: SC 1.4.3 for text, SC 1.4.11 for large text and non-text. */
const NEEDS = { text: 4.5, 'non-text': 3, decoration: null, apart: null };

/*
 * The approved pairings: which token is used on which ground, for what. This
 * is the design decision; the ratios are measured, never typed.
 */
const PAIRS = [
  ['text', 'background', 'text', 'Reading text, headings'],
  ['text', 'surface', 'text', 'Text inside cards and inputs'],
  ['text', 'joint', 'text', 'Hero text crossing a cast-block joint'],
  ['subtle', 'background', 'text', 'Captions, meta, helper text'],
  ['subtle', 'surface', 'text', 'Helper and required text in cards'],
  ['subtle', 'joint', 'text', 'Meta crossing a joint'],
  ['gold', 'background', 'text', 'Page title, card labels'],
  ['gold', 'surface', 'text', 'Card labels'],
  ['gold', 'joint', 'text', 'Page title crossing a joint'],
  ['pink-text', 'background', 'text', 'Error text, pink glyphs'],
  ['pink-text', 'surface', 'text', 'Error text in the form card'],
  ['pink-text', 'joint', 'text', 'Pink glyphs crossing a joint'],
  ['cyan', 'background', 'text', 'Hover text; the focus ring (needs 3)'],
  ['cyan', 'surface', 'text', 'Hover text and focus ring in cards'],
  ['cyan', 'joint', 'text', 'Focus ring crossing a joint'],
  ['border', 'background', 'non-text', 'Every boundary'],
  ['border', 'surface', 'non-text', 'Input and chip edges on a card'],
  ['border', 'joint', 'non-text', 'Chip edges crossing a joint'],
  ['pink', 'background', 'non-text', 'Error edge; action shadow'],
  ['pink', 'surface', 'non-text', 'Error edge on the form card'],
  ['background', 'gold', 'text', 'Label on a gold fill'],
  ['background', 'cyan', 'text', 'Label on a hovered button'],
  ['background', 'text', 'text', 'Badge; the current page block'],
  ['background', 'pink', 'text', 'Glyph on the pink category tile'],
  ['gold-text', 'gold', 'text', 'Text on the gold surface'],
  ['gold-muted', 'gold', 'text', 'Secondary text on gold'],
  ['darkcyan', 'gold', 'text', 'Links on gold'],
  ['gold-border', 'gold', 'non-text', 'Boundaries on gold'],
  ['gold-btn-label', 'gold-text', 'text', 'Label on the dark button on gold'],
  ['gold', 'background', 'decoration', 'Object shadow'],
  ['cyan', 'background', 'decoration', 'Hovered card shadow'],
  ['joint', 'background', 'decoration', 'Cast-block joints and bolts'],
  ['pink', 'gold', 'decoration', 'Button shadow on the gold surface'],
  ['cyan', 'pink', 'apart', 'A ring never touches a pink shadow'],
  ['cyan', 'gold', 'apart', 'A ring never touches a gold shadow or fill'],
  ['cyan', 'border', 'apart', 'A ring never touches a neighbour edge'],
  ['pink', 'border', 'apart', 'An error is a shape change, not a recolour'],
  ['text', 'subtle', 'apart', 'The two text colours never carry a state'],
];

export const readTokens = (css = readFileSync(CSS, 'utf8')) => {
  const tokens = {};
  for (const [, name, hex] of css.matchAll(
    /--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    tokens[name] = hex.toUpperCase();
  }
  return tokens;
};

const luminance = (hex) => {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

export const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const verdict = (job, value) => {
  const needs = NEEDS[job];
  if (job === 'apart') return 'kept apart';
  if (needs === null) return 'decoration';
  return value >= needs ? 'pass' : '**FAIL**';
};

export const renderTable = (tokens = readTokens()) => {
  const rows = PAIRS.map(([fg, bg, job, use]) => {
    if (!tokens[fg] || !tokens[bg]) {
      throw new Error(
        `contrast-table: no token --color-${!tokens[fg] ? fg : bg}`,
      );
    }
    const value = ratio(tokens[fg], tokens[bg]);
    const needs = NEEDS[job] === null ? 'n/a' : NEEDS[job].toFixed(1);
    return `| \`${fg}\` ${tokens[fg]} | \`${bg}\` ${tokens[bg]} | ${job} | ${use} | ${needs} | ${value.toFixed(2)} | ${verdict(job, value)} |`;
  });
  return [
    START,
    '',
    '<!-- Generated by scripts/contrast-table.mjs --write from src/styles/global.css. tests/contrast-table.spec.ts fails if it drifts. -->',
    '',
    '| Foreground | Background | Job | Used for | Needs | Ratio | Result |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    END,
  ].join('\n');
};

export const documentedTable = (doc = readFileSync(DOC, 'utf8')) => {
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  return start === -1 || end === -1 ? null : doc.slice(start, end + END.length);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const table = renderTable();
  if (process.argv.includes('--write')) {
    const doc = readFileSync(DOC, 'utf8');
    const current = documentedTable(doc);
    if (current === null) {
      throw new Error(`contrast-table: ${DOC} has no ${START} … ${END} block`);
    }
    writeFileSync(DOC, doc.replace(current, table));
    console.log('contrast-table: docs/STYLEGUIDE.md updated');
  } else {
    console.log(table);
  }
}
