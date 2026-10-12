import { percent } from '../lib/format.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// The threshold, measured: Monte Carlo of the surface code at distances 3, 5 and 7 over a range of
// physical error rates, run in a Web Worker (lib/qec.js thresholdScan). The tests check that these
// logical error rates agree with PyMatching's within statistical error.

const GRIDS = {
  'code-capacity': { ps: [0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16], label: 'bit flips, perfect measurements' },
  phenomenological: { ps: [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05], label: 'bit flips and measurement errors' },
};
const DISTANCES = [3, 5, 7];
// percent() rounds to 0.1%, too coarse for logical error rates
const sup = (n) => String(n).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
const pct = (v) => (v > 0 && v < 0.01 ? `${(v * 100).toPrecision(2)}%` : percent(v));
const runs = new Map(); // key -> { status, progress, results }
let task = null;
let lessonApi = null;

// Exact matching over a space-time graph with many defects is too slow for a browser, so noisy checks
// are always decoded with union-find. (Code capacity with matching falls back to union-find in the
// rare trial with more than MWPM_LIMIT defects.)
const decoderOf = (s) => (s.noise === 'phenomenological' ? 'uf' : s.decoder);
const keyOf = (s) => `${s.noise}|${decoderOf(s)}|${s.trials}`;

function start(s) {
  const key = keyOf(s);
  if (runs.has(key)) return;
  task?.cancel();
  const entry = { status: 'running', progress: 0, results: null };
  runs.set(key, entry);
  const { ps } = GRIDS[s.noise];
  task = runTask(new URL('../lib/qec.js', import.meta.url), 'thresholdScan', { distances: DISTANCES, ps, trials: s.trials, decoder: decoderOf(s), noise: s.noise, seed: 7 }, {
    onProgress: (p) => {
      entry.progress = p;
      lessonApi?.redraw();
    },
  });
  task.promise
    .then((results) => {
      entry.status = 'done';
      entry.results = results;
      lessonApi?.redraw();
    })
    .catch(() => {
      if (entry.status === 'running') runs.delete(key);
    });
}

function drawChart(api) {
  const { ctx, w, h } = prep(api.canvas('chart'));
  const th = api.theme;
  const s = api.settings;
  const entry = runs.get(keyOf(s));
  const { ps } = GRIDS[s.noise];
  const box = { x0: 60, y0: 14, x1: w - 14, y1: h - 42 };
  const lo = -4;
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 10 ** lo)) - lo) / -lo) * (box.y1 - box.y0);
  const X = xAxis(ctx, box, [0, ps[ps.length - 1] * 1.05], th);
  ctx.font = MONO;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = lo; e <= 0; e++) {
    ctx.strokeStyle = withAlpha(th.muted, 0.15);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    ctx.fillStyle = th.muted;
    ctx.fillText(e === 0 ? '1' : `10${sup(e)}`, box.x0 - 6, Y(10 ** e));
  }
  // the unprotected qubit, for comparison (only fair for a single round of errors)
  if (s.noise === 'code-capacity') {
    ctx.strokeStyle = withAlpha(th.muted, 0.7);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p), Y(p)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const colors = [th.accent2, th.marked, th.ampNeg];
  if (entry?.results) {
    entry.results.forEach(({ d, row }, k) => {
      ctx.strokeStyle = colors[k];
      ctx.fillStyle = colors[k];
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      row.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.p), Y(Math.max(r.rate, 0.5 / r.trials))));
      ctx.stroke();
      for (const r of row) {
        const sigma = Math.sqrt((Math.max(r.rate, 1 / r.trials) * (1 - r.rate)) / r.trials);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(X(r.p), Y(r.rate + sigma));
        ctx.lineTo(X(r.p), Y(Math.max(r.rate - sigma, 0.5 / r.trials)));
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(X(r.p), Y(Math.max(r.rate, 0.5 / r.trials)), r.fails ? 4 : 2.5, 0, 2 * Math.PI);
        if (r.fails) ctx.fill();
        else ctx.stroke();
      }
      // legend, top left
      ctx.font = FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillRect(box.x0 + 12, box.y0 + 8 + 18 * k, 14, 3);
      ctx.fillText(`d = ${d}`, box.x0 + 32, box.y0 + 18 * k + 2);
    });
  } else {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Simulating… ${Math.round((entry?.progress ?? 0) * 100)}%`, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2);
  }
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`physical error rate p (${GRIDS[s.noise].label})${s.noise === 'code-capacity' ? '; dashed = one unprotected qubit' : '; d rounds per run'}`, (box.x0 + box.x1) / 2, h);
}

// Λ = P_L(d) / P_L(d + 2) at the grid point nearest to p.
function lambdaAt(results, p) {
  const row3 = results[0].row;
  const i = row3.reduce((best, r, k) => (Math.abs(r.p - p) < Math.abs(row3[best].p - p) ? k : best), 0);
  const cells = results.map((r) => r.row[i]);
  const rates = cells.map((c) => c.rate);
  // Λ with a binomial error bar: relative error sqrt((1 − P₁)/f₁ + (1 − P₂)/f₂) from the failure counts
  const lam = [];
  for (let k = 0; k + 1 < cells.length; k++) {
    const [a, b] = [cells[k], cells[k + 1]];
    if (b.fails > 0 && a.fails > 0) {
      const v = a.rate / b.rate;
      lam.push({ v, err: v * Math.sqrt((1 - a.rate) / a.fails + (1 - b.rate) / b.fails) });
    }
  }
  return { p: row3[i].p, rates, lam };
}

function readout(api) {
  const s = api.settings;
  const entry = runs.get(keyOf(s));
  const box = api.el('lambda');
  if (!entry?.results) {
    box.innerHTML = `<p class="hint">Running ${DISTANCES.length * GRIDS[s.noise].ps.length * s.trials} simulated memory experiments in the background…</p>`;
    return;
  }
  const { p, rates, lam } = lambdaAt(entry.results, s.pl);
  const show = (v) => (v > 0 ? pct(v) : `< ${pct(1 / s.trials)}`);
  box.innerHTML = `<div class="readout-grid">
      ${DISTANCES.map((d, k) => `<div class="stat"><span>P_L at p = ${pct(p)}, d = ${d}</span><b>${show(rates[k])}</b></div>`).join('')}
      <div class="stat"><span>Suppression Λ per step in d</span><b>${lam.length ? lam.map(({ v, err }) => `${fmt(v, 2)} ± ${fmt(err, err < 0.1 ? 2 : 1)}`).join(', ') : '–'}</b></div></div>
    <p class="hint">${
      lam.length && lam.every(({ v, err }) => v - 2 * err > 1)
        ? 'Λ > 1: below threshold, every step up in distance divides the logical error rate.'
        : lam.length && lam.every(({ v, err }) => v + 2 * err < 1)
          ? 'Λ < 1: above threshold, bigger codes do worse.'
          : 'Near the threshold, or too few failures to tell Λ from 1 at this number of trials (more trials shrink the error bars).'
    } Each run is ${s.noise === 'phenomenological' ? 'd rounds of noisy checks followed by one perfect round' : 'one round of errors and perfect checks'}.</p>`;
}

function calculator(api) {
  const s = api.settings;
  // P_L(d) = P_L(7) Λ^{-(d - 7)/2}
  const target = 10 ** s.target;
  const steps = Math.max(0, Math.log(s.pl7 / target) / Math.log(s.lam));
  const d = 7 + 2 * Math.ceil(steps);
  api.el('calc').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Distance needed</span><b>${d}</b></div>
      <div class="stat"><span>Physical qubits per logical qubit (≈ 2d²)</span><b>${(2 * d * d).toLocaleString()}</b></div></div>
    <p class="hint">Starting from a distance-7 logical error of ${pct(s.pl7)} per cycle and dividing it by Λ = ${fmt(s.lam, 2)} for every step d → d + 2, to reach 10${sup(s.target)} per cycle.</p>`;
}

const STEPS = [
  {
    title: 'Bigger codes, below a threshold',
    preset: { noise: 'code-capacity', decoder: 'mwpm', pl: 0.04, trials: 8000 },
    focus: ['Logical error rate against physical error rate', 'Suppression Λ'],
    html: `<p>Each point is thousands of simulated memory experiments: random bit flips with probability p on every data qubit, decode, check whether the logical qubit flipped. The three curves are distances 3, 5 and 7.</p>
      <p>On the left, bigger codes are better; on the right, worse. They cross at the <b>threshold</b>, about 10% for bit flips with perfect measurements and matching.</p>`,
  },
  {
    title: 'Below threshold: exponential suppression',
    preset: { noise: 'code-capacity', decoder: 'mwpm', pl: 0.04, trials: 8000 },
    focus: ['Suppression Λ', 'Logical error rate against physical error rate'],
    html: `<p>Well below the threshold, every step d → d + 2 divides the logical error rate by a factor <b>Λ</b>. A failure needs about (d + 1)/2 errors to line up, so P_L ∝ (p/p_th)^((d+1)/2): exponentially small in d.</p>`,
    math: `<span class="eq">P_L(d) ≈ A (p/p_th)^((d+1)/2),  Λ = P_L(d)/P_L(d+2) ≈ p_th/p</span>
      So halving p roughly doubles Λ, and Λ, not p alone, decides how many qubits a useful logical qubit costs.`,
    predict: {
      q: 'Above the threshold (say p = 16%), going from d = 3 to d = 7…',
      options: ['still helps a little', 'makes the logical error rate worse', 'has no effect', 'eliminates errors'],
      answer: 1,
      why: 'Above threshold, more qubits mean more ways to fail than the code can fix: the curves cross.',
    },
  },
  {
    title: 'Above threshold: more is worse',
    preset: { noise: 'code-capacity', decoder: 'mwpm', pl: 0.16, trials: 8000 },
    focus: ['Suppression Λ', 'Logical error rate against physical error rate'],
    html: `<p>At p = 16% the order has flipped: the distance-7 code fails more often than distance 3 (just above the crossing the difference is small and needs many trials to see). Error correction only pays off once the hardware is good enough, which is why "below threshold" was the milestone the field chased for decades.</p>`,
  },
  {
    title: 'Measurement errors lower the threshold',
    preset: { noise: 'phenomenological', decoder: 'uf', pl: 0.01 },
    focus: ['Logical error rate against physical error rate', 'Suppression Λ'],
    html: `<p>Real checks are measured by noisy circuits, so the syndrome itself can be wrong. Repeating the measurement d times and decoding in space and time (next lesson) still works, but the threshold drops to roughly 3% in this model (a little lower with union-find), and to about 1% with full circuit-level noise.</p>`,
  },
  {
    title: 'Willow crossed it',
    preset: { noise: 'phenomenological', decoder: 'uf', pl: 0.01, lam: 2.14, pl7: 0.00143, target: -10 },
    focus: ['How big must the code be?'],
    html: `<p>In 2024 Google's Willow processor ran surface-code memories at distances 3, 5 and 7 and measured <b>Λ = 2.14</b>: the logical error rate fell by that factor at each step, reaching 0.143% per cycle at distance 7. For the first time a bigger surface code was clearly better on real hardware.</p>
      <p>The calculator shows what that rate implies: to reach error rates useful for long algorithms, Λ has to grow, by lowering physical error rates, or the codes get very large.</p>`,
  },
  {
    title: 'Your turn',
    preset: { noise: 'code-capacity', decoder: 'uf', pl: 0.06 },
    html: `<p>Compare the two decoders and noise models, raise the number of trials for smoother curves, and use the calculator to see how Λ sets the cost of a logical qubit.</p>`,
  },
];

lessonApi = runLesson({
  slug: 'threshold',
  settings: { noise: 'code-capacity', decoder: 'mwpm', trials: 2000, pl: 0.04, lam: 2.14, pl7: 0.00143, target: -10 },
  controls: [
    { id: 'noise', label: 'Noise', type: 'choice', options: [['code-capacity', 'Perfect checks'], ['phenomenological', 'Noisy checks']] },
    { id: 'decoder', label: 'Decoder', type: 'choice', options: [['mwpm', 'Matching'], ['uf', 'Union-find']], show: (s) => s.noise === 'code-capacity' },
    { type: 'note', html: 'With noisy checks the decoder is union-find (exact matching would take minutes here).', show: (s) => s.noise === 'phenomenological' },
    { id: 'trials', label: 'Trials per point', type: 'choice', options: [[500, '500'], [2000, '2000'], [8000, '8000']] },
    { id: 'pl', label: 'Read Λ at p ≈', type: 'range', min: 0.005, max: 0.16, step: 0.005, format: (v) => percent(v) },
    { id: 'lam', label: 'Calculator: Λ', type: 'range', min: 1.2, max: 10, step: 0.02, format: (v) => v.toFixed(2) },
    { id: 'target', label: 'Calculator: target logical error', type: 'range', min: -15, max: -4, step: 1, format: (v) => `10${sup(v)}` },
  ],
  cards: [
    { id: 'chart', title: 'Logical error rate against physical error rate', legend: 'Monte Carlo, ±1σ bars · d = 3, 5, 7', height: 320 },
    { id: 'lambda', title: 'Suppression Λ', kind: 'html' },
    { id: 'calc', title: 'How big must the code be?', kind: 'html', folded: true },
  ],
  steps: STEPS,
  draw(api) {
    start(api.settings);
    drawChart(api);
    readout(api);
    calculator(api);
  },
});
