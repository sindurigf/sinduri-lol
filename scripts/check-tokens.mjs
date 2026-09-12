/*
 * Fails if a component reintroduces a Tailwind arbitrary value or a raw hex
 * colour. It replaces a pull request checkbox that was ticked on every pull
 * request while violations sat in the tree.
 *
 * Both scans ignore comments. Contrast documentation in several components
 * quotes surface hex values on purpose, and that prose is the reason the
 * tokens are trustworthy. Flagging it would make this a check people learn to
 * silence, which is the failure mode the file exists to correct.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

/* The only file allowed to name a colour literally. */
const TOKEN_SOURCE = join(SRC, 'styles/global.css');

const EXTENSIONS = ['.astro', '.vue', '.ts', '.css'];

/*
 * A Tailwind arbitrary value: a utility, then a bracketed literal, as in
 * `h-[3px]`. The utility must be a real dash-separated chain so that
 * subscript syntax in a script block (`items[0]`, `map[key]`) cannot match.
 */
const ARBITRARY_VALUE = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]\s]+\]/g;

/* #abc, #aabbcc, #aabbccdd. */
const RAW_HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g;

/*
 * Blank out comments while preserving line and column numbers, so a hit
 * still reports the position it actually occupies in the file. Replacing a
 * comment with "" would shift every line after it.
 */
const blankComments = (source) => {
  const keepNewlines = (match) => match.replace(/[^\n]/g, ' ');

  return source
    .replace(/\/\*[\s\S]*?\*\//g, keepNewlines) /* block */
    .replace(/<!--[\s\S]*?-->/g, keepNewlines) /* markup */
    .replace(/^[ \t]*\/\/.*$/gm, keepNewlines); /* whole-line // only, so a
                                                   URL is never truncated */
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [path] : [];
    }),
  );
  return files.flat();
};

const locate = (source, index) => {
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  return `${line}:${index - before.lastIndexOf('\n')}`;
};

const scan = (source, pattern) => {
  const hits = [];
  for (const match of source.matchAll(pattern)) {
    hits.push({ text: match[0], at: locate(source, match.index) });
  }
  return hits;
};

const failures = [];

for (const path of await walk(SRC)) {
  const source = blankComments(await readFile(path, 'utf8'));
  const name = relative(ROOT, path);

  for (const hit of scan(source, ARBITRARY_VALUE)) {
    failures.push(`${name}:${hit.at}  arbitrary value  ${hit.text}`);
  }

  if (path === TOKEN_SOURCE) continue;

  for (const hit of scan(source, RAW_HEX)) {
    failures.push(`${name}:${hit.at}  raw hex  ${hit.text}`);
  }
}

if (failures.length > 0) {
  console.error(
    `Found ${failures.length} value(s) that should come from a token:\n`,
  );
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    '\nAdd a token to src/styles/global.css and use it by name. See the' +
      '\n--spacing-menu-bar and --blur-header comments for the house style.',
  );
  process.exit(1);
}

console.log('Tokens: no arbitrary values or raw hex outside global.css.');
