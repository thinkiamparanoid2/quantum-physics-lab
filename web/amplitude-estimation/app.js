import { registerProbs } from '../lib/algorithms.js';
import { probabilities, runOps } from '../lib/circuit.js';
import { bhmtBound, classicalQuantileError, CONFIDENCE, estimateOf, qaeCircuit, qaeQuantileError } from '../lib/estimation.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Amplitude estimation: phase estimation on the Grover operator of a one-qubit A, simulated on the
// statevector engine. The tests check the outcome distribution against the closed form of Brassard,
// Høyer, Mosca and Tapp, their error bound, and the 1/calls against 1/√calls scaling.

function compute(s) {
  const { ops, count, calls } = qaeCircuit(s.m, s.a);
  const { state } = runOps(s.m + 1, ops);
  return { ops, P: registerProbs(probabilities(state), count), calls };
}

function circuitHtml(api) {
  const box = api.el('circuit');
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div><p class="hint"></p>';
  const s = api.settings;
  const labels = [...Array.from({ length: s.m }, (_, q) => `count ${q}`), 'state'];
  drawCircuit(box.querySelector('.circuit-scroll'), { n: s.m + 1, ops: api.model.ops, applied: api.model.ops.length, labels });
  box.querySelector('.hint').textContent = `A = RY(2θ) prepares cos θ|0⟩ + sin θ|1⟩ with sin²θ = a. Each counting qubit controls a power of the Grover operator Q = RY(4θ); an inverse QFT reads out the phase. ${api.model.calls} applications of Q in all.`;
}

function drawDistribution(api) {
  const { ctx, w, h } = prep(api.canvas('dist'));
  const th = api.theme;
  const s = api.settings;
  const { P } = api.model;
  const M = P.length;
  const box = { x0: 44, y0: 18, x1: w - 14, y1: h - 40 };
  const bw = (box.x1 - box.x0) / M;
  const pmax = Math.max(...P);
  const Y = (p) => box.y1 - (p / pmax) * 0.95 * (box.y1 - box.y0);
  P.forEach((p, y) => {
    const err = Math.abs(estimateOf(y, s.m) - s.a);
    ctx.fillStyle = withAlpha(err <= bhmtBound(s.m, s.a) ? th.accent2 : th.muted, 0.85);
    ctx.fillRect(box.x0 + y * bw + Math.min(2, bw * 0.1), Y(p), bw - 2 * Math.min(2, bw * 0.1), box.y1 - Y(p));
  });
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = Math.max(1, Math.round(M / 8));
  for (let y = 0; y < M; y += step) ctx.fillText(String(y), box.x0 + (y + 0.5) * bw, box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText(`measured y on ${s.m} counting qubits (estimate ã = sin²(π y / ${M}))`, (box.x0 + box.x1) / 2, box.y1 + 20);
  const correct = P.reduce((acc, p, y) => acc + (Math.abs(estimateOf(y, s.m) - s.a) <= bhmtBound(s.m, s.a) ? p : 0), 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText(`blue: outcomes within the Brassard et al. bound ±${fmt(bhmtBound(s.m, s.a), 4)} of a = ${s.a}: total probability ${fmt(correct, 3)} (theorem: ≥ ${fmt(CONFIDENCE, 3)})`, box.x0, 0);
}

function drawScaling(api) {
  const { ctx, w, h } = prep(api.canvas('scaling'));
  const th = api.theme;
  const s = api.settings;
  const box = { x0: 60, y0: 16, x1: w - 16, y1: h - 36 };
  const ms = Array.from({ length: 11 }, (_, i) => i + 2);
  const calls = (m) => 2 ** m - 1;
  const [xa, xb, ya, yb] = [Math.log10(2), Math.log10(5000), -5, 0];
  const X = (n) => box.x0 + ((Math.log10(n) - xa) / (xb - xa)) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 1e-6)) - ya) / (yb - ya)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = ya; e <= yb; e++) {
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10^${e}`, box.x0 - 6, Y(10 ** e));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const n of [3, 15, 63, 255, 1023, 4095]) ctx.fillText(String(n), X(n), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('calls to A (or Q)', (box.x0 + box.x1) / 2, box.y1 + 18);
  const line = (pts, color, width = 2, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line(ms.map((m) => [calls(m), classicalQuantileError(calls(m), s.a)]), th.ampNeg, 2.5);
  line(ms.map((m) => [calls(m), bhmtBound(m, s.a)]), withAlpha(th.accent2, 0.6), 2, [5, 4]);
  line(ms.map((m) => [calls(m), qaeQuantileError(m, s.a)]), th.accent2, 2.5);
  ctx.beginPath();
  ctx.arc(X(calls(s.m)), Y(qaeQuantileError(s.m, s.a)), 6, 0, 2 * Math.PI);
  ctx.strokeStyle = th.text;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [
    ['sampling A and counting 1s: ∝ 1/√calls', th.ampNeg, []],
    ['amplitude estimation (exact distribution)', th.accent2, []],
    ['its guaranteed bound: ∝ 1/calls', withAlpha(th.accent2, 0.6), [5, 4]],
  ].forEach(([t, c, d], i) => {
    const y = box.y1 - 60 + 18 * i;
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
  ctx.fillText(`error reached with ${Math.round(CONFIDENCE * 100)}% confidence, a = ${s.a}`, box.x1, box.y0);
}

const STEPS = [
  {
    title: 'Estimating a probability',
    preset: { a: 0.3, m: 4 },
    focus: ['Error against effort'],
    html: `<p>Many problems reduce to: a circuit A ends in a "good" state with probability a; estimate a. Monte Carlo integrals, option prices, counting solutions. The classical way is to run A N times and count. The error shrinks like 1/√N: a hundred times the effort buys one more digit (red line).</p>`,
  },
  {
    title: 'A rotation hides the answer',
    preset: { a: 0.3, m: 4 },
    focus: ['The circuit'],
    html: `<p>Write a = sin²θ. The Grover operator Q, built from A, its inverse and two reflections, rotates by 2θ in the plane of the good and bad states, so its eigenvalues are e<sup>±2iθ</sup>. The amplitude is encoded in a <b>phase</b>, and phase estimation reads phases out with Heisenberg-limited precision.</p>`,
    math: `<span class="eq">Q = −A S₀ A† S_χ,  eigenvalues e^{±2iθ},  a = sin²θ</span>
      For A = RY(2θ) on one qubit, Q is simply RY(4θ). Counting qubit j controls Q^{2^{m−1−j}}, exactly as in the phase-estimation lesson.`,
  },
  {
    title: 'Reading out the phase',
    preset: { a: 0.3, m: 5 },
    focus: ['Outcomes'],
    html: `<p>Each outcome y gives an estimate sin²(πy/2<sup>m</sup>). The distribution has two peaks (from the eigenvalues e<sup>±2iθ</sup>, which give the same estimate) and long tails. Brassard, Høyer, Mosca and Tapp proved that with probability at least 8/π² ≈ 81% the estimate lands within about 2π√(a(1−a))/2<sup>m</sup> of a. The blue bars are those outcomes; the tests check the whole distribution against their formula.</p>`,
    predict: {
      q: 'Adding one counting qubit roughly…',
      options: ['halves the error and doubles the calls', 'halves the error and quadruples the calls', 'keeps the error, doubles the calls', 'squares the error'],
      answer: 0,
      why: 'Calls double (2^m − 1) and the guaranteed error halves: error ∝ 1/calls, against 1/√calls for sampling.',
    },
  },
  {
    title: 'A quadratic speed-up',
    preset: { a: 0.3, m: 8 },
    focus: ['Error against effort'],
    html: `<p>Plotted against the number of calls, amplitude estimation's guaranteed error falls as 1/calls (blue dashes) and sampling's as 1/√calls. The actual error jumps around under the bound, depending on how neatly θ lands on the grid of outcomes. For a target error ε the quantum method needs about 1/ε calls instead of 1/ε²: quadratic, not exponential.</p>`,
  },
  {
    title: 'The fine print',
    preset: { a: 0.3, m: 6 },
    focus: ['Error against effort'],
    html: `<p>The speed-up is real but costly. The controlled powers of Q make deep circuits, and noise erodes the advantage. Variants without phase estimation (iterative and maximum-likelihood amplitude estimation, Suzuki et al. 2020; Grinko et al. 2021) keep the 1/calls scaling with shallower circuits. Resource studies for option pricing (Chakrabarti et al. 2021) conclude that a useful advantage needs fault-tolerant machines with thousands of logical qubits.</p>`,
  },
  {
    title: 'Your turn',
    preset: { a: 0.05, m: 6 },
    html: `<p>Change a and the number of counting qubits. Which values of a are estimated almost exactly, and why? (Hint: when 2<sup>m</sup>θ/π is a whole number.)</p>`,
  },
];

runLesson({
  slug: 'amplitude-estimation',
  settings: { a: 0.3, m: 4 },
  controls: [
    { id: 'a', label: 'True amplitude a', type: 'range', min: 0.02, max: 0.98, step: 0.01, format: (v) => v.toFixed(2) },
    { id: 'm', label: 'Counting qubits m', type: 'choice', options: [2, 3, 4, 5, 6, 7, 8].map((m) => [m, String(m)]) },
  ],
  cards: [
    { id: 'circuit', title: 'The circuit', kind: 'html' },
    { id: 'dist', title: 'Outcomes', height: 240 },
    { id: 'scaling', title: 'Error against effort', height: 280 },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    circuitHtml(api);
    drawDistribution(api);
    drawScaling(api);
  },
});
