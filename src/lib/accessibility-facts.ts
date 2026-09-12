import source from '../../ACCESSIBILITY.md?raw';

/*
 * The facts the public accessibility statement must not get wrong, read out
 * of ACCESSIBILITY.md rather than restated on the page.
 *
 * WHY DERIVE RATHER THAN WRITE. The failure mode of a published statement is
 * not absence, it is being confidently out of date in front of the people
 * least able to check it: a conformance status that disagrees with the file
 * recording the testing, or a review date that stopped moving. ACCESSIBILITY.md
 * is the single source, §9 requires it to be updated in the same commit as
 * the change it describes, and CI holds several of its tables to the CSS.
 *
 * Only the values that go stale on their own are derived: the target
 * standard, the conformance status, the review date and the two reporting
 * routes. The rest of the page is stable prose and is written there.
 *
 * The parse is strict and throws rather than falling back, because a silent
 * default renders an authoritative-looking statement nobody checked. If §1's
 * table is reformatted this fails the build; tests/accessibility-page.spec.ts
 * asserts the rendered page against the same file from the other side.
 */

/** One `| Field | Value |` row from the §1 table, by field name. */
const tableValue = (field: string): string => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\|\\s*${escaped}\\s*\\|([^|]+)\\|`, 'm').exec(
    source,
  );

  if (!match) {
    throw new Error(
      `ACCESSIBILITY.md has no "${field}" row in its section 1 table. The ` +
        'public statement at /accessibility reads that table so the two ' +
        'cannot disagree. Restore the row, or update src/lib/' +
        'accessibility-facts.ts to match the new shape.',
    );
  }

  /* Strip the bold markers the table uses for emphasis; this is not Markdown. */
  return match[1]!.trim().replace(/\*\*/g, '');
};

export const accessibilityFacts = {
  /** e.g. "WCAG 2.2 Level AA, with AAA text contrast where achievable". */
  targetStandard: tableValue('Target standard'),
  /**
   * Rendered verbatim and prominently. The honest status is the most
   * important thing on the page, and the sentence most likely to be quietly
   * softened later.
   */
  conformanceStatus: tableValue('Conformance status'),
  /** ISO date. Shown so a reader can judge how current the claim is. */
  lastReviewed: tableValue('Last reviewed'),
  /** Public issue tracker, for anyone happy to report in the open. */
  publicReporting: tableValue('Public reporting'),
  /** Email, for anyone who is not. */
  privateReporting: tableValue('Private reporting'),
} as const;
