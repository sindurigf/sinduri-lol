/*
 * Regenerates src/assets/footer-field.svg from src/lib/footer-field.ts.
 *
 *   node scripts/footer-field.mjs
 *
 * Run it after changing the drawing, or after retoning `border`, `subtle` or
 * `muted` in src/styles/global.css; tests/footer.spec.ts fails until you do.
 * Node runs the TypeScript module directly by stripping its types, so there is
 * nothing to build first.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  FIELD_OUTPUT,
  TOKEN_SOURCE,
  fieldSvg,
  readPalette,
} from '../src/lib/footer-field.ts';

const root = new URL('..', import.meta.url);
const svg = fieldSvg(
  readPalette(readFileSync(new URL(TOKEN_SOURCE, root), 'utf8')),
);
writeFileSync(new URL(FIELD_OUTPUT, root), svg);
console.log(`wrote ${FIELD_OUTPUT}, ${svg.length} bytes`);
