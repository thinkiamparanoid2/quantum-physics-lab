import { anyons, groundState, loopAround, plaquettesInside, toricCode } from '../lib/toric.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { runLesson } from '../ui/lesson-kit.js';

// Kitaev's toric code: qubits on the edges of a torus, anyons where checks are violated, and the
// −1 from carrying an e around an m, read off the stabilizer tableau (lib/toric.js; the tests
// check the ground state and the braiding phase against the statevector engine as well).

const grounds = new Map();
const ground = (L) => {
  if (!grounds.has(L)) grounds.set(L, groundState(toricCode(L)).tableau);
  return grounds.get(L);
};
const edgeList = (text, n) => [
  ...new Set(
    String(text ?? '')
      .split(',')
      .filter((t) => t.trim() !== '')
      .map(Number)
      .filter((e) => Number.isInteger(e) && e >= 0 && e < n),
  ),
];
let hit = () => -1;
let animation = 0;

function compute(s) {
  const code = toricCode(s.L);
  const zs = edgeList(s.zs, code.n);
  const xs = edgeList(s.xs, code.n);
  // a loop as tall or wide as the torus would wrap round it, so keep it at most L − 1 faces
  const [lr, lc] = [Math.min(s.lr, s.L - 1), Math.min(s.lc, s.L - 1)];
  const loop = loopAround(code, s.li % s.L, s.lj % s.L, lr, lc);
  const carried = s.braid ? loop.slice(0, Math.round(s.pos * loop.length)) : [];
  const zErr = new Uint8Array(code.n);
  const xErr = new Uint8Array(code.n);
  for (const e of zs) zErr[e] ^= 1;
  for (const e of carried) zErr[e] ^= 1;
  for (const e of xs) xErr[e] ^= 1;
  const t = ground(s.L).clone();
  zErr.forEach((v, e) => v && t.zGate(e));
  xErr.forEach((v, e) => v && t.xGate(e));
  const { e, m } = anyons(code, zErr, xErr);
  const inside = new Set(plaquettesInside(code, s.li % s.L, s.lj % s.L, lr, lc));
  return {
    code,
    zErr,
    xErr,
    e,
    m,
    loop,
    carried,
    inside,
    mInside: m.filter((k) => inside.has(k)).length,
    loopValue: t.expectation({ z: loop }),
    Z1: t.expectation({ z: code.logicals.Z1 }),
    Z2: t.expectation({ z: code.logicals.Z2 }),
  };
}

function draw(api) {
  const { ctx, w, h } = prep(api.canvas('torus'));
  const th = api.theme;
  const s = api.settings;
  const md = api.model;
  const { code } = md;
  const L = code.L;
  const sp = Math.min((w - 70) / L, (h - 80) / L);
  const x0 = (w - sp * L) / 2;
  const y0 = 46;
  const P = (i, j) => [x0 + j * sp, y0 + i * sp];
  // edges as drawn: h(i, j) from (i, j) to (i, j + 1), v(i, j) from (i, j) to (i + 1, j), with the
  // last column and row drawn to ghost copies of column 0 and row 0
  const seg = (e) => {
    if (e < L * L) {
      const i = Math.floor(e / L);
      const j = e % L;
      return [P(i, j), P(i, j + 1)];
    }
    const k = e - L * L;
    const i = Math.floor(k / L);
    const j = k % L;
    return [P(i, j), P(i + 1, j)];
  };
  // the braiding loop's inside
  if (s.braid) {
    ctx.fillStyle = withAlpha(th.accent, 0.08);
    for (const k of md.inside) {
      const [px, py] = P(Math.floor(k / L), k % L);
      ctx.fillRect(px, py, sp, sp);
    }
  }
  // lattice
  ctx.lineCap = 'round';
  for (let e = 0; e < code.n; e++) {
    const [a, b] = seg(e);
    ctx.strokeStyle = withAlpha(th.muted, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  }
  // the wrap-around: ghost row and column
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('= left edge', P(0, L)[0] + 8, P(0, L)[1] - 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('= top edge', P(L, 0)[0], P(L, 0)[1] + 10);
  // the loop path
  if (s.braid) {
    ctx.strokeStyle = withAlpha(th.accent, 0.55);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    for (const e of md.loop) {
      const [a, b] = seg(e);
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // Z errors: pink edges; X errors: blue bars across the edge (a dual-lattice string)
  for (let e = 0; e < code.n; e++) {
    const [a, b] = seg(e);
    if (md.zErr[e]) {
      ctx.strokeStyle = th.ampNeg;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
    }
    if (md.xErr[e]) {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const horizontal = a[1] === b[1];
      ctx.strokeStyle = th.accent2;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(mx, my - sp * 0.42);
        ctx.lineTo(mx, my + sp * 0.42);
      } else {
        ctx.moveTo(mx - sp * 0.42, my);
        ctx.lineTo(mx + sp * 0.42, my);
      }
      ctx.stroke();
    }
  }
  // vertices (and their ghosts)
  for (let i = 0; i <= L; i++) {
    for (let j = 0; j <= L; j++) {
      const ghost = i === L || j === L;
      ctx.beginPath();
      ctx.arc(...P(i, j), 3, 0, 2 * Math.PI);
      ctx.fillStyle = withAlpha(th.text, ghost ? 0.3 : 0.75);
      ctx.fill();
    }
  }
  // anyons: e on vertices (pink discs), m on faces (blue squares); repeated on the ghost copies
  const eSize = Math.max(8, sp * 0.17);
  for (const k of md.e) {
    const [i, j] = [Math.floor(k / L), k % L];
    const spots = [[i, j]];
    if (i === 0) spots.push([L, j]);
    if (j === 0) spots.push([i, L]);
    if (i === 0 && j === 0) spots.push([L, L]);
    spots.forEach(([a, b], n) => {
      ctx.globalAlpha = n ? 0.35 : 1;
      ctx.beginPath();
      ctx.arc(...P(a, b), eSize, 0, 2 * Math.PI);
      ctx.fillStyle = th.ampNeg;
      ctx.fill();
      ctx.fillStyle = th.surfaceSolid;
      ctx.font = `700 ${Math.round(eSize)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('e', P(a, b)[0], P(a, b)[1] - 1);
      ctx.globalAlpha = 1;
    });
  }
  for (const k of md.m) {
    const [px, py] = P(Math.floor(k / L) + 0.5, (k % L) + 0.5);
    const r = Math.max(8, sp * 0.16);
    ctx.fillStyle = th.accent2;
    ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
    ctx.fillStyle = th.surfaceSolid;
    ctx.font = `700 ${Math.round(r * 1.1)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('m', px, py);
  }
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${L} × ${L} torus: ${code.n} qubits on the edges · clicks add ${s.mode === 'Z' ? 'Z (moves e)' : 'X (moves m)'}`, 8, 4);

  hit = (px, py) => {
    let best = -1;
    let bd = sp * 0.3;
    for (let e = 0; e < code.n; e++) {
      const [a, b] = seg(e);
      const d = Math.hypot(px - (a[0] + b[0]) / 2, py - (a[1] + b[1]) / 2);
      if (d < bd) [best, bd] = [e, d];
    }
    return best;
  };
  status(api);
}

function status(api) {
  const s = api.settings;
  const md = api.model;
  const sign = (v) => (v > 0 ? '+1' : v < 0 ? '−1' : '0');
  const braidNote = s.braid
    ? md.carried.length === md.loop.length
      ? `The e has gone all the way round and fused back into nothing. Its trip multiplied the state by the loop operator, <b>${sign(md.loopValue)}</b>: the loop encloses ${md.mInside} m anyon${md.mInside === 1 ? '' : 's'}.`
      : `The e is ${md.carried.length} of ${md.loop.length} edges along the loop. The loop encloses ${md.mInside} m anyon${md.mInside === 1 ? '' : 's'}; the loop operator is <b>${sign(md.loopValue)}</b>.`
    : md.e.length || md.m.length
      ? 'Anyons only ever appear in pairs at the ends of strings; moving one along costs nothing more.'
      : md.Z1 < 0 || md.Z2 < 0
        ? '<b>No anyons, but a logical qubit has flipped:</b> a string wrapped all the way round the torus.'
        : 'The ground state: every star and plaquette is +1.';
  api.el('status').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>e anyons (stars at −1)</span><b>${md.e.length}</b></div>
      <div class="stat"><span>m anyons (plaquettes at −1)</span><b>${md.m.length}</b></div>
      <div class="stat"><span>Energy above ground (H = −ΣA − ΣB)</span><b>${2 * (md.e.length + md.m.length)}</b></div>
      <div class="stat"><span>Logical Z̄₁, Z̄₂</span><b>${sign(md.Z1)}, ${sign(md.Z2)}</b></div></div>
    <p class="hint">${braidNote}</p>`;
}

function carryAround(a) {
  cancelAnimationFrame(animation);
  const start = performance.now();
  const dur = 3000;
  a.set({ braid: true, pos: 0 });
  const tick = (now) => {
    const f = Math.min(1, (now - start) / dur);
    a.set({ pos: Math.round(f * 100) / 100 });
    if (f < 1) animation = requestAnimationFrame(tick);
  };
  animation = requestAnimationFrame(tick);
}

// edge indices for L = 5
const H = (i, j) => i * 5 + j;
const V = (i, j) => 25 + i * 5 + j;

const STEPS = [
  {
    title: 'A code on a torus',
    preset: { L: 5, zs: '', xs: '', braid: false },
    html: `<p>Kitaev's <b>toric code</b> puts a qubit on every edge of a square grid whose opposite sides are joined, a torus. Two kinds of check: a <b>star</b> A<sub>v</sub> = X on the four edges at a vertex, and a <b>plaquette</b> B<sub>p</sub> = Z around a face.</p>
      <p>On a 5 × 5 torus: 50 qubits, 25 stars and 25 plaquettes. The product of all stars is the identity, and so is the product of all plaquettes, so only 48 checks are independent: <b>two logical qubits</b>. It is the surface code without boundaries.</p>`,
    math: `<span class="eq">H = − Σ_v A_v − Σ_p B_p</span>
      All the checks commute (a star and a plaquette share zero or two edges), so the ground states have every A_v = B_p = +1. Violating one check costs energy 2.`,
  },
  {
    title: 'Z errors make e particles',
    preset: { L: 5, zs: `${H(2, 2)}`, xs: '', braid: false, mode: 'Z' },
    html: `<p>A Z on one edge anticommutes with the two stars at its ends: both flip to −1. In the energy picture these are two quasiparticles, called <b>e</b> (electric charges).</p>
      <p><b>Click edges</b> to add or remove Z errors and move them about.</p>`,
  },
  {
    title: 'Only the ends show',
    preset: { L: 5, zs: [H(1, 1), H(1, 2), V(1, 3), V(2, 3)].join(','), xs: '', braid: false, mode: 'Z' },
    html: `<p>A string of Z's lights stars only at its two ends; every star along the middle sees two flips. So an e can be moved anywhere by extending the string, at no extra energy. The string itself is invisible: only where it ends can be measured.</p>`,
  },
  {
    title: 'X errors make m particles',
    preset: { L: 5, zs: '', xs: [V(2, 1), V(2, 2)].join(','), braid: false, mode: 'X' },
    html: `<p>An X on an edge flips the two plaquettes beside it, creating a pair of <b>m</b> particles (magnetic fluxes) in the faces. Strings of X's run across edges, on the <i>dual</i> lattice whose vertices are the faces.</p>`,
    predict: {
      q: 'Two e anyons are brought onto the same vertex. What is left?',
      options: ['A doubly charged particle', 'Nothing: they fuse into the vacuum', 'An m anyon', 'A logical error'],
      answer: 1,
      why: 'Two Z flips on one star cancel, so e × e = 1. The same holds for m × m.',
    },
  },
  {
    title: 'Braiding: e around m',
    preset: { L: 5, zs: '', xs: `${V(2, 2)}`, braid: true, pos: 0, li: 1, lj: 0, lr: 3, lc: 2, mode: 'Z' },
    focus: ['The torus', 'Anyons and loops'],
    html: `<p>An m pair sits in neighbouring faces. Press <b>Carry an e around</b>: a fresh e pair is made, one of them travels around the dashed loop enclosing one m, and fuses with its partner again.</p>
      <p>Nothing is left on the lattice, yet the state has been multiplied by <b>−1</b>. Neither anyon is a fermion or a boson on its own, but taking one around the other gives a sign: <b>mutual statistics</b>, a purely topological effect like the Aharonov–Bohm phase.</p>`,
    math: `The trip applies Z on every edge of the loop, which equals the product of the plaquettes inside:
      <span class="eq">Z_loop = ∏_{p inside} B_p = (−1)^{number of m inside}</span>
      The loop has to cross the X string that made the m pair, and Z and X anticommute there: that is where the sign comes from.`,
  },
  {
    title: 'Around both: no sign',
    preset: { L: 5, zs: '', xs: `${V(2, 2)}`, braid: true, pos: 1, li: 1, lj: 0, lr: 3, lc: 4, mode: 'Z' },
    focus: ['The torus', 'Anyons and loops'],
    html: `<p>A loop that encloses both m's gives (−1)² = +1. The phase depends only on how the paths wind around each other, not on their shape: move the loop with the sliders and watch it change only when an m crosses the boundary.</p>`,
  },
  {
    title: 'Loops around the torus',
    preset: { L: 5, zs: '', xs: [H(0, 0), H(1, 0), H(2, 0), H(3, 0), H(4, 0)].join(','), braid: false, mode: 'X' },
    focus: ['The torus', 'Anyons and loops'],
    html: `<p>Here an m pair was made and one m dragged all the way round the torus until it met its partner from the other side. No anyons remain, but Z̄₁ is now −1: a <b>logical</b> qubit has flipped. Strings that wrap the torus are the logical operators.</p>
      <p>The shortest such string has L edges. Local noise would have to stretch a string across the whole torus without being caught: that is <b>topological protection</b>, and the surface code inherits it.</p>`,
  },
  {
    title: 'Your turn',
    preset: { L: 5, zs: '', xs: '', braid: false, mode: 'Z' },
    html: `<p>Switch between Z and X clicks to build strings. Can you flip Z̄₂ instead of Z̄₁? Turn on the braiding loop, move it, and carry an e around different numbers of m's.</p>`,
  },
];

const api = runLesson({
  slug: 'toric-code',
  settings: { L: 5, zs: '', xs: '', mode: 'Z', braid: false, pos: 0, li: 1, lj: 0, lr: 3, lc: 2 },
  controls: [
    { id: 'mode', label: 'Clicks add', type: 'choice', options: [['Z', 'Z (e strings)'], ['X', 'X (m strings)']] },
    { id: 'L', label: 'Torus size L', type: 'choice', options: [[4, '4'], [5, '5'], [6, '6']] },
    { id: 'braid', label: 'Braiding loop', type: 'check' },
    { id: 'li', label: 'Loop top row', type: 'range', min: 0, max: 5, step: 1, show: (s) => s.braid },
    { id: 'lj', label: 'Loop left column', type: 'range', min: 0, max: 5, step: 1, show: (s) => s.braid },
    { id: 'lr', label: 'Loop height', type: 'range', min: 1, max: 4, step: 1, show: (s) => s.braid },
    { id: 'lc', label: 'Loop width', type: 'range', min: 1, max: 4, step: 1, show: (s) => s.braid },
    { id: 'pos', label: 'e along the loop', type: 'range', min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}%`, show: (s) => s.braid },
    { type: 'button', label: 'Carry an e around', primary: true, onClick: carryAround, show: (s) => s.braid },
    { type: 'button', label: 'Clear', onClick: (a) => a.set({ zs: '', xs: '', pos: 0 }) },
  ],
  cards: [
    { id: 'torus', title: 'The torus', legend: 'pink = Z string, e anyons · blue = X string, m anyons · dashed = loop', height: 470 },
    { id: 'status', title: 'Anyons and loops', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw,
});

api.canvas('torus').style.cursor = 'pointer';
api.canvas('torus').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const edge = hit(e.clientX - rect.left, e.clientY - rect.top);
  if (edge < 0) return;
  const key = api.settings.mode === 'Z' ? 'zs' : 'xs';
  const list = edgeList(api.settings[key], api.model.code.n);
  const k = list.indexOf(edge);
  if (k >= 0) list.splice(k, 1);
  else list.push(edge);
  api.set({ [key]: list.sort((a, b) => a - b).join(',') });
});
