import { freeFermion, groundState, kinkDensityFree, zzCorrelation } from '../lib/ising.js';
import { svd } from '../lib/linalg.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// The transverse-field Ising chain: a quantum phase transition at h = J. Ground states by Lanczos
// (lib/ising.js), the gap from the exact free-fermion solution, and the Kibble–Zurek quench from
// free fermions (equal to the statevector simulation, which the tests check, and cheap for 400 spins).

const HS = Array.from({ length: 26 }, (_, i) => i * 0.1);
const scans = new Map();
const TAUS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
let kzCache = null;

// half-chain entanglement entropy (bits) of a real state on N qubits
function halfEntropy(N, psi) {
  const a = N >> 1;
  const rows = 1 << a;
  const cols = 1 << (N - a);
  const M = new Float64Array(rows * cols);
  for (let b = 0; b < psi.length; b++) M[(b & (rows - 1)) * cols + (b >> a)] = psi[b];
  return svd(M, rows, cols).S.reduce((s, v) => (v * v > 1e-14 ? s - v * v * Math.log2(v * v) : s), 0);
}

const SIZES = [6, 8, 10];
function scan(N) {
  if (scans.has(N)) return scans.get(N);
  const rows = HS.map((h) => {
    const g = groundState(N, 1, h);
    return { h, end: zzCorrelation(N, g.vector, 0, N - 1), S: halfEntropy(N, g.vector) };
  });
  scans.set(N, rows);
  return rows;
}

// the finite chain's gap at h = 0, 0.02, …, 2.5 (one small eigenproblem each, cached per size)
const gaps = new Map();
function gapCurve(N) {
  if (!gaps.has(N)) gaps.set(N, Array.from({ length: 126 }, (_, i) => freeFermion(N, 1, i * 0.02).gap));
  return gaps.get(N);
}

function compute(s) {
  const g = groundState(s.N, 1, s.h);
  const corr = Array.from({ length: s.N - 1 }, (_, r) => zzCorrelation(s.N, g.vector, 0, r + 1));
  return { g, corr, ff: freeFermion(s.N, 1, s.h), scan: scan(s.N), S: halfEntropy(s.N, g.vector) };
}

function marker(ctx, X, box, h, th) {
  ctx.strokeStyle = th.text;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(X(h), box.y0);
  ctx.lineTo(X(h), box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
}

function legend(ctx, box, th, items) {
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  items.forEach(([t, c, dash], i) => {
    const y = box.y0 + 8 + 18 * i;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(box.x0 + 12, y);
    ctx.lineTo(box.x0 + 30, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.text;
    ctx.fillText(t, box.x0 + 36, y);
  });
}

function drawPhase(api) {
  const { ctx, w, h } = prep(api.canvas('phase'));
  const th = api.theme;
  const s = api.settings;
  const half = w / 2;
  // left: the gap
  const b1 = { x0: 46, y0: 14, x1: half - 14, y1: h - 36 };
  const X1 = xAxis(ctx, b1, [0, 2.5], th);
  const Y1 = (v) => b1.y1 - (v / 3.2) * (b1.y1 - b1.y0);
  const curve = (X, Y, f, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 125; i++) {
      const hv = i * 0.02;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(hv), Y(f(hv)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve(X1, Y1, (hv) => 2 * Math.abs(1 - hv), withAlpha(th.muted, 0.9), [4, 4]);
  curve(X1, Y1, (hv) => gapCurve(s.N)[Math.round(hv / 0.02)], th.accent2);
  marker(ctx, X1, b1, s.h, th);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= 3; v++) ctx.fillText(String(v), b1.x0 - 6, Y1(v));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('field h / J', (b1.x0 + b1.x1) / 2, b1.y1 + 20);
  legend(ctx, b1, th, [
    [`gap, ${s.N} spins`, th.accent2],
    ['gap, infinite chain: 2|J − h|', withAlpha(th.muted, 0.9), [4, 4]],
  ]);
  // right: order and entanglement
  const b2 = { x0: half + 46, y0: 14, x1: w - 14, y1: h - 36 };
  const X2 = xAxis(ctx, b2, [0, 2.5], th);
  const Y2 = (v) => b2.y1 - v * (b2.y1 - b2.y0);
  const series = (rows, get, color, width = 2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    rows.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X2(r.h), Y2(get(r))));
    ctx.stroke();
  };
  series(api.model.scan, (r) => r.end, th.ampNeg);
  SIZES.forEach((N, i) => series(scan(N), (r) => r.S, withAlpha(th.marked, 0.4 + 0.3 * i), 1.5 + 0.5 * i));
  marker(ctx, X2, b2, s.h, th);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0, 0.5, 1]) ctx.fillText(String(v), b2.x0 - 6, Y2(v));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('field h / J', (b2.x0 + b2.x1) / 2, b2.y1 + 20);
  legend(ctx, { ...b2, x0: b2.x1 - 250 }, th, [
    [`⟨Z₀ Z_last⟩, ${s.N} spins: order`, th.ampNeg],
    ['entanglement, 6 / 8 / 10 spins (bits)', th.marked],
  ]);
}

function drawCorr(api) {
  const { ctx, w, h } = prep(api.canvas('corr'));
  const th = api.theme;
  const { corr, ff, S } = api.model;
  const s = api.settings;
  const box = { x0: 46, y0: 30, x1: w - 16, y1: h - 30 };
  const bw = (box.x1 - box.x0) / corr.length;
  const Y = (v) => box.y1 - v * (box.y1 - box.y0);
  corr.forEach((c, r) => {
    ctx.fillStyle = withAlpha(th.ampNeg, 0.8);
    ctx.fillRect(box.x0 + r * bw + 4, Y(c), bw - 8, box.y1 - Y(c));
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(r + 1), box.x0 + (r + 0.5) * bw, box.y1 + 4);
  });
  ctx.font = MONO;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0, 0.5, 1]) ctx.fillText(String(v), box.x0 - 6, Y(v));
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.text;
  ctx.fillText(`⟨Z₀ Z_r⟩ against distance r at h = ${fmt(s.h, 2)}J · ground energy ${fmt(api.model.g.energy, 5)} (free fermions: ${fmt(ff.energy, 5)}) · gap ${fmt(ff.gap, 4)} · entanglement ${fmt(S, 3)} bits`, 8, 6);
}

function drawKZ(api) {
  const { ctx, w, h } = prep(api.canvas('kz'));
  const th = api.theme;
  if (!kzCache) kzCache = { big: TAUS.map((t) => kinkDensityFree(400, 1, 3, t, { steps: Math.max(200, t * 20) })), small: TAUS.map((t) => kinkDensityFree(10, 1, 3, t, { steps: Math.max(200, t * 20) })) };
  const box = { x0: 56, y0: 16, x1: w - 16, y1: h - 36 };
  const [xa, xb, ya, yb] = [Math.log10(0.2), Math.log10(80), -4, 0];
  const X = (t) => box.x0 + ((Math.log10(t) - xa) / (xb - xa)) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 1e-6)) - ya) / (yb - ya)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = ya; e <= yb; e++) {
    ctx.strokeStyle = withAlpha(th.muted, 0.15);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10^${e}`, box.x0 - 6, Y(10 ** e));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of [0.25, 1, 4, 16, 64]) ctx.fillText(String(t), X(t), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('ramp time τ (h from 3J to 0)', (box.x0 + box.x1) / 2, box.y1 + 18);
  // Dziarmaga's slow-ramp law for the infinite chain: n = 1/(2π √(2 τ_Q)), τ_Q = τ / 3
  ctx.strokeStyle = withAlpha(th.text, 0.6);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  [0.2, 80].forEach((t, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(t), Y(1 / (2 * Math.PI * Math.sqrt((2 * t) / 3)))));
  ctx.stroke();
  ctx.setLineDash([]);
  const pts = (vals, color) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(TAUS[i]), Y(v)));
    ctx.stroke();
    vals.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(X(TAUS[i]), Y(v), 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };
  pts(kzCache.big, th.accent2);
  pts(kzCache.small, th.ampNeg);
  legend(ctx, { ...box, x0: box.x1 - 300 }, th, [
    ['400 spins (free fermions)', th.accent2],
    ['10 spins (= statevector, checked in the tests)', th.ampNeg],
    ['Kibble–Zurek law ∝ τ^(−1/2)', withAlpha(th.text, 0.6), [4, 4]],
  ]);
}

const STEPS = [
  {
    title: 'Two terms that disagree',
    preset: { N: 10, h: 0.2 },
    focus: ['Phase diagram', 'Correlations in the ground state'],
    html: `<p>The transverse-field Ising chain has two competing terms. −J Z<sub>i</sub>Z<sub>i+1</sub> wants neighbours aligned (all up or all down); −h X<sub>i</sub> wants each spin in |+⟩, pointing sideways. They don't commute, so the ground state is a compromise that changes character as h/J is tuned: a <b>quantum phase transition</b>, driven at zero temperature by quantum fluctuations rather than heat.</p>
      <p>At h = 0.2J the spins are aligned along z: ⟨Z₀Z<sub>r</sub>⟩ stays near 1 at every distance.</p>`,
    math: `<span class="eq">H = −J Σ Z_i Z_{i+1} − h Σ X_i</span>
      With no field the two ground states are all-up and all-down. On a finite chain the field mixes them into a cat state (all-up + all-down)/√2, which is why ⟨Z⟩ = 0 but ⟨Z₀ Z_r⟩ ≈ 1.`,
  },
  {
    title: 'Strong field: disorder',
    preset: { N: 10, h: 2 },
    focus: ['Correlations in the ground state', 'Phase diagram'],
    html: `<p>At h = 2J the field wins: spins point along x, and z-correlations die off exponentially with distance. This is the <b>paramagnet</b>.</p>`,
    predict: {
      q: 'Where would you expect the transition to sit?',
      options: ['h = 0', 'h = J/2', 'h = J', 'h = 2J'],
      answer: 2,
      why: 'Kramers–Wannier duality swaps the two terms, mapping h/J to J/h; the only self-dual point is h = J.',
    },
  },
  {
    title: 'The gap closes at h = J',
    preset: { N: 10, h: 1 },
    focus: ['Phase diagram'],
    html: `<p>Through Jordan–Wigner the chain becomes free fermions with energies ε<sub>k</sub>, solvable exactly. The gap (left) is the cheapest excitation. In the paramagnet it grows as 2(h − J). In the ordered phase the lowest excitation on a finite open chain is exponentially small: the two nearly degenerate ordered states (in fermion language, Majorana zero modes at the chain ends, the Kitaev chain). At h = J the gap of a long chain closes: the system is <b>critical</b>.</p>`,
    math: `<span class="eq">ε_k = 2 √(J² + h² − 2Jh cos k)  (infinite chain),  gap = 2|J − h|</span>
      For the open chain the ε_k are twice the singular values of the bidiagonal matrix with h on the diagonal and J beside it. The tests check its ground energy and gap against Lanczos and dense diagonalisation.`,
  },
  {
    title: 'Entanglement grows only at the transition',
    preset: { N: 10, h: 1 },
    focus: ['Phase diagram', 'Correlations in the ground state'],
    html: `<p>The amber curves are the entanglement between the two halves of the chain, for 6, 8 and 10 spins. Deep in either phase they lie on top of each other: the entanglement has saturated, an <b>area law</b> (only bonds near the cut matter). In the ordered phase the saturated value is exactly one bit, carried by the cat state (all up + all down).</p>
      <p>Near h = J the curves fan out: at the critical point the entanglement keeps growing with the chain, as (c/6) log₂ N with central charge c = ½, the fingerprint of the critical Ising model. From 6 to 8 to 10 spins it rises by 0.042 and 0.032 bits; the formula gives 0.035 and 0.027.</p>`,
  },
  {
    title: 'Crossing the transition too fast',
    preset: { N: 10, h: 1 },
    focus: ['Kibble–Zurek: kinks after a ramp'],
    html: `<p>Start deep in the paramagnet (h = 3J) and lower the field to zero over a time τ. Near h = J the gap closes, so no ramp is slow enough to stay in the ground state: the chain freezes into domains, leaving <b>kinks</b> between them. The faster the ramp, the more kinks.</p>
      <p>Kibble and Zurek predicted the scaling: kink density ∝ τ<sup>−1/2</sup> for this transition (the exponent comes from the critical exponents ν = z = 1). The 400-spin curve follows it for slow ramps; the 10-spin chain falls below it once τ is long enough for the finite gap to protect it.</p>`,
    math: `<span class="eq">n ≈ 1 / (2π √(2 τ_Q)),  τ_Q = τ / 3 here   (Dziarmaga 2005)</span>
      Each momentum pair is an independent Landau–Zener problem; the tests check the free-fermion result against the 10-qubit statevector simulation to 10⁻⁹. Quantum annealers and Rydberg-atom arrays have measured this scaling.`,
  },
  {
    title: 'Your turn',
    preset: { N: 10, h: 0.8 },
    html: `<p>Move the field through the transition and watch the correlations change from flat to decaying. Compare 8 and 12 spins: which quantities change with size, and which don't?</p>`,
  },
];

runLesson({
  slug: 'ising-transition',
  settings: { N: 10, h: 0.2 },
  controls: [
    { id: 'h', label: 'Field h / J', type: 'range', min: 0, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
    { id: 'N', label: 'Spins', type: 'choice', options: [[8, '8'], [10, '10'], [12, '12']] },
  ],
  cards: [
    { id: 'phase', title: 'Phase diagram', legend: 'exact: free fermions (gap) and Lanczos (order, entanglement)', height: 280 },
    { id: 'corr', title: 'Correlations in the ground state', height: 220 },
    { id: 'kz', title: 'Kibble–Zurek: kinks after a ramp', legend: 'kinks per bond at the end of the ramp', height: 300, folded: true },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawPhase(api);
    drawCorr(api);
    drawKZ(api);
  },
});
