import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// Barren plateaus, measured: the variance of a gradient over random initialisations of a
// hardware-efficient circuit, for a global cost ⟨Z⊗…⊗Z⟩ and a local cost ⟨Z₀⟩, from 2 to 10
// qubits, run in a Web Worker (lib/vqc.js gradientVariance). The tests check the trends and the
// parameter-shift gradient.

const NS = [2, 4, 6, 8, 10];
const runs = new Map();
let lessonApi = null;

function start(depth) {
  if (runs.has(depth)) return runs.get(depth);
  const entry = { result: null, progress: 0 };
  runs.set(depth, entry);
  runTask(new URL('../lib/vqc.js', import.meta.url), 'gradientVariance', { ns: NS, depth: depth === 'linear' ? 'linear' : 2, samples: 200 }, {
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
  ctx.fillText(`Sampling 200 random circuits per size… ${Math.round(entry.progress * 100)}%`, w / 2, h / 2);
}

function drawVariance(api) {
  const s = api.settings;
  const entry = start(s.depth);
  if (!entry.result) return waiting(api, 'variance', entry);
  const { ctx, w, h } = prep(api.canvas('variance'));
  const th = api.theme;
  const box = { x0: 60, y0: 16, x1: w - 16, y1: h - 36 };
  const X = (n) => box.x0 + ((n - 2) / 8) * (box.x1 - box.x0);
  const [ya, yb] = [-5, 0];
  const Y = (v) => box.y1 - ((Math.log10(v) - ya) / (yb - ya)) * (box.y1 - box.y0);
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
  for (const n of NS) ctx.fillText(String(n), X(n), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('qubits n', (box.x0 + box.x1) / 2, box.y1 + 18);
  // guide: halving per qubit
  const r0 = entry.result[0].global;
  ctx.strokeStyle = withAlpha(th.text, 0.4);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(2), Y(r0));
  ctx.lineTo(X(10), Y(r0 * 2 ** -8));
  ctx.stroke();
  ctx.setLineDash([]);
  const series = (key, color) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    entry.result.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.n), Y(r[key])));
    ctx.stroke();
    entry.result.forEach((r) => {
      ctx.beginPath();
      ctx.arc(X(r.n), Y(r[key]), r.n === s.n ? 6 : 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };
  series('global', th.ampNeg);
  series('local', th.accent2);
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [
    ['global cost ⟨Z⊗Z⊗…⊗Z⟩', th.ampNeg, []],
    ['local cost ⟨Z₀⟩', th.accent2, []],
    ['halving per added qubit', withAlpha(th.text, 0.4), [4, 4]],
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
  ctx.fillText(`variance of ∂C/∂θ₀ over 200 random parameter sets · ${s.depth === 'linear' ? 'as many layers as qubits' : '2 layers'}`, box.x1, box.y0);
}

function drawHistogram(api) {
  const s = api.settings;
  const entry = start(s.depth);
  if (!entry.result) return waiting(api, 'hist', entry);
  const { ctx, w, h } = prep(api.canvas('hist'));
  const th = api.theme;
  const r = entry.result.find((x) => x.n === s.n);
  const bins = 41;
  const range = 1;
  const count = (v) => {
    const c = new Array(bins).fill(0);
    for (const g of v) c[Math.max(0, Math.min(bins - 1, Math.floor(((g + range) / (2 * range)) * bins)))]++;
    return c;
  };
  const cg = count(r.gradients.global);
  const cl = count(r.gradients.local);
  const max = Math.max(...cg, ...cl);
  const box = { x0: 40, y0: 24, x1: w - 16, y1: h - 34 };
  const bw = (box.x1 - box.x0) / bins;
  const Y = (c) => box.y1 - (c / max) * (box.y1 - box.y0);
  for (let b = 0; b < bins; b++) {
    ctx.fillStyle = withAlpha(th.accent2, 0.55);
    ctx.fillRect(box.x0 + b * bw + 1, Y(cl[b]), bw / 2 - 1, box.y1 - Y(cl[b]));
    ctx.fillStyle = withAlpha(th.ampNeg, 0.8);
    ctx.fillRect(box.x0 + b * bw + bw / 2, Y(cg[b]), bw / 2 - 1, box.y1 - Y(cg[b]));
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of [-1, -0.5, 0, 0.5, 1]) ctx.fillText(String(v), box.x0 + ((v + range) / (2 * range)) * (box.x1 - box.x0), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('gradient ∂C/∂θ₀', (box.x0 + box.x1) / 2, box.y1 + 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.fillText(`${s.n} qubits, ${r.layers} layers: 200 random circuits · pink: global cost · blue: local cost`, box.x0, 4);
}

const STEPS = [
  {
    title: 'Where is downhill?',
    preset: { depth: 'shallow', n: 2 },
    focus: ['Gradient variance against size', 'The gradients themselves'],
    html: `<p>Training a variational circuit means following gradients. Start from random parameters and compute ∂C/∂θ for one parameter. Over many random starts the gradient takes many values; its <b>variance</b> says how informative a gradient typically is.</p>
      <p>With 2 qubits gradients are large and spread out: there is always a clear downhill direction.</p>`,
  },
  {
    title: 'A global cost goes flat',
    preset: { depth: 'shallow', n: 10 },
    focus: ['Gradient variance against size', 'The gradients themselves'],
    html: `<p>Now measure a <b>global</b> cost, the product Z on every qubit, with a shallow 2-layer circuit. Its gradient variance falls by about half for each added qubit: at 10 qubits the gradients are squeezed around zero (pink). The landscape is a <b>barren plateau</b>: almost flat almost everywhere.</p>
      <p>Resolving a gradient of size ε needs about 1/ε² shots, so exponentially small gradients need exponentially many measurements.</p>`,
    math: `<span class="eq">Var[∂C/∂θ] ∼ b^{−n},  b > 1</span>
      McClean et al. (2018) showed this for random deep circuits; Cerezo et al. (2021) showed that with shallow circuits it depends on the cost: global costs plateau, local ones need not.`,
  },
  {
    title: 'A local cost stays trainable',
    preset: { depth: 'shallow', n: 10 },
    focus: ['Gradient variance against size', 'The gradients themselves'],
    html: `<p>Same circuits, but measure only ⟨Z₀⟩, a <b>local</b> cost. Its gradient variance (blue) stays near 0.28 from 2 to 10 qubits: shallow circuits with local costs keep usable gradients. The choice of what you measure matters as much as the circuit.</p>`,
    predict: {
      q: 'What happens to the local cost if the circuit is made much deeper (as many layers as qubits)?',
      options: ['Nothing changes', 'Its gradients also start to vanish', 'Its gradients grow', 'It becomes global'],
      answer: 1,
      why: 'Deep random circuits scramble information across all qubits, so even local observables lose their gradients.',
    },
  },
  {
    title: 'Deep circuits flatten everything',
    preset: { depth: 'linear', n: 10 },
    focus: ['Gradient variance against size', 'The gradients themselves'],
    html: `<p>With as many layers as qubits, the circuits behave more like random unitaries and both costs plateau: the local variance falls from 0.30 at 2 qubits to 0.005 at 10. Noise makes it worse still: hardware noise drives every state towards the maximally mixed state, flattening gradients exponentially in depth (noise-induced barren plateaus, Wang et al. 2021).</p>`,
  },
  {
    title: 'The uncomfortable twist',
    preset: { depth: 'shallow', n: 10 },
    html: `<p>Ways around barren plateaus exist: local costs, shallow or structured circuits, clever initialisations. But Cerezo et al. (2023, "Does provable absence of barren plateaus imply classical simulability?") argue that the very structure that guarantees large gradients often lets a classical computer simulate the model efficiently. Trainable and classically hard at the same time is a narrow target, and an open research question.</p>`,
  },
  {
    title: 'Your turn',
    preset: { depth: 'shallow', n: 6 },
    html: `<p>Compare the histograms for each size and depth. At what size would you stop being able to see the global gradient with 1000 measurement shots? (A gradient of size ε needs roughly 1/ε² shots.)</p>`,
  },
];

lessonApi = runLesson({
  slug: 'barren-plateaus',
  settings: { depth: 'shallow', n: 2 },
  controls: [
    { id: 'depth', label: 'Depth', type: 'choice', options: [['shallow', '2 layers'], ['linear', 'n layers']] },
    { id: 'n', label: 'Qubits (histogram)', type: 'choice', options: NS.map((n) => [n, String(n)]) },
  ],
  cards: [
    { id: 'variance', title: 'Gradient variance against size', height: 300 },
    { id: 'hist', title: 'The gradients themselves', height: 220 },
  ],
  steps: STEPS,
  draw(api) {
    drawVariance(api);
    drawHistogram(api);
  },
});
