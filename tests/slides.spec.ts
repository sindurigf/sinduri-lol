import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { builtPages, DIST_DIR } from './routes';

/**
 * The talk slides linked from the open source post: three figures that rot
 * silently, and one link that can 404.
 *
 * A download link names its format, its size and, here, its page count,
 * because the control hands over a file rather than moving between pages. All
 * three are measurements typed into Markdown, which is the one place in this
 * repository that cannot compute them: `src/pages/career.astro` measures its
 * CV with `statSync` at build time so the number cannot drift, and a content
 * collection has no equivalent. ARCHITECTURE.md says not to copy a measured value
 * without a check that fails; this is that check, three times over.
 *
 * The path is asserted too. Nothing in the build resolves an href written in
 * Markdown, so a renamed or uncommitted PDF ships as a 404 with no warning.
 * `scripts/check-links.mjs` skips any target beginning with `/` and delegates
 * site-absolute routes to the suite; this file accepts that delegation for
 * `/talks/`, and tests/cv.spec.ts for the CV.
 *
 * It reads dist/ rather than driving a browser, inside test bodies only; see
 * tests/routes.ts.
 *
 * The assertions read the paragraph, not the anchor. "Download the slides" is
 * the link text and "(PDF, 815 KB, 31 pages)" sits beside it in the same `<p>`,
 * so a test written against the anchor would fail on correct copy and invite
 * rewording published prose to suit a test. What matters is that a reader
 * meets the three figures before they click.
 *
 * Proven able to fail, 2026-09-09, chromium, five mutations each reverted:
 * changing the stated size, the stated page count, or deleting "PDF, " fails
 * that one test alone and quotes the paragraph back. Renaming the href fails
 * all four on "has no paragraph containing a link to …", because the lookup
 * breaks before anything reads the file. Deleting the PDF with the href intact
 * fails the build test by name, and the size and page count tests with a raw
 * ENOENT, which is left as it is: guarding them would restate the assertion
 * the build test exists to make.
 */

const POST_ROUTE = '/blog/open-source-is-not-just-code';
const SLIDES_HREF = '/talks/open-source-is-not-just-code.pdf';
const BYTES_PER_KB = 1024;

/**
 * `SLIDES_HREF` as a regex literal: the dots in a filename are not wildcards.
 */
const HREF_PATTERN = SLIDES_HREF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The built PDF.
 *
 * A hand-rolled `join` here and `builtPages()` below, deliberately. That
 * helper knows the two shapes Astro emits for a route and filters to `.html`.
 * The PDF is not a route: it is an asset Astro copies out of public/ verbatim,
 * so the helper would never return it.
 */
const builtSlides = (): string => join(DIST_DIR, SLIDES_HREF);

/**
 * The rendered `<p>` that carries the slides link, as plain text.
 *
 * Scoped to the one paragraph rather than searched across the document: "PDF"
 * and a number of KB appear elsewhere in this post, so a whole-file search
 * would answer "does this string appear anywhere". Matching the paragraph is
 * what makes the assertions below statements about the download link.
 */
const slidesParagraph = (): string => {
  const page = builtPages().find((p) => p.route === POST_ROUTE);

  expect(
    page,
    `${POST_ROUTE} is not in the build. This file is about a link on that ` +
      `post, so there is nothing to check until the post itself is emitted.`,
  ).toBeDefined();

  const html = readFileSync(page!.file, 'utf8');
  const match = html.match(
    new RegExp(
      `<p[^>]*>(?:(?!</p>)[\\s\\S])*?<a[^>]*href="${HREF_PATTERN}"[^>]*>[\\s\\S]*?</p>`,
    ),
  );

  expect(
    match,
    `${POST_ROUTE} has no paragraph containing a link to ${SLIDES_HREF}. ` +
      `That link is the only route to the deck; if it moves, this file moves ` +
      `with it.`,
  ).not.toBeNull();

  return match![0]
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * The object body for `<num> 0 obj`, as latin1 bytes.
 *
 * The boundary in the pattern is load-bearing and an `indexOf` would not have
 * it: a plain search for `1 0 obj` matches inside `21 0 obj` if that is
 * written earlier, and every read downstream then measures the wrong object.
 */
const pdfObject = (bytes: string, num: string): string => {
  const start = new RegExp(`(?:^|[^0-9])${num} 0 obj`).exec(bytes);
  if (!start) throw new Error(`PDF object ${num} not found`);

  const from = start.index + start[0].length - `${num} 0 obj`.length;
  const to = bytes.indexOf('endobj', from);
  if (to === -1) throw new Error(`PDF object ${num} has no endobj`);

  return bytes.slice(from, to);
};

/**
 * The page count, read out of the PDF's own page tree, with no dependency.
 *
 * The route is trailer `/Root`, catalog `/Pages`, that object's `/Count`, the
 * same walk tests/cv.spec.ts does for `/Info`, and it needs nothing but
 * `readFileSync`. `pdfinfo` would answer it in one line, and poppler is not a
 * dependency here or on a CI runner by default.
 *
 * Not a count of `/Type /Page` objects, though the two agree today. That is a
 * property of how the producer laid the file out; `/Count` on the page tree
 * root is what the format defines as the number of pages.
 */
const slidesPageCount = (): number => {
  const bytes = readFileSync(builtSlides(), 'latin1');

  const root = /\/Root\s+(\d+)\s+\d+\s*R/.exec(bytes);
  if (!root) throw new Error('no /Root reference in the trailer');

  const pagesRef = /\/Pages\s+(\d+)\s+\d+\s*R/.exec(pdfObject(bytes, root[1]));
  if (!pagesRef) throw new Error('the catalog has no /Pages reference');

  const count = /\/Count\s+(\d+)/.exec(pdfObject(bytes, pagesRef[1]));
  if (!count) throw new Error('the page tree root has no /Count');

  return Number(count[1]);
};

test.describe('the talk slides', () => {
  test('the linked PDF is actually in the build', () => {
    slidesParagraph();

    expect(
      existsSync(builtSlides()),
      `${POST_ROUTE} links to ${SLIDES_HREF}, which the build did not emit. ` +
        `Astro copies public/ verbatim, so the file is missing from ` +
        `public${SLIDES_HREF} or was never committed.`,
    ).toBe(true);
  });

  test('the size beside the link matches the file', () => {
    const text = slidesParagraph();

    const stated = text.match(/(\d+)\s*KB/);
    expect(
      stated,
      `the slides paragraph should state the size in KB, so a reader knows ` +
        `what they are about to download. Got ${JSON.stringify(text)}.`,
    ).not.toBeNull();

    const actual = Math.round(statSync(builtSlides()).size / BYTES_PER_KB);
    expect(
      Number(stated![1]),
      `the slides link says ${stated![1]} KB, the file is ${actual} KB. The ` +
        `deck was re-exported and the Markdown was not updated with it.`,
    ).toBe(actual);
  });

  test('the page count beside the link matches the file', () => {
    const text = slidesParagraph();

    const stated = text.match(/(\d+)\s*pages?/);
    expect(
      stated,
      `the slides paragraph should state the page count, which is the third ` +
        `figure a reader is given before they commit to a download. Got ` +
        `${JSON.stringify(text)}.`,
    ).not.toBeNull();

    const actual = slidesPageCount();
    expect(
      Number(stated![1]),
      `the slides link says ${stated![1]} pages, the PDF's page tree says ` +
        `${actual}. The deck was re-exported at a different length and the ` +
        `Markdown was not updated with it.`,
    ).toBe(actual);
  });

  test('the format is named beside the link', () => {
    const text = slidesParagraph();

    expect(
      text,
      `the slides paragraph should name the format, because the control ` +
        `hands over a file rather than moving between pages. Got ` +
        `${JSON.stringify(text)}.`,
    ).toContain('PDF');
  });
});
