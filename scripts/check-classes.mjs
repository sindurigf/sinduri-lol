/*
 * Fails if a class in the built HTML has no rule in the built CSS.
 *
 * Tailwind v4 generates nothing for a utility whose theme token does not
 * exist, and says nothing about it: `tracking-heading-tight` and
 * `shadow-hard-gold-4` rendered as plain text for a whole branch, with every
 * test green. This compares what the pages ask for with what the stylesheets
 * define, after `npm run build`.
 *
 * A variant is matched as the class Tailwind generates for it: `hover:text-cyan`
 * is the selector `.hover\:text-cyan:hover`, whose class name, unescaped, is
 * the token itself. Only selector text is read, never declaration values, so a
 * `0.5rem` in a value cannot pass for a class named `5rem`.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist/client');
const SRC = join(ROOT, 'src');
const PUBLIC = join(ROOT, 'public');
const SOURCE_EXTENSIONS = ['.astro', '.vue', '.ts', '.md', '.mjs'];

/*
 * Deliberate hooks: classes put in the markup for a test or a script to
 * select, meant to have no CSS of their own. That is the only thing that
 * belongs here. A class nothing reads is dead and should be deleted; a class
 * meant to style something and generating nothing is the bug this file
 * exists to catch, and should be fixed. Each entry names what selects it.
 */
const HOOKS = new Map([
  [
    'page-hero',
    'test hook: tests/page-hero.spec.ts and tests/page-structure.spec.ts ' +
      'select it to find the hero.',
  ],
]);

const walk = async (dir, extensions) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path, extensions);
      return extensions.some((ext) => entry.name.endsWith(ext)) ? [path] : [];
    }),
  );
  return files.flat();
};

/* `.hover\:text-cyan` → `hover:text-cyan`, `.w-1\/2` → `w-1/2`. */
const unescape = (name) =>
  name
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, '$1');

const CLASS_IN_SELECTOR = /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-])+)/g;

/*
 * Every class named in a selector. The text before each `{` is a selector or
 * an at-rule prelude; the text after the last `;` in it drops any declaration
 * that precedes a nested rule. Preludes are skipped.
 */
const selectorClasses = (css) => {
  const classes = new Set();
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const chunk of stripped.split('{').slice(0, -1)) {
    const selector = chunk.split(/[;}]/).at(-1).trim();
    if (selector.startsWith('@') || selector === '') continue;
    for (const [, name] of selector.matchAll(CLASS_IN_SELECTOR)) {
      classes.add(unescape(name));
    }
  }
  return classes;
};

const CLASS_ATTRIBUTE = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/g;

const decodeEntities = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const main = async () => {
  if (!existsSync(DIST)) {
    console.error(
      'Classes: dist/client does not exist. Run `npm run build` first; this ' +
        'check reads the build output.',
    );
    process.exit(1);
  }

  const pages = await walk(DIST, ['.html']);

  /*
   * The check reads the build, so a build older than the source passes or
   * fails on code that is no longer there. Every page is rewritten on each
   * build, so the newest page is when the build ran.
   */
  const newest = async (files) =>
    Math.max(
      ...(await Promise.all(
        files.map(async (file) => (await stat(file)).mtimeMs),
      )),
    );
  const builtAt = await newest(pages);
  const editedAt = await newest([
    ...(await walk(SRC, [''])),
    ...(await walk(PUBLIC, [''])),
  ]);
  if (editedAt > builtAt) {
    console.error('Classes: dist/ is older than src/, run npm run build.');
    process.exit(1);
  }
  const stylesheets = await walk(DIST, ['.css']);

  const defined = new Set();
  for (const file of stylesheets) {
    for (const name of selectorClasses(await readFile(file, 'utf8'))) {
      defined.add(name);
    }
  }

  /* class → the built pages that use it */
  const used = new Map();
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    for (const [, css] of html.matchAll(INLINE_STYLE)) {
      for (const name of selectorClasses(css)) defined.add(name);
    }
    for (const [, double, single] of html.matchAll(CLASS_ATTRIBUTE)) {
      for (const token of decodeEntities(double ?? single).split(/\s+/)) {
        if (token === '') continue;
        if (!used.has(token)) used.set(token, new Set());
        used.get(token).add(relative(ROOT, file));
      }
    }
  }

  const missing = [...used.keys()]
    .filter((token) => !defined.has(token) && !HOOKS.has(token))
    .sort();

  if (missing.length === 0) {
    console.log(
      `Classes: all ${used.size} classes in the built HTML have CSS or are listed hooks.`,
    );
    return;
  }

  const sources = await walk(SRC, SOURCE_EXTENSIONS);
  const sourceText = await Promise.all(
    sources.map(async (file) => [
      relative(ROOT, file),
      await readFile(file, 'utf8'),
    ]),
  );
  const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

  console.error(
    `Classes: ${missing.length} class(es) in the built HTML generate no CSS.`,
  );
  for (const token of missing) {
    const pagesUsing = [...used.get(token)].sort();
    const bounded = new RegExp(
      `(^|[\\s"'\`])${escapeRegExp(token)}(?=[\\s"'\`]|$)`,
      'm',
    );
    const inSource = sourceText
      .filter(([, text]) => bounded.test(text))
      .map(([file]) => file);
    console.error(`\n  ${token}`);
    console.error(
      `    source: ${inSource.length > 0 ? inSource.join(', ') : 'not found as a literal in src/'}`,
    );
    console.error(
      `    built:  ${pagesUsing[0]}${pagesUsing.length > 1 ? ` and ${pagesUsing.length - 1} more` : ''}`,
    );
  }
  process.exit(1);
};

await main();
