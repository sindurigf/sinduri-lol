/* Allow-lists the check scripts and their self-tests share. */

/* False positives, each with its reason; an entry that no longer matches fails. */
export const TOKEN_EXCEPTIONS = [
  {
    file: 'src/lib/brand.ts',
    text: 'light-[a-z-]',
    reason: 'a regex character class naming light-mode tokens, not a class',
  },
];

/*
 * Classes that exist only for a test or script to select. An entry that no
 * longer matches fails.
 */
export const CLASS_HOOKS = new Map();

/*
 * Each entry names what reads the original. An entry that no longer matches
 * fails.
 */
export const SERVED_AS_IS = new Map([
  ...[
    'logo-rabbit.svg',
    'roundel-rabbit.svg',
    'bunny-footer.svg',
    'lepus-rabbit.svg',
  ].map((name) => [
    name,
    'a vector from scripts/make-logo.mjs or the rabbit trace, drawn sharp at every size as it is.',
  ]),
  ...['minerva', 'rudra', 'hela'].map((cat) => [
    `about-cats-${cat}.avif`,
    'the About cats draw their frames from it with SVG <image>; it is an AVIF atlas already.',
  ]),
  [
    'hero-rabbit-climb.webp',
    "the homepage rabbit and Let It Fall's climbing rabbit draw their poses from it by offset; a lossless WebP from scripts/make-climb-atlas.mjs already.",
  ],
  ...['jar', 'book', 'picture', 'watch', 'teacup']
    .flatMap((name) => [name, `${name}-ink`])
    .map((name) => [
      `home-stickers/${name}.webp`,
      'home.css paints a die-cut sticker in the homepage fall with it, its throw baked in: pink, or ink in light mode; a WebP already, drawn at most at its own 211px.',
    ]),
  [
    'home-meadow.webp',
    "src/scripts/home-meadow.ts cuts the meadow's grasses and buds from it by offset onto a canvas, drawn smaller than its own 320px; a WebP atlas already.",
  ],
  [
    'social-icons.svg',
    'the footer imports it with `?url` and every page links it as a <use> sprite.',
  ],
]);

/*
 * Each entry names why the text stays as written. An entry that no longer
 * matches fails.
 */
export const TITLE_CASE_ALLOWED = [
  {
    route: '/talks/open-source-is-not-just-code/',
    kind: 'heading',
    text: 'Example: curl',
    reason: 'curl writes its own name in lower case.',
  },
  {
    route: '/blog/open-source-is-not-just-code/',
    kind: 'heading',
    text: 'What Happened at curl',
    reason: 'curl writes its own name in lower case.',
  },
];
