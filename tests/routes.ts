import { readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Every route the site builds.
 *
 * Hardcoded deliberately. Playwright collects test files before the `webServer`
 * command runs, so reading `dist/` at import time would read a stale or absent
 * build and silently produce an empty suite. The list is kept honest by the
 * "route coverage" test in a11y.spec.ts, which reads the real build output and
 * fails if this array and `dist/` have drifted apart.
 *
 * Add a route here when you add a page.
 */
export const ROUTES = [
  '/',
  '/about',
  '/career',
  '/contact',
  '/blog',
  '/blog/example-post',
  '/blog/skincare',
  '/blog/travel',
  '/blog/personal-thoughts',
  '/blog/professional-journey',
  '/blog/open-source',
] as const;

export const DIST_DIR = 'dist';

/** Routes actually present in the build output, derived from index.html files. */
export const routesFromBuild = (distDir = DIST_DIR): string[] => {
  if (!existsSync(distDir)) {
    throw new Error(
      `Build output not found at "${distDir}". Run \`npm run build\` first.`,
    );
  }

  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (entry.name !== 'index.html') continue;

      const rel = relative(distDir, full).split(sep).slice(0, -1).join('/');
      found.push(rel === '' ? '/' : `/${rel}`);
    }
  };

  walk(distDir);

  return found.sort();
};
