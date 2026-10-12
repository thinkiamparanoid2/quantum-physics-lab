import { blochVector } from '../lib/bloch.js';
import { runOps, seededRandom } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { breakEven, distill, injectionOps, label, levels, N, syndromeOf, verdict } from '../lib/magic.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Magic states: the T gate by injection (a two-qubit statevector run, lib/circuit.js), and 15-to-1
// distillation on the [[15,1,3]] Reed–Muller code (lib/magic.js). The tests check the weight
// enumerator against MacWilliams, that fifteen T gates act as a logical T† on the code, the 35p³
// law against Monte Carlo, and injection for both measurement outcomes.

const PB = breakEven();
const sup = (n) => String(n).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
const sci = (v) => {
  if (v === 0) return '0';
  if (v >= 1e-3) return percent(v);
  const e = Math.floor(Math.log10(v));
  return `${(v / 10 ** e).toFixed(1)} × 10${sup(e)}`;
};
const maskOf = (text) => String(text ?? '').split(',').reduce((m, t) => (Number(t) >= 1 && Number(t) <= N ? m | (1 << (Number(t) - 1)) : m), 0);
const textOf = (mask) => [...Array(N).keys()].filter((k) => (mask >> k) & 1).map(label).join(',');
let tally = null; // { p, shots, accepted, bad }
let hit = () => -1;
let blochs = null;

function compute(s) {
  const ops = injectionOps({ theta: s.theta, phi: s.phi, fix: s.fix });
  const run = runOps(2, ops, ops.length, () => (s.outcome ? 0.99 : 0.01));
  const mask = maskOf(s.errs);
  return { ops, run, mask, syn: syndromeOf(mask), verdict: verdict(mask) };
}

function drawInjection(api) {
  const s = api.settings;
  const box = api.el('inject');
  if (!blochs) {
    box.innerHTML = `<div class="circuit-scroll" data-role="circuit"></div>
      <div class="bloch-row"><canvas role="img" aria-label="T applied directly"></canvas><canvas role="img" aria-label="The data qubit after injection"></canvas></div>
      <p class="hint" data-role="note" aria-live="polite"></p>`;
    const [a, b] = box.querySelectorAll('canvas');
    blochs = { want: new BlochView(a, { title: 'T|ψ⟩, the goal', labels: 'poles' }), got: new BlochView(b, { title: 'data qubit after', labels: 'poles' }) };
  }
  const { ops, run } = api.model;
  drawCircuit(box.querySelector('[data-role="circuit"]'), { n: 2, ops, applied: ops.length, labels: ['data |ψ⟩', 'magic T|+⟩'] });
  // T|ψ⟩ on the Bloch sphere: the same tilt, phase advanced by π/4
  const want = [Math.sin(s.theta) * Math.cos(s.phi + Math.PI / 4), Math.sin(s.theta) * Math.sin(s.phi + Math.PI / 4), Math.cos(s.theta)];
  const got = blochVector(run.state, 0);
  blochs.want.vector = want;
  blochs.got.vector = got;
  blochs.want.draw(api.theme);
  blochs.got.draw(api.theme);
  const f = (1 + want[0] * got[0] + want[1] * got[1] + want[2] * got[2]) / 2;
  const m = run.bits[0];
  box.querySelector('[data-role="note"]').innerHTML =
    `Measured the magic qubit: <b>${m}</b> (each outcome has probability 50%). ` +
    (m === 0 ? 'Outcome 0: the data qubit is already T|ψ⟩. ' : s.fix ? 'Outcome 1: the data qubit was T†|ψ⟩, and the S gate turned it into T|ψ⟩. ' : 'Outcome 1 without the fix: the data qubit is T†|ψ⟩, rotated the wrong way. ') +
    `Fidelity with T|ψ⟩: <b>${percent(f)}</b>.`;
}

function drawBatch(api) {
  const { ctx, w, h } = prep(api.canvas('batch'));
  const th = api.theme;
  const { mask, syn } = api.model;
  const left = 92;
  const colW = (w - left - 70) / N;
  const X = (k) => left + (k + 0.5) * colW;
  const yQ = 40;
  const rowY = (j) => 92 + j * 30;
  const r = Math.min(13, colW * 0.4);
  ctx.font = MONO;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = th.muted;
  ctx.fillText('input', left - 12, yQ);
  for (let j = 0; j < 4; j++) {
    const lit = (syn >> j) & 1;
    if (lit) {
      ctx.fillStyle = withAlpha(th.marked, 0.18);
      ctx.fillRect(left - 86, rowY(j) - 12, w - left + 70, 24);
    }
    ctx.fillStyle = lit ? th.marked : th.muted;
    ctx.fillText(`check ${1 << j}`, left - 12, rowY(j));
    ctx.textAlign = 'left';
    ctx.fillText(lit ? '1  ✗' : '0', w - 60, rowY(j));
    ctx.textAlign = 'right';
  }
  for (let k = 0; k < N; k++) {
    const x = X(k);
    const err = (mask >> k) & 1;
    // the qubit
    ctx.beginPath();
    ctx.arc(x, yQ, r, 0, 2 * Math.PI);
    ctx.fillStyle = err ? th.ampNeg : th.surfaceSolid;
    ctx.fill();
    ctx.strokeStyle = err ? th.ampNeg : th.axis;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = err ? th.surfaceSolid : th.text;
    ctx.font = err ? '700 11px Inter, system-ui, sans-serif' : MONO;
    ctx.textAlign = 'center';
    ctx.fillText(err ? 'Z' : String(label(k)), x, yQ + 0.5);
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.fillText(String(label(k)), x, yQ + r + 10);
    // its checks: one dot per set bit of its label
    for (let j = 0; j < 4; j++) {
      if (!((label(k) >> j) & 1)) continue;
      ctx.beginPath();
      ctx.arc(x, rowY(j), 5, 0, 2 * Math.PI);
      ctx.fillStyle = err ? th.ampNeg : withAlpha(th.accent2, 0.75);
      ctx.fill();
    }
  }
  const v = api.model.verdict;
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = v === 'reject' ? th.marked : v === 'bad' ? th.ampNeg : th.accent2;
  const errors = textOf(mask);
  ctx.fillText(
    v === 'reject'
      ? `Rejected: the checks read ${syn} (= XOR of the error labels ${errors}). Throw the batch away.`
      : v === 'bad'
        ? `Accepted, but the output is flipped: the labels ${errors} XOR to 0 and their number is odd.`
        : mask
          ? `Accepted and fine: the labels ${errors} XOR to 0 and their number is even (a stabilizer).`
          : 'No errors: accepted, a perfect magic state.',
    left - 86,
    h - 10,
  );
  hit = (px, py) => {
    if (Math.abs(py - yQ) > r + 6) return -1;
    const k = Math.floor((px - left) / colW);
    return k >= 0 && k < N ? k : -1;
  };
}

function tallyHtml(api) {
  const s = api.settings;
  const d = distill(s.p);
  const t = tally && tally.p === s.p ? tally : null;
  api.el('tally').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Accepted (theory)</span><b>${percent(d.accept)}</b></div>
      <div class="stat"><span>Output error (theory)</span><b>${sci(d.out)}</b></div>
      ${t ? `<div class="stat"><span>Accepted (${t.shots.toLocaleString()} batches)</span><b>${percent(t.accepted / t.shots)}</b></div>
      <div class="stat"><span>Bad among accepted</span><b>${t.bad} of ${t.accepted.toLocaleString()}</b></div>` : ''}</div>
    <p class="hint">Input error rate ${percent(s.p)} on each of the 15 states. ${t ? '' : 'Press <b>Run 20,000 batches</b> to compare with a simulation.'}</p>`;
}

function drawCurve(api) {
  const { ctx, w, h } = prep(api.canvas('curve'));
  const th = api.theme;
  const s = api.settings;
  const box = { x0: 64, y0: 14, x1: w - 16, y1: h - 40 };
  const [xa, xb, ya, yb] = [-4, -0.5, -16, 0];
  const X = (p) => box.x0 + ((Math.log10(p) - xa) / (xb - xa)) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 1e-30)) - ya) / (yb - ya)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.strokeStyle = withAlpha(th.muted, 0.15);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = ya; e <= yb; e += 2) {
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    if (e > ya) ctx.fillText(e === 0 ? '1' : `10${sup(e)}`, box.x0 - 6, Y(10 ** e));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let e = xa; e <= xb; e++) {
    ctx.beginPath();
    ctx.moveTo(X(10 ** e), box.y0);
    ctx.lineTo(X(10 ** e), box.y1);
    ctx.stroke();
    ctx.fillText(`10${sup(e)}`, X(10 ** e), box.y1 + 6);
  }
  ctx.font = FONT;
  ctx.fillText('input error rate p per raw magic state', (box.x0 + box.x1) / 2, box.y1 + 22);
  const ps = [];
  for (let e = xa; e <= xb + 1e-9; e += 0.02) ps.push(10 ** e);
  const curve = (f, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p), Y(f(p))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  curve((p) => p, withAlpha(th.muted, 0.8), [4, 4]);
  curve((p) => 35 * p ** 3, withAlpha(th.text, 0.6), [2, 3]);
  curve((p) => distill(p).out, th.accent2);
  curve((p) => levels(p, 2)[2].error, th.ampNeg);
  ctx.restore();
  // break-even and the current p
  ctx.strokeStyle = withAlpha(th.marked, 0.7);
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(X(PB), box.y0);
  ctx.lineTo(X(PB), box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = th.marked;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`break-even ${percent(PB)}`, X(PB) - 4, box.y0 + 2);
  const d1 = distill(s.p).out;
  const d2 = levels(s.p, 2)[2].error;
  for (const [v, color] of [
    [s.p, th.muted],
    [d1, th.accent2],
    [d2, th.ampNeg],
  ]) {
    if (v < 1e-30) continue;
    ctx.beginPath();
    ctx.arc(X(s.p), Y(v), 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }
  // legend, in the empty lower right
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lx = Math.min(X(0.03), box.x1 - 190);
  [
    ['no distillation (out = in)', withAlpha(th.muted, 0.8)],
    ['one round (exact)', th.accent2],
    ['35p³', withAlpha(th.text, 0.6)],
    ['two rounds', th.ampNeg],
  ].forEach(([text, color], i) => {
    const y = box.y1 - 76 + 18 * i;
    ctx.fillStyle = color;
    ctx.fillRect(lx, y - 1.5, 16, 3);
    ctx.fillStyle = th.text;
    ctx.fillText(text, lx + 22, y);
  });
}

function costHtml(api) {
  const s = api.settings;
  const rows = levels(s.p, 3);
  api.el('cost').innerHTML = `<table class="tally"><thead><tr><th>rounds</th><th>error per magic state</th><th>raw states per output</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i}</td><td>${sci(r.error)}</td><td>${i ? fmt(r.cost, 0) : '1'}</td></tr>`).join('')}</tbody></table>
    <p class="hint">Starting from ${percent(s.p)} per raw state. Each round consumes 15 states per output, a little more counting rejected batches. A large algorithm with 10⁹ T gates needs about 10⁻¹² or better per state.</p>`;
}

const STEPS = [
  {
    title: 'Cliffords are not enough',
    preset: { theta: 1.2, phi: 0.6, outcome: 0, fix: true },
    focus: ['T by injection'],
    html: `<p>Error-correcting codes make Clifford gates (H, S, CNOT) cheap and safe. But a computer of only Cliffords can be simulated efficiently on a laptop (the Gottesman–Knill theorem, see the stabilizer lesson). To compute anything hard you need one more gate, usually <b>T</b> = diag(1, e<sup>iπ/4</sup>).</p>
      <p>No code can do every gate transversally (Eastin–Knill), and for the surface code T is the missing one. The trick: prepare a special state T|+⟩, a <b>magic state</b>, and teleport the gate.</p>`,
  },
  {
    title: 'Teleporting the gate',
    preset: { theta: 1.2, phi: 0.6, outcome: 0, fix: true },
    focus: ['T by injection'],
    html: `<p>A CNOT from the data qubit onto the magic state, then measure the magic qubit. If the outcome is 0, the data qubit is now exactly T|ψ⟩, for any |ψ⟩. Only Cliffords and a measurement were used: the "T-ness" came from the magic state.</p>`,
    math: `With |ψ⟩ = a|0⟩ + b|1⟩ and w = e^{iπ/4}:
      <span class="eq">CNOT (a|0⟩ + b|1⟩)(|0⟩ + w|1⟩)/√2 = [ (a|0⟩ + w b|1⟩)|0⟩ + (w a|0⟩ + b|1⟩)|1⟩ ] /√2</span>
      Outcome 0 leaves a|0⟩ + w b|1⟩ = T|ψ⟩; outcome 1 leaves (up to a global phase) a|0⟩ + w̄ b|1⟩ = T†|ψ⟩.`,
    predict: {
      q: 'When the outcome is 1 the data qubit holds T†|ψ⟩. What fixes it?',
      options: ['Apply T twice', 'Apply S (since S T† = T)', 'Start again', 'Apply X'],
      answer: 1,
      why: 'S = T², so S T† = T. S is a Clifford gate, cheap on the code.',
    },
  },
  {
    title: 'Outcome 1 needs a Clifford fix',
    preset: { theta: 1.2, phi: 0.6, outcome: 1, fix: false },
    focus: ['T by injection'],
    html: `<p>Here the outcome was 1 and no fix was applied: the arrow has turned by −π/4 instead of +π/4 (fidelity below 100%). Switch on <b>S if outcome is 1</b> in Try it and the right state appears. Either outcome succeeds; you just have to know which happened.</p>`,
  },
  {
    title: 'But magic states are noisy',
    preset: { errs: '', p: 0.01 },
    focus: ['Fifteen raw magic states', 'Distill: simulated batches'],
    html: `<p>Magic states are made by rotating a physical qubit, so they carry its error rate, perhaps 10⁻³ to 10⁻², while a long algorithm needs T gates with errors around 10⁻¹⁰ or less. The fix is to <b>distill</b>: take many noisy magic states and make fewer, better ones using only Cliffords.</p>
      <p>Bravyi and Kitaev's 15-to-1 protocol puts 15 raw states into the [[15,1,3]] Reed–Muller code. Errors on them act as Z errors on the 15 qubits. Four checks look for them.</p>`,
  },
  {
    title: 'Every qubit has an address',
    preset: { errs: '5', p: 0.01 },
    focus: ['Fifteen raw magic states', 'Distill: simulated batches'],
    html: `<p>Qubit k carries the label k = 1 … 15. Check 1, 2, 4 and 8 each test the qubits whose label has that binary digit, so the four check bits read out the <b>XOR of the labels</b> of all errors. One error on qubit 5 reads 0101 = 5: caught.</p>
      <p>Two errors on different qubits XOR to a nonzero label too: also caught. <b>Click qubits</b> to add or remove errors.</p>`,
  },
  {
    title: 'Three errors can slip through',
    preset: { errs: '1,2,3', p: 0.01 },
    focus: ['Fifteen raw magic states', 'Distill: simulated batches'],
    html: `<p>Errors on qubits 1, 2 and 3: 1 ⊕ 2 ⊕ 3 = 0, so every check reads 0 and the batch is accepted, yet the output is flipped. An odd number of errors whose labels cancel acts as the logical Z̄.</p>`,
    predict: {
      q: 'How many sets of three qubits have labels that XOR to zero?',
      options: ['15', '35', '105', '455'],
      answer: 1,
      why: 'Pick any two labels a ≠ b; the third must be a ⊕ b. That gives 15 · 14 / 6 = 35 triples, the weight-3 words of the Hamming code.',
    },
  },
  {
    title: 'Four can be harmless',
    preset: { errs: '1,2,4,7', p: 0.01 },
    focus: ['Fifteen raw magic states', 'Distill: simulated batches'],
    html: `<p>1 ⊕ 2 ⊕ 4 ⊕ 7 = 0 again, but four errors are an even pattern: a stabilizer of the code, which does nothing to the output. Accepted, and fine.</p>
      <p>So the protocol fails only when three or more errors line up just so. With error p per state that happens with probability about <b>35p³</b>.</p>`,
  },
  {
    title: 'Output error 35p³',
    preset: { p: 0.01 },
    focus: ['Error in, error out'],
    html: `<p>The exact output error (from the code's full weight enumerator) follows 35p³ at small p. From 1% raw states, one round gives about 3.6 × 10⁻⁵; feeding those into a second round gives about 1.6 × 10⁻¹². Distillation only helps below a break-even input error near 14%.</p>`,
    math: `<span class="eq">P_accept = Σ_w A_w p^w (1−p)^(15−w),  P_out = Σ_{w odd} A_w p^w (1−p)^(15−w) / P_accept</span>
      A_w counts the words of weight w in the Hamming [15,11] code: 1, 35, 105, 168, 280, 435, 435, 280, 168, 105, 35, 1 for w = 0, 3, 4, …, 12, 15.`,
  },
  {
    title: 'The price',
    preset: { p: 0.001 },
    focus: ['Error in, error out', 'How many rounds?'],
    html: `<p>Each round costs at least 15 raw states per output, so two rounds cost about 225. That is why "magic state factories" were expected to take up most of a fault-tolerant computer, and why cheaper schemes matter: Gidney, Shutty and Jones's <b>magic state cultivation</b> (2024) grows a good T state inside a small surface-code patch at a fraction of the cost.</p>
      <p>This analysis assumes perfect Clifford gates; in practice the factory runs on error-corrected qubits, whose own errors set a floor.</p>`,
  },
  {
    title: 'Your turn',
    preset: { errs: '', p: 0.05 },
    focus: ['Fifteen raw magic states', 'Distill: simulated batches', 'Error in, error out'],
    html: `<p>Run batches at different input error rates and compare the simulated acceptance and output error with the formula. Can you find a set of five errors that slips through and flips the output?</p>`,
  },
];

const api = runLesson({
  slug: 'magic-states',
  settings: { theta: 1.2, phi: 0.6, outcome: 0, fix: true, errs: '', p: 0.01 },
  controls: [
    { id: 'theta', label: 'Data tilt θ', type: 'range', min: 0, max: Math.PI, step: Math.PI / 36, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    { id: 'phi', label: 'Data phase φ', type: 'range', min: 0, max: 2 * Math.PI, step: Math.PI / 36, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    { id: 'outcome', label: 'Measurement outcome', type: 'choice', options: [[0, '0'], [1, '1']] },
    { id: 'fix', label: 'S if outcome is 1', type: 'check' },
    { id: 'p', label: 'Raw magic-state error p', type: 'range', min: 0.001, max: 0.2, step: 0.001, format: (v) => percent(v) },
    {
      type: 'button',
      label: 'Random batch',
      onClick: (a) => {
        const rng = seededRandom(Math.floor(Math.random() * 2 ** 31));
        let mask = 0;
        for (let k = 0; k < N; k++) if (rng() < a.settings.p) mask |= 1 << k;
        a.set({ errs: textOf(mask) });
      },
    },
    {
      type: 'button',
      label: 'Run 20,000 batches',
      primary: true,
      onClick: (a) => {
        const p = a.settings.p;
        const rng = seededRandom(Math.floor(Math.random() * 2 ** 31));
        const t = { p, shots: 20000, accepted: 0, bad: 0 };
        for (let i = 0; i < t.shots; i++) {
          let mask = 0;
          for (let k = 0; k < N; k++) if (rng() < p) mask |= 1 << k;
          const v = verdict(mask);
          if (v !== 'reject') t.accepted++;
          if (v === 'bad') t.bad++;
        }
        tally = t;
        a.redraw();
      },
    },
    { type: 'button', label: 'Clear errors', onClick: (a) => a.set({ errs: '' }) },
  ],
  cards: [
    { id: 'inject', title: 'T by injection', kind: 'html' },
    { id: 'batch', title: 'Fifteen raw magic states', legend: 'click a qubit to toggle a Z error · dots = which checks see it', height: 250 },
    { id: 'tally', title: 'Distill: simulated batches', kind: 'html' },
    { id: 'curve', title: 'Error in, error out', legend: 'exact, from the weight enumerator', height: 330 },
    { id: 'cost', title: 'How many rounds?', kind: 'html', folded: true },
  ],
  steps: STEPS,
  compute,
  draw(a) {
    drawInjection(a);
    drawBatch(a);
    tallyHtml(a);
    drawCurve(a);
    costHtml(a);
  },
});

api.canvas('batch').style.cursor = 'pointer';
api.canvas('batch').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const k = hit(e.clientX - rect.left, e.clientY - rect.top);
  if (k < 0) return;
  api.set({ errs: textOf(api.model.mask ^ (1 << k)) });
});
