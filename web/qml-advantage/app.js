import { classify, dataset, fourierSurrogate } from '../lib/vqc.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, prep } from '../ui/charts.js';
import { runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// Is there an advantage? A trained re-uploading classifier next to a classical surrogate: ridge
// regression on exactly the Fourier features the circuit can produce. Then the evidence, both ways.

const EPOCHS = 80;
const runs = new Map();
let lessonApi = null;
const keyOf = (s) => `${s.kind}|${s.layers}`;

function start(s) {
  const key = keyOf(s);
  if (runs.has(key)) return runs.get(key);
  const entry = { result: null, surrogate: null };
  runs.set(key, entry);
  entry.surrogate = fourierSurrogate(dataset(s.kind, 60, 1), s.layers);
  runTask(new URL('../lib/vqc.js', import.meta.url), 'trainClassifier', { kind: s.kind, layers: s.layers, epochs: EPOCHS }).promise.then((result) => {
    entry.result = result;
    lessonApi?.redraw();
  });
  return entry;
}

const accuracy = (f, data) => data.filter((p) => Math.sign(f(p.x) || 1e-12) === p.y).length / data.length;

function panel(ctx, th, box, f, train, test, title) {
  const L = 1.6;
  const size = Math.min(box.x1 - box.x0, box.y1 - box.y0);
  const x0 = box.x0 + (box.x1 - box.x0 - size) / 2;
  const y0 = box.y0;
  const X = (v) => x0 + ((v + L) / (2 * L)) * size;
  const Y = (v) => y0 + ((L - v) / (2 * L)) * size;
  const G = 34;
  const cell = size / G;
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const v = f([-L + ((j + 0.5) / G) * 2 * L, L - ((i + 0.5) / G) * 2 * L]);
      ctx.fillStyle = withAlpha(v >= 0 ? th.accent2 : th.ampNeg, 0.12 + 0.4 * Math.min(1, Math.abs(v)));
      ctx.fillRect(x0 + j * cell, y0 + i * cell, cell + 0.5, cell + 0.5);
    }
  }
  for (const d of test) {
    ctx.beginPath();
    ctx.arc(X(d.x[0]), Y(d.x[1]), 3, 0, 2 * Math.PI);
    ctx.strokeStyle = d.y > 0 ? th.accent2 : th.ampNeg;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  for (const d of train) {
    ctx.beginPath();
    ctx.arc(X(d.x[0]), Y(d.x[1]), 4, 0, 2 * Math.PI);
    ctx.fillStyle = d.y > 0 ? th.accent2 : th.ampNeg;
    ctx.fill();
  }
  ctx.strokeStyle = withAlpha(th.muted, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, x0 + size / 2, y0 + size + 6);
}

function drawSurrogate(api) {
  const s = api.settings;
  const entry = start(s);
  const { ctx, w, h } = prep(api.canvas('surrogate'));
  const th = api.theme;
  if (!entry.result) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Training the quantum model in the background…', w / 2, h / 2);
    return;
  }
  const { train, test, history } = entry.result;
  const params = history[history.length - 1].params;
  const qf = (x) => classify(s.layers, params, x);
  const half = w / 2;
  const qa = [accuracy(qf, train), accuracy(qf, test)];
  const ca = [accuracy(entry.surrogate.f, train), accuracy(entry.surrogate.f, test)];
  panel(ctx, th, { x0: 10, y0: 8, x1: half - 10, y1: h - 40 }, qf, train, test, `quantum circuit, ${s.layers} layers: training ${Math.round(qa[0] * 100)}%, test ${Math.round(qa[1] * 100)}%`);
  panel(ctx, th, { x0: half + 10, y0: 8, x1: w - 10, y1: h - 40 }, entry.surrogate.f, train, test, `classical, ${entry.surrogate.features} Fourier features: training ${Math.round(ca[0] * 100)}%, test ${Math.round(ca[1] * 100)}%`);
}

const EVIDENCE = [
  ['Exponential speed-ups for linear algebra (HHL-style QML)', 'Need fast quantum access to data (QRAM) and only output a quantum state. Tang (2019) and others found classical "dequantised" algorithms for low-rank cases such as recommendation systems; Aaronson (2015) lists the fine print.', 'Mostly dequantised for low-rank data'],
  ['Quantum kernels on classical data', 'Large benchmarks (Bowles, Ahmed and Schuld, 2024) find classical models usually match or win. Kernel values concentrate exponentially without care (Thanasilp et al., 2024). A proven advantage exists for data built on the discrete logarithm (Liu, Arunachalam and Temme, 2021).', 'Proven only for specially structured problems'],
  ['Variational circuits (quantum neural networks)', 'They are Fourier series in the data; classical surrogates and random Fourier features often reproduce them (Schreiber, Eisert and Meyer, 2023; Landman et al., 2022). Barren plateaus limit training, and avoiding them often makes the model classically simulable (Cerezo et al., 2023).', 'No convincing advantage on classical data yet'],
  ['Learning from quantum data', 'When the data are quantum states from an experiment, a quantum memory can learn some properties with exponentially fewer experiments; demonstrated on a superconducting processor (Huang et al., Science 2022).', 'The strongest evidence so far'],
  ['Generalisation', 'Quantum models can generalise from few training points, with bounds that grow with the number of trainable gates (Caro et al., 2022). This is about data efficiency, not speed.', 'Established, with modest implications'],
];

function evidenceHtml(api) {
  api.el('evidence').innerHTML = `<table class="tally evidence"><thead><tr><th>claim</th><th>what is known</th><th>status</th></tr></thead><tbody>
    ${EVIDENCE.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table>
    <p class="hint">Schuld and Killoran (PRX Quantum, 2022) argue that quantum advantage may be the wrong yardstick for the field, and that understanding what quantum models are good at is the real research question.</p>`;
}

const STEPS = [
  {
    title: 'The question',
    preset: { kind: 'moons', layers: 3 },
    focus: ['What the evidence says'],
    html: `<p>Quantum machine learning has been advertised with promises of exponential speed-ups. A fair question for any lesson series on it: what is actually known? This lesson sets a quantum model beside a classical one built to match it, then summarises the evidence on both sides, with references.</p>`,
  },
  {
    title: 'A classical twin',
    preset: { kind: 'moons', layers: 3 },
    focus: ['Quantum model against its classical twin'],
    html: `<p>The 3-layer classifier from earlier is a Fourier series in (x₁, x₂) with frequencies up to 3 in each coordinate. So build the classical model with exactly those 49 cos/sin features and fit it by ridge regression: a convex problem, solved in milliseconds, no circuits.</p>
      <p>On the moons it scores 100% on fresh test points, against the quantum model's 87%.</p>`,
  },
  {
    title: 'Not a clean sweep',
    preset: { kind: 'xor', layers: 3 },
    focus: ['Quantum model against its classical twin'],
    html: `<p>On XOR the quantum model is perfect on the test set and the classical twin is slightly behind (96%). The circuit's coefficients are not free, and here that restriction happens to be a good prior. That is the honest picture: the function class is classical, and which model generalises better depends on the problem and on choices like regularisation.</p>`,
    predict: {
      q: 'Does a matching classical model prove that a quantum model is useless?',
      options: ['Yes, always', 'No: it removes the claim of a speed-up for this task, but a quantum model can still be a useful prior or a source of features', 'Only for XOR', 'It proves the opposite'],
      answer: 1,
      why: 'It shows the task needs no quantum computer; it says nothing about tasks where the quantum structure is hard to simulate.',
    },
  },
  {
    title: 'What the evidence says',
    preset: { kind: 'moons', layers: 3 },
    focus: ['What the evidence says'],
    html: `<p>The table summarises five lines of research. Speed-ups for classical data have mostly been dequantised or not shown at practical scale; proven advantages exist, but for problems built around hard number theory or for data that are already quantum.</p>`,
  },
  {
    title: 'Where to look',
    preset: { kind: 'circle', layers: 3 },
    html: `<p>The most promising directions use quantum computers on quantum problems: learning from quantum sensors and experiments, simulating quantum systems (the fields track on this site), and models whose structure is provably hard to simulate. Being honest about this is what makes the field credible, and these lessons try to show both the ideas and their limits.</p>`,
  },
];

lessonApi = runLesson({
  slug: 'qml-advantage',
  settings: { kind: 'moons', layers: 3 },
  controls: [
    { id: 'kind', label: 'Dataset', type: 'choice', options: [['circle', 'Circle'], ['moons', 'Moons'], ['xor', 'XOR']] },
    { id: 'layers', label: 'Layers (frequencies)', type: 'choice', options: [[2, '2'], [3, '3']] },
  ],
  cards: [
    { id: 'surrogate', title: 'Quantum model against its classical twin', legend: 'filled = training points · hollow = test points', height: 360 },
    { id: 'evidence', title: 'What the evidence says', kind: 'html' },
  ],
  steps: STEPS,
  draw(api) {
    drawSurrogate(api);
    evidenceHtml(api);
  },
});
