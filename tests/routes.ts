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
 *
 * `/404` is in the list so the page is scanned and measured like any other,
 * and `astro preview` does serve it at that path with a 200. That is NOT what
 * proves the 404 works: preview is serving the file directly, and it would do
 * that whether or not unknown paths ever reach it. tests/not-found.spec.ts
 * asserts the status code on a path that does not exist, which is the part
 * that can actually regress.
 */
export const ROUTES = [
  '/',
  '/404',
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

/**
 * Routes actually present in the build output, derived from its HTML files.
 *
 * Two shapes, because Astro emits two. Every ordinary page is written as
 * `<route>/index.html`, and the route is the directory. `src/pages/404.astro`
 * is special-cased by Astro and written as `dist/404.html` at the root, which
 * is the filename Cloudflare Pages looks for when nothing matches a request.
 * Matching only `index.html` would leave the 404 page out of this list
 * entirely, so the coverage test would have kept passing with `/404` in ROUTES
 * removed, or with the page itself deleted.
 */
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

      if (!entry.name.endsWith('.html')) continue;

      const segments = relative(distDir, full).split(sep);

      if (entry.name === 'index.html') {
        const rel = segments.slice(0, -1).join('/');
        found.push(rel === '' ? '/' : `/${rel}`);
        continue;
      }

      segments[segments.length - 1] = entry.name.replace(/\.html$/, '');
      found.push(`/${segments.join('/')}`);
    }
  };

  walk(distDir);

  return found.sort();
};
