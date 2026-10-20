import { postLinks, talkLinks, type PageLink } from './site-pages';
import {
  ABOUT_PATH,
  ACCESSIBILITY_PATH,
  BLOG_PATH,
  CAREER_PATH,
  CONTACT_PATH,
  CREDITS_PATH,
  PRIVACY_PATH,
} from './paths';

/** Every page the Curiouser button can land on, by title; posts and talks are read from source. */
export const curiouserPages = (): PageLink[] => [
  { title: 'About', href: ABOUT_PATH },
  { title: 'Career', href: CAREER_PATH },
  { title: 'Blog', href: BLOG_PATH },
  ...postLinks(),
  ...talkLinks(),
  { title: 'Credits', href: CREDITS_PATH },
  { title: 'Accessibility', href: ACCESSIBILITY_PATH },
  { title: 'Privacy', href: PRIVACY_PATH },
  { title: 'Contact', href: CONTACT_PATH },
];
