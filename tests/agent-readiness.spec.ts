import { test, expect } from './test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { headersFor, parseHeadersFile } from './policy-server';
import { DIST_DIR, POST_ROUTES, builtHtml } from './routes';

/*
 * Two of specification.website's Agent Readiness items, beside /llms.txt
 * (tests/llms-txt.spec.ts): the `Link` discovery header in public/_headers,
 * and the Markdown source of each post from src/lib/markdown-source.ts.
 *
 * Verified not to be vacuous, 2026-09-18: `rel="describedby"` renamed in
 * public/_headers fails the first test, and the image rewrite in
 * src/lib/markdown-source.ts disabled fails the third naming the post whose
 * images were left relative. Restored, all three pass.
 */

const SITE = 'https://sinduri.lol';

const linkTargets = (): Map<string, string> => {
  const rules = parseHeadersFile(
    readFileSync(join(DIST_DIR, '_headers'), 'utf8'),
  );
  const link = headersFor(rules, '/').get('link') ?? '';
  return new Map(
    [...link.matchAll(/<([^>]+)>;\s*rel="([^"]+)"/g)].map((match) => [
      match[2]!,
      match[1]!,
    ]),
  );
};

const sourcePath = (route: string): string => `${route}.md`;

test.describe('agent readiness', () => {
  test('the Link header names llms.txt, the sitemap and the feed, and all three exist', () => {
    const targets = linkTargets();
    expect(Object.fromEntries(targets), 'the Link header on / changed').toEqual(
      {
        describedby: '/llms.txt',
        sitemap: '/sitemap-index.xml',
        alternate: '/rss.xml',
      },
    );
    for (const [rel, path] of targets) {
      expect(
        existsSync(join(DIST_DIR, path)),
        `Link rel="${rel}" points at ${path}, which the build does not emit`,
      ).toBe(true);
    }
  });

  test('every post links its Markdown source', () => {
    const pages = builtHtml();
    for (const route of POST_ROUTES) {
      expect(
        pages.get(route),
        `${route} should carry <link rel="alternate" type="text/markdown">`,
      ).toContain(
        `<link rel="alternate" type="text/markdown" href="${sourcePath(route)}">`,
      );
    }
  });

  test('every Markdown source stands on its own', () => {
    for (const route of POST_ROUTES) {
      const file = join(DIST_DIR, sourcePath(route));
      expect(existsSync(file), `${sourcePath(route)} was not built`).toBe(true);
      const source = readFileSync(file, 'utf8');

      expect(source, `${route}: no YAML frontmatter`).toMatch(
        /^---\n[\s\S]+?\n---\n/,
      );
      expect(
        source,
        `${route}: the frontmatter should name the page as canonical`,
      ).toContain(`canonical: "${SITE}${route}/"`);
      expect(
        [...source.matchAll(/\]\((\.\.?\/[^)\s]*)/g)].map((m) => m[1]),
        `${route}: a link or image is relative to the repository, not the site`,
      ).toEqual([]);
      expect(
        [...source.matchAll(/\]\((\/[^)\s]*)/g)].map((m) => m[1]),
        `${route}: a root-relative link has no origin in a file read as text`,
      ).toEqual([]);

      const images = [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map(
        (m) => m[1]!,
      );
      for (const url of images) {
        const path = url.replace(SITE, '');
        expect(
          existsSync(join(DIST_DIR, path)),
          `${route}: image ${url} is not in the build`,
        ).toBe(true);
      }
    }
  });
});
