import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { builtPages } from './routes';

/**
 * The public accessibility statement at /accessibility, held to
 * ACCESSIBILITY.md.
 *
 * The page derives its facts at build time, so drift is not what this guards.
 * Two other things are:
 *
 *   1. Reachability, which is the reason the page exists. ACCESSIBILITY.md sat
 *      in this repository for months linked from nothing clickable, which is
 *      the same as not having published it. A statement is only a statement if
 *      the person a barrier lands on can get to it, so every page carries the
 *      link.
 *
 *   2. The status sentence, which is the one thing here somebody would soften.
 *      "Target only. No conformance claim." is the honest position for a site
 *      whose manual testing is unfinished, and the standard failure of these
 *      pages is to state a target as though it were an achievement. The
 *      derivation stops the page disagreeing with the file; it does nothing
 *      about both being changed together.
 *
 * So this compares the rendered page against ACCESSIBILITY.md, catching a
 * reformat of the table that the parse in src/lib/accessibility-facts.ts
 * silently survived, and separately asserts the claim is still the honest one.
 *
 * Verified 2026-09-09, against the build as committed:
 *
 *   - claiming conformance in ACCESSIBILITY.md's section 1 table fails "the
 *     status is still the honest one";
 *   - hardcoding a value on the page instead of rendering the derived one
 *     fails "the page reports what the record says". Editing ACCESSIBILITY.md
 *     alone can NEVER fail it, because the page reads that file and the two
 *     move together by construction; what it catches is somebody deciding the
 *     derivation is too clever and typing the values in;
 *   - removing the footer link fails "every page can reach the statement" on
 *     all 25 routes;
 *   - renaming a row in that table fails the BUILD rather than this file,
 *     deliberately: src/lib/accessibility-facts.ts throws instead of
 *     defaulting, so a statement that quietly lost a fact never ships.
 */

const PAGE = '/accessibility';
const RECORD = 'ACCESSIBILITY.md';

/**
 * The status the project currently claims. Not derived, unlike everything else
 * on the page: this is the assertion that the derived value is still the
 * honest one, so deriving it too would make the test agree with whatever it
 * was given and check nothing.
 */
const HONEST_STATUS = 'Target only. No conformance claim.';

const tableValue = (field: string): string => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\|\\s*${escaped}\\s*\\|([^|]+)\\|`, 'm').exec(
    readFileSync(RECORD, 'utf8'),
  );
  expect(match, `${RECORD} has no "${field}" row`).not.toBeNull();
  return match![1]!.trim().replace(/\*\*/g, '');
};

const pageText = (): string => {
  const page = builtPages().find((entry) => entry.route === PAGE);
  expect(page, `${PAGE} was not built`).toBeDefined();

  const html = readFileSync(page!.file, 'utf8');
  return html
    .slice(html.indexOf('<body'))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

test.describe('the accessibility statement', () => {
  test('every page can reach the statement', () => {
    const missing = builtPages()
      .filter(({ route }) => route !== '/404')
      .filter(({ file }) => !readFileSync(file, 'utf8').includes(PAGE))
      .map(({ route }) => route);

    expect(
      missing,
      'route(s) with no link to /accessibility. It is in the footer, so ' +
        'every page should carry one. A statement nobody can reach is the ' +
        'same as no statement, which is what ACCESSIBILITY.md was for months: ' +
        missing.join(', '),
    ).toEqual([]);
  });

  test('the page reports what the record says', () => {
    const text = pageText();

    for (const field of [
      'Target standard',
      'Conformance status',
      'Last reviewed',
    ]) {
      const value = tableValue(field);
      expect(
        text,
        `/accessibility does not show the "${field}" value from ${RECORD}, ` +
          `which is "${value}". The page reads that table at build time, so ` +
          'the two disagreeing means the table was reformatted in a way the ' +
          'parse in src/lib/accessibility-facts.ts survived without noticing.',
      ).toContain(value);
    }
  });

  test('the status is still the honest one', () => {
    /*
     * If the project genuinely reaches its target, this is meant to fail.
     * Update HONEST_STATUS in the same commit and say in the message what
     * testing justifies the claim, in particular that the manual passes in
     * docs/MANUAL_TESTING.md are done: a conformance claim made on automated
     * results alone is not one WCAG supports.
     */
    expect(
      tableValue('Conformance status'),
      `${RECORD} now claims a different conformance status. If that is real, ` +
        'update HONEST_STATUS here in the same commit and say what testing ' +
        'supports it. A conformance claim resting on automated checks alone ' +
        'is not one WCAG supports, and the manual passes are unfinished.',
    ).toBe(HONEST_STATUS);
  });

  test('it tells a reader how to report a barrier', () => {
    /*
     * The page's actual job. Everything above is about the statement being
     * accurate; this is about it being useful to somebody who is stuck right
     * now, which is the only reason any of it is published.
     */
    const text = pageText();

    expect(
      text.toLowerCase(),
      '/accessibility no longer tells anyone how to report a barrier, which ' +
        'is the one thing the page is for.',
    ).toContain('report a barrier');

    for (const route of ['Private reporting', 'Public reporting']) {
      const value = tableValue(route);
      expect(
        readFileSync(
          builtPages().find((entry) => entry.route === PAGE)!.file,
          'utf8',
        ),
        `/accessibility does not offer the ${route.toLowerCase()} route from ` +
          `${RECORD} (${value}). Both are offered on purpose: not everyone ` +
          'can or wants to report a barrier in public.',
      ).toContain(value);
    }
  });
});
