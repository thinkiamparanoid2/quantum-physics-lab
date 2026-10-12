import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// Adiabatic quantum computing on a 6-spin Ising problem: the spectrum of H(s) = (1 − s)(−ΣX) + s H_P
// and the success probability of linear anneals of length T, computed exactly in a Web Worker
// (lib/aqc.js annealScan). The tests check the spectrum's end points and the success limits.

const INSTANCES = { easy: 192, hard: 59 };
const TS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const runs = new Map();
let lessonApi = null;

function start(kind) {
  if (runs.has(kind)) return runs.get(kind);
  const entry = { result: null, progress: 0 };
  runs.set(kind, entry);
  runTask(new URL('../lib/aqc.js', import.meta.url), 'annealScan', { seed: INSTANCES[kind], n: 6, Ts: TS }, {
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

function waiting(api, id, entry) {
  const { ctx, w, h } = prep(api.canvas(id));
  ctx.font = FONT;
  ctx.fillStyle = api.theme.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Annealing 64-dimensional states for 12 run times… ${Math.round(entry.progress * 100)}%`, w / 2, h / 2);
}

function drawSpectrum(api) {
  const entry = start(api.settings.kind);
  if (!entry.result) return waiting(api, 'spectrum', entry);
  const { ctx, w, h } = prep(api.canvas('spectrum'));
  const th = api.theme;
  const { rows, minGap, sAtMin } = entry.result.spec;
  const box = { x0: 50, y0: 16, x1: w - 16, y1: h - 36 };
  const X = xAxis(ctx, box, [0, 1], th);
  const all = rows.flatMap((r) => r.values);
  const [lo, hi] = [Math.min(...all) - 0.3, Math.max(...all) + 0.3];
  const Y = (e) => box.y1 - ((e - lo) / (hi - lo)) * (box.y1 - box.y0);
  for (let k = rows[0].values.length - 1; k >= 0; k--) {
    ctx.strokeStyle = k === 0 ? th.accent2 : k === 1 ? th.ampNeg : withAlpha(th.muted, 0.55);
    ctx.lineWidth = k < 2 ? 2.5 : 1.2;
    ctx.beginPath();
    rows.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.s), Y(r.values[k])));
    ctx.stroke();
  }
  const row = rows.reduce((a, b) => (Math.abs(b.s - sAtMin) < Math.abs(a.s - sAtMin) ? b : a));
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X(row.s), Y(row.values[0]) + 6);
  ctx.lineTo(X(row.s), Y(row.values[1]) - 6);
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.marked;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`minimum gap Δ = ${fmt(minGap, 3)} at s ≈ ${fmt(sAtMin, 2)}`, X(row.s) + 8, Y(row.values[1]) - 8);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('interpolation s: H(s) = (1 − s)(−ΣX) + s H_P', (box.x0 + box.x1) / 2, box.y1 + 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText('lowest 8 energies · blue: ground state · pink: first excited', box.x0 + 6, box.y0);
}

function drawSuccess(api) {
  const entry = start(api.settings.kind);
  if (!entry.result) return waiting(api, 'success', entry);
  const { ctx, w, h } = prep(api.canvas('success'));
  const th = api.theme;
  const { scan, spec } = entry.result;
  const box = { x0: 50, y0: 16, x1: w - 16, y1: h - 36 };
  const X = (T) => box.x0 + (Math.log2(T) / 11) * (box.x1 - box.x0);
  const Y = (p) => box.y1 - p * (box.y1 - box.y0);
  ctx.strokeStyle = th.axis;
  ctx.beginPath();
  ctx.moveTo(box.x0, box.y0);
  ctx.lineTo(box.x0, box.y1);
  ctx.lineTo(box.x1, box.y1);
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const T of [1, 4, 16, 64, 256, 1024]) ctx.fillText(String(T), X(T), box.y1 + 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const p of [0, 0.5, 1]) ctx.fillText(`${p * 100}%`, box.x0 - 6, Y(p));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('total run time T', (box.x0 + box.x1) / 2, box.y1 + 18);
  // 1/Δ²
  const tGap = 1 / spec.minGap ** 2;
  if (tGap < 2048) {
    ctx.strokeStyle = withAlpha(th.marked, 0.8);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(tGap), box.y0);
    ctx.lineTo(X(tGap), box.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.marked;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('T = 1/Δ²', X(tGap) - 4, box.y0 + 22);
  }
  ctx.strokeStyle = th.accent2;
  ctx.fillStyle = th.accent2;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  scan.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.T), Y(r.success)));
  ctx.stroke();
  scan.forEach((r) => {
    ctx.beginPath();
    ctx.arc(X(r.T), Y(r.success), 4, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.strokeStyle = withAlpha(th.muted, 0.6);
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x0, Y(1 / 64));
  ctx.lineTo(box.x1, Y(1 / 64));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('probability of reading out the optimal answer (dotted: a random guess, 1/64)', box.x0 + 6, box.y0);
}

function readout(api) {
  const entry = start(api.settings.kind);
  if (!entry.result) {
    api.el('readout').innerHTML = '<p class="hint">Computing…</p>';
    return;
  }
  const { spec, scan, optimal } = entry.result;
  const reach = (p) => scan.find((r) => r.success >= p)?.T;
  const bits = optimal.map((b) => Array.from({ length: 6 }, (_, i) => ((b >> i) & 1 ? '↓' : '↑')).join(''));
  api.el('readout').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Answer (spins 0 … 5)</span><b>${bits.join(', ')}</b></div>
      <div class="stat"><span>Minimum gap Δ</span><b>${fmt(spec.minGap, 3)}</b></div>
      <div class="stat"><span>1/Δ²</span><b>${fmt(1 / spec.minGap ** 2, 0)}</b></div>
      <div class="stat"><span>T for 95% success</span><b>${reach(0.95) ?? '> 2048'}</b></div></div>`;
}

const STEPS = [
  {
    title: 'An answer as a ground state',
    preset: { kind: 'easy' },
    focus: ['The answer'],
    html: `<p>Many optimisation problems can be written as an energy to minimise: here six spins with random couplings and fields, H<sub>P</sub> = Σ J<sub>ij</sub>Z<sub>i</sub>Z<sub>j</sub> + Σ h<sub>i</sub>Z<sub>i</sub>. The lowest-energy configuration is the answer. Finding it by trying all 2ⁿ configurations is exponential; for general instances of such problems no efficient classical method is known.</p>`,
  },
  {
    title: 'Start easy, change slowly',
    preset: { kind: 'easy' },
    focus: ['Energy levels along the way'],
    html: `<p>Start in the ground state of H<sub>B</sub> = −ΣX, every spin pointing sideways, which is easy to prepare. Then morph the Hamiltonian into H<sub>P</sub>: H(s) = (1 − s)H<sub>B</sub> + sH<sub>P</sub>. The <b>adiabatic theorem</b>: change slowly enough and the system stays in the instantaneous ground state, arriving at the answer.</p>
      <p>"Slowly enough" is set by the smallest gap Δ between the ground and first excited levels along the way.</p>`,
    math: `<span class="eq">T ≫ max_s ‖dH/ds‖ / Δ(s)²</span>
      A common rule of thumb is T ∼ 1/Δ²_min (with ħ = 1 and ‖dH/ds‖ of order the problem's energy scale).`,
  },
  {
    title: 'Slow enough works',
    preset: { kind: 'easy' },
    focus: ['Success against run time', 'The answer'],
    html: `<p>For this instance the gap never drops below 1.06, and a run of T ≈ 32 already finds the answer 99% of the time. Very fast runs do no better than guessing: with T → 0 the state is still |+…+⟩, and each of the 64 configurations comes out with probability 1/64.</p>`,
  },
  {
    title: 'A small gap',
    preset: { kind: 'hard' },
    focus: ['Energy levels along the way', 'Success against run time'],
    html: `<p>Another instance of the same size has an avoided crossing near s = 0.5 where the gap shrinks to 0.048. Runs shorter than T ≈ 1/Δ² ≈ 440 mostly jump across it and miss the answer (success stays below 40%); it passes 95% only around T ≈ 2000, sixty times longer than the easy instance needs.</p>
      <p>For hard problem families the minimum gap can close exponentially fast with system size (often at first-order transitions), and then the run time grows exponentially too.</p>`,
    predict: {
      q: 'Halving the minimum gap multiplies the required run time by roughly…',
      options: ['2', '4', '√2', 'It does not change'],
      answer: 1,
      why: 'T ∼ 1/Δ², so halving Δ quadruples T.',
    },
  },
  {
    title: 'Where it stands',
    preset: { kind: 'hard' },
    html: `<p>Adiabatic quantum computing with general Hamiltonians is as powerful as the circuit model (Aharonov et al., 2007). Quantum annealers implement the stoquastic Ising version with noise and at finite temperature; whether they offer a scaling advantage over the best classical heuristics for useful problems has not been established. The gap, not the number of qubits, is the quantity to watch.</p>`,
  },
  {
    title: 'Your turn',
    preset: { kind: 'easy' },
    html: `<p>Compare the two instances' spectra. Where along s does each gap close, and how does that show up in the success curve?</p>`,
  },
];

lessonApi = runLesson({
  slug: 'adiabatic-qc',
  settings: { kind: 'easy' },
  controls: [{ id: 'kind', label: 'Instance', type: 'choice', options: [['easy', 'Large gap'], ['hard', 'Small gap']] }],
  cards: [
    { id: 'spectrum', title: 'Energy levels along the way', height: 280 },
    { id: 'success', title: 'Success against run time', height: 250 },
    { id: 'readout', title: 'The answer', kind: 'html' },
  ],
  steps: STEPS,
  draw(api) {
    drawSpectrum(api);
    drawSuccess(api);
    readout(api);
  },
});
