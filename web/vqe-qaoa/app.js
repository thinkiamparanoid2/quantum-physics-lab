import { H2 } from '../lib/h2-data.js';
import { cutDistribution, cutValue, energy, h2State, maxCut, optimiseQaoa, pauliOperator, qaoaState } from '../lib/vqc.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// VQE and QAOA: the H₂ molecule with a one-parameter ansatz on PennyLane's Hamiltonians, and MaxCut
// on a 5-node graph. The tests check the Hamiltonians, HF and FCI energies, the VQE minimum and the
// QAOA expectations against PennyLane.

const EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
  [0, 2],
];
const MAXCUT = maxCut(5, EDGES);
const ops = H2.map((h) => pauliOperator(h.terms, 4));
const vqeMin = (k) => {
  // golden-section search on the landscape, after a coarse scan
  const E = (t) => energy(ops[k], h2State(t));
  let best = 0;
  for (let i = 0; i <= 120; i++) {
    const t = -Math.PI + (2 * Math.PI * i) / 120;
    if (E(t) < E(best)) best = t;
  }
  let [lo, hi] = [best - 0.06, best + 0.06];
  for (let i = 0; i < 60; i++) {
    const [a, b] = [lo + 0.382 * (hi - lo), lo + 0.618 * (hi - lo)];
    if (E(a) < E(b)) hi = b;
    else lo = a;
  }
  return { theta: (lo + hi) / 2, energy: E((lo + hi) / 2) };
};
const minima = H2.map((_, k) => vqeMin(k));
const qaoaBest = new Map();

function compute(s) {
  if (!qaoaBest.has(s.p)) qaoaBest.set(s.p, optimiseQaoa(5, EDGES, s.p));
  return { best: qaoaBest.get(s.p) };
}

function drawVqe(api) {
  const { ctx, w, h } = prep(api.canvas('vqe'));
  const th = api.theme;
  const s = api.settings;
  const k = s.bond;
  const half = w / 2;
  // left: E(θ) at this bond length
  const b1 = { x0: 56, y0: 22, x1: half - 12, y1: h - 36 };
  const E = (t) => energy(ops[k], h2State(t));
  const vals = Array.from({ length: 201 }, (_, i) => E(-Math.PI + (2 * Math.PI * i) / 200));
  const [lo, hi] = [Math.min(...vals) - 0.02, Math.max(...vals) + 0.02];
  const X1 = (t) => b1.x0 + ((t + Math.PI) / (2 * Math.PI)) * (b1.x1 - b1.x0);
  const Y1 = (e) => b1.y1 - ((e - lo) / (hi - lo)) * (b1.y1 - b1.y0);
  ctx.strokeStyle = th.accent2;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  vals.forEach((e, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X1(-Math.PI + (2 * Math.PI * i) / 200), Y1(e)));
  ctx.stroke();
  ctx.strokeStyle = withAlpha(th.marked, 0.8);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(b1.x0, Y1(H2[k].fci));
  ctx.lineTo(b1.x1, Y1(H2[k].fci));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(X1(s.theta), Y1(E(s.theta)), 6, 0, 2 * Math.PI);
  ctx.fillStyle = th.ampNeg;
  ctx.fill();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [
    [-Math.PI, '−π'],
    [0, '0 (HF)'],
    [Math.PI, 'π'],
  ].forEach(([t, l]) => ctx.fillText(l, X1(t), b1.y1 + 4));
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmt(lo + 0.02, 2), b1.x0 - 4, Y1(lo + 0.02));
  ctx.fillText(fmt(hi - 0.02, 2), b1.x0 - 4, Y1(hi - 0.02));
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.text;
  ctx.fillText(`E(θ) at ${H2[k].bond} Å: ${fmt(E(s.theta), 4)} Ha at θ = ${fmt(s.theta, 2)} · dashed: exact`, b1.x0, 2);
  // right: dissociation curve
  const b2 = { x0: half + 50, y0: 22, x1: w - 14, y1: h - 36 };
  const X2 = (d) => b2.x0 + ((d - 0.2) / 2.4) * (b2.x1 - b2.x0);
  const Y2 = (e) => b2.y1 - ((e + 1.2) / 0.7) * (b2.y1 - b2.y0);
  const series = (get, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    H2.forEach((hh, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X2(hh.bond), Y2(get(hh, i))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  series((hh) => hh.hf, th.muted, [5, 4]);
  series((hh, i) => minima[i].energy, th.accent2);
  H2.forEach((hh) => {
    ctx.beginPath();
    ctx.arc(X2(hh.bond), Y2(hh.fci), 4, 0, 2 * Math.PI);
    ctx.strokeStyle = th.marked;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.arc(X2(H2[k].bond), Y2(minima[k].energy), 7, 0, 2 * Math.PI);
  ctx.strokeStyle = th.ampNeg;
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const d of [0.5, 1, 1.5, 2, 2.5]) ctx.fillText(String(d), X2(d), b2.y1 + 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const e of [-1.1, -0.9, -0.7, -0.5]) ctx.fillText(String(e), b2.x0 - 4, Y2(e));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('bond length (Å)', (b2.x0 + b2.x1) / 2, b2.y1 + 18);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [
    ['Hartree–Fock', th.muted, [5, 4]],
    ['VQE minimum', th.accent2, []],
  ].forEach(([t, c, d], i) => {
    const y = b2.y0 + 8 + 18 * i;
    ctx.strokeStyle = c;
    ctx.setLineDash(d);
    ctx.beginPath();
    ctx.moveTo(b2.x1 - 140, y);
    ctx.lineTo(b2.x1 - 122, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.text;
    ctx.fillText(t, b2.x1 - 116, y);
  });
  ctx.fillText('○ exact (FCI)', b2.x1 - 140, b2.y0 + 44);
}

function drawQaoa(api) {
  const { ctx, w, h } = prep(api.canvas('qaoa'));
  const th = api.theme;
  const s = api.settings;
  const half = w * 0.42;
  // left: the graph, coloured by the most likely bit string at the chosen angles
  const angles = s.angles === 'best' ? api.model.best : { g: [s.gamma], b: [s.beta] };
  const state = qaoaState(5, EDGES, angles.g, angles.b);
  let top = 0;
  for (let b = 1; b < 32; b++) if (state.re[b] ** 2 + state.im[b] ** 2 > state.re[top] ** 2 + state.im[top] ** 2) top = b;
  const cx = half / 2;
  const cy = h / 2;
  const R = Math.min(half, h) * 0.32;
  const P = (i) => [cx + R * Math.sin((2 * Math.PI * i) / 5), cy - R * Math.cos((2 * Math.PI * i) / 5)];
  for (const [u, v] of EDGES) {
    const cut = ((top >> u) ^ (top >> v)) & 1;
    ctx.strokeStyle = cut ? th.marked : withAlpha(th.muted, 0.5);
    ctx.lineWidth = cut ? 3.5 : 1.5;
    ctx.setLineDash(cut ? [] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(...P(u));
    ctx.lineTo(...P(v));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(...P(i), 15, 0, 2 * Math.PI);
    ctx.fillStyle = (top >> i) & 1 ? th.ampNeg : th.accent2;
    ctx.fill();
    ctx.fillStyle = th.surfaceSolid;
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i), ...P(i));
  }
  const dist = cutDistribution(state, 5, EDGES);
  const mean = cutValue(state, EDGES);
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`most likely bit string: cuts ${EDGES.filter(([u, v]) => ((top >> u) ^ (top >> v)) & 1).length} of 6 edges (amber)`, 8, 4);
  ctx.textBaseline = 'bottom';
  ctx.fillText(`⟨C⟩ = ${fmt(mean, 3)} · approximation ratio ${fmt(mean / MAXCUT, 3)} · P(maximum cut) = ${fmt(dist[MAXCUT], 3)}`, 8, h - 4);
  // right: the p = 1 landscape over (γ, β)
  const b = { x0: half + 40, y0: 20, x1: w - 14, y1: h - 40 };
  const G = 36;
  const cw = (b.x1 - b.x0) / G;
  const rh = (b.y1 - b.y0) / G;
  let vmax = 0;
  const vals = [];
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const v = cutValue(qaoaState(5, EDGES, [(Math.PI * (j + 0.5)) / G], [(Math.PI * (G - i - 0.5)) / G]), EDGES);
      vals.push(v);
      vmax = Math.max(vmax, v);
    }
  }
  vals.forEach((v, idx) => {
    const [i, j] = [Math.floor(idx / G), idx % G];
    ctx.fillStyle = withAlpha(th.marked, Math.max(0, (v - 1.5) / (vmax - 1.5)) ** 2);
    ctx.fillRect(b.x0 + j * cw, b.y0 + i * rh, cw + 0.5, rh + 0.5);
  });
  if (s.angles !== 'best' || s.p === 1) {
    const [gm, bm] = s.angles === 'best' ? [api.model.best.g[0], api.model.best.b[0]] : [s.gamma, s.beta];
    ctx.beginPath();
    ctx.arc(b.x0 + (gm / Math.PI) * (b.x1 - b.x0), b.y1 - ((bm % Math.PI) / Math.PI) * (b.y1 - b.y0), 6, 0, 2 * Math.PI);
    ctx.strokeStyle = th.text;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('γ → π', (b.x0 + b.x1) / 2, b.y1 + 4);
  ctx.save();
  ctx.translate(b.x0 - 14, (b.y0 + b.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('β → π', 0, 0);
  ctx.restore();
  ctx.font = FONT;
  ctx.fillText('p = 1 landscape of ⟨C⟩ (brighter = more edges cut)', (b.x0 + b.x1) / 2, b.y1 + 20);
}

const STEPS = [
  {
    title: 'The variational idea',
    preset: { bond: 3, theta: 0 },
    focus: ['VQE for the hydrogen molecule'],
    html: `<p>The <b>variational quantum eigensolver</b> (VQE) prepares a state with tunable parameters, measures its energy ⟨H⟩ on the quantum computer, and lets a classical optimiser adjust the parameters. Whatever the state, ⟨H⟩ ≥ E₀, the true ground energy (the variational principle), so lower is always better.</p>
      <p>The test case: the hydrogen molecule in the minimal STO-3G basis, mapped to 4 qubits with 15 Pauli terms (Hamiltonians generated with PennyLane's quantum chemistry module).</p>`,
  },
  {
    title: 'Hartree–Fock misses something',
    preset: { bond: 3, theta: 0 },
    focus: ['VQE for the hydrogen molecule'],
    html: `<p>θ = 0 is the Hartree–Fock state |1100⟩: both electrons in the bonding orbital. At the equilibrium bond length, 0.74 Å, its energy is −1.1168 Ha, against the exact −1.1373 Ha. The 21 mHa gap is the <b>correlation energy</b>, thirteen times the "chemical accuracy" of 1.6 mHa that predictions need.</p>`,
  },
  {
    title: 'One parameter is enough here',
    preset: { bond: 3, theta: 0.23 },
    focus: ['VQE for the hydrogen molecule'],
    html: `<p>The ansatz mixes in the doubly excited configuration: cos(θ/2)|1100⟩ − sin(θ/2)|0011⟩. Symmetry (particle number and spin) confines H₂'s ground state to exactly these two configurations, so at the best θ the VQE energy equals the exact one, at every bond length (the tests check all ten against PennyLane's exact energies).</p>`,
    math: `<span class="eq">E(θ) = ⟨ψ(θ)|H|ψ(θ)⟩,  |ψ(θ)⟩ = cos(θ/2)|1100⟩ − sin(θ/2)|0011⟩</span>
      This is PennyLane's DoubleExcitation(θ) gate acting on the Hartree–Fock state. Measuring ⟨H⟩ on hardware means measuring all 15 Pauli terms, grouped into commuting sets, each with many shots.`,
  },
  {
    title: 'Pulling the molecule apart',
    preset: { bond: 9, theta: 0 },
    focus: ['VQE for the hydrogen molecule'],
    html: `<p>At 2.5 Å Hartree–Fock is off by 0.23 Ha: as the atoms separate, each electron should sit on its own atom, which a single configuration cannot describe (static correlation). VQE with its one extra configuration still lands on the exact curve. The landscape minimum moves far from θ = 0.</p>
      <p>Be clear about the scale: H₂ in this basis is a 2 × 2 problem a student can solve by hand. Interesting molecules need many more qubits, deeper circuits and huge numbers of measurements, and classical methods like coupled cluster and DMRG are formidable competition.</p>`,
    predict: {
      q: 'What can VQE never report, whatever its parameters (ignoring noise)?',
      options: ['An energy above the true ground energy', 'An energy below the true ground energy', 'The Hartree–Fock energy', 'A positive energy'],
      answer: 1,
      why: 'The variational principle: ⟨ψ|H|ψ⟩ ≥ E₀ for every normalised state.',
    },
  },
  {
    title: 'QAOA: a cut through a graph',
    preset: { p: 1, angles: 'best' },
    focus: ['QAOA for MaxCut'],
    html: `<p>MaxCut: colour the nodes of a graph in two colours to cut as many edges as possible. This graph (a 5-cycle with one chord) can have at most 5 of its 6 edges cut. The <b>quantum approximate optimisation algorithm</b> alternates two operations p times: a phase e<sup>−iγC</sup> from the cost, and a mixing rotation e<sup>−iβΣX</sup>. Then you measure and read off a colouring.</p>
      <p>With the best p = 1 angles, the expected cut is 4.11 (ratio 0.82) and a maximum cut appears 42% of the time. A random colouring averages 3 (ratio 0.6).</p>`,
    math: `<span class="eq">|γ, β⟩ = e^{−iβ_p B} e^{−iγ_p C} ⋯ e^{−iβ₁ B} e^{−iγ₁ C} |+⟩^⊗n,  C = Σ_{(u,v)} (1 − Z_u Z_v)/2,  B = Σ X</span>
      The tests compare ⟨C⟩ at several angles with PennyLane.`,
  },
  {
    title: 'Deeper QAOA',
    preset: { p: 3, angles: 'best' },
    focus: ['QAOA for MaxCut'],
    html: `<p>With p = 2 the ratio reaches 0.925 and with p = 3, 0.965, where a maximum cut is sampled 85% of the time. As p → ∞ QAOA becomes adiabatic and finds the optimum, but deeper circuits cost more and suffer more noise. Whether QAOA beats the best classical heuristics (like Goemans–Williamson, which guarantees 0.878 on any graph) at useful sizes remains open.</p>`,
  },
  {
    title: 'Your turn',
    preset: { p: 1, angles: 'manual', gamma: 1, beta: 0.5 },
    html: `<p>Drag γ and β around the p = 1 landscape and find its peaks. Then go back to VQE and trace the landscape's minimum as the bond stretches.</p>`,
  },
];

runLesson({
  slug: 'vqe-qaoa',
  settings: { bond: 3, theta: 0, p: 1, angles: 'best', gamma: 1, beta: 0.5 },
  controls: [
    { id: 'bond', label: 'Bond length', type: 'range', min: 0, max: H2.length - 1, step: 1, format: (v) => `${H2[v].bond} Å` },
    { id: 'theta', label: 'VQE parameter θ', type: 'range', min: -Math.PI, max: Math.PI, step: 0.01, format: (v) => v.toFixed(2) },
    { id: 'p', label: 'QAOA layers p', type: 'choice', options: [[1, '1'], [2, '2'], [3, '3']] },
    { id: 'angles', label: 'QAOA angles', type: 'choice', options: [['best', 'Optimised'], ['manual', 'Manual (p = 1)']] },
    { id: 'gamma', label: 'γ', type: 'range', min: 0, max: Math.PI, step: 0.02, format: (v) => v.toFixed(2), show: (s) => s.angles === 'manual' },
    { id: 'beta', label: 'β', type: 'range', min: 0, max: Math.PI, step: 0.02, format: (v) => v.toFixed(2), show: (s) => s.angles === 'manual' },
  ],
  cards: [
    { id: 'vqe', title: 'VQE for the hydrogen molecule', height: 290 },
    { id: 'qaoa', title: 'QAOA for MaxCut', height: 300 },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawVqe(api);
    drawQaoa(api);
  },
});
