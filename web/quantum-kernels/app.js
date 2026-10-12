import { dataset, KERNELS, kernelRidge } from '../lib/vqc.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { runLesson } from '../ui/lesson-kit.js';

// Quantum kernels: the ZZ feature map of Havlíček et al. (checked against PennyLane in the tests),
// the angle-encoding kernel (a classical product formula, also checked), and a classical RBF kernel,
// each used in kernel ridge regression on the same data.

const NAMES = { zz: 'ZZ feature map (quantum)', angle: 'angle encoding (quantum, but a product of cos²)', rbf: 'RBF (classical)' };
const cache = new Map();

function fit(kind, kernelType, scale) {
  const key = `${kind}|${kernelType}|${scale}`;
  if (cache.has(key)) return cache.get(key);
  const train = dataset(kind, 40, 1);
  const test = dataset(kind, 100, 2);
  const k = (a, b) => KERNELS[kernelType](a, b, scale);
  const model = kernelRidge(train, k);
  const acc = (d) => d.filter((p) => Math.sign(model.f(p.x) || 1e-12) === p.y).length / d.length;
  const r = { train, test, model, trainAcc: acc(train), testAcc: acc(test) };
  cache.set(key, r);
  return r;
}

const compute = (s) => fit(s.kind, s.kernel, s.scale);

function drawMatrix(api) {
  const { ctx, w, h } = prep(api.canvas('matrix'));
  const th = api.theme;
  const { model, train } = api.model;
  const order = train.map((_, i) => i).sort((a, b) => train[b].y - train[a].y);
  const n = order.length;
  const size = Math.min(w - 40, h - 40);
  const x0 = (w - size) / 2;
  const y0 = 20;
  const c = size / n;
  order.forEach((i, r) =>
    order.forEach((j, q) => {
      ctx.fillStyle = withAlpha(th.marked, Math.max(0.02, model.K[i][j]));
      ctx.fillRect(x0 + q * c, y0 + r * c, c + 0.3, c + 0.3);
    }),
  );
  const blue = train.filter((p) => p.y > 0).length;
  ctx.strokeStyle = th.text;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0, y0, blue * c, blue * c);
  ctx.strokeRect(x0 + blue * c, y0 + blue * c, (n - blue) * c, (n - blue) * c);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`k(xᵢ, xⱼ) for the 40 training points, blue class first (boxes: same class)`, x0, y0 - 4);
}

function drawBoundary(api) {
  const { ctx, w, h } = prep(api.canvas('boundary'));
  const th = api.theme;
  const { model, train, test } = api.model;
  const size = Math.min(w - 20, h - 20);
  const x0 = (w - size) / 2;
  const y0 = (h - size) / 2;
  const L = 1.6;
  const X = (v) => x0 + ((v + L) / (2 * L)) * size;
  const Y = (v) => y0 + ((L - v) / (2 * L)) * size;
  const G = 32;
  const cell = size / G;
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const f = model.f([-L + ((j + 0.5) / G) * 2 * L, L - ((i + 0.5) / G) * 2 * L]);
      ctx.fillStyle = withAlpha(f >= 0 ? th.accent2 : th.ampNeg, 0.12 + 0.4 * Math.min(1, Math.abs(f)));
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
    ctx.stroke();
  }
  ctx.strokeStyle = withAlpha(th.muted, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
}

function compareHtml(api) {
  const s = api.settings;
  const rows = ['zz', 'angle', 'rbf'].map((k) => {
    const r = fit(s.kind, k, s.scale);
    return `<tr${k === s.kernel ? ' class="current"' : ''}><td>${NAMES[k]}</td><td>${Math.round(r.trainAcc * 100)}%</td><td>${Math.round(r.testAcc * 100)}%</td></tr>`;
  });
  api.el('compare').innerHTML = `<table class="tally"><thead><tr><th>kernel (bandwidth ${s.scale})</th><th>training</th><th>test</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="hint">Kernel ridge regression with λ = 0.05 on 40 training points; test accuracy on 100 fresh points.</p>`;
}

const STEPS = [
  {
    title: 'A kernel measures similarity',
    preset: { kind: 'circle', kernel: 'zz', scale: 0.5 },
    focus: ['Kernel matrix', 'Decision boundary'],
    html: `<p>A <b>quantum kernel</b> encodes two data points with a feature map and asks how much the states overlap, k(x, x′) = |⟨φ(x)|φ(x′)⟩|². On hardware: run the encoding of x, then the inverse encoding of x′, and count how often you get back to |00⟩.</p>
      <p>Here the ZZ feature map of Havlíček et al. (Nature 2019) on the circle data. The blue points all sit near the centre and resemble each other: the bright top-left block. The pink points surround the circle on every side, so only neighbouring pink points look alike, which is all a kernel method needs.</p>`,
    math: `<span class="eq">k(x, x′) = |⟨0|U(x′)† U(x)|0⟩|²</span>
      The ZZ map: H on each qubit, RZ(2x₁), RZ(2x₂), then e^{−i (π−x₁)(π−x₂) Z₁Z₂}, repeated twice. The tests compare this kernel with PennyLane.`,
  },
  {
    title: 'Training is linear algebra',
    preset: { kind: 'circle', kernel: 'zz', scale: 0.5 },
    focus: ['Decision boundary', 'How the kernels compare'],
    html: `<p>Once the kernel matrix is known, no circuit training is needed: kernel ridge regression solves (K + λI)α = y, and new points are classified by the sign of Σ αᵢ k(xᵢ, x). The optimisation is convex: no barren plateaus, no local minima. Here 94% of unseen points come out right.</p>`,
    math: `<span class="eq">α = (K + λI)⁻¹ y,  f(x) = Σᵢ αᵢ k(xᵢ, x)</span>
      For pure states k(x, x′) = Tr(ρ(x) ρ(x′)), so K is a Gram matrix of 4 × 4 density matrices: with two qubits its rank is at most 16, whatever the number of data points (checked in the tests). The feature space is the space of density matrices, of dimension 4ⁿ.`,
  },
  {
    title: 'Bandwidth matters',
    preset: { kind: 'circle', kernel: 'zz', scale: 2 },
    focus: ['Kernel matrix', 'Decision boundary', 'How the kernels compare'],
    html: `<p>Multiply the data by 2 before encoding. The states now spin round so fast that every pair of points looks about equally (dis)similar: the matrix loses its block structure and test accuracy falls to 75%. Choosing this scale (the bandwidth) well matters as much as choosing the circuit.</p>`,
    predict: {
      q: 'With many qubits and a large bandwidth, what happens to the off-diagonal kernel values?',
      options: ['They grow towards 1', 'They concentrate near 0, so K looks like the identity', 'They become negative', 'Nothing'],
      answer: 1,
      why: 'Typical overlaps between unrelated states of n qubits are about 1/2ⁿ, so K → I and nothing generalises. Telling such tiny overlaps apart also needs exponentially many shots.',
    },
  },
  {
    title: 'Some quantum kernels are classical',
    preset: { kind: 'circle', kernel: 'angle', scale: 1 },
    focus: ['Decision boundary', 'How the kernels compare'],
    html: `<p>Angle encoding gives a product state, so its kernel is a product of cos² terms, which a laptop computes directly. It works well here (98% test accuracy), but nothing quantum is needed to evaluate it. A useful quantum kernel must be hard to compute classically, which needs entangling encodings like the ZZ map, and even that is not sufficient.</p>`,
  },
  {
    title: 'The classical baseline',
    preset: { kind: 'moons', kernel: 'rbf', scale: 1 },
    focus: ['Decision boundary', 'How the kernels compare'],
    html: `<p>A standard classical RBF kernel reaches 94–100% test accuracy on all three datasets at every bandwidth tried here, at least as well as the quantum kernels. That matches large benchmark studies (Bowles, Ahmed and Schuld, 2024): on ordinary datasets, classical models typically match or beat quantum ones.</p>
      <p>There are problems with a proven quantum kernel advantage (Liu, Arunachalam and Temme, 2021), but they are built around a hard number-theoretic structure (the discrete logarithm), not everyday data.</p>`,
  },
  {
    title: 'Your turn',
    preset: { kind: 'xor', kernel: 'zz', scale: 1 },
    html: `<p>For each dataset, find the bandwidth that suits the ZZ kernel best. Can it ever beat the RBF kernel here?</p>`,
  },
];

runLesson({
  slug: 'quantum-kernels',
  settings: { kind: 'circle', kernel: 'zz', scale: 0.5 },
  controls: [
    { id: 'kernel', label: 'Kernel', type: 'choice', options: [['zz', 'ZZ map'], ['angle', 'Angle'], ['rbf', 'RBF (classical)']] },
    { id: 'kind', label: 'Dataset', type: 'choice', options: [['circle', 'Circle'], ['moons', 'Moons'], ['xor', 'XOR']] },
    { id: 'scale', label: 'Bandwidth (data scale)', type: 'choice', options: [[0.5, '0.5'], [1, '1'], [2, '2'], [4, '4']] },
  ],
  cards: [
    { id: 'matrix', title: 'Kernel matrix', height: 300 },
    { id: 'boundary', title: 'Decision boundary', legend: 'filled = training points · hollow = test points', height: 340 },
    { id: 'compare', title: 'How the kernels compare', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawMatrix(api);
    drawBoundary(api);
    compareHtml(api);
  },
});
