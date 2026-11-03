/* Folds a post's Watch Out lists, long code and module bodies in native <details>; headings stay outside. Not slides. */

import { TALKS_PATH } from './post-figure.mjs';
import {
  CODE_FOLD_MIN_LINES,
  FOLD_CLASS,
  WATCH_OUT_HEADING,
  moduleLabel,
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

const button = (action, label) => ({
  type: 'element',
  tagName: 'button',
  properties: {
    type: 'button',
    className: ['btn-secondary'],
    dataModules: action,
  },
  children: [text(label)],
});

/* Hidden until src/scripts/post-folds.ts wires them: without JavaScript they would do nothing. */
const moduleControls = () => ({
  type: 'element',
  tagName: 'div',
  properties: { className: ['module-controls'], hidden: true },
  children: [
    button('close', 'Close All Modules'),
    button('open', 'Open All Modules'),
  ],
});

/*
 * Each module's body after its h2, in a <details open>, so nothing is hidden on load.
 * One child-list swap on the parent keeps the Watch Out and code folds postFold made.
 */
const groupModules = (ctx, siblings) => {
  const isH2 = (node) => node.type === 'element' && node.tagName === 'h2';
  /* GFM footnotes follow the last module with their own sr-only h2; they are not its body. */
  const endsModule = (node) =>
    isH2(node) ||
    (node.type === 'element' &&
      node.tagName === 'section' &&
      node.properties?.dataFootnotes !== undefined);
  const out = [];
  let controlsPlaced = false;
  for (let index = 0; index < siblings.length; index += 1) {
    const node = siblings[index];
    const label = isH2(node) ? moduleLabel(ctx.textContent(node)) : undefined;
    if (!label) {
      out.push(node);
      continue;
    }
    if (!controlsPlaced) {
      out.push(moduleControls());
      controlsPlaced = true;
    }
    out.push(node);
    const body = [];
    while (index + 1 < siblings.length && !endsModule(siblings[index + 1])) {
      index += 1;
      body.push(siblings[index]);
    }
    out.push({
      type: 'element',
      tagName: 'details',
      properties: { className: [FOLD_CLASS], dataModule: '', open: true },
      children: [summary(label), ...body],
    });
  }
  return out;
};

export const moduleFold = ({ fileURL } = {}) => {
  let done = false;

  return {
    name: 'module-fold',

    element: {
      filter: ['h2'],

      visit(node, ctx) {
        if (done || String(fileURL ?? '').includes(TALKS_PATH)) return;
        if (!moduleLabel(ctx.textContent(node))) return;
        done = true;
        const parent = ctx.parent(node);
        ctx.setProperty(parent, 'children', groupModules(ctx, parent.children));
      },
    },
  };
};
