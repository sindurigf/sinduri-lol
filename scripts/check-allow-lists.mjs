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
    'roundel-rabbit-light.svg',
    'bunny-footer-light.svg',
    'lepus-rabbit-light.svg',
  ].map((name) => [
    name,
    'a vector from scripts/make-logo.mjs or the rabbit trace, drawn sharp at every size as it is.',
  ]),
  ...['minerva', 'rudra', 'hela'].map((cat) => [
    `about-cats-${cat}.avif`,
    'the About cats draw their frames from it with SVG <image>; it is an AVIF atlas already.',
  ]),
  ...['hero-rabbit-climb.webp', 'hero-rabbit-climb-light.webp'].map((name) => [
    name,
    "Let It Fall's climbing rabbit draws its poses from it by offset; a lossless WebP from scripts/make-climb-atlas.mjs already.",
  ]),
  ...['hero-rabbit.svg', 'hero-rabbit-light.svg'].map((name) => [
    name,
    'the hero canvas rasterises the vector atlas at the size it draws the rabbit.',
  ]),
  [
    'hero-still-short.webp',
    'layout.css links it as the hero background under `scripting: none`; ' +
      'scripts/make-hero-still.mjs writes it as WebP already.',
  ],
  [
    'hero-still-tall.webp',
    'layout.css links it as the hero background under `scripting: none`; ' +
      'scripts/make-hero-still.mjs writes it as WebP already.',
  ],
  [
    'hero-still-wide.webp',
    'layout.css links it as the hero background under `scripting: none`; ' +
      'scripts/make-hero-still.mjs writes it as WebP already.',
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

/*
 * Lines check:wording lets through: `file` is a path or a RegExp, `text` a
 * RegExp the line must match. An entry that no longer matches fails.
 */
export const WORDING_EXCEPTIONS = [
  {
    file: /\.(?:astro|md|json)$/,
    rule: 'she-her',
    text: /\b(?:alt|imageAlt)\s*[:=]|"alt":|!\[/,
    reason: 'alt text describes the person in the photo.',
  },
  {
    file: 'src/pages/about.astro',
    rule: 'name',
    text: /^\s*alt:/,
    reason: 'alt text describes the person in the photo.',
  },
  {
    file: 'src/pages/about.astro',
    rule: 'she-her',
    text: /^\s*role:/,
    reason: 'a cat bio; the cats are female.',
  },
  {
    file: 'src/lib/about-cats-moves.ts',
    rule: 'she-her',
    text: /The queen/,
    reason: 'Minerva, a cat.',
  },
  {
    file: 'tests/about-cats.spec.ts',
    rule: 'she-her',
    text: /./,
    reason: 'the About cats are female.',
  },
  {
    file: 'docs/VOICE.md',
    rule: 'she-her',
    text: /Minerva/,
    reason: 'quotes the Minerva bio as a voice example.',
  },
  {
    file: 'src/lib/feed-excerpt.ts',
    rule: 'em-dash',
    text: /mdash:/,
    reason:
      'the HTML entity table decodes the em dash entity in feed excerpts.',
  },
];
