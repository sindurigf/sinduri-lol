/* Pure, no imports: src/plugins/post-fold.mjs and the post page read it. */

/** The h3 whose list folds: each module's surprises. */
export const WATCH_OUT_HEADING = 'Watch Out';

/** A code block this many lines long or longer folds; shorter code stays open. */
export const CODE_FOLD_MIN_LINES = 15;

export const FOLD_CLASS = 'post-fold';

const FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^ {0,3}\1[ \t]*$/gm;

/** Whether Markdown has a Watch Out list or a long fenced block, so the page needs the fold script. */
export const hasFold = (markdown: string): boolean =>
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

/** "4 Surprises" or "the Python Code, 24 Lines": what a fold holds, after Show or Hide. */
export const surprisesLabel = (count: number): string =>
  `${count} ${count === 1 ? 'Surprise' : 'Surprises'}`;

export const codeLabel = (
  language: string | undefined,
  lines: number,
): string => {
  const name = language ? LANGUAGES[language] : undefined;
  return `the ${name ? `${name} ` : ''}Code, ${lines} Lines`;
};
