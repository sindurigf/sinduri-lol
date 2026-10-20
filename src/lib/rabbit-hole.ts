import { PHOTOGRAPHERS } from './credits';
import {
  ABOUT_PATH,
  ACCESSIBILITY_PATH,
  BLOG_PATH,
  CAREER_PATH,
  CONTACT_PATH,
  CREDITS_PATH,
  DOWN_PATH,
  PRIVACY_PATH,
} from './paths';
import { postLinks, talkLinks, type PageLink } from './site-pages';

/** Lewis Carroll, Alice's Adventures in Wonderland (1865), chapters 1 and 2: public domain. */
export const FALL_QUOTE =
  'Down, down, down. Would the fall never come to an end?';
export const QUOTE_SOURCE = 'Lewis Carroll, Alice’s Adventures in Wonderland';
export const CURIOUSER_QUOTE = 'Curiouser and curiouser!';

export const LEPUS_RIDET_MEANING = 'the hare laughs';

const FEET_PER_SHELF = 40;

export interface Shelf {
  kind: 'Post' | 'Talk' | 'Fact' | 'Jar' | 'Map';
  /** A Latin phrase that opens the text and is marked as Latin. */
  term?: string;
  text: string;
  /** The link's name: unique on the page, so it says where it goes (SC 2.4.9). */
  linkLabel: string;
  href: string;
  depth: number;
}

const postPages = async (): Promise<PageLink[]> => postLinks();
const talkPages = async (): Promise<PageLink[]> => talkLinks();

/** Real things from the site, in the order they go past: nothing here is typed by hand but the framing words. */
export const shelves = async (): Promise<Shelf[]> => {
  const [posts, talks] = await Promise.all([postPages(), talkPages()]);
  const named = Object.keys(PHOTOGRAPHERS).length;
  const items: Omit<Shelf, 'depth'>[] = [
    {
      kind: 'Fact',
      term: 'Lepus Ridet',
      text: ` is Latin for “${LEPUS_RIDET_MEANING}”.`,
      href: ABOUT_PATH,
      linkLabel: 'Why that name, on About',
    },
    ...posts.map((post) => ({
      kind: 'Post' as const,
      text: 'A post from the blog.',
      href: post.href,
      linkLabel: post.title,
    })),
    {
      kind: 'Jar',
      text: `Orange Marmalade, the jar said. It was empty. The credits are not: ${named} photographers are named there.`,
      href: CREDITS_PATH,
      linkLabel: 'Open the credits',
    },
    ...talks.map((talk) => ({
      kind: 'Talk' as const,
      text: 'A talk, as slides.',
      href: talk.href,
      linkLabel: talk.title,
    })),
    {
      kind: 'Map',
      text: 'A map of where this started and where it went.',
      href: CAREER_PATH,
      linkLabel: 'Follow the career',
    },
  ];
  return items.map((item, i) => ({ ...item, depth: (i + 1) * FEET_PER_SHELF }));
};

/** Every page the Curiouser button can land on, by title. */
export const curiouserPages = async (): Promise<PageLink[]> => [
  { title: 'About', href: ABOUT_PATH },
  { title: 'Career', href: CAREER_PATH },
  { title: 'Blog', href: BLOG_PATH },
  ...(await postPages()),
  ...(await talkPages()),
  { title: 'Credits', href: CREDITS_PATH },
  { title: 'Accessibility', href: ACCESSIBILITY_PATH },
  { title: 'Privacy', href: PRIVACY_PATH },
  { title: 'Contact', href: CONTACT_PATH },
  { title: 'Down the Rabbit Hole', href: DOWN_PATH },
];
