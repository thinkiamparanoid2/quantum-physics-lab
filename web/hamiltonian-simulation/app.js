import { H2 } from '../lib/h2-data.js';
import { skewedModel } from '../lib/hamsim.js';
import { pauliOperator } from '../lib/vqc.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// Hamiltonian simulation by product formulas (Trotter, orders 1 and 2) and by qDRIFT, compared at
// equal numbers of exponentials. qDRIFT's channel is computed exactly on density matrices
// (lib/hamsim.js); the tests check it against sampled gate sequences and Campbell's bound.

const MODELS = {
  h2: { name: 'H₂ at 0.74 Å: 14 terms of similar size', terms: () => pauliOperator(H2[3].terms, 4).terms, start: 0b0011, steps: [1, 2, 4, 8, 16, 32] },
  skewed: { name: '60 terms with sizes falling as 1/k²', terms: () => skewedModel(), start: 0b0101, steps: [1, 2, 4, 8, 16] },
};
const T = 2;
const runs = new Map();
let lessonApi = null;

function start(model) {
  if (runs.has(model)) return runs.get(model);
  const entry = { result: null, progress: 0, terms: MODELS[model].terms() };
  runs.set(model, entry);
  runTask(new URL('../lib/hamsim.js', import.meta.url), 'compareMethods', { terms: entry.terms, n: 4, start: MODELS[model].start, t: T, stepsList: MODELS[model].steps }, {
    onProgress: (p) => {
      entry.progress = p;
      lessonApi?.redraw();
    },
  }).promise.then((result) => {
    entry.result = result;
    lessonApi?.redraw();
  });
  return entry;
}

const COLORS = (th) => ({ trotter1: th.ampNeg, trotter2: th.marked, qdrift: th.accent2 });
const NAMES = { trotter1: 'Trotter, first order', trotter2: 'Trotter, second order', qdrift: 'qDRIFT (exact average channel)' };

function drawError(api) {
  const entry = start(api.settings.model);
  const { ctx, w, h } = prep(api.canvas('error'));
  const th = api.theme;
  if (!entry.result) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Simulating… ${Math.round(entry.progress * 100)}%`, w / 2, h / 2);
    return;
  }
  const r = entry.result;
  const box = { x0: 60, y0: 16, x1: w - 16, y1: h - 36 };
  const [xa, xb, ya, yb] = [1, 4, -8, 0];
  const X = (v) => box.x0 + ((Math.log10(v) - xa) / (xb - xa)) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 1e-9)) - ya) / (yb - ya)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = ya; e <= yb; e += 2) {
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10^${e}`, box.x0 - 6, Y(10 ** e));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of [10, 100, 1000, 10000]) ctx.fillText(String(v), X(v), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('exponentials (single Pauli rotations) used', (box.x0 + box.x1) / 2, box.y1 + 18);
  const col = COLORS(th);
  // Campbell's bound for qDRIFT
  ctx.strokeStyle = withAlpha(th.accent2, 0.5);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  r.qdrift.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.exps), Y(Math.min(1, p.bound))));
  ctx.stroke();
  ctx.setLineDash([]);
  for (const k of ['trotter1', 'trotter2', 'qdrift']) {
    ctx.strokeStyle = col[k];
    ctx.fillStyle = col[k];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    r[k].forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.exps), Y(p.infidelity)));
    ctx.stroke();
    r[k].forEach((p) => {
      ctx.beginPath();
      ctx.arc(X(p.exps), Y(p.infidelity), 3.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [...Object.entries(NAMES).map(([k, t]) => [t, col[k], []]), ["Campbell's bound 2λ²t²/N for qDRIFT", withAlpha(th.accent2, 0.5), [4, 4]]].forEach(([t, c, d], i) => {
    const y = box.y1 - 76 + 18 * i;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.setLineDash(d);
    ctx.beginPath();
    ctx.moveTo(box.x0 + 12, y);
    ctx.lineTo(box.x0 + 30, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.text;
    ctx.fillText(t, box.x0 + 36, y);
  });
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`infidelity after t = ${T} · ${MODELS[api.settings.model].name}`, box.x1, box.y0);
}

function drawTerms(api) {
  const entry = start(api.settings.model);
  const { ctx, w, h } = prep(api.canvas('terms'));
  const th = api.theme;
  const mags = entry.terms.map((t) => Math.abs(t.coeff)).sort((a, b) => b - a);
  const box = { x0: 50, y0: 20, x1: w - 14, y1: h - 26 };
  const bw = (box.x1 - box.x0) / mags.length;
  const Y = (v) => box.y1 - (v / mags[0]) * (box.y1 - box.y0);
  mags.forEach((m, i) => {
    ctx.fillStyle = withAlpha(th.accent2, 0.8);
    ctx.fillRect(box.x0 + i * bw + 0.5, Y(m), Math.max(1, bw - 1), box.y1 - Y(m));
  });
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lambda = mags.reduce((a, b) => a + b, 0);
  ctx.fillText(`${mags.length} terms, sorted by |h_j| · λ = Σ|h_j| = ${fmt(lambda, 3)} · largest share ${Math.round((100 * mags[0]) / lambda)}%`, box.x0, 2);
}

const STEPS = [
  {
    title: 'From a Hamiltonian to gates',
    preset: { model: 'h2' },
    focus: ['Term sizes'],
    html: `<p>A quantum computer runs gates, not Hamiltonians. If H = Σ h<sub>j</sub> P<sub>j</sub> is a sum of Pauli strings, each piece e<sup>−iθP</sup> is easy: a rotation with a ladder of CNOTs. The trouble is that the pieces don't commute, so e<sup>−iHt</sup> is not simply their product.</p>
      <p>Two Hamiltonians to compare: H₂ (14 terms of similar size) and a model with 60 terms whose sizes fall off fast, like the long tails of molecular Hamiltonians.</p>`,
  },
  {
    title: 'Product formulas',
    preset: { model: 'h2' },
    focus: ['Error against cost'],
    html: `<p>Trotter: chop time into N steps and apply every term once per step. The error comes from the commutators, shrinking as 1/N (infidelity as 1/N²); the symmetric second-order formula shrinks as 1/N² (infidelity 1/N⁴). Each step costs one exponential per term, so the cost grows with the number of terms L.</p>
      <p>For H₂ both orders work well, and second order reaches 10⁻⁷ with a few hundred rotations.</p>`,
    math: `<span class="eq">e^{−iHt} ≈ (Π_j e^{−ih_j P_j t/N})^N,   error ≤ (t²/2N) Σ_{j<k} ‖[h_j P_j, h_k P_k]‖</span>`,
  },
  {
    title: 'qDRIFT: random, cheap, first order',
    preset: { model: 'h2' },
    focus: ['Error against cost'],
    html: `<p>Campbell's qDRIFT (2019) does something different: draw terms at random with probability |h<sub>j</sub>|/λ and apply each as a rotation by the same small angle τ = λt/N. On average the random sequence reproduces e<sup>−iHt</sup>, with error at most 2λ²t²/N, <b>independent of the number of terms</b>.</p>
      <p>On H₂ that independence buys nothing: the terms are few and similar in size, and qDRIFT's 1/N convergence loses to Trotter.</p>`,
    math: `<span class="eq">λ = Σ_j |h_j|,  τ = λt/N,  ‖E_qDRIFT − U‖_◇ ≤ 2λ²t²/N</span>
      The curve shows the exact average channel, computed on density matrices; the tests compare it with the mean over 4000 sampled gate sequences.`,
    predict: {
      q: 'When should qDRIFT beat Trotter?',
      options: ['When all terms are equal', 'When there are many terms, most of them small, and moderate accuracy is enough', 'Always at high accuracy', 'Never'],
      answer: 1,
      why: 'Its cost depends on λ, not on L, but it converges only at first order.',
    },
  },
  {
    title: 'Many small terms',
    preset: { model: 'skewed' },
    focus: ['Error against cost', 'Term sizes'],
    html: `<p>Now 60 terms with sizes falling as 1/k². Trotter must touch all 60 terms every step, even the tiny ones; qDRIFT spends its rotations mostly on the big ones. At 60 rotations qDRIFT's error is a quarter of first-order Trotter's.</p>
      <p>But follow the curves to higher accuracy: second-order Trotter falls as 1/N⁴ and overtakes everything. Which method is cheapest depends on the Hamiltonian and on the accuracy you need.</p>`,
  },
  {
    title: 'The bigger picture',
    preset: { model: 'skewed' },
    html: `<p>Actual Trotter errors are often far below the commutator bounds (Childs et al., "Theory of Trotter error", 2021), and randomised and partially randomised formulas mix the two ideas. Asymptotically optimal methods (qubitisation, quantum signal processing; Low and Chuang, 2019) need extra qubits and are aimed at fault-tolerant machines. Simulating chemistry and materials is still the most convincing long-term use of quantum computers.</p>`,
  },
  {
    title: 'Your turn',
    preset: { model: 'h2' },
    html: `<p>Compare both Hamiltonians. For each, how many rotations does each method need for an infidelity of 10⁻³?</p>`,
  },
];

lessonApi = runLesson({
  slug: 'hamiltonian-simulation',
  settings: { model: 'h2' },
  controls: [{ id: 'model', label: 'Hamiltonian', type: 'choice', options: [['h2', 'H₂ (14 terms)'], ['skewed', '60 terms, skewed']] }],
  cards: [
    { id: 'error', title: 'Error against cost', height: 320 },
    { id: 'terms', title: 'Term sizes', height: 160 },
  ],
  steps: STEPS,
  draw(api) {
    drawError(api);
    drawTerms(api);
  },
});
