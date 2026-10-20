import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { BLOG_CONTENT_DIR, postHref } from './paths';

/*
 * Titles and paths of posts and talks, read from source as plain Node. The
 * Footer on every page uses them, and astro:content would emit every post
 * image on pages that never show it (scripts/check-untransformed.mjs).
 */

export interface PageLink {
  title: string;
  href: string;
}

const TALKS_DIR = './src/content/talks';
const TALKS_PATH = '/talks/';
const DECK_FILE = 'slides.md';
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const FIRST_HEADING = /^# (.+)$/m;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Published posts, newest first. */
export const postLinks = (dir = BLOG_CONTENT_DIR): PageLink[] =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .flatMap((name) => {
      const block = FRONTMATTER.exec(
        readFileSync(join(dir, name), 'utf8'),
      )?.[1];
      const data: unknown = block === undefined ? undefined : load(block);
      if (!isRecord(data)) throw new Error(`${name} has no frontmatter.`);
      const { title, date, placeholder } = data;
      if (typeof title !== 'string' || typeof date !== 'string') {
        throw new Error(`${name} needs a title and a date.`);
      }
      return placeholder === true
        ? []
        : [{ title, date, href: postHref(name.replace(/\.md$/, '')) }];
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ title, href }) => ({ title, href }));

/** Talk decks: the cover slide's heading is the title. */
export const talkLinks = (dir = TALKS_DIR): PageLink[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name, DECK_FILE);
    if (!entry.isDirectory() || !existsSync(file)) return [];
    const title = FIRST_HEADING.exec(readFileSync(file, 'utf8'))?.[1];
    if (title === undefined) throw new Error(`${file} has no cover heading.`);
    return [{ title, href: `${TALKS_PATH}${entry.name}/` }];
  });
