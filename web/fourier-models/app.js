import { fourierCoefficients, fourierModel, TARGETS } from '../lib/vqc.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// Quantum models are Fourier series (Schuld, Sweke & Meyer 2021): a one-qubit model that uploads
// x with L rotations RX(x) can only contain frequencies |k| ≤ L. Fitted with Adam in a Web Worker
// (lib/vqc.js fitFourier) and compared with the classical least-squares Fourier series of the same
// degree. The tests check the coefficients against PennyLane's qml.fourier.coefficients.

const EPOCHS = 200;
const KMAX = 6;
const runs = new Map();
let lessonApi = null;
const keyOf = (s) => `${s.target}|${s.layers}`;

function start(s) {
  const key = keyOf(s);
  if (runs.has(key)) return runs.get(key);
  const entry = { result: null };
  runs.set(key, entry);
  runTask(new URL('../lib/vqc.js', import.meta.url), 'fitFourier', { target: s.target, layers: s.layers, epochs: EPOCHS }).promise.then((result) => {
    entry.result = result;
    lessonApi?.redraw();
  });
  return entry;
}

const epochOf = (api) => Math.min(EPOCHS, Math.max(0, Math.round(api.t)));
const classicalAt = (w, x) => w.reduce((s, c, i) => s + c * (i === 0 ? 1 : i % 2 ? Math.cos(((i + 1) / 2) * x) : Math.sin((i / 2) * x)), 0);

function waiting(api, id) {
  const { ctx, w, h } = prep(api.canvas(id));
  ctx.font = FONT;
  ctx.fillStyle = api.theme.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Fitting in the background…', w / 2, h / 2);
}

function drawFit(api) {
  const entry = start(api.settings);
  if (!entry.result) return waiting(api, 'fit');
  const { ctx, w, h } = prep(api.canvas('fit'));
  const th = api.theme;
  const s = api.settings;
  const r = entry.result;
  const params = r.history[epochOf(api)].params;
  const box = { x0: 44, y0: 14, x1: w - 14, y1: h - 34 };
  const X = (x) => box.x0 + (x / (2 * Math.PI)) * (box.x1 - box.x0);
  const Y = (v) => (box.y0 + box.y1) / 2 - (v / 1.15) * ((box.y1 - box.y0) / 2);
  ctx.strokeStyle = withAlpha(th.muted, 0.3);
  ctx.beginPath();
  ctx.moveTo(box.x0, Y(0));
  ctx.lineTo(box.x1, Y(0));
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [
    [0, '0'],
    [Math.PI, 'π'],
    [2 * Math.PI, '2π'],
  ].forEach(([x, t]) => ctx.fillText(t, X(x), box.y1 + 4));
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [-1, 0, 1]) ctx.fillText(String(v), box.x0 - 6, Y(v));
  const curve = (f, color, width, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = (2 * Math.PI * i) / 300;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(f(x)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve(TARGETS[s.target], withAlpha(th.muted, 0.8), 2);
  curve((x) => classicalAt(r.classicalW, x), th.marked, 2, [5, 4]);
  curve((x) => fourierModel(s.layers, params, x), th.accent2, 2.5);
  r.xs.forEach((x, j) => {
    ctx.beginPath();
    ctx.arc(X(x), Y(r.ys[j]), 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = th.muted;
    ctx.fill();
  });
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [
    ['target (dots: the 40 training samples)', withAlpha(th.muted, 0.8), []],
    [`quantum model, L = ${s.layers}, epoch ${epochOf(api)}: loss ${fmt(r.history[epochOf(api)].loss, 4)}`, th.accent2, []],
    [`best classical Fourier series of degree ${s.layers}: loss ${fmt(r.classicalLoss, 4)}`, th.marked, [5, 4]],
  ].forEach(([t, c, d], i) => {
    const y = box.y0 + 8 + 18 * i;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.setLineDash(d);
    ctx.beginPath();
    ctx.moveTo(box.x0 + 8, y);
    ctx.lineTo(box.x0 + 26, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.text;
    ctx.fillText(t, box.x0 + 32, y);
  });
}

function drawSpectrum(api) {
  const entry = start(api.settings);
  if (!entry.result) return waiting(api, 'spectrum');
  const { ctx, w, h } = prep(api.canvas('spectrum'));
  const th = api.theme;
  const s = api.settings;
  const params = entry.result.history[epochOf(api)].params;
  const model = fourierCoefficients((x) => fourierModel(s.layers, params, x), KMAX);
  const target = fourierCoefficients(TARGETS[s.target], 32);
  const mag = (list, k) => {
    const c = list.find((v) => v.k === k);
    return c ? Math.hypot(c.re, c.im) * (k ? 2 : 1) : 0; // one-sided amplitude
  };
  const box = { x0: 44, y0: 14, x1: w - 14, y1: h - 34 };
  const cw = (box.x1 - box.x0) / (KMAX + 1);
  const Y = (v) => box.y1 - (Math.min(v, 1) / 1) * (box.y1 - box.y0);
  // the frequencies this model can reach
  ctx.fillStyle = withAlpha(th.accent2, 0.08);
  ctx.fillRect(box.x0, box.y0, cw * (s.layers + 1), box.y1 - box.y0);
  for (let k = 0; k <= KMAX; k++) {
    const x = box.x0 + k * cw;
    ctx.fillStyle = withAlpha(th.muted, 0.5);
    ctx.fillRect(x + cw * 0.18, Y(mag(target, k)), cw * 0.28, box.y1 - Y(mag(target, k)));
    ctx.fillStyle = th.accent2;
    ctx.fillRect(x + cw * 0.52, Y(mag(model, k)), cw * 0.28, box.y1 - Y(mag(model, k)));
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(k), x + cw / 2, box.y1 + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0, 0.5, 1]) ctx.fillText(String(v), box.x0 - 6, Y(v));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('frequency k', (box.x0 + box.x1) / 2, box.y1 + 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText(`grey: target · blue: model · shaded: k ≤ L = ${s.layers}, the only frequencies the model can contain`, box.x0 + 8, box.y0 + 2);
}

const STEPS = [
  {
    title: 'One qubit, one upload',
    preset: { target: 'cos 2x', layers: 1 },
    focus: ['Model against target', 'Frequency spectrum'],
    at: 0,
    html: `<p>The simplest quantum model: one qubit, a trainable rotation, the data x uploaded once as RX(x), another trainable rotation, then measure ⟨Z⟩. Whatever the parameters, the output is a sine wave of frequency 1 plus a constant, a + b cos x + c sin x. The spectrum (right) has nothing above k = 1.</p>`,
  },
  {
    title: 'Why: the encoding sets the frequencies',
    preset: { target: 'cos 2x', layers: 1 },
    focus: ['Frequency spectrum'],
    at: EPOCHS,
    html: `<p>RX(x) = e<sup>−ixX/2</sup> has eigenvalues e<sup>±ix/2</sup>. ⟨Z⟩ multiplies the state by its conjugate, so phases combine into e<sup>ikx</sup> with k ∈ {−1, 0, 1}. Upload x L times and k runs from −L to L. Schuld, Sweke and Meyer (2021) showed that every such model is a Fourier series whose frequencies are fixed by the encoding; the trainable gates only choose the coefficients.</p>
      <p>Trained on cos 2x, the one-upload model cannot follow: frequency 2 is out of reach, and the best it can do is the flat line.</p>`,
    math: `<span class="eq">f(x) = Σ_{k=−L}^{L} c_k e^{ikx},  c_{−k} = c_k*</span>
      The tests compare the coefficients of these circuits with PennyLane's qml.fourier.coefficients and check that every c_k with |k| > L vanishes.`,
    predict: {
      q: 'How many uploads does the model need to fit cos 3x exactly?',
      options: ['1', '2', '3', 'Infinitely many'],
      answer: 2,
      why: 'Frequency 3 needs L ≥ 3.',
    },
  },
  {
    title: 'More uploads, more frequencies',
    preset: { target: 'cos 2x', layers: 2 },
    focus: ['Model against target', 'Frequency spectrum'],
    at: EPOCHS,
    play: false,
    html: `<p>With two uploads, frequency 2 is available and the fit is exact. Press play to watch the training: the spectrum moves its weight onto k = 2.</p>`,
  },
  {
    title: 'A square wave',
    preset: { target: 'square', layers: 3 },
    focus: ['Model against target', 'Frequency spectrum'],
    at: EPOCHS,
    html: `<p>A square wave needs every odd frequency. With L = 3 the model reaches k = 1 and 3, and its best fit is the same as the classical Fourier series truncated at degree 3, overshoot at the jumps and all (the Gibbs phenomenon).</p>`,
  },
  {
    title: 'Right frequencies, wrong coefficients',
    preset: { target: 'two-tone', layers: 3 },
    focus: ['Model against target', 'Frequency spectrum'],
    at: EPOCHS,
    html: `<p>The target 0.5 sin x + 0.4 cos 3x needs only k = 1 and 3, and L = 3 contains both. Yet the one-qubit model cannot reach this particular combination (loss 0.04, where the classical series is exact). Its coefficients are not free: they come from a few rotation angles and are tied together. With L = 5 it succeeds. Frequencies are necessary, not sufficient.</p>`,
  },
  {
    title: 'What this means',
    preset: { target: 'sawtooth', layers: 3 },
    focus: ['Model against target'],
    at: EPOCHS,
    html: `<p>On the training points, a quantum model with frequencies |k| ≤ L can never beat the least-squares Fourier series of degree L, which a laptop solves exactly in microseconds (the dashed curve; the tests check the inequality). That doesn't make quantum models useless, but it means any advantage must come from structure that classical models struggle with, a theme of the "Is there an advantage?" lesson.</p>`,
  },
  {
    title: 'Your turn',
    preset: { target: 'sawtooth', layers: 1 },
    html: `<p>Try each target with L from 1 to 5. When does the quantum model match the classical series, and when does it fall short?</p>`,
  },
];

lessonApi = runLesson({
  slug: 'fourier-models',
  settings: { target: 'cos 2x', layers: 1 },
  controls: [
    { id: 'target', label: 'Target', type: 'choice', options: Object.keys(TARGETS).map((k) => [k, k]) },
    { id: 'layers', label: 'Uploads L', type: 'choice', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
  ],
  cards: [
    { id: 'fit', title: 'Model against target', height: 280 },
    { id: 'spectrum', title: 'Frequency spectrum', legend: 'one-sided amplitude of each frequency', height: 220 },
  ],
  steps: STEPS,
  player: { duration: () => EPOCHS, speed: EPOCHS / 10 },
  draw(api) {
    drawFit(api);
    drawSpectrum(api);
  },
});
