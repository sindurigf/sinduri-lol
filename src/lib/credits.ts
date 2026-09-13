/**
 * Where each photographer credited on the site is linked, in Sinduri's order
 * of preference: a personal site, then Drupal.org, then LinkedIn. Checked
 * 2026-09-13; rominronin.net and tech.dichtlog.nl did not answer that day, so
 * Baris Tosun and Joris Vercammen are on Drupal.org. Keyed by the name exactly as a caption writes it after "Photo: ",
 * so a caption for someone not listed here stays plain text rather than
 * guessing a link.
 */
export const PHOTOGRAPHERS: Readonly<Record<string, string>> = {
  'Alex Gruber': 'https://www.linkedin.com/in/alex-gruber-59617549/',
  'Andrey Pshenichny': 'https://andreys.info/',
  'Baris Tosun': 'https://www.drupal.org/u/rominronin',
  'Daniel Lemon': 'https://danlemon.com/',
  'Joris Vercammen': 'https://www.drupal.org/u/borisson_',
  'Klaus Purer': 'https://klau.si/',
  'Paul Johnson': 'https://www.drupal.org/u/pdjohnson',
  'Tdm Dilip': 'https://www.instagram.com/tdmdilip/',
};

/** The prefix a markdown image title starts with to name its photographer. */
export const PHOTO_CREDIT_PREFIX = 'Photo: ';

/** Whose site this one's name, and its email address, were borrowed from. */
export const NAME_INSPIRATION = {
  name: 'Norman Kämper-Leymann',
  href: 'https://norman.lol/',
  site: 'norman.lol',
} as const;

/** Who told Sinduri about Stitch and encouraged her to build this site. */
export const ENCOURAGEMENT = {
  name: 'Arthur Lorenz',
  href: 'https://utor.io/',
} as const;
