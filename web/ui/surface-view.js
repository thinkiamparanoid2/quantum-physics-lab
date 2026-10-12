// Drawing the rotated surface code (lib/qec.js): data qubits on a grid, X checks as pink faces, Z
// checks as blue faces (half-discs on the edges), lit checks in amber, errors on the data qubits,
// and optional overlays (a correction, matched pairs, grown clusters, a logical operator).
// Returns a hit test (x, y in CSS pixels) -> data qubit index or -1.

import { withAlpha } from './bloch.js';
import { FONT, MONO, prep } from './charts.js';

export function drawSurface(canvas, opts) {
  // pairSets: [{ graph, pairs }] matched defect pairs; grownSets: [{ graph, support }] union-find
  // edge growth (0, 1 = half grown, 2 = fully grown) for one or both matching graphs.
  const { theme: th, code, errX = null, errZ = null, lit = new Set(), correction = null, pairSets = [], grownSets = [], logical = null, label = null } = opts;
  const { ctx, w, h } = prep(canvas);
  const d = code.d;
  const s = Math.min((w - 60) / d, (h - 50) / d);
  const x0 = (w - s * (d - 1)) / 2;
  const y0 = (h - s * (d - 1)) / 2 + 6;
  const P = (i, j) => [x0 + j * s, y0 + i * s];

  // faces
  code.checks.forEach((c, k) => {
    const color = c.type === 'X' ? th.ampNeg : th.accent2;
    const on = lit.has(k);
    ctx.fillStyle = withAlpha(on ? th.marked : color, on ? 0.75 : 0.22);
    ctx.strokeStyle = withAlpha(on ? th.marked : color, on ? 1 : 0.5);
    ctx.lineWidth = on ? 2.5 : 1;
    ctx.beginPath();
    const { i, j } = c;
    if (c.qubits.length === 4) {
      const [ax, ay] = P(i - 1, j - 1);
      ctx.rect(ax, ay, s, s);
    } else if (i === 0 || i === d) {
      const [cx] = P(0, j - 0.5);
      const cy = i === 0 ? y0 : y0 + (d - 1) * s;
      ctx.arc(cx, cy, s / 2, i === 0 ? Math.PI : 0, i === 0 ? 2 * Math.PI : Math.PI);
    } else {
      const [, cy] = P(i - 0.5, 0);
      const cx = j === 0 ? x0 : x0 + (d - 1) * s;
      ctx.arc(cx, cy, s / 2, j === 0 ? Math.PI / 2 : -Math.PI / 2, j === 0 ? (3 * Math.PI) / 2 : Math.PI / 2);
    }
    ctx.fill();
    ctx.stroke();
  });

  const centre = (graph, node) => {
    if (node === graph.boundary) return null;
    const c = graph.checks[node];
    return P(c.i - 0.5, c.j - 0.5);
  };

  // union-find clusters: each grown edge drawn from its check(s) to its data qubit
  for (const { graph, support } of grownSets) {
    ctx.lineCap = 'round';
    graph.edges.forEach((e, k) => {
      if (!support[k]) return;
      ctx.strokeStyle = withAlpha(th.marked, support[k] === 2 ? 0.6 : 0.3);
      ctx.lineWidth = Math.max(3, s * (support[k] === 2 ? 0.18 : 0.08));
      const q = P(Math.floor(e.q / d), e.q % d);
      for (const node of [e.a, e.b]) {
        const c = centre(graph, node);
        if (!c) continue;
        // half-grown edges reach only halfway from the check that grew them
        const end = support[k] === 2 ? q : [(c[0] + q[0]) / 2, (c[1] + q[1]) / 2];
        ctx.beginPath();
        ctx.moveTo(...c);
        ctx.lineTo(...end);
        ctx.stroke();
      }
    });
  }

  // matched pairs: a line from each lit check to its partner, or to the nearest edge where its
  // kind of error chain can end (top/bottom for X errors seen by Z checks, left/right for Z errors)
  for (const { graph, pairs } of pairSets) {
    for (const [a, b] of pairs) {
      const A = graph.checks[a];
      const pa = centre(graph, a);
      let pb;
      if (b === graph.boundary) {
        if (A.type === 'Z') pb = P(A.i - 0.5 < (d - 1) / 2 ? -0.75 : d - 0.25, A.j - 0.5);
        else pb = P(A.i - 0.5, A.j - 0.5 < (d - 1) / 2 ? -0.75 : d - 0.25);
      } else pb = centre(graph, b);
      ctx.strokeStyle = th.text;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(...pa);
      ctx.lineTo(...pb);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // logical operator
  if (logical) {
    const qs = logical === 'X' ? code.logicalX : code.logicalZ;
    ctx.strokeStyle = logical === 'X' ? th.ampNeg : th.accent2;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    qs.forEach((q, k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, ...P(Math.floor(q / d), q % d)));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // data qubits
  const r = Math.max(6, s * 0.2);
  for (let q = 0; q < code.n; q++) {
    const [x, y] = P(Math.floor(q / d), q % d);
    const ex = errX?.[q];
    const ez = errZ?.[q];
    const fix = correction?.[q];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = th.surfaceSolid;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = fix ? th.marked : th.axis;
    ctx.stroke();
    const tag = ex && ez ? 'Y' : ex ? 'X' : ez ? 'Z' : '';
    if (tag) {
      ctx.fillStyle = tag === 'X' ? th.ampNeg : tag === 'Z' ? th.accent2 : th.marked;
      ctx.beginPath();
      ctx.arc(x, y, r - 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = `700 ${Math.round(r)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = th.surfaceSolid;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, x, y + 1);
    }
    if (fix) {
      ctx.strokeStyle = th.marked;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  if (label) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, 8, 4);
  }
  ctx.font = MONO;
  return (px, py) => {
    for (let q = 0; q < code.n; q++) {
      const [x, y] = P(Math.floor(q / d), q % d);
      if (Math.hypot(px - x, py - y) <= Math.max(r + 4, s * 0.35)) return q;
    }
    return -1;
  };
}

// Errors as a short string for links: "3X,7Z,12Y".
export function encodeErrors(errX, errZ) {
  const parts = [];
  for (let q = 0; q < errX.length; q++) {
    const t = errX[q] && errZ[q] ? 'Y' : errX[q] ? 'X' : errZ[q] ? 'Z' : '';
    if (t) parts.push(`${q}${t}`);
  }
  return parts.join(',');
}

export function decodeErrors(text, n) {
  const errX = new Uint8Array(n);
  const errZ = new Uint8Array(n);
  for (const part of String(text ?? '').split(',')) {
    const m = /^(\d+)([XYZ])$/.exec(part.trim());
    if (!m) continue;
    const q = Number(m[1]);
    if (q >= n) continue;
    if (m[2] !== 'Z') errX[q] = 1;
    if (m[2] !== 'X') errZ[q] = 1;
  }
  return { errX, errZ };
}
