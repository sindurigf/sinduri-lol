/**
 * Preference: personal site, then Drupal.org, then LinkedIn. Keyed by the name
 * as written after "Photo: "; an unlisted name stays plain text.
 */
export const PHOTOGRAPHERS = {
  'Alex Gruber': 'https://www.linkedin.com/in/alex-gruber-59617549/',
  'Andrey Pshenichny': 'https://andreys.info/',
  'Baris Tosun': 'https://www.drupal.org/u/rominronin',
  'Bram Driesen': 'https://www.drupal.org/u/bramdriesen',
  'Daniel Lemon': 'https://danlemon.com/',
  'Joris Vercammen': 'https://www.drupal.org/u/borisson_',
  'Josef Kruckenberg': 'https://www.dasjo.at/',
  'Karl Hepworth': 'https://www.drupal.org/u/fubarhouse',
  'Klaus Purer': 'https://klau.si/',
  lowfidelity: 'https://www.lowfidelity.at/',
  'Patrick Itten': 'https://www.patrickitten.ch/',
  'Paul Johnson': 'https://www.drupal.org/u/pdjohnson',
  'Tdm Dilip': 'https://www.instagram.com/tdmdilip/',
} as const satisfies Readonly<Record<string, string>>;

export type Photographer = keyof typeof PHOTOGRAPHERS;

/* Throws too: `astro build` does not typecheck, and a stale name renders no href. */
export const photographerHref = (name: Photographer): string => {
  const href: string | undefined = PHOTOGRAPHERS[name];
  if (!href) throw new Error(`No PHOTOGRAPHERS entry for "${name}".`);
  return href;
};

export const PHOTO_CREDIT_PREFIX = 'Photo: ';

/* Keyed by the name as written after "Screenshot: ". */
export const SCREENSHOT_SOURCES = {
  'Drupal Association': 'https://www.drupal.org/association',
  'Drupal.org': 'https://www.drupal.org/',
} as const satisfies Readonly<Record<string, string>>;

export const SCREENSHOT_CREDIT_PREFIX = 'Screenshot: ';

export interface LicensedPhoto {
  photographer: Photographer;
  /** The photo's title where it is published. */
  title: string;
  source: string;
  /** Where `source` is, e.g. Flickr or Wikimedia Commons. */
  sourceName: string;
  /** Spelled out, e.g. "Creative Commons Attribution 4.0" (SC 3.1.4). */
  licence: string;
  licenceHref: string;
  /** What was changed, as the licence asks, e.g. "resized". */
  changes: string;
}

/**
 * Photos used under a Creative Commons licence, keyed by file name without its
 * extension: the caption and /credits link the source and licence and say what changed.
 */
export const LICENSED_PHOTOS = {
  'drupal-lecture-hall': {
    photographer: 'Andrey Pshenichny',
    title: 'DrupalDevDays 2023 Vienna',
    source: 'https://www.flickr.com/photos/beta-robot/53065586392/',
    sourceName: 'Flickr',
    licence: 'Creative Commons Attribution 2.0',
    licenceHref: 'https://creativecommons.org/licenses/by/2.0/',
    changes: 'resized',
  },
  'drupalcon-rotterdam-award': {
    photographer: 'Karl Hepworth',
    title: 'Women in Drupal Award Ceremony - DrupalCon Rotterdam 2026',
    source: 'https://www.flickr.com/photos/200855369@N08/55559653507/',
    sourceName: 'Flickr',
    licence: 'Creative Commons Attribution-ShareAlike 4.0',
    licenceHref: 'https://creativecommons.org/licenses/by-sa/4.0/',
    changes: 'resized',
  },
} as const satisfies Readonly<Record<string, LicensedPhoto>>;

/** The site's name and email address are borrowed from norman.lol. */
export const NAME_INSPIRATION = {
  name: 'Norman Kämper-Leymann',
  href: 'https://norman.lol/',
  site: 'norman.lol',
} as const;

export const THANKS = [
  {
    name: 'Arthur Lorenz',
    href: 'https://utor.io/',
    reason:
      'Thank you for showing me Stitch and your workflow for static websites, and for encouraging me to actually build my own!',
  },
  {
    name: 'Vincenzo Gambino',
    href: 'https://www.gambinovincenzo.com/',
    reason:
      'Thank you for introducing me to Astro at a Drupal session. Its performance still amazes me, and this site is built with Astro and Vue.',
  },
  {
    name: 'Alexandru Teodor Ieremia',
    href: 'https://www.linkedin.com/in/alexandru-teodor-ieremia-8581231b4/',
    reason:
      'Thank you for teaching me frontend and accessibility. I used what I learnt from you to build this site.',
  },
  {
    name: 'Petra Morawa-Zechner',
    href: 'https://diegestaltung.at/',
    reason:
      'Thank you for teaching me good design principles and how to think about sustainability in design.',
  },
] as const;
