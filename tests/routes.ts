import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Every route the site builds. Add a route here when you add a page.
 *
 * Hardcoded on purpose. Playwright collects test files before the `webServer`
 * command builds the site, so reading `dist/` at module scope reads an absent
 * or stale build and generates the wrong tests, or none, without failing.
 * Read `dist/` only inside a test body. The "route coverage" test in
 * a11y.spec.ts compares this list with the build and fails when they drift.
 *
 * `/404` is listed so the page is scanned like any other. `astro preview`
 * serves that file at that path with a 200, which says nothing about unknown
 * paths; tests/not-found.spec.ts asserts the status on a path that does not
 * exist.
 *
 * The blog routes are grouped by the file that generates them, so a route in
 * the wrong group stands out (`/blog/travel` is a category, not a post), and
 * tests/blog.spec.ts can count posts from POST_ROUTES.
 */
const PAGE_ROUTES = [
  '/',
  '/404',
  '/about',
  '/career',
  '/contact',
  /*
   * The contact form's confirmation. Prerendered, so it is an asset like every
   * other page and every suite that walks ROUTES measures it.
   *
   * `/contact/send/` is deliberately absent: it is the one on-demand route, it
   * renders nothing for a GET, and it is not in the build for the route
   * coverage test to find. tests/contact.spec.ts exercises it.
   */
  '/contact/sent',
  // Linked from the footer, so every suite that walks ROUTES measures them.
  '/accessibility',
  '/privacy',
] as const;

/**
 * Category listings, from `src/pages/blog/[category]/index.astro`. One per
 * entry in BLOG_CATEGORIES (`src/content.config.ts`).
 */
export const CATEGORY_ROUTES = [
  '/blog/skincare',
  '/blog/travel',
  '/blog/personal-thoughts',
  '/blog/professional-journey',
  '/blog/open-source',
] as const;

/** Posts, from `src/pages/blog/[slug].astro`. Newest first. */
export const POST_ROUTES = [
  '/blog/open-source-is-not-just-code',
  '/blog/lorem-ipsum-dolor-sit-amet',
  '/blog/consectetur-adipiscing-elit',
  '/blog/ut-enim-ad',
  '/blog/quis-nostrud-exercitation-ullamco',
  '/blog/duis-aute-irure-dolor',
  '/blog/excepteur-sint-occaecat',
  '/blog/sed-ut-perspiciatis-unde-omnis',
  '/blog/nemo-enim-ipsam-voluptatem',
  '/blog/neque-porro-quisquam-est',
  '/blog/temporibus-autem-quibusdam',
] as const;

/**
 * The blog index: `/blog` (`src/pages/blog/index.astro`), then `/blog/page/<n>`
 * (`src/pages/blog/page/[page].astro`). `/blog/page/2` exists because the
 * index shows nine posts a page and there are eleven (2026-09-11).
 *
 * The `page` segment avoids a collision: `/blog/[category]` and `/blog/[slug]`
 * already share the segment after `/blog`, so `/blog/2` would clash with any
 * numeric category or slug.
 */
const INDEX_ROUTES = ['/blog', '/blog/page/2'] as const;

export const ROUTES = [
  ...PAGE_ROUTES,
  ...INDEX_ROUTES,
  ...CATEGORY_ROUTES,
  ...POST_ROUTES,
] as const;

/**
 * A copy of `POSTS_PER_PAGE` in `src/lib/blog.ts`. It cannot be imported:
 * Playwright collects this file in plain Node, and anything that reaches
 * `astro:content` fails at collection time and takes the suite with it. The
 * pagination test in tests/blog.spec.ts counts the rendered cards, so a
 * drifted copy fails there.
 */
export const POSTS_PER_PAGE = 9;

/*
 * The adapter splits the build into `dist/client` and `dist/server`. The
 * assets, and everything these specs read, are the client half.
 */
export const DIST_DIR = 'dist/client';

/** Where the Markdown lives. Mirrors BLOG_CONTENT_DIR in content.config.ts. */
export const BLOG_CONTENT_DIR = 'src/content/blog';

/**
 * The post routes the Markdown in `src/content/blog/` should produce.
 *
 * `routesFromBuild` compares ROUTES with `dist/`; this compares POST_ROUTES
 * with the source, so a post added or renamed without updating POST_ROUTES
 * fails with the file name, which is where the fix is.
 *
 * Astro's `glob()` loader uses the path without its extension as the entry
 * id, and every post is a flat `<slug>.md`, so the slug is the basename. A
 * post in a subdirectory breaks that and fails the comparison.
 */
export const postRoutesFromContent = (
  contentDir = BLOG_CONTENT_DIR,
): string[] => {
  if (!existsSync(contentDir)) {
    throw new Error(`Blog content not found at "${contentDir}".`);
  }

  return readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `/blog/${entry.name.replace(/\.md$/, '')}`)
    .sort();
};

/**
 * Routes present in the build, derived from its HTML files.
 *
 * Astro writes each page as `<route>/index.html`, except `src/pages/404.astro`,
 * which becomes `dist/client/404.html`, the file Workers serves when nothing
 * matches. Matching only `index.html` would drop `/404`, and the coverage test
 * would pass with the page deleted.
 */
export const builtPages = (
  distDir = DIST_DIR,
): { route: string; file: string }[] => {
  if (!existsSync(distDir)) {
    throw new Error(
      `Build output not found at "${distDir}". Run \`npm run build\` first.`,
    );
  }

  const found: { route: string; file: string }[] = [];

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
        found.push({ route: rel === '' ? '/' : `/${rel}`, file: full });
        continue;
      }

      segments[segments.length - 1] = entry.name.replace(/\.html$/, '');
      found.push({ route: `/${segments.join('/')}`, file: full });
    }
  };

  walk(distDir);

  return found;
};

export const routesFromBuild = (distDir = DIST_DIR): string[] =>
  builtPages(distDir)
    .map((page) => page.route)
    .sort();

/** Every built page's HTML, keyed by route. Call inside a test body. */
export const builtHtml = (distDir = DIST_DIR): Map<string, string> =>
  new Map(
    builtPages(distDir).map((page) => [
      page.route,
      readFileSync(page.file, 'utf8'),
    ]),
  );

/**
 * The routes whose built HTML carries a hydrated island for `component`.
 *
 * The completeness guard for a spec that walks a hardcoded subset of ROUTES.
 * Such a spec keeps passing when the component appears on a new route, which
 * then has no coverage; comparing the literal with this, inside a test, makes
 * that a failure. See `BADGE_ROUTES` in tests/motion.spec.ts and ARCHITECTURE.md >
 * Conventions > Tests.
 *
 * Calling this at module scope instead of keeping the literal reads an absent
 * or stale `dist/`, for the same reason ROUTES is hardcoded.
 *
 * Matched on Astro's `component-url` attribute, so the component's name in an
 * HTML comment or in prose does not count.
 */
export const islandRoutesFromBuild = (
  component: string,
  distDir = DIST_DIR,
): string[] => {
  const marker = new RegExp(`component-url="[^"]*/${component}\\.[^"]*\\.js"`);

  return builtPages(distDir)
    .filter((page) => marker.test(readFileSync(page.file, 'utf8')))
    .map((page) => page.route)
    .sort();
};
