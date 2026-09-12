/** WCAG 2.2 values more than one spec uses. Contrast ratios are in contrast.ts. */

/**
 * SC 2.5.8 Target Size (Minimum): 24x24 CSS px on the target's own box. At
 * least 24, so compare with `toBeGreaterThanOrEqual`; a 24.0px target passes.
 */
export const MIN_TARGET = 24;

/**
 * Every A and AA tag up to WCAG 2.2, for axe. No rule is disabled and no
 * result is excluded: a failure is a defect to fix in the markup, never here.
 */
export const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

/** SC 1.4.10 Reflow width: 1280px at 400% zoom. */
export const REFLOW_VIEWPORT = { width: 320, height: 720 };
