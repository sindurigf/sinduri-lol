import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

/**
 * Values specs read out of the repository instead of copying them, so a stale
 * copy cannot make an assertion pass. Call these inside test bodies.
 */
export const GLOBAL_CSS = 'src/styles/global.css';
export const ASTRO_CONFIG = 'astro.config.mjs';

/**
 * A colour token's hex from global.css, lower-cased. The same pattern
 * src/lib/theme-color.ts uses for `--color-background`.
 */
export const cssColorToken = (name: string): string => {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const match = new RegExp(`${escaped}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(
    readFileSync(GLOBAL_CSS, 'utf8'),
  );

  expect(
    match,
    `${name} was not found in ${GLOBAL_CSS}. If the token was renamed, update ` +
      'the specs that read it, and src/lib/theme-color.ts for the background.',
  ).not.toBeNull();

  return match![1]!.toLowerCase();
};

/** `site` from astro.config.mjs, without a trailing slash. */
export const configuredSite = (): string => {
  const match = /site:\s*['"]([^'"]+)['"]/.exec(
    readFileSync(ASTRO_CONFIG, 'utf8'),
  );

  expect(
    match,
    `no \`site\` found in ${ASTRO_CONFIG}. Every absolute URL the build ` +
      'emits comes from it: the canonical links, the Open Graph tags, the ' +
      'sitemap entries and the Sitemap line in robots.txt.',
  ).not.toBeNull();

  return match![1]!.replace(/\/$/, '');
};
