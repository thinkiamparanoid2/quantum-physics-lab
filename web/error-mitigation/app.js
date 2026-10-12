import { seededRandom } from '../lib/circuit.js';
import { applyReadout, exponentialFit, exponentialParams, fold, isingCircuit, mitigateReadout, probsOf, richardson, runNoisy, zz } from '../lib/mitigation.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Error mitigation on a 3-qubit Ising Trotter circuit with gate and readout noise, simulated with
// density matrices (lib/mitigation.js): readout-error mitigation and zero-noise extrapolation by
// gate folding, with optional shot noise. The tests check the simulator, folding, readout inversion
// and the extrapolations.

const OPS = isingCircuit({});
const LAMS = [1, 3, 5];
const IDEAL = zz(probsOf(runNoisy(3, OPS)), 0, 1);
const cache = new Map();

// estimate ⟨Z0 Z1⟩ from `shots` samples of the distribution (seeded), or exactly when shots = 0
function sample(probs, shots, rng) {
  if (!shots) return probs;
  const counts = new Array(probs.length).fill(0);
  for (let k = 0; k < shots; k++) {
    let u = rng();
    let b = 0;
    while (b < probs.length - 1 && u >= probs[b]) u -= probs[b++];
    counts[b]++;
  }
  return counts.map((c) => c / shots);
}

function compute(s) {
  const key = JSON.stringify(s);
  if (cache.has(key)) return cache.get(key);
  const noise = { p1: s.p2 / 10, p2: s.p2 };
  const rng = seededRandom(7);
  const e0 = s.ro / 2;
  const e1 = s.ro;
  const scales = LAMS.map((lam, k) => {
    const exact = probsOf(runNoisy(3, fold(OPS, k), noise));
    const measured = sample(applyReadout(exact, 3, e0, e1), s.shots, rng);
    const corrected = s.readout ? mitigateReadout(measured, 3, e0, e1) : measured;
    return { lam, raw: zz(measured, 0, 1), value: zz(corrected, 0, 1), exactGate: zz(exact, 0, 1), dist: corrected };
  });
  const ys = scales.map((x) => x.value);
  const zne = s.extrap === 'exp' ? exponentialFit(LAMS, ys) : richardson(LAMS, ys);
  const r = { scales, zne, raw: scales[0].raw, readoutOnly: scales[0].value };
  cache.set(key, r);
  return r;
}

function circuitHtml(api) {
  const box = api.el('circuit');
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div><p class="hint"></p>';
  const ops = OPS.map((o) => (o.gate === 'CNOT' ? { gate: 'X', target: o.target, controls: [o.control] } : o));
  drawCircuit(box.querySelector('.circuit-scroll'), { n: 3, ops, applied: ops.length, labels: ['q0', 'q1', 'q2'] });
  box.querySelector('.hint').textContent = `Three Trotter steps of a 3-qubit transverse-field Ising chain: ${OPS.length} gates, ${OPS.filter((o) => o.gate === 'CNOT').length} of them CNOTs. We estimate ⟨Z₀Z₁⟩ at the end; without noise it is ${IDEAL.toFixed(4)}.`;
}

function drawZne(api) {
  const { ctx, w, h } = prep(api.canvas('zne'));
  const th = api.theme;
  const s = api.settings;
  const m = api.model;
  const box = { x0: 56, y0: 16, x1: w - 16, y1: h - 40 };
  const X = (lam) => box.x0 + (lam / 5.5) * (box.x1 - box.x0);
  const vals = [...m.scales.map((x) => x.value), m.zne, IDEAL, 0];
  const [lo, hi] = [Math.min(...vals) - 0.05, Math.max(...vals) + 0.05];
  const Y = (v) => box.y1 - ((v - lo) / (hi - lo)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = Math.ceil(lo * 10) / 10; v <= hi; v += 0.1) ctx.fillText(v.toFixed(1), box.x0 - 6, Y(v));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const lam of [0, 1, 3, 5]) ctx.fillText(String(lam), X(lam), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('noise scale λ (each gate G replaced by G (G†G)^k, λ = 2k + 1)', (box.x0 + box.x1) / 2, box.y1 + 22);
  ctx.strokeStyle = withAlpha(th.marked, 0.9);
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x0, Y(IDEAL));
  ctx.lineTo(box.x1, Y(IDEAL));
  ctx.stroke();
  ctx.setLineDash([]);
  // the extrapolating curve
  ctx.strokeStyle = th.accent2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const ys = m.scales.map((x) => x.value);
  for (let i = 0; i <= 110; i++) {
    const lam = i * 0.05;
    let v;
    if (s.extrap === 'exp') {
      const { a, b } = exponentialParams(LAMS, ys);
      v = a * Math.exp(b * lam);
    } else {
      v = LAMS.reduce((acc, li, k) => acc + ys[k] * LAMS.reduce((pr, lj, j) => (j === k ? pr : (pr * (lam - lj)) / (li - lj)), 1), 0);
    }
    (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(lam), Y(v));
  }
  ctx.stroke();
  for (const x of m.scales) {
    ctx.beginPath();
    ctx.arc(X(x.lam), Y(x.value), 5, 0, 2 * Math.PI);
    ctx.fillStyle = th.accent2;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(X(0), Y(m.zne), 7, 0, 2 * Math.PI);
  ctx.strokeStyle = th.ampNeg;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.text;
  ctx.fillText(`blue: measured ⟨Z₀Z₁⟩ at each scale · pink circle: the ${s.extrap === 'exp' ? 'exponential' : 'Richardson'} extrapolation to λ = 0 · amber: the noiseless value`, box.x0 + 6, box.y0);
}

function summaryHtml(api) {
  const m = api.model;
  const s = api.settings;
  const row = (name, v) => `<tr><td>${name}</td><td>${fmt(v, 4)}</td><td>${fmt(Math.abs(v - IDEAL), 4)}</td></tr>`;
  api.el('summary').innerHTML = `<table class="tally"><thead><tr><th>estimate of ⟨Z₀Z₁⟩</th><th>value</th><th>error</th></tr></thead><tbody>
      ${row('noiseless (the target)', IDEAL)}
      ${row('raw measurement', m.raw)}
      ${s.readout ? row('readout mitigated', m.readoutOnly) : ''}
      ${row(`readout ${s.readout ? '+' : 'not mitigated, '} zero-noise extrapolation`, m.zne)}</tbody></table>
    <p class="hint">${s.shots ? `${s.shots.toLocaleString()} shots per circuit. ` : 'Exact probabilities (infinitely many shots). '}Mitigation is not free: Richardson extrapolation from λ = 1, 3, 5 weights the three results by γ = 15/8, −5/4, 3/8, which multiplies independent shot noise by √Σγᵢ² ≈ 2.3, so about 5× more shots buy back the same precision; readout inversion adds a factor of up to 1/(1 − e₀ − e₁) per qubit.</p>`;
}

const STEPS = [
  {
    title: 'Noise without error correction',
    preset: { p2: 0.02, ro: 0.04, readout: false, extrap: 'exp', shots: 0 },
    focus: ['The circuit', 'How close do we get?'],
    html: `<p>Today's processors are too small and too noisy for error correction. Can we still get accurate expectation values? Here a 3-qubit circuit with 12 CNOTs, each failing with probability 2%, and readout that misreads 2–4% of bits. The measured ⟨Z₀Z₁⟩ comes out at about 0.21 against the noiseless 0.38.</p>`,
  },
  {
    title: 'Fixing the readout',
    preset: { p2: 0.02, ro: 0.04, readout: true, extrap: 'exp', shots: 0 },
    focus: ['How close do we get?'],
    html: `<p>Readout errors can be calibrated: prepare |0⟩ and |1⟩, record how often each is misread, and invert that confusion matrix on the measured probabilities. With exact probabilities the inversion removes readout error completely (the tests check it), leaving the gate errors.</p>`,
    math: `<span class="eq">p_measured = A p_true,  A = ⊗_q [[1 − e₀, e₁], [e₀, 1 − e₁]],  p_true = A⁻¹ p_measured</span>`,
  },
  {
    title: 'Zero-noise extrapolation',
    preset: { p2: 0.02, ro: 0.04, readout: true, extrap: 'exp', shots: 0 },
    focus: ['Extrapolating to zero noise', 'How close do we get?'],
    html: `<p>We can't remove gate noise, but we can <b>increase</b> it on purpose: replace each gate G by G G† G (three times the noise, same ideal result) or G G† G G† G (five times). Measure at λ = 1, 3, 5 and extrapolate back to λ = 0 (Temme, Bravyi and Gambetta 2017; Kandala et al. 2019). An exponential fit lands within 0.01 of the noiseless value.</p>`,
    predict: {
      q: 'Why does G G† G have the same ideal effect as G?',
      options: ['It doesn’t', 'G† G is the identity, so only the noise of the extra gates remains', 'Because CNOTs are self-inverse only', 'Because of error correction'],
      answer: 1,
      why: 'G†G = I ideally, so folding adds noise without changing the computation.',
    },
  },
  {
    title: 'The model matters',
    preset: { p2: 0.02, ro: 0.04, readout: true, extrap: 'richardson', shots: 0 },
    focus: ['Extrapolating to zero noise', 'How close do we get?'],
    html: `<p>Richardson extrapolation (a quadratic through the three points) assumes nothing about the shape and lands less close here; exponential extrapolation would be exact if the noise were global depolarizing (the tests check that). ZNE reduces the bias by an order of magnitude but has no guarantee: its accuracy depends on how well the extrapolation model fits the device.</p>`,
  },
  {
    title: 'The price: shots',
    preset: { p2: 0.02, ro: 0.04, readout: true, extrap: 'richardson', shots: 2000 },
    focus: ['Extrapolating to zero noise', 'How close do we get?'],
    html: `<p>With 2000 shots per circuit, statistical noise appears, and extrapolation amplifies it. Mitigation trades bias for variance, and the number of shots needed grows exponentially with circuit size and noise. That is why mitigation is a bridge to error correction, not a replacement. Still, IBM's 127-qubit "utility" experiment (Kim et al., Nature 2023) used ZNE to get accurate values beyond brute-force classical simulation, though classical methods soon reproduced them.</p>`,
  },
  {
    title: 'Your turn',
    preset: { p2: 0.03, ro: 0.08, readout: true, extrap: 'exp', shots: 0 },
    html: `<p>Raise the gate error until extrapolation stops working. How many shots do you need for the mitigated estimate to beat the raw one?</p>`,
  },
];

runLesson({
  slug: 'error-mitigation',
  settings: { p2: 0.02, ro: 0.04, readout: false, extrap: 'exp', shots: 0 },
  controls: [
    { id: 'p2', label: 'CNOT error (single-qubit gates: a tenth of it)', type: 'range', min: 0, max: 0.05, step: 0.005, format: (v) => `${(v * 100).toFixed(1)}%` },
    { id: 'ro', label: 'Readout error (0→1 half of 1→0)', type: 'range', min: 0, max: 0.1, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
    { id: 'readout', label: 'Mitigate readout', type: 'check' },
    { id: 'extrap', label: 'Extrapolation', type: 'choice', options: [['exp', 'Exponential'], ['richardson', 'Richardson']] },
    { id: 'shots', label: 'Shots per circuit', type: 'choice', options: [[0, 'Exact'], [20000, '20 000'], [2000, '2000']] },
  ],
  cards: [
    { id: 'circuit', title: 'The circuit', kind: 'html' },
    { id: 'zne', title: 'Extrapolating to zero noise', height: 280 },
    { id: 'summary', title: 'How close do we get?', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    circuitHtml(api);
    drawZne(api);
    summaryHtml(api);
  },
});
