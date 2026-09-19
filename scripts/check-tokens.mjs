/*
 * Fails if anything in src/ writes a value that should come from a token: a
 * Tailwind arbitrary value, a raw hex colour, a colour function, a raw length
 * in CSS, a spacing utility off the 4px scale, or an inline style. It replaces a pull request checkbox that was ticked on every pull
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

/* rgb(), rgba(), hsl(), hsla(): a colour, like hex, belongs in @theme. */
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?)\(/g;

/*
 * A length in a CSS declaration. Only px, rem and em: viewport and container
 * units describe the layout rather than a design value, and zero is zero in
 * any unit.
 */
const RAW_LENGTH =
  /(?<![\w.#-])(?!0*\.?0+(?:px|rem|em)\b)\d*\.?\d+(?:px|rem|em)\b/g;

/*
 * A margin, padding, gap or inset utility. The spacing scale is 4px steps from
 * docs/STYLEGUIDE.md: 0, 1, 2, 3, 4, 6, 8, 12, 16, 24. A half step or a step
 * between them is a value nobody chose on purpose.
 */
const SPACING_UTILITY =
  /(?<![\w-])-?(?:[a-z0-9]+:)*(?:m|mt|mb|ml|mr|mx|my|ms|me|p|pt|pb|pl|pr|px|py|ps|pe|gap|gap-x|gap-y|space-x|space-y|top|bottom|left|right|inset|inset-x|inset-y)-(\d+(?:\.\d+)?)(?![\w.-])/g;
const SPACING_SCALE = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '6',
  '8',
  '12',
  '16',
  '24',
]);

const INLINE_STYLE = /\sstyle=["{]/g;

/*
 * Known exceptions, each waiting on a decision that will remove it. An entry
 * that no longer matches anything fails too, so the list cannot outlive the
 * code it excuses.
 */
const PENDING = [
  {
    file: 'src/components/PageHero.astro',
    text: 'lg:py-20',
    reason:
      'hero padding, decided in the hero pass (docs/STYLEGUIDE.md Part 3)',
  },
  {
    file: 'src/pages/404.astro',
    text: 'py-28',
    reason:
      '404 hero padding, decided in the hero pass (docs/STYLEGUIDE.md Part 3)',
  },
];

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

/* The span of the `@theme static { … }` block, where literals are tokens. */
const themeSpan = (source) => {
  const start = source.indexOf('@theme static {');
  return start === -1 ? [0, 0] : [start, source.indexOf('\n}', start)];
};

/*
 * The CSS in a file: all of a .css file, the <style> blocks of a component.
 * Each span is scanned declaration by declaration, so a custom property
 * definition (`--x: 4px`, which is a token) and a media query condition are
 * told apart from a property that uses a raw value.
 */
const cssSpans = (path, source) => {
  if (path.endsWith('.css')) return [[0, source.length]];
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => [
    m.index + m[0].indexOf(m[1]),
    m.index + m[0].indexOf(m[1]) + m[1].length,
  ]);
};

const rawLengths = (source, [from, to], [themeFrom, themeTo]) => {
  const hits = [];
  const re = new RegExp(RAW_LENGTH.source, 'g');
  re.lastIndex = from;
  for (let m = re.exec(source); m && m.index < to; m = re.exec(source)) {
    if (m.index >= themeFrom && m.index <= themeTo) continue;
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    const statementStart = Math.max(
      source.lastIndexOf(';', m.index),
      source.lastIndexOf('{', m.index),
      source.lastIndexOf('}', m.index),
      lineStart - 1,
    );
    const statement = source.slice(statementStart + 1, m.index).trimStart();
    if (statement.startsWith('--')) continue;
    if (/^@(media|container|supports)/.test(statement)) continue;
    const blockStart = source.lastIndexOf('{', m.index);
    const opener = source.slice(
      source.lastIndexOf('\n', blockStart) + 1,
      blockStart,
    );
    if (
      /^\s*@(media|container)/.test(opener) &&
      source.slice(blockStart, m.index).indexOf(':') === -1
    )
      continue;
    hits.push({ text: m[0], at: locate(source, m.index) });
  }
  return hits;
};

const failures = [];
const pendingSeen = new Set();

const isPending = (name, text) =>
  PENDING.some((entry, i) => {
    const hit = entry.file === name && entry.text === text;
    if (hit) pendingSeen.add(i);
    return hit;
  });

for (const path of await walk(SRC)) {
  const source = blankComments(await readFile(path, 'utf8'));
  const name = relative(ROOT, path);
  const theme = path === TOKEN_SOURCE ? themeSpan(source) : [0, 0];
  const inTheme = (at) => {
    const offset = source
      .split('\n')
      .slice(0, Number(at.split(':')[0]) - 1)
      .join('\n').length;
    return offset >= theme[0] && offset <= theme[1];
  };

  for (const hit of scan(source, ARBITRARY_VALUE)) {
    failures.push(`${name}:${hit.at}  arbitrary value  ${hit.text}`);
  }

  for (const hit of scan(source, COLOUR_FUNCTION)) {
    if (!inTheme(hit.at)) {
      failures.push(`${name}:${hit.at}  colour function  ${hit.text}`);
    }
  }

  for (const span of cssSpans(path, source)) {
    for (const hit of rawLengths(source, span, theme)) {
      failures.push(`${name}:${hit.at}  raw length  ${hit.text}`);
    }
  }

  for (const match of source.matchAll(SPACING_UTILITY)) {
    if (SPACING_SCALE.has(match[1])) continue;
    const text = match[0];
    if (isPending(name, text)) continue;
    failures.push(
      `${name}:${locate(source, match.index)}  off-scale spacing  ${text}`,
    );
  }

  if (path.endsWith('.astro') || path.endsWith('.vue')) {
    for (const hit of scan(source, INLINE_STYLE)) {
      failures.push(`${name}:${hit.at}  inline style`);
    }
  }

  if (path === TOKEN_SOURCE) continue;

  for (const hit of scan(source, RAW_HEX)) {
    failures.push(`${name}:${hit.at}  raw hex  ${hit.text}`);
  }
}

PENDING.forEach((entry, i) => {
  if (!pendingSeen.has(i)) {
    failures.push(
      `${entry.file}  pending exception "${entry.text}" no longer matches; remove it from PENDING`,
    );
  }
});

if (failures.length > 0) {
  console.error(
    `Found ${failures.length} value(s) that should come from a token:\n`,
  );
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    '\nAdd a token to src/styles/global.css and use it by name. See the' +
      '\n--spacing-menu-bar and --spacing-joint comments for the house style.',
  );
  process.exit(1);
}

console.log(
  'Tokens: no arbitrary values, raw colours, raw lengths, off-scale spacing or inline styles outside the tokens.',
);
