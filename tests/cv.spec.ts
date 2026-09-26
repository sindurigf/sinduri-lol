import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './test';
import { DIST_DIR } from './routes';
import { NODE } from './tags';

/**
 * The CV PDF. `npm run publish:cv` strips Canva's identifying metadata and
 * retags the structure; an unscrubbed export looks identical on the page, so
 * the assertions are on the bytes. `/Title` must stay (PDF/UA, SC 2.4.2).
 */
const CV_PATH = 'sinduri-guntupalli-cv.pdf';
const BYTES_PER_KB = 1024;

const builtCv = () => join(DIST_DIR, CV_PATH);

/** The whole file as bytes, latin1 so every byte survives as one character. */
const cvBytes = () => readFileSync(builtCv(), 'latin1');

/**
 * The /Info dictionary only: `/Title` also occurs in the outline and structure
 * elements. Absence checks stay whole-file, since a leak anywhere counts.
 */
const infoDict = (bytes: string): string => {
  const ref = /\/Info\s+(\d+)\s+(\d+)\s*R/.exec(bytes);
  if (!ref) throw new Error('no /Info reference in the trailer');

  /* Not preceded by a digit, so object 2 is never found inside "12 0 obj". */
  const header = new RegExp(`(?<!\\d)${ref[1]}\\s+${ref[2]}\\s+obj\\b`).exec(
    bytes,
  );
  const end = header ? bytes.indexOf('endobj', header.index) : -1;
  if (!header || end === -1) throw new Error(`object ${ref[1]} not found`);

  return bytes.slice(header.index, end);
};

const cvInfoDict = () => infoDict(cvBytes());

/** Objects tagged as an image: a Figure, or alt text on anything but a link. */
const taggedImages = (bytes: string): string[] =>
  [...bytes.matchAll(/(?<!\d)\d+\s+\d+\s+obj\b[\s\S]*?endobj/g)]
    .map(([object]) => object)
    .filter(
      (object) =>
        /\/S\s*\/Figure\b/.test(object) ||
        (/\/Alt\s*\(/.test(object) && !/\/S\s*\/Link\b/.test(object)),
    );

test(
  'the /Info lookup finds its own object, not one whose number ends in it',
  NODE,
  () => {
    const bytes =
      '12 0 obj\n<< /Title (object 12) >>\nendobj\n' +
      '2 0 obj\n<< /Title (object 2) >>\nendobj\n' +
      'trailer\n<< /Info 2 0 R >>';

    expect(infoDict(bytes)).toContain('(object 2)');
  },
);

test(
  'the image-tag lookup finds a Figure and alt text, not link text',
  NODE,
  () => {
    const bytes =
      '1 0 obj\n<< /S /Figure /K [ 0 ] >>\nendobj\n' +
      '2 0 obj\n<< /Alt (A photo) /S /P >>\nendobj\n' +
      '3 0 obj\n<< /Alt (https://example.com) /S /Link >>\nendobj';

    expect(taggedImages(bytes).map((object) => object.split(' ')[0])).toEqual([
      '1',
      '2',
    ]);
  },
);

test.describe('the CV file', () => {
  test('is in the build, where the button points', NODE, () => {
    expect(
      existsSync(builtCv()),
      `${builtCv()} is missing, so /career's CV button is a 404.`,
    ).toBe(true);
  });

  test(
    'carries none of the identifying metadata the export came with',
    NODE,
    () => {
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
          `${CV_PATH} still carries ${field} (${what}); run npm run publish:cv.`,
        ).toBe(false);
      }
    },
  );

  test('keeps the document title a reader needs', NODE, () => {
    expect(
      /\/Title\s*\((.+?)\)/.test(cvInfoDict()),
      `${CV_PATH} has no /Title in its information dictionary (SC 2.4.2).`,
    ).toBe(true);
  });

  test('declares the language its text is actually written in', NODE, () => {
    const bytes = cvBytes();

    expect(
      bytes.includes('/Lang (en)'),
      `${CV_PATH} does not declare /Lang (en) (SC 3.1.1).`,
    ).toBe(true);

    expect(
      bytes.includes('de-DE'),
      `${CV_PATH} still declares de-DE somewhere`,
    ).toBe(false);
  });

  test('is still a tagged PDF after being scrubbed', NODE, () => {
    expect(
      cvBytes().includes('StructTreeRoot'),
      `${CV_PATH} has lost its structure tree; publish:cv (pikepdf) keeps it.`,
    ).toBe(true);
  });

  // Counted in the bytes because publish:cv saves without object streams,
  // which leaves every structure element readable as text.
  test(
    'carries the tags publish:cv leaves, not the ones Canva exports',
    NODE,
    () => {
      const tags = (level: string) =>
        cvBytes().match(new RegExp(`/S\\s*/${level}\\b`, 'g'))?.length ?? 0;
      const raw = `${CV_PATH} carries Canva's own tags; run npm run publish:cv`;

      expect(tags('H1'), `${raw}: the name should be one H1.`).toBe(1);
      expect(tags('H2'), `${raw}: the six section titles are the H2s.`).toBe(6);
      expect(
        tags('H[3-6]'),
        `${raw}: Canva's H3 to H6 change between exports, so they become P.`,
      ).toBe(0);
    },
  );

  test(
    'draws the portrait as decoration, since the name H1 says who it shows',
    NODE,
    () => {
      expect(
        taggedImages(cvBytes()),
        `${CV_PATH} tags an image (Figure or alt text); run npm run publish:cv.`,
      ).toEqual([]);
    },
  );
});

test.describe('the CV link on /career', () => {
  test('names the format and the real size of the file', async ({ page }) => {
    await page.goto('/career');

    const link = page.getByRole('link', { name: /download my cv/i });
    await expect(link).toHaveAttribute('href', `/${CV_PATH}`);

    const expectedKb = Math.round(statSync(builtCv()).size / BYTES_PER_KB);

    await expect(
      link,
      `the label must name the format and the file's measured size.`,
    ).toHaveText(new RegExp(`\\(PDF,\\s*${expectedKb}\\s*KB\\)`, 'i'));
  });
});
