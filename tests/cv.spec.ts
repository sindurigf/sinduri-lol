import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST_DIR } from './routes';

/**
 * The CV PDF, and the metadata that came with it.
 *
 * `/career`'s primary button hands over a file rather than moving between
 * pages. Two different things can regress here and only one of them is visible
 * on the page.
 *
 * The visible half is the link: whether the file is in the build at all, and
 * whether the size printed in the label still matches the file. The label is
 * rendered from `statSync` at build time precisely so it cannot drift, and the
 * test below is what proves that wiring works rather than trusting it.
 *
 * The invisible half is why this spec is worth more than a link check. The
 * file shipped here is a Canva export, and the export carried the name of the
 * person whose template it began as in `/Author` and `dc:creator`, the
 * template ids in `/Keywords`, and Canva in `/Producer` and `/Creator`. Those
 * were stripped by hand. Nothing stops the next re-export from arriving with
 * all of them back, and nothing about the rendered page would look any
 * different if it did: the leak is in bytes no reader sees, so the assertions
 * are on the bytes.
 *
 * `/Title` is asserted PRESENT, not absent. It is the one metadata field that
 * has to stay: a reader announces it, and PDF/UA requires it, so stripping it
 * in the name of privacy would trade a leak for an SC 2.4.2 failure.
 *
 * Verified not to be vacuous, one assertion at a time, because the obvious
 * version of two of these passed against a file that should have failed:
 *
 *   - the unmodified Canva export fails the metadata test on all eight fields
 *     at once, and the language test on both of its assertions;
 *   - the tag test fails when StructTreeRoot is removed;
 *   - the title test passed against a file whose title had been removed until
 *     it was scoped to the information dictionary, because `/Title` also
 *     occurs in the outline and on structure elements. See `cvInfoDict`;
 *   - the size test fails as soon as the file changes if the label is typed
 *     rather than measured, which is why career.astro measures it.
 */

const CV_PATH = 'sinduri-guntupalli-cv.pdf';
const BYTES_PER_KB = 1024;

const builtCv = () => join(DIST_DIR, CV_PATH);

/** The whole file as bytes, latin1 so every byte survives as one character. */
const cvBytes = () => readFileSync(builtCv(), 'latin1');

/**
 * Just the document information dictionary.
 *
 * Scoping matters for `/Title` and only for `/Title`. That key also occurs in
 * the outline and on structure elements, dozens of times in this file, so
 * searching the whole document for it answers "does the string appear
 * anywhere", which is true of a PDF with no document title at all.
 *
 * The absence checks below are deliberately NOT scoped this way. Whole-file is
 * the stricter question for those: a leaked author name is a leak wherever it
 * sits, and confining the search to one object would miss a copy elsewhere.
 */
const cvInfoDict = () => {
  const bytes = cvBytes();
  const ref = /\/Info\s+(\d+)\s+\d+\s*R/.exec(bytes);
  if (!ref) throw new Error('no /Info reference in the trailer');

  const start = bytes.indexOf(`${ref[1]} 0 obj`);
  const end = bytes.indexOf('endobj', start);
  if (start === -1 || end === -1) throw new Error(`object ${ref[1]} not found`);

  return bytes.slice(start, end);
};

test.describe('the CV file', () => {
  test('is in the build, where the button points', () => {
    expect(
      existsSync(builtCv()),
      `${builtCv()} is missing. /career's primary button links to /${CV_PATH}, ` +
        `so without this file that button is a 404 and the page gives no sign of it.`,
    ).toBe(true);
  });

  test('carries none of the identifying metadata the export came with', () => {
    const bytes = cvBytes();

    const forbidden: readonly [string, string][] = [
      ['/Author', 'the author name of whoever the template belonged to'],
      ['/Producer', 'the producing application'],
      ['/Creator', 'the creating application'],
      ['/Keywords', 'the Canva template ids'],
      ['dc:creator', 'the XMP copy of the author name'],
      ['xmp:CreatorTool', 'the XMP copy of the creating application'],
      ['pdf:Producer', 'the XMP copy of the producing application'],
      ['pdf:Keywords', 'the XMP copy of the template ids'],
    ];

    for (const [field, what] of forbidden) {
      expect(
        bytes.includes(field),
        `${CV_PATH} still carries ${field}, which is ${what}. This is a fresh ` +
          `export that was published without being scrubbed. Nothing on the ` +
          `rendered page shows this; it is only in the file.`,
      ).toBe(false);
    }
  });

  test('keeps the document title a reader needs', () => {
    expect(
      /\/Title\s*\((.+?)\)/.test(cvInfoDict()),
      `${CV_PATH} has no /Title in its information dictionary. A PDF reader ` +
        `announces the title rather than the filename, and PDF/UA requires ` +
        `one, so this is SC 2.4.2 for the document. It is the one metadata ` +
        `field that must survive scrubbing.`,
    ).toBe(true);
  });

  test('declares the language its text is actually written in', () => {
    const bytes = cvBytes();

    expect(
      bytes.includes('/Lang (en)'),
      `${CV_PATH} does not declare /Lang (en). The Canva export declared ` +
        `de-DE over English text, which is a screen reader reading this CV ` +
        `aloud in a German voice: SC 3.1.1 for the document.`,
    ).toBe(true);

    expect(
      bytes.includes('de-DE'),
      `${CV_PATH} still declares de-DE somewhere`,
    ).toBe(false);
  });

  test('is still a tagged PDF after being scrubbed', () => {
    expect(
      cvBytes().includes('StructTreeRoot'),
      `${CV_PATH} has lost its structure tree. The scrub is done by ` +
        `overwriting bytes in place for exactly this reason: rewriting the ` +
        `file through a PDF engine rebuilds it and drops the tags, which is ` +
        `the difference between a reader announcing headings and reading a ` +
        `wall of glyphs.`,
    ).toBe(true);
  });
});

test.describe('the CV link on /career', () => {
  test('names the format and the real size of the file', async ({ page }) => {
    await page.goto('/career');

    const link = page.getByRole('link', { name: /download my cv/i });
    await expect(link).toHaveAttribute('href', `/${CV_PATH}`);

    const expectedKb = Math.round(statSync(builtCv()).size / BYTES_PER_KB);

    await expect(
      link,
      `the label must name the format and the size measured off the file. ` +
        `The size is rendered from statSync at build time, so a mismatch here ` +
        `means the label was typed by hand and has gone stale.`,
    ).toHaveText(new RegExp(`\\(PDF,\\s*${expectedKb}\\s*KB\\)`, 'i'));
  });
});
