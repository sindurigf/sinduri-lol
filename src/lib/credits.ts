/**
 * Preference: personal site, then Drupal.org, then LinkedIn. Keyed by the name
 * as written after "Photo: "; an unlisted name stays plain text.
 */
export const PHOTOGRAPHERS = {
  'Alex Gruber': 'https://www.linkedin.com/in/alex-gruber-59617549/',
  'Andrey Pshenichny': 'https://andreys.info/',
  'Baris Tosun': 'https://www.drupal.org/u/rominronin',
  'Daniel Lemon': 'https://danlemon.com/',
  'Joris Vercammen': 'https://www.drupal.org/u/borisson_',
  'Klaus Purer': 'https://klau.si/',
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
      'Thank you for introducing me to Astro at a Drupal session. I am so amazed by its performance!',
  },
  {
    name: 'Alexandru Teodor Ieremia',
    href: 'https://www.linkedin.com/in/alexandru-teodor-ieremia-8581231b4/',
    reason:
      'Thank you for teaching me frontend and accessibility. I tried to use what I learned while building this site.',
  },
  {
    name: 'Petra Morawa-Zechner',
    href: 'https://diegestaltung.at/',
    reason:
      'Thank you for teaching me good design principles and how to think about sustainability in design.',
  },
] as const;
