import { expect, test } from '@playwright/test';
import { builtHtml } from './routes';

/**
 * No word is glued to an inline element. With `compressHTML`, Astro drops the
 * line break between an inline closing tag at the end of a source line and
 * the text that starts the next one, so
 *
 *   before <a href="…">Klaus Purer</a>
 *   and Drupal
 *
 * built to "Klaus Purerand Drupal". Nothing else catches it: axe, the type
 * checker and the formatter all pass. The fix is an explicit `{' '}` after the
 * tag. Found in four places on 2026-09-18, /about three times and /privacy
 * once, and a fifth, before a `<span lang="la">`, written and caught the same
 * day while moving /about onto Section; `span` joined the opening side then.
 *
 * It reads dist/ rather than driving a browser, inside the test body only; see
 * tests/routes.ts.
 *
 * Proven able to fail, 2026-09-18: against a build with the `</a>and` fix
 * but not the other three, it reported exactly /about `</strong>My` twice and
 * /privacy `</strong>Every`; rebuilt with all four fixes, it passed.
 */
const INLINE = 'a|strong|em|b|i|code';

/*
 * `span` only on the opening side: a closing `</span>` is routinely followed
 * straight by text, after the empty square marker in the blog filter.
 */
const OPENING = `${INLINE}|span`;

/** A closing inline tag with a letter straight after it, or a letter straight before an opening one. */
const GLUED = new RegExp(
  `</(?:${INLINE})>[A-Za-z]|[A-Za-z]<(?:${OPENING})[\\s>]`,
  'g',
);

const CONTEXT_CHARS = 30;

test('no word is glued to a link or an emphasis', () => {
  const glued = [...builtHtml()].flatMap(([route, html]) =>
    [...html.matchAll(GLUED)].map((match) => {
      const start = Math.max(0, match.index - CONTEXT_CHARS);
      return `${route}: …${html.slice(start, match.index + CONTEXT_CHARS)}…`;
    }),
  );
  expect(glued, glued.join('\n')).toEqual([]);
});
