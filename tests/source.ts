import { globSync, readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import {
  cssColorToken as readCssColorToken,
  GLOBAL_CSS,
} from '../src/lib/css-token';

/** Values read from the repository, not copied, so a stale copy cannot pass. */
const ASTRO_CONFIG = 'astro.config.mjs';
const CONTENT_CONFIG = 'src/content.config.ts';

export { GLOBAL_CSS };

export const STYLESHEETS = 'src/styles/**/*.css';

/** Every stylesheet `GLOBAL_CSS` imports, and itself, as one string. */
export const stylesheetSource = (): string =>
  globSync(STYLESHEETS)
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

/**
 * Same parse astro.config.mjs uses for `__THEME_COLOR__`. Throws on a token
 * defined twice, so a `prefers-color-scheme` override fails the build.
 */
export const cssColorToken = (name: string): string =>
  readCssColorToken(name).toLowerCase();

/**
 * `site` from astro.config.mjs, without a trailing slash. Searched from
 * `defineConfig({` at its own indent so a commented-out origin cannot match.
 */
export const configuredSite = (): string => {
  const source = readFileSync(ASTRO_CONFIG, 'utf8');
  const config = source.slice(source.indexOf('defineConfig({'));
  const match = /^ {2}site:\s*['"]([^'"]+)['"]/m.exec(config);

  expect(match, `no \`site\` found in ${ASTRO_CONFIG}.`).not.toBeNull();

  return match![1]!.replace(/\/$/, '');
};

/** `BLOG_CATEGORIES` from src/content.config.ts, which imports `astro:content`. */
export const blogCategories = (): string[] => {
  const source = readFileSync(CONTENT_CONFIG, 'utf8');
  const list = /BLOG_CATEGORIES = \[([^\]]*)\]/.exec(source)?.[1];

  expect(list, `no BLOG_CATEGORIES found in ${CONTENT_CONFIG}.`).toBeDefined();

  return [...list!.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]!);
};
