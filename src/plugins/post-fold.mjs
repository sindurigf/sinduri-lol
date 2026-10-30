/*
 * Folds a post's extras in a native <details>: the list after each Watch Out
 * h3, and code blocks of CODE_FOLD_MIN_LINES or more. The heading stays
 * outside the fold, so it is still a heading. Not slides.
 */

import { TALKS_PATH } from './post-figure.mjs';
import {
  CODE_FOLD_MIN_LINES,
  FOLD_CLASS,
  WATCH_OUT_HEADING,
  codeLabel,
  surprisesLabel,
} from '../lib/post-folds.ts';

const text = (value) => ({ type: 'text', value });

const span = (className, children, hidden = false) => ({
  type: 'element',
  tagName: 'span',
  properties: hidden ? { className, ariaHidden: 'true' } : { className },
  children,
});

/* A constant name: the native expanded state and the +/- marker carry the state (GOV.UK details). */
const summary = (what) => ({
  type: 'element',
  tagName: 'summary',
  properties: { className: ['post-contents-summary'] },
  children: [
    span(['fold-label'], [text(what)]),
    span(['post-contents-marker'], [], true),
  ],
});

/* One replacement: wrapNode keeps declared children after the node, and <summary> must come first. */
const wrapInFold = (ctx, node, what) => {
  ctx.replaceNode(node, {
    type: 'element',
    tagName: 'details',
    properties: { className: [FOLD_CLASS] },
    children: [summary(what), node],
  });
};

const nextElement = (ctx, node) => {
  const siblings = ctx.parent(node)?.children ?? [];
  const start = (ctx.indexOf(node) ?? siblings.length) + 1;
  return siblings
    .slice(start)
    .find((sibling) => sibling.type === 'element' || sibling.value?.trim());
};

const languageOf = (code) =>
  [code.properties?.className ?? []]
    .flat()
    .map(String)
    .find((name) => name.startsWith('language-'))
    ?.slice('language-'.length);

export const postFold = ({ fileURL } = {}) => ({
  name: 'post-fold',

  element: {
    filter: ['h3', 'pre'],

    visit(node, ctx) {
      if (String(fileURL ?? '').includes(TALKS_PATH)) return;

      if (node.tagName === 'h3') {
        if (ctx.textContent(node).trim() !== WATCH_OUT_HEADING) return;
        const list = nextElement(ctx, node);
        if (list?.type !== 'element' || !['ul', 'ol'].includes(list.tagName))
          return;
        const items = list.children.filter((child) => child.tagName === 'li');
        wrapInFold(ctx, list, surprisesLabel(items.length));
        return;
      }

      const [code] = node.children ?? [];
      if (code?.type !== 'element' || code.tagName !== 'code') return;
      const lines = ctx.textContent(code).replace(/\n$/, '').split('\n').length;
      if (lines < CODE_FOLD_MIN_LINES) return;
      wrapInFold(ctx, node, codeLabel(languageOf(code), lines));
    },
  },
});
