/*
 * Marks a list item whose entire content is a single link, so CSS can give
 * that link a real target box.
 *
 * SC 2.5.8 grants an inline exception: a link in a sentence is exempt,
 * because the line it sits in sets its size and the author cannot enlarge it
 * without breaking the paragraph. A bibliography bullet that is nothing but a
 * link has no sentence around it, so the exception does not reach it: it
 * renders 21px tall and fails. See ACCESSIBILITY.md section 4, which says
 * every target on this site passes on its own size and that the spacing
 * exception is implemented nowhere.
 *
 * A "Sources and further reading" list mixes the two shapes, and only one of
 * them fails:
 *
 *   - Rust, [Governance and teams](...)     exempt, there is a sentence
 *   - [Linux](https://www.kernel.org/)      not exempt, 21px, fails
 *
 * Conformance would otherwise hang on how each line happens to be worded,
 * which is not something a post author should have to hold in their head.
 * This runs at build time over every markdown document instead.
 *
 * WHY A PLUGIN AND NOT A SELECTOR. CSS cannot ask whether an element has text
 * of its own; `li > a:only-child` matches both shapes above, because a text
 * node is not a child for the purposes of `:only-child`. So the "Rust," line
 * would be padded too, and padding a link that is genuinely in a sentence
 * opens the leading around it. The distinction has to be drawn where the text
 * nodes are still visible, which is the tree.
 *
 * This is a Sätteri hast visitor, not a rehype plugin. Astro 7 made Sätteri
 * the default markdown processor; `markdown.rehypePlugins` still parses, but
 * it warns that it needs `@astrojs/markdown-remark`, which is no longer
 * installed, and it silently does nothing without it. `hastPlugins` on the
 * processor is the supported hook.
 */

const MARKER_CLASS = 'link-item';

/*
 * The inline elements markdown can put between a list item and a link inside
 * it: `**[text](url)**`, `*[text](url)*`, `~~[text](url)~~`. Deliberately not
 * every inline element: this is the set the content pipeline can produce, and
 * a wider one would start guessing.
 */
const WRAPPERS = new Set(['strong', 'em', 'del']);

const isElement = (node, tagName) =>
  node?.type === 'element' && node.tagName === tagName;

export const linkListItem = {
  name: 'link-list-item',

  element: {
    filter: ['a'],

    visit(node, ctx) {
      let current = node;
      let parent = ctx.parent(current);

      while (parent?.type === 'element' && WRAPPERS.has(parent.tagName)) {
        current = parent;
        parent = ctx.parent(current);
      }

      if (!isElement(parent, 'li')) return;

      /*
       * Comparing text rather than counting children is what makes the
       * `strong` case above work without a special branch: a wrapper
       * contributes no text of its own, so the two strings still match. It
       * also rules out `<li>Rust, <a>…</a></li>`, where the item carries
       * text the link does not.
       */
      const whole = ctx.textContent(parent).trim();
      if (whole === '' || whole !== ctx.textContent(node).trim()) return;

      const existing = parent.properties?.className;
      ctx.setProperty(
        parent,
        'className',
        Array.isArray(existing) ? [...existing, MARKER_CLASS] : [MARKER_CLASS],
      );
    },
  },
};
