/*
 * Fails if a Markdown file links to a path that does not exist.
 *
 * The documentation in this repository is load-bearing and cross-referenced:
 * CLAUDE.md points at AI.md, ACCESSIBILITY.md, README.md and the skills, and
 * the pull request template points at ACCESSIBILITY.md and
 * docs/MANUAL_TESTING.md from inside .github/, so its links are all relative
 * and all one directory up. Renaming any of those targets breaks a link that
 * nothing else would catch, because a broken relative link in Markdown fails
 * silently on GitHub: it renders as an ordinary link and 404s on click.
 *
 * Only relative links are resolved. External URLs are not fetched, because a
 * checker that reaches the network fails for reasons that have nothing to do
 * with the change under test.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/* Not ours to validate, or not checked in. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.astro',
  'design',
  'test-results',
  'playwright-report',
]);

/* [text](target), ignoring any "title" that follows the target. */
const LINK = /\[[^\]]*\]\(\s*([^)\s]+?)\s*(?:"[^"]*")?\)/g;

/*
 * Not resolvable against the filesystem, for three different reasons.
 *
 * A scheme or a protocol-relative `//` is external. A bare `#` is a position
 * in the current file.
 *
 * A leading `/` is a site route, and this is the case worth spelling out: it
 * looks like a path and is not one. Blog posts link to each other that way,
 * as `/blog/consectetur-adipiscing-elit`, which Astro resolves through the
 * router from src/content/blog/consectetur-adipiscing-elit.md. Resolving it
 * as a path finds nothing and reports a break in a link that works. Checking
 * routes properly means enumerating what the build emits, which is the a11y
 * suite's job, not this file's.
 */
const isUnresolvable = (target) =>
  /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(target);

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = await Promise.all(
    entries.map((entry) => {
      if (entry.isDirectory()) {
        return SKIP_DIRS.has(entry.name) ? [] : walk(join(dir, entry.name));
      }
      return entry.name.endsWith('.md') ? [join(dir, entry.name)] : [];
    }),
  );
  return found.flat();
};

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

const failures = [];

for (const path of await walk(ROOT)) {
  const source = await readFile(path, 'utf8');

  for (const match of source.matchAll(LINK)) {
    const target = match[1];
    if (isUnresolvable(target)) continue;

    /* A fragment is a position inside the target, not part of its path. */
    const [pathPart] = target.split('#');
    if (pathPart === '') continue;

    const resolved = resolve(dirname(path), decodeURIComponent(pathPart));
    if (existsSync(resolved)) continue;

    failures.push(
      `${relative(ROOT, path)}:${lineOf(source, match.index)}  ${target}`,
    );
  }
}

if (failures.length > 0) {
  console.error(`Found ${failures.length} broken relative link(s):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Links: every relative Markdown link resolves.');
