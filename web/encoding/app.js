import { runOps } from '../lib/circuit.js';
import { amplitudeEncodingOps } from '../lib/vqc.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Three ways to load four numbers into qubits: basis, angle and amplitude encoding, run on the
// statevector engine (lib/circuit.js). The tests check that the amplitude-encoding circuit
// prepares exactly the normalised vector, and the angle-encoding overlap formula.

const REF = [0.8, 0.3, 0.6, 0.1]; // a second, fixed data point to compare with
const NAMES = { basis: 'Basis', angle: 'Angle', amplitude: 'Amplitude' };

function encode(enc, v) {
  if (enc === 'basis') {
    const ops = v.map((x, i) => (x >= 0.5 ? { gate: 'X', target: i } : null)).filter(Boolean);
    return { n: 4, ops };
  }
  if (enc === 'angle') return { n: 4, ops: v.map((x, i) => ({ gate: 'RY', target: i, angle: Math.PI * x })) };
  return { n: 2, ops: amplitudeEncodingOps(v) };
}

function overlap(enc, a, b) {
  if (enc === 'basis') return a.every((x, i) => x >= 0.5 === b[i] >= 0.5) ? 1 : 0;
  if (enc === 'angle') return a.reduce((p, x, i) => p * Math.cos((Math.PI * (x - b[i])) / 2) ** 2, 1);
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  return dot ** 2 / (a.reduce((s, x) => s + x * x, 0) * b.reduce((s, x) => s + x * x, 0) || 1);
}

function compute(s) {
  const v = [s.x1, s.x2, s.x3, s.x4];
  const e = encode(s.enc, v);
  const { state } = runOps(e.n, e.ops);
  return { v, ...e, state };
}

function drawState(api) {
  const { ctx, w, h } = prep(api.canvas('state'));
  const th = api.theme;
  const { state, n } = api.model;
  const dim = 1 << n;
  const box = { x0: 46, y0: 18, x1: w - 12, y1: h - 40 };
  const bw = (box.x1 - box.x0) / dim;
  const Y = (p) => box.y1 - p * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const p of [0, 0.5, 1]) ctx.fillText(String(p), box.x0 - 6, Y(p));
  for (let b = 0; b < dim; b++) {
    const p = state.re[b] ** 2 + state.im[b] ** 2;
    ctx.fillStyle = withAlpha(state.re[b] < -1e-12 ? th.ampNeg : th.accent2, 0.85);
    ctx.fillRect(box.x0 + b * bw + 2, Y(p), bw - 4, box.y1 - Y(p));
    // ket label, qubit 0 first
    const label = Array.from({ length: n }, (_, q) => (b >> q) & 1).join('');
    ctx.save();
    ctx.translate(box.x0 + (b + 0.5) * bw, box.y1 + 6);
    if (dim > 8) ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = th.muted;
    ctx.textAlign = dim > 8 ? 'right' : 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`|${label}⟩`, 0, 0);
    ctx.restore();
  }
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`probabilities of the ${1 << n} basis states of ${n} qubits (qubit 0 written first)`, box.x0, 2);
}

function drawCircuitCard(api) {
  const box = api.el('circuit');
  const { n, ops } = api.model;
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div><p class="hint"></p>';
  drawCircuit(box.querySelector('.circuit-scroll'), { n, ops, applied: ops.length, labels: Array.from({ length: n }, (_, q) => `q${q}`) });
  const s = api.settings;
  box.querySelector('.hint').textContent =
    s.enc === 'basis'
      ? 'One X gate for each feature above 0.5: the numbers become a bit string.'
      : s.enc === 'angle'
        ? 'One rotation per feature, RY(π x): each number sets the tilt of its own qubit.'
        : 'A rotation on q1 splits the weight between its two halves, then two rotations on q0 controlled by q1 (the first wrapped in X gates, so it acts when q1 is |0⟩): four numbers in two qubits.';
}

function compareHtml(api) {
  const { v } = api.model;
  const rows = ['basis', 'angle', 'amplitude'].map((enc) => {
    const e = encode(enc, v);
    return `<tr${enc === api.settings.enc ? ' class="current"' : ''}><td>${NAMES[enc]}</td><td>${e.n}</td><td>${e.ops.length}</td><td>${enc === 'basis' ? 'one bit each' : enc === 'angle' ? 'one per qubit' : '2ⁿ in n qubits'}</td><td>${fmt(overlap(enc, v, REF), 3)}</td></tr>`;
  });
  api.el('compare').innerHTML = `<table class="tally"><thead><tr><th>encoding</th><th>qubits</th><th>gates</th><th>features</th><th>overlap |⟨φ(x)|φ(r)⟩|²</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="hint">r = (${REF.join(', ')}) is a second data point. The overlap is how similar the two points look to a quantum model; each encoding gives a different notion of similarity.</p>`;
}

const STEPS = [
  {
    title: 'Getting data into qubits',
    preset: { enc: 'basis', x1: 0.7, x2: 0.2, x3: 0.9, x4: 0.4 },
    html: `<p>Before a quantum computer can learn anything from data, the numbers have to become a quantum state. This choice, the <b>encoding</b> or feature map, shapes everything the model can do afterwards. Here is one data point with four features between 0 and 1, loaded three ways.</p>`,
  },
  {
    title: 'Basis encoding',
    preset: { enc: 'basis', x1: 0.7, x2: 0.2, x3: 0.9, x4: 0.4 },
    html: `<p>Round each feature to a bit and prepare that bit string: |1010⟩. Simple and exact for binary data, but rounding throws information away, and two points are either identical or orthogonal: overlap 1 or 0.</p>`,
  },
  {
    title: 'Angle encoding',
    preset: { enc: 'angle', x1: 0.7, x2: 0.2, x3: 0.9, x4: 0.4 },
    html: `<p>Rotate qubit i by an angle proportional to feature i. One qubit per feature, one gate each, and nearby points give nearby states: the overlap falls off smoothly, as a product of cos² terms. The state is a product state, with no entanglement; quantum models add that later with entangling gates and repeated encodings.</p>`,
    math: `<span class="eq">|φ(x)⟩ = ⊗_i RY(π x_i)|0⟩,  |⟨φ(x)|φ(x′)⟩|² = Π_i cos²(π (x_i − x′_i)/2)</span>`,
  },
  {
    title: 'Amplitude encoding',
    preset: { enc: 'amplitude', x1: 0.7, x2: 0.2, x3: 0.9, x4: 0.4 },
    html: `<p>Use the four numbers, normalised, as the four amplitudes of a 2-qubit state. In general 2ⁿ numbers fit into n qubits, an exponential compression that features in many speed-up claims.</p>
      <p>The catch: preparing an arbitrary such state takes about 2ⁿ gates (here a small tree of rotations), and reading amplitudes back needs many repeated measurements. The compression is real, but it is not free.</p>`,
    predict: {
      q: 'How many qubits does amplitude encoding need for 1024 features?',
      options: ['1024', '512', '32', '10'],
      answer: 3,
      why: '2¹⁰ = 1024 amplitudes fit into 10 qubits.',
    },
  },
  {
    title: 'Encodings define similarity',
    preset: { enc: 'angle', x1: 0.75, x2: 0.35, x3: 0.6, x4: 0.15 },
    focus: ['How the encodings compare'],
    html: `<p>Move the point close to r = (0.8, 0.3, 0.6, 0.1) and watch the overlaps. Basis encoding jumps between 0 and 1; angle and amplitude encodings change smoothly, each in their own way. That overlap is a <b>kernel</b>, a measure of similarity, and the kernels lesson builds a classifier from it.</p>`,
  },
  {
    title: 'Your turn',
    preset: { enc: 'amplitude', x1: 0.5, x2: 0.5, x3: 0.5, x4: 0.5 },
    html: `<p>Find two points that look identical under basis encoding but different under angle encoding. When does amplitude encoding give an overlap of exactly 1 for different points? (Hint: it only sees directions.)</p>`,
  },
];

runLesson({
  slug: 'encoding',
  settings: { enc: 'basis', x1: 0.7, x2: 0.2, x3: 0.9, x4: 0.4 },
  controls: [
    { id: 'enc', label: 'Encoding', type: 'choice', options: [['basis', 'Basis'], ['angle', 'Angle'], ['amplitude', 'Amplitude']] },
    ...['x1', 'x2', 'x3', 'x4'].map((id, i) => ({ id, label: `Feature ${i + 1}`, type: 'range', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) })),
  ],
  cards: [
    { id: 'circuit', title: 'The encoding circuit', kind: 'html' },
    { id: 'state', title: 'The state it prepares', height: 240 },
    { id: 'compare', title: 'How the encodings compare', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawCircuitCard(api);
    drawState(api);
    compareHtml(api);
  },
});
