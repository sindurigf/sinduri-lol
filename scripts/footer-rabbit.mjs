/*
 * Prints the hero rabbit (src/lib/hero-field-hare.ts), sitting, as SVG paths for
 * the footer tuft: `node scripts/footer-rabbit.mjs [scale]`. Records the
 * canvas calls of drawHare and flattens arcs into 32 segments a circle.
 */
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { drawHare, hopFrame } = await jiti.import(
  '../src/lib/hero-field-hare.ts',
);

const SEGS = 32;
const fmt = (n) => +n.toFixed(2);
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const ROLE = { B: 'edge', G: 'body', S: 'shine' };
const makeCtx = () => {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let d = [];
  let cur = null;
  const out = [];
  const P = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const pt = (x, y) => {
    const [a, b] = P(x, y);
    return `${fmt(a)} ${fmt(b)}`;
  };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: '',
    lineCap: '',
    save() {
      stack.push([...m]);
    },
    restore() {
      m = stack.pop();
    },
    translate(x, y) {
      m = mul(m, [1, 0, 0, 1, x, y]);
    },
    scale(x, y) {
      m = mul(m, [x, 0, 0, y, 0, 0]);
    },
    rotate(a) {
      const c = Math.cos(a),
        s = Math.sin(a);
      m = mul(m, [c, s, -s, c, 0, 0]);
    },
    beginPath() {
      d = [];
    },
    moveTo(x, y) {
      d.push(`M${pt(x, y)}`);
    },
    lineTo(x, y) {
      d.push(`L${pt(x, y)}`);
    },
    bezierCurveTo(a, b, c, e, f, g) {
      d.push(`C${pt(a, b)} ${pt(c, e)} ${pt(f, g)}`);
    },
    quadraticCurveTo(a, b, c, e) {
      d.push(`Q${pt(a, b)} ${pt(c, e)}`);
    },
    arc(x, y, r, s, e, ccw) {
      let span = e - s;
      if (ccw) {
        if (span > 0) span -= 2 * Math.PI;
      } else if (span < 0) span += 2 * Math.PI;
      const n = Math.max(2, Math.ceil((Math.abs(span) / (2 * Math.PI)) * SEGS));
      for (let i = 0; i <= n; i++) {
        const t = s + (span * i) / n;
        const c = pt(x + r * Math.cos(t), y + r * Math.sin(t));
        d.push(i === 0 && d.length === 0 ? `M${c}` : `L${c}`);
      }
    },
    ellipse() {
      throw new Error('ellipse unsupported');
    },
    closePath() {
      d.push('Z');
    },
    fill() {
      out.push({ op: 'fill', style: ctx.fillStyle, d: d.join('') });
    },
    stroke() {
      out.push({
        op: 'stroke',
        style: ctx.strokeStyle,
        w: ctx.lineWidth * Math.hypot(m[0], m[1]),
        d: d.join(''),
      });
    },
  };
  return { ctx, out };
};
const palette = {
  border: 'B',
  subtle: 'B',
  bud: 'B',
  background: 'G',
  shine: 'S',
  veil: 'G',
  veilEdge: 'G',
  floor: 'G',
  floorEdge: 'G',
};
const { ctx, out } = makeCtx();
drawHare(
  ctx,
  0,
  0,
  Number(process.argv[2] ?? 1.7),
  hopFrame(0.5, 1, 0),
  0,
  palette,
);
// merge consecutive fill+stroke of the same path
const parts = [];
for (let i = 0; i < out.length; i++) {
  const o = out[i],
    n = out[i + 1];
  if (o.op === 'fill' && n && n.op === 'stroke' && n.d === o.d) {
    parts.push(
      `<path class="hare-${ROLE[o.style]}" d="${o.d}" stroke-width="${fmt(n.w)}"></path>`,
    );
    i++;
    continue;
  }
  parts.push(
    o.op === 'fill'
      ? `<path class="hare-${ROLE[o.style]}" d="${o.d}"></path>`
      : `<path class="hare-stroke" d="${o.d}" stroke-width="${fmt(o.w)}"></path>`,
  );
}
const xs = [],
  ys = [];
for (const o of out)
  for (const mt of o.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
    xs.push(+mt[1]);
    ys.push(+mt[2]);
  }
console.error(
  'bbox',
  Math.min(...xs),
  Math.min(...ys),
  Math.max(...xs),
  Math.max(...ys),
  'paths',
  parts.length,
  'roles',
  [...new Set(out.map((o) => o.op + o.style))].join(','),
);
console.log(parts.join('\n'));
