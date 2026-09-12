import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { builtPages, DIST_DIR, ROUTES } from './routes';
import { GLOBAL_CSS, cssColorToken } from './source';

/**
 * The favicon set and the web app manifest.
 *
 * The icons arrived as a delivered pack that was wrong about its own contents:
 * `favicon.ico` held a single 16x16 frame under a README describing it as
 * "16 / 32 / 48, multi-resolution" and an install snippet declaring it
 * `sizes="32x32"`. The only symptom is a slightly soft tab icon nobody files a
 * bug about. So the assertion that matters is not that a file exists but that
 * every declared size is true of the bytes on disk, which also catches the
 * next regeneration: `convert` will write a one-frame .ico while the markup
 * goes on claiming three.
 *
 * It reads dist/ rather than driving a browser, like tests/head.spec.ts and
 * tests/titles.spec.ts: these are static bytes in the served output.
 * Dimensions are parsed out of the PNG and ICO headers rather than by adding
 * an image library for two struct reads.
 *
 * The theme colour is not written down here. The manifest's `theme_color` is
 * compared against `--color-background` in global.css, and
 * src/pages/site.webmanifest.ts derives it, so the two cannot drift.
 *
 * Proven able to fail, 2026-09-08:
 *
 *   - favicon.ico rebuilt from the 16px PNG alone fails two tests, the
 *     intended overlap: "favicon.ico carries every size it declares" names the
 *     missing 32 and 48, and "every declared size is true of the file" catches
 *     the same bytes through the markup's `sizes` attribute;
 *   - the ICO declared `sizes="16x16 32x32 64x64"` over a 16/32/48 file fails
 *     "every declared size is true of the file". Narrowing it to "32x32"
 *     passes, correctly: only the over-claim is a lie;
 *   - `#ffc000` hardcoded into MANIFEST.theme_color, the value the icon pack
 *     shipped, fails "tints the installed app with the background token";
 *   - public/maskable-icon-512x512.png deleted fails "every icon it names is
 *     in the build, at the size it claims";
 *   - the <link rel="manifest"> deleted from BaseLayout fails "links the
 *     manifest" on every route.
 */

const MANIFEST_ROUTE = '/site.webmanifest';

interface Size {
  width: number;
  height: number;
}

const asText = (size: Size): string => `${size.width}x${size.height}`;

/**
 * Width and height out of a PNG's IHDR chunk.
 *
 * The layout is fixed by the spec: an 8-byte signature, then a 4-byte chunk
 * length, the literal `IHDR`, then two big-endian uint32s. So width sits at
 * byte 16 and height at byte 20 of every PNG there is.
 */
const pngSize = (file: string): Size => {
  const buffer = readFileSync(file);

  expect(
    buffer.subarray(1, 4).toString('ascii'),
    `${file} does not start with a PNG signature.`,
  ).toBe('PNG');

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

/**
 * Every frame in an ICO.
 *
 * An ICONDIR is a 2-byte zero, a 2-byte type of 1, then a 2-byte little-endian
 * count. Each 16-byte ICONDIRENTRY that follows opens with a one-byte width
 * and height, where 0 means 256: the field cannot hold 256 itself. Get that
 * wrong and a 256px icon reads as 0x0.
 */
const icoSizes = (file: string): Size[] => {
  const buffer = readFileSync(file);

  expect(
    buffer.readUInt16LE(0) === 0 && buffer.readUInt16LE(2) === 1,
    `${file} is not an ICO: its header does not read reserved=0, type=1. ` +
      'A PNG renamed to .ico is the usual cause and browsers mostly accept ' +
      'it, but it can hold only one size, which defeats the point of the file.',
  ).toBe(true);

  const count = buffer.readUInt16LE(4);
  const ENTRY = 16;
  const FIRST = 6;

  return Array.from({ length: count }, (_, index) => {
    const at = FIRST + index * ENTRY;
    return {
      width: buffer[at] === 0 ? 256 : buffer[at]!,
      height: buffer[at + 1] === 0 ? 256 : buffer[at + 1]!,
    };
  });
};

/** Every `sizes="…"` token, as {width, height}. `any` is dropped. */
const declaredSizes = (attribute: string): Size[] =>
  attribute
    .split(/\s+/)
    .filter((token) => token && token.toLowerCase() !== 'any')
    .map((token) => {
      const [width, height] = token.toLowerCase().split('x');
      return { width: Number(width), height: Number(height) };
    });

interface IconLink {
  rel: string;
  href: string;
  sizes: string | null;
}

/** Every <link> whose rel mentions an icon, plus the manifest link. */
const iconLinks = (html: string): IconLink[] => {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];

  return links
    .map((tag) => ({
      rel: /\srel=["']([^"']*)["']/i.exec(tag)?.[1]?.toLowerCase() ?? '',
      href: /\shref=["']([^"']*)["']/i.exec(tag)?.[1] ?? '',
      sizes: /\ssizes=["']([^"']*)["']/i.exec(tag)?.[1] ?? null,
    }))
    .filter((link) => /\bicon\b/.test(link.rel) || link.rel === 'manifest');
};

const distFile = (href: string): string =>
  join(DIST_DIR, href.replace(/^\//, ''));

const homeHtml = (): string => {
  const home = builtPages().find((page) => page.route === '/');
  expect(home, '/ was not found in the build').toBeTruthy();
  return readFileSync(home!.file, 'utf8');
};

const manifest = (): Record<string, unknown> => {
  const file = distFile(MANIFEST_ROUTE);

  expect(
    existsSync(file),
    `${MANIFEST_ROUTE} was not built. It is generated by ` +
      'src/pages/site.webmanifest.ts, so an endpoint that stopped exporting ' +
      'GET is the likely cause.',
  ).toBe(true);

  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
};

test.describe('the favicon set', () => {
  test('every icon the head links is in the build', () => {
    const links = iconLinks(homeHtml());

    expect(
      links.length,
      'The head links no icons at all. BaseLayout.astro should carry the ' +
        'SVG, the ICO, the 96px PNG, the apple-touch-icon and the manifest.',
    ).toBeGreaterThan(0);

    for (const link of links) {
      expect(
        existsSync(distFile(link.href)),
        `The head links ${link.href} (rel="${link.rel}") and the build has ` +
          'no such file.',
      ).toBe(true);
    }
  });

  test('every declared size is true of the file', () => {
    /*
     * The assertion this file exists for. A `sizes` attribute is a promise to
     * the browser about bytes it has not fetched yet, and nothing else in the
     * suite reads the bytes.
     */
    for (const link of iconLinks(homeHtml())) {
      if (!link.sizes || link.rel === 'manifest') continue;

      const file = distFile(link.href);
      const wanted = declaredSizes(link.sizes);

      if (file.endsWith('.svg')) continue; /* vector: any size is honest */

      const present = file.endsWith('.ico') ? icoSizes(file) : [pngSize(file)];

      for (const size of wanted) {
        expect(
          present.some(
            (actual) =>
              actual.width === size.width && actual.height === size.height,
          ),
          `${link.href} is declared sizes="${link.sizes}" but holds only ` +
            `${present.map(asText).join(', ')}. A browser asking for ` +
            `${asText(size)} would get one of those scaled, which is soft at ` +
            'best. Either rebuild the file or narrow the attribute.',
        ).toBe(true);
      }
    }
  });

  test('favicon.ico carries every size it declares', () => {
    /*
     * Named separately from the loop above so the ICO's frame count fails
     * under its own name. It is the defect the delivered pack shipped, and
     * `convert` writes a single-frame .ico from a single input without
     * complaining, so a regeneration is how it comes back.
     */
    const sizes = icoSizes(distFile('/favicon.ico')).map(asText);

    for (const wanted of ['16x16', '32x32', '48x48']) {
      expect(
        sizes,
        `favicon.ico should hold 16, 32 and 48 and holds ${sizes.join(', ')}. ` +
          'Rebuild it from the three PNGs: `convert favicon-16x16.png ' +
          'favicon-32x32.png favicon-48x48.png favicon.ico`.',
      ).toContain(wanted);
    }
  });
});

test.describe('the web app manifest', () => {
  test('tints the installed app with the background token', () => {
    const parsed = manifest();

    for (const key of ['theme_color', 'background_color']) {
      expect(
        String(parsed[key]).toLowerCase(),
        `The manifest's ${key} is not the site background. It should carry ` +
          `--color-background from ${GLOBAL_CSS}; ` +
          'src/pages/site.webmanifest.ts reads it out of that file so the ' +
          'manifest, the <meta name="theme-color"> tag and the stylesheet ' +
          'cannot drift apart. The icon pack shipped #ffc000 here, which ' +
          'would paint an installed app gold over a dark site and flash a ' +
          'yellow splash screen before every launch.',
      ).toBe(cssColorToken('--color-background'));
    }
  });

  test('every icon it names is in the build, at the size it claims', () => {
    const icons = manifest().icons as {
      src: string;
      sizes: string;
      purpose?: string;
    }[];

    expect(icons?.length, 'The manifest declares no icons.').toBeGreaterThan(0);

    for (const icon of icons) {
      const file = distFile(icon.src);

      expect(
        existsSync(file),
        `The manifest names ${icon.src} and the build has no such file.`,
      ).toBe(true);

      expect(
        asText(pngSize(file)),
        `The manifest declares ${icon.src} as ${icon.sizes} and the file is ` +
          'a different size. An installer picks by this value.',
      ).toBe(icon.sizes);
    }
  });

  test('declares exactly one maskable icon', () => {
    /*
     * A launcher masks a maskable icon to its own shape, so its artwork is
     * padded into the central 80% safe zone. An icon declared as both
     * `any` and `maskable` lets a launcher that wants an unmasked icon pick
     * the padded one and render the mark smaller than it should be. Keeping
     * the two purposes on separate files is what prevents that, and it is
     * invisible in the JSON unless something asserts it.
     */
    const icons = manifest().icons as { purpose?: string }[];
    const maskable = icons.filter((icon) =>
      (icon.purpose ?? '').split(/\s+/).includes('maskable'),
    );

    expect(
      maskable.length,
      'The manifest should declare exactly one maskable icon.',
    ).toBe(1);

    for (const icon of icons) {
      const purposes = (icon.purpose ?? 'any').split(/\s+/);
      expect(
        purposes.includes('maskable') && purposes.includes('any'),
        'An icon is declared both `any` and `maskable`. Split them: the ' +
          'maskable file is padded for the launcher mask, so it renders the ' +
          'mark too small anywhere it is not masked.',
      ).toBe(false);
    }
  });

  /*
   * One test over every route. These are string checks on built HTML, so there
   * is nothing per-route to isolate, and `expect.soft` names every failing
   * route in one run. The `checked` count is the floor: comparing two empty
   * lists passes, so without it an empty ROUTES would leave this green.
   */
  test('every route links the manifest', () => {
    const built = builtPages();
    const checked: string[] = [];

    for (const route of ROUTES) {
      const page = built.find((entry) => entry.route === route);
      expect(page, `${route} was not found in the build`).toBeTruthy();
      checked.push(route);

      const links = iconLinks(readFileSync(page!.file, 'utf8'));

      expect
        .soft(
          links.some(
            (link) => link.rel === 'manifest' && link.href === MANIFEST_ROUTE,
          ),
          `${route} should carry <link rel="manifest" href="${MANIFEST_ROUTE}">. ` +
            'It is in BaseLayout, so a route missing it is a route that ' +
            'stopped using the layout.',
        )
        .toBe(true);
    }

    expect(
      checked,
      'the per-route walk visited a different set of routes than ROUTES. It ' +
        'passes vacuously if that list is ever empty.',
    ).toEqual([...ROUTES]);
  });
});
