/*
 * Per-page sharing cards: drawn by scripts/make-og.mjs from the built pages,
 * read by BaseLayout. No Astro imports, so the Node script can load this file.
 */

/** Under public/, so the build copies the cards as they are. */
export const OG_CARD_DIR = 'images/og';
export const OG_CARD_MANIFEST = `${OG_CARD_DIR}/cards.json`;

/** Routes that keep the site card, `og-default.png`, instead of a card of their own. */
export const SITE_CARD_ROUTES: readonly string[] = ['/'];

/**
 * The owner's picks where a page's first photo is not its card's: `null`
 * keeps the header logo, a path names a photo under src/assets/.
 */
export const OG_PHOTO_CHOICES: Readonly<Record<string, string | null>> = {
  /* Its sample photos are specimens, not the page's subject. */
  '/brand': null,
  '/career': 'src/assets/photos/sinduri-studio.jpg',
};

export interface OgCard {
  title: string;
  /** The built photo URL, hash included, so a new photo shows as stale; null for the header logo. */
  photo: string | null;
  alt: string;
}

export type OgCardManifest = Record<string, OgCard>;

export interface FirstPhoto {
  src: string;
  alt: string;
}

const MAIN = /<main\b[\s\S]*?<\/main>/;
const IMG = /<img\b[^>]*>/g;
/* The rabbit marks are site art, never a page's photo. */
const LOGO_ART = /\/(?:bunny-|logo-rabbit|roundel-rabbit|lepus-rabbit)/;

/** The entities Astro writes into attributes, decoded. */
export const decodeEntities = (text: string): string =>
  text
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

const attribute = (tag: string, name: string): string | null =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/** The largest `srcset` candidate, else `src`: the card is drawn from the sharpest copy. */
const largest = (tag: string): string | null => {
  const candidates = (attribute(tag, 'srcset') ?? '')
    .split(',')
    .map((entry) => entry.trim().split(/\s+/))
    .flatMap(([url, width]) =>
      url && width?.endsWith('w') ? [{ url, width: parseInt(width, 10) }] : [],
    )
    .sort((a, b) => b.width - a.width);
  return candidates[0]?.url ?? attribute(tag, 'src');
};

/** The first photo in a built page's `<main>`: an `<img>` with alt text that is not logo art. */
export const firstPhoto = (html: string): FirstPhoto | null => {
  const main = MAIN.exec(html)?.[0] ?? '';
  for (const [tag] of main.matchAll(IMG)) {
    const alt = attribute(tag, 'alt');
    const src = largest(tag);
    if (!alt || !src || LOGO_ART.test(src)) continue;
    return { src, alt: decodeEntities(alt) };
  }
  return null;
};

/** `/blog/tag/drupal` → `images/og/blog--tag--drupal.jpg`. */
export const ogCardPath = (route: string): string =>
  `${OG_CARD_DIR}/${route.replace(/^\/|\/$/g, '').replaceAll('/', '--')}.jpg`;

/** Route as the manifest keys it: no trailing slash, `/` for the homepage. */
export const ogRoute = (pathname: string): string =>
  pathname === '/' ? '/' : pathname.replace(/\/(?:index\.html)?$/, '');

const IMAGE_MIME: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

/** The media type of a photo a card can embed; throws on any other file. */
export const imageMime = (path: string): string => {
  const type = IMAGE_MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()];
  if (!type)
    throw new Error(`make-og: ${path} is not a JPEG, PNG, WebP or AVIF.`);
  return type;
};
