import { classifierOps, classify } from '../lib/vqc.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis } from '../ui/charts.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// A variational classifier that trains while you watch: a 2-qubit data re-uploading circuit,
// trained with Adam on exact parameter-shift gradients in a Web Worker (lib/vqc.js
// trainClassifier). The play bar scrubs through the recorded epochs. The tests check the model and
// its gradients against PennyLane.

const EPOCHS = 80;
const runs = new Map();
let lessonApi = null;
const keyOf = (s) => `${s.kind}|${s.layers}`;

function start(s) {
  const key = keyOf(s);
  if (runs.has(key)) return runs.get(key);
  const entry = { status: 'running', result: null };
  runs.set(key, entry);
  runTask(new URL('../lib/vqc.js', import.meta.url), 'trainClassifier', { kind: s.kind, layers: s.layers, epochs: EPOCHS }).promise.then((result) => {
    entry.status = 'done';
    entry.result = result;
    lessonApi?.redraw();
  });
  return entry;
}

const epochOf = (api) => Math.min(EPOCHS, Math.max(0, Math.round(api.t)));

function waiting(api, id) {
  const { ctx, w, h } = prep(api.canvas(id));
  ctx.font = FONT;
  ctx.fillStyle = api.theme.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Training in the background…', w / 2, h / 2);
}

function drawBoundary(api) {
  const entry = start(api.settings);
  if (!entry.result) return waiting(api, 'boundary');
  const { ctx, w, h } = prep(api.canvas('boundary'));
  const th = api.theme;
  const { train, test, history } = entry.result;
  const params = history[epochOf(api)].params;
  const size = Math.min(w - 20, h - 20);
  const x0 = (w - size) / 2;
  const y0 = (h - size) / 2;
  const L = 1.6;
  const X = (v) => x0 + ((v + L) / (2 * L)) * size;
  const Y = (v) => y0 + ((L - v) / (2 * L)) * size;
  const G = 40;
  const cell = size / G;
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const x = [-L + ((j + 0.5) / G) * 2 * L, L - ((i + 0.5) / G) * 2 * L];
      const f = classify(api.settings.layers, params, x);
      ctx.fillStyle = withAlpha(f >= 0 ? th.accent2 : th.ampNeg, 0.12 + 0.45 * Math.abs(f));
      ctx.fillRect(x0 + j * cell, y0 + i * cell, cell + 0.5, cell + 0.5);
    }
  }
  for (const d of test) {
    ctx.beginPath();
    ctx.arc(X(d.x[0]), Y(d.x[1]), 3.5, 0, 2 * Math.PI);
    ctx.strokeStyle = d.y > 0 ? th.accent2 : th.ampNeg;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const d of train) {
    ctx.beginPath();
    ctx.arc(X(d.x[0]), Y(d.x[1]), 5, 0, 2 * Math.PI);
    ctx.fillStyle = d.y > 0 ? th.accent2 : th.ampNeg;
    ctx.fill();
    ctx.strokeStyle = th.surfaceSolid;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (Math.sign(classify(api.settings.layers, params, d.x) || 1e-12) !== d.y) {
      ctx.strokeStyle = th.text;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(d.x[0]), Y(d.x[1]), 8, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = withAlpha(th.muted, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
}

function drawLoss(api) {
  const entry = start(api.settings);
  if (!entry.result) return waiting(api, 'loss');
  const { ctx, w, h } = prep(api.canvas('loss'));
  const th = api.theme;
  const { history } = entry.result;
  const box = { x0: 44, y0: 14, x1: w - 14, y1: h - 36 };
  const X = xAxis(ctx, box, [0, EPOCHS], th, { integer: true });
  const maxLoss = Math.max(...history.map((r) => r.loss)) * 1.05;
  const Yl = (v) => box.y1 - (v / maxLoss) * (box.y1 - box.y0);
  const Ya = (v) => box.y1 - v * (box.y1 - box.y0);
  const line = (get, Y, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    history.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), Y(get(r))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line((r) => r.loss, Yl, th.marked);
  line((r) => r.acc, Ya, th.accent2);
  line((r) => r.testAcc, Ya, th.accent2, [4, 4]);
  const e = epochOf(api);
  ctx.strokeStyle = th.text;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(X(e), box.y0);
  ctx.lineTo(X(e), box.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0, 0.5, 1]) ctx.fillText(`${Math.round(v * 100)}%`, box.x0 - 4, Ya(v));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('epoch', (box.x0 + box.x1) / 2, box.y1 + 20);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [
    ['loss (mean squared error)', th.marked, []],
    ['training accuracy', th.accent2, []],
    ['test accuracy (unseen points)', th.accent2, [4, 4]],
  ].forEach(([t, c, d], i) => {
    const y = box.y1 - 60 + 18 * i;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.setLineDash(d);
    ctx.beginPath();
    ctx.moveTo(box.x1 - 220, y);
    ctx.lineTo(box.x1 - 202, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.text;
    ctx.fillText(t, box.x1 - 196, y);
  });
}

function circuitHtml(api) {
  const box = api.el('circuit');
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div><p class="hint"></p>';
  const entry = runs.get(keyOf(api.settings));
  const L = api.settings.layers;
  const params = entry?.result ? entry.result.history[epochOf(api)].params : new Array(4 * L).fill(0);
  const x = [0.5, -0.8];
  const ops = classifierOps(L).map((op) => {
    if (op.gate === 'CNOT') return { gate: 'X', target: op.target, controls: [op.control] };
    return { gate: op.gate, target: op.target, angle: op.param !== undefined ? params[op.param] : x[op.input] };
  });
  drawCircuit(box.querySelector('.circuit-scroll'), { n: 2, ops, applied: ops.length, labels: ['q0 (read out)', 'q1'] });
  const r = entry?.result?.history[epochOf(api)];
  box.querySelector('.hint').innerHTML = `${L} layer${L > 1 ? 's' : ''}: each loads the point (x₁, x₂) with RY gates, then applies trainable RZ and RY rotations (${4 * L} parameters) and a CNOT. The prediction is the sign of ⟨Z⟩ on q0. Shown for x = (0.5, −0.8)${r ? ` at epoch ${epochOf(api)}: loss ${fmt(r.loss, 3)}, training accuracy ${Math.round(r.acc * 100)}%, test accuracy ${Math.round(r.testAcc * 100)}%` : ''}.`;
}

const STEPS = [
  {
    title: 'A learning task',
    preset: { kind: 'circle', layers: 3 },
    at: 0,
    focus: ['Decision boundary', 'The model'],
    html: `<p>Sixty points, labelled blue inside a circle and pink outside. The task: learn a rule that labels new points correctly. The shading is the model's opinion everywhere in the plane (blue for ⟨Z⟩ > 0); ringed points are currently misclassified.</p>
      <p>Before training the parameters are random and so is the boundary.</p>`,
  },
  {
    title: 'The model is a circuit',
    preset: { kind: 'circle', layers: 3 },
    at: 0,
    focus: ['The model'],
    html: `<p>Each layer writes the point into two qubits with RY(x₁), RY(x₂), then applies trainable rotations and an entangling CNOT. Writing the data in again in every layer, <b>data re-uploading</b>, lets a small circuit represent complicated functions. The output is ⟨Z⟩ on the first qubit, a number between −1 and 1.</p>`,
  },
  {
    title: 'Exact gradients from the circuit itself',
    preset: { kind: 'circle', layers: 3 },
    at: 0,
    focus: ['The model'],
    html: `<p>Training needs the derivative of the output with respect to each parameter. A quantum computer cannot backpropagate, but for rotation gates there is an exact trick, the <b>parameter-shift rule</b>: run the circuit with the parameter shifted by +π/2 and by −π/2 and take half the difference. Same circuit, two runs, no approximation.</p>`,
    math: `<span class="eq">∂⟨Z⟩/∂θ = [⟨Z⟩(θ + π/2) − ⟨Z⟩(θ − π/2)] / 2</span>
      Valid for any gate e^{−iθP/2} with P a Pauli. The tests check these gradients against PennyLane to 10⁻¹². With n parameters an epoch costs 2n circuit runs per data point, and on hardware each run is many shots.`,
  },
  {
    title: 'Training',
    preset: { kind: 'circle', layers: 3 },
    at: 0,
    focus: ['Decision boundary', 'Learning curves'],
    play: true,
    html: `<p>Press play: Adam follows the gradients for 80 epochs. The loss falls, the boundary bends into shape, and accuracy climbs above 90%.</p>`,
  },
  {
    title: 'One layer is not enough',
    preset: { kind: 'circle', layers: 1 },
    at: 80,
    focus: ['Decision boundary', 'Learning curves'],
    html: `<p>With one layer the model can only produce a limited family of functions (each feature enters through a single rotation, so only frequency 1 in each: see the Fourier lesson). It cannot close a circle: training settles on calling almost every point pink, which already scores about 77% because most points lie outside. Depth here means more re-uploads, not just more parameters.</p>`,
    predict: {
      q: 'Which dataset do you expect two layers to fit perfectly?',
      options: ['The circle', 'The two moons', 'XOR (opposite quadrants)', 'None of them'],
      answer: 2,
      why: 'XOR is a product of the two coordinates’ signs, which a low-frequency function like sin x₁ sin x₂ captures: two layers reach 100%.',
    },
  },
  {
    title: 'Training is not testing',
    preset: { kind: 'moons', layers: 2 },
    at: 80,
    focus: ['Decision boundary', 'Learning curves'],
    html: `<p>On the two moons with two layers, 87% of training points are right but only 72% of fresh test points (hollow circles). The model has partly fitted the training sample rather than the pattern. Three layers do better on both.</p>`,
  },
  {
    title: 'Your turn',
    preset: { kind: 'xor', layers: 2 },
    at: 80,
    html: `<p>Try every dataset with one to four layers. Where do the training and test accuracies agree, and where do they part? None of this needs a quantum computer at this size: it is about understanding what such models can and cannot do.</p>`,
  },
];

lessonApi = runLesson({
  slug: 'qml-classifier',
  settings: { kind: 'circle', layers: 3 },
  controls: [
    { id: 'kind', label: 'Dataset', type: 'choice', options: [['circle', 'Circle'], ['moons', 'Moons'], ['xor', 'XOR']] },
    { id: 'layers', label: 'Layers (re-uploads)', type: 'choice', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4']] },
  ],
  cards: [
    { id: 'boundary', title: 'Decision boundary', legend: 'filled = training points · hollow = test points · ringed = wrong', height: 380 },
    { id: 'loss', title: 'Learning curves', height: 260 },
    { id: 'circuit', title: 'The model', kind: 'html' },
  ],
  steps: STEPS,
  player: { duration: () => EPOCHS, speed: EPOCHS / 10 },
  draw(api) {
    drawBoundary(api);
    drawLoss(api);
    circuitHtml(api);
  },
});
