/* Pure, no imports: src/plugins/post-fold.mjs and the post page read it. */

/** The h3 whose list folds: each module's surprises. */
export const WATCH_OUT_HEADING = 'Watch Out';

/** A code block this many lines long or longer folds; shorter code stays open. */
export const CODE_FOLD_MIN_LINES = 15;

export const FOLD_CLASS = 'post-fold';

/** An h2 that opens a module: "Module 3: Practice with Test Content" or "Side Path: Move an Existing Site". */
export const MODULE_HEADING = /^(Module \d+|Side Path):/;

/** "Module 3 Steps": a module fold's name, the same open or closed. */
export const moduleLabel = (heading: string): string | undefined => {
  const match = MODULE_HEADING.exec(heading.trim());
  return match ? `${match[1]} Steps` : undefined;
};

const FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^ {0,3}\1[ \t]*$/gm;

/** Whether Markdown has a Watch Out list or a long fenced block, so the page needs the fold script. */
export const hasFold = (markdown: string): boolean =>
  new RegExp(`^## ${MODULE_HEADING.source.slice(1)}`, 'm').test(markdown) ||
  new RegExp(`^### ${WATCH_OUT_HEADING}[ \\t]*$`, 'm').test(markdown) ||
  [...markdown.matchAll(FENCE)].some(
    ([, , body]) => (body ?? '').split('\n').length - 1 >= CODE_FOLD_MIN_LINES,
  );

const LANGUAGES: Record<string, string> = {
  bash: 'Bash',
  json: 'JSON',
  python: 'Python',
  ruby: 'Ruby',
  scss: 'SCSS',
  sql: 'SQL',
  yaml: 'YAML',
};

/** "4 Surprises" or "Python Code, 24 Lines": a fold's name, the same open or closed. */
export const surprisesLabel = (count: number): string =>
  `${count} ${count === 1 ? 'Surprise' : 'Surprises'}`;

export const codeLabel = (
  language: string | undefined,
  lines: number,
): string => {
  const name = language ? LANGUAGES[language] : undefined;
  return `${name ? `${name} ` : ''}Code, ${lines} Lines`;
};
