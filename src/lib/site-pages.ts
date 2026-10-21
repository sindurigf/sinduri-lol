import {
  categoryLabel,
  getCategoriesWithPosts,
  getPostsByTag,
  getSortedPosts,
  tagLabel,
} from './blog';
import { BRAND_SECTIONS, BRAND_PATH, brandHref } from './brand-sections';
import {
  ABOUT_PATH,
  ACCESSIBILITY_PATH,
  BLOG_PATH,
  CAREER_PATH,
  CONTACT_PATH,
  CREDITS_PATH,
  CV_PATH,
  PRIVACY_PATH,
  SITE_FEED_PATH,
  categoryHref,
  postHref,
  tagHref,
} from './paths';
import type { MatchablePage } from './page-match';
import { talkDecks } from './talk-deck';

/* The pages a lost visitor may have meant: the 404 page matches the address against these. */
export const sitePages = async (): Promise<MatchablePage[]> => {
  const talks = [...(await talkDecks())].map(([deck, slides]) => ({
    title: slides[0]?.slide.data.title ?? deck,
    path: `/talks/${deck}/`,
  }));
  return [
    { title: 'Home', path: '/' },
    { title: 'About', path: ABOUT_PATH },
    { title: 'Career', path: CAREER_PATH },
    { title: 'Blog', path: BLOG_PATH },
    { title: 'Contact', path: CONTACT_PATH },
    { title: 'Brand', path: BRAND_PATH },
    { title: 'Accessibility', path: ACCESSIBILITY_PATH },
    { title: 'Privacy', path: PRIVACY_PATH },
    { title: 'Credits', path: CREDITS_PATH },
    { title: 'CV', path: CV_PATH },
    ...(await getCategoriesWithPosts()).map((category) => ({
      title: categoryLabel(category),
      path: categoryHref(category),
    })),
    ...[...(await getPostsByTag()).keys()].map((tag) => ({
      title: tagLabel(tag),
      path: tagHref(tag),
    })),
    { title: 'RSS Feed', path: SITE_FEED_PATH },
    ...(await getSortedPosts()).map((post) => ({
      title: post.data.title,
      path: postHref(post.id),
    })),
    ...BRAND_SECTIONS.map(({ slug, title }) => ({
      title,
      path: brandHref(slug),
    })),
    ...talks,
  ];
};
