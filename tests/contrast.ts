/**
 * The WCAG ratio floors, shared because they are properties of the standard
 * rather than of any one surface.
 *
 * AA_TEXT is SC 1.4.3 for body copy. AA_LARGE is the same criterion's relaxed
 * floor for large text, which the standard defines as 18pt, or 14pt bold —
 * 24px and 18.66px at this site's 16px root. NON_TEXT is SC 1.4.11, which
 * covers the boundary of a control and the focus indicator that marks its
 * state. AAA_TEXT is SC 1.4.6 and is informative here: this site targets AA,
 * and the gold tokens simply clear the higher bar.
 */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;
export const AAA_TEXT = 7;
export const NON_TEXT = 3;

/** Large text under SC 1.4.3, in CSS pixels at a 16px root. */
export const LARGE_TEXT_PX = 24;
export const LARGE_TEXT_BOLD_PX = 18.66;

/**
 * The contrast toolkit, as a string of JavaScript to install in the page.
 *
 * WHY A STRING AND NOT A MODULE. Every consumer runs this inside
 * `page.evaluate`, where the browser has no access to anything Node imported.
 * The maths has to be installed in the page, and a template literal spliced
 * into the evaluated body is how that happens without a bundler step.
 *
 * WHY IT IS SHARED. It lived in tests/gold-surface.spec.ts, which is where it
 * was written and where most of it is still used. tests/contrast-incomplete
 * .spec.ts needs the same `parse`, `luminance`, `ratio`, `over` and
 * `effectiveBackground`, and a second copy of a WCAG contrast implementation
 * is the kind of duplication that drifts silently: two files would disagree by
 * a rounding rule and both would keep passing. One definition, two importers.
 *
 * Colours come out of `getComputedStyle` as `rgb()` / `rgba()`, which is why
 * `parse` reads that form rather than hex; `fromHex` exists for the values
 * quoted in the documentation tables.
 */
export const PAGE_HELPERS = `
  const parse = (value) => {
    const m = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  const fromHex = (hex) => {
    const h = hex.trim().replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  };

  const channel = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const luminance = (c) =>
    0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  /*
   * Source-over composite of a partly transparent colour onto an opaque one.
   * A border painted at alpha 0.4 is not the colour it declares; what a reader
   * sees is that colour mixed with whatever is behind it, and that mix is what
   * SC 1.4.11 measures. Alpha 1 is the identity case, alpha 0 collapses to the
   * ground, which is the right answer for a border that declares a width and
   * paints nothing.
   */
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  /*
   * The effective background of an element: its own, or the nearest ancestor
   * with a non-transparent one. Returns null rather than guessing when an
   * image or gradient is in the way, or when a partly transparent layer would
   * make the answer a composite rather than a colour.
   */
  const effectiveBackground = (element) => {
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null;
      const colour = parse(style.backgroundColor);
      if (!colour) return null;
      if (colour.a === 0) continue;
      if (colour.a < 1) return null;
      return colour;
    }
    return null;
  };

  /*
   * The effective background, composited rather than surrendered.
   *
   * effectiveBackground above returns null the moment it meets a partly
   * transparent layer, which is the right answer where the caller needs a
   * single declared colour it can name. It is the wrong answer for a focus
   * ring: the sticky header is rgba(10, 10, 10, 0.94) over the page's
   * rgb(19, 19, 19), and every control inside it — the wordmark, four nav
   * links, the menu trigger, the call to action — came back unresolved on
   * that alone. 138 of 572 controls, which is not a rounding error, and a
   * spec that skipped them would have skipped the entire header.
   *
   * So: collect the translucent layers on the way up, find the first opaque
   * one, and composite them back down onto it. Still returns null for a
   * background image or a gradient, where there is no single colour to
   * composite and guessing would be worse than declining.
   */
  const compositeBackground = (element) => {
    const layers = [];
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null;
      const colour = parse(style.backgroundColor);
      if (!colour) return null;
      if (colour.a === 0) continue;
      if (colour.a < 1) {
        layers.push(colour);
        continue;
      }
      /* Opaque ground found: fold the translucent layers back onto it. */
      return layers.reduceRight((ground, layer) => over(layer, ground), colour);
    }
    return null;
  };

  const isGold = (colour) =>
    colour !== null && colour.r === 255 && colour.g === 192 && colour.b === 0;

  /*
   * Split a computed box-shadow into its layers. Not a plain split on ",":
   * every layer starts with an rgb() or rgba() colour, which contains commas
   * of its own, so this tracks parenthesis depth. Chromium computes a layer as
   * "rgb(255, 255, 255) 0px 0px 0px 3px inset".
   */
  const shadowLayers = (value) => {
    if (value === 'none') return [];
    const parts = [];
    let depth = 0;
    let current = '';
    for (const character of String(value)) {
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      if (character === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += character;
    }
    parts.push(current);
    return parts
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => ({
        text: part,
        colour: parse(part),
        inset: part.includes('inset'),
      }));
  };

  /*
   * Every layer of an element's focus indicator, measured against ONE colour:
   * the fill of the control it is marking. That is the measurement the offset
   * was hiding. An inset ring sits inside the padding box, so the fill is
   * literally what it abuts. The outline sits outside the border box, so with
   * a non-zero offset it abuts the ground instead and this number understates
   * it — which is the point, because the question being asked is what survives
   * when the offset is taken away.
   */
  const focusRingsAgainstFill = (element, fill) => {
    const style = getComputedStyle(element);
    const out = [];

    const outline = parse(style.outlineColor);
    if (
      outline !== null &&
      style.outlineStyle !== 'none' &&
      parseFloat(style.outlineWidth) > 0
    ) {
      out.push({
        layer: 'outline ' + style.outlineColor,
        ratio: Number(ratio(over(outline, fill), fill).toFixed(2)),
      });
    }

    for (const layer of shadowLayers(style.boxShadow)) {
      if (!layer.inset || layer.colour === null) continue;
      out.push({
        layer: 'inset ring ' + layer.text,
        ratio: Number(ratio(over(layer.colour, fill), fill).toFixed(2)),
      });
    }

    return out;
  };

  const describe = (element) => {
    const id = element.id ? '#' + element.id : '';
    const cls = element.className && typeof element.className === 'string'
      ? '.' + element.className.trim().split(/\\s+/).join('.')
      : '';
    return element.tagName.toLowerCase() + id + cls;
  };

  const hasOwnText = (element) =>
    [...element.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
    );

  /*
   * Controls inside a gold section that are invisible AS A SHAPE against the
   * ground behind them. Their labels may contrast perfectly, and every
   * automated contrast rule will pass them: a contrast rule measures a
   * foreground against its own background and never asks whether that
   * background is distinguishable from the surface the control sits on.
   *
   * A control is delimited by one of two things, so this checks one of two
   * things, chosen by the fill's alpha:
   *
   *   OPAQUE FILL (alpha 1). The fill is the boundary. .btn-primary on gold is
   *   this case: an opaque #FFC000 fill on a #FFC000 ground, 1.00:1, a button
   *   with no edge at all. Compared at 1.05 rather than at 3:1 deliberately —
   *   this arm is a same-colour detector, not a conformance check. A filled
   *   control can legitimately sit close to its ground and still be delimited
   *   by its border, and that border is measured by the arm below.
   *
   *   TRANSPARENT OR PARTLY TRANSPARENT FILL (alpha < 1). The ground shows
   *   through, so the BORDER is the only thing that delimits the control, and
   *   a border matching the ground makes it exactly as invisible as the fill
   *   case. .btn-gold-secondary is this case: background-color: transparent
   *   with a 4px #131313 border, 11.32 on gold. The border is a non-text
   *   boundary, so the threshold here is the 3:1 of SC 1.4.11 rather than the
   *   same-colour proxy above.
   *
   * ALL FOUR EDGES ARE TESTED, not just the narrowest. Width and colour are
   * set independently in CSS — this codebase writes both border-4 and
   * border-b-8 with different tokens — so the narrowest edge is a proxy for
   * nothing: it can be the one edge that passes while a wider one fails. Each
   * edge is an independent segment of the control's outline, and a control
   * whose left and right edges vanish into the ground reads as two horizontal
   * rules rather than as a button. The cost of being thorough is three extra
   * ratio computations on a handful of elements.
   *
   * WHAT THIS DELIBERATELY DOES NOT FLAG: a control with no declared border at
   * all. Every link in prose inside a gold section is a transparent fill with
   * no border, and it is not border-delimited — it is delimited by its colour
   * and its underline, which .surface-gold supplies and the text walk in this
   * file already measures. Flagging those would make this check fire on every
   * paragraph link on the surface and it would be wrong about all of them.
   */
  const BORDER_EDGES = ['top', 'right', 'bottom', 'left'];

  const invisibleControls = (root) => {
    const out = [];
    const rgb = (c) =>
      'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')';

    for (const element of root.querySelectorAll('a, button, [role="button"]')) {
      const style = getComputedStyle(element);
      const fill = parse(style.backgroundColor);
      if (fill === null) continue;

      const behind = effectiveBackground(element.parentElement);
      if (behind === null) continue;

      const ground = rgb(behind);
      const label = (element.textContent ?? '').trim().slice(0, 40);

      if (fill.a === 1) {
        if (ratio(fill, behind) < 1.05) {
          out.push({
            selector: describe(element),
            detail: 'fill ' + style.backgroundColor + ' on ' + ground,
            label,
          });
        }
        continue;
      }

      /*
       * Group the failing edges by the colour they resolve to, so a uniform
       * four-sided border reports one line naming all four rather than four
       * identical ones.
       */
      const failing = new Map();

      for (const edge of BORDER_EDGES) {
        const cap = edge[0].toUpperCase() + edge.slice(1);
        if (['none', 'hidden'].includes(style['border' + cap + 'Style'])) continue;
        if (parseFloat(style['border' + cap + 'Width']) <= 0) continue;

        const declared = parse(style['border' + cap + 'Color']);
        if (declared === null) continue;

        const painted = over(declared, behind);
        const measured = ratio(painted, behind);
        if (measured >= ${NON_TEXT}) continue;

        const key = rgb(painted) + '|' + measured.toFixed(2);
        if (!failing.has(key)) failing.set(key, { painted, measured, edges: [] });
        failing.get(key).edges.push(edge);
      }

      for (const entry of failing.values()) {
        out.push({
          selector: describe(element),
          detail:
            'border-' + entry.edges.join('/') + ' ' + rgb(entry.painted) +
            ' on ' + ground + ' at ' + entry.measured.toFixed(2) + ':1, needs ' +
            ${NON_TEXT},
          label,
        });
      }
    }
    return out;
  };
`;
