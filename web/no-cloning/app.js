import { blochAt, cnotCopy, copies, fidelity, ghzWMix, monogamy, optimalClone } from '../lib/cloning.js';
import { seededRandom, zeroState } from '../lib/circuit.js';
import { angleLabel, percent } from '../lib/format.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Copying machines and entanglement budgets. States and numbers come from lib/cloning.js, whose
// tests check the 5/6 fidelity of the optimal cloner and the CKW inequality on random states.

const deg = (v) => `${Math.round((v * 180) / Math.PI)}°`;
let views = [];

function randomThree(seed) {
  const rng = seededRandom(seed);
  const s = zeroState(3);
  let n = 0;
  for (let b = 0; b < 8; b++) {
    // Gaussian amplitudes give a uniformly random pure state
    const g = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    s.re[b] = g();
    s.im[b] = g();
    n += s.re[b] ** 2 + s.im[b] ** 2;
  }
  for (let b = 0; b < 8; b++) {
    s.re[b] /= Math.sqrt(n);
    s.im[b] /= Math.sqrt(n);
  }
  return s;
}

function compute(s) {
  const r = blochAt(s.theta, s.phi);
  const out = copies(s.machine === 'optimal' ? optimalClone(s.theta, s.phi) : cnotCopy(s.theta, s.phi));
  let three;
  if (s.three === 'random') three = randomThree(s.seed);
  else three = ghzWMix(s.three === 'ghz' ? 0 : s.three === 'w' ? Math.PI / 2 : s.mix);
  return { r, out, fid: out.map((c) => fidelity(r, c)), mono: monogamy(three) };
}

function drawCopies(api) {
  const box = api.el('copies');
  if (!views.length) {
    box.innerHTML = '<div class="bloch-row"><canvas></canvas><canvas></canvas><canvas></canvas></div><p class="hint" id="copy-note"></p>';
    views = [...box.querySelectorAll('canvas')].map((c, i) => new BlochView(c, { title: ['the original', 'copy A', 'copy B'][i], labels: 'poles' }));
  }
  const { r, out, fid } = api.model;
  views[0].vector = r;
  views[0].note = '';
  out.forEach((c, i) => {
    views[i + 1].vector = c;
    views[i + 1].others = [r];
    views[i + 1].note = `fidelity ${percent(fid[i])}`;
  });
  views.forEach((v) => v.draw(api.theme));
  box.querySelector('#copy-note').innerHTML =
    api.settings.machine === 'optimal'
      ? 'The thin arrow is the original. Each copy points the same way at 2/3 the length, for every input: fidelity 5/6 ≈ 83.3%.'
      : 'The thin arrow is the original. Each "copy" keeps only the z component of the original: fidelity (1 + z²)/2.';
}

function drawFidelity(api) {
  const { ctx, w, h } = prep(api.canvas('fid'));
  const th = api.theme;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0.4, 1], th);
  const X = xAxis(ctx, box, [0, 180], th);
  const curve = (f, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), Y(f((i * Math.PI) / 180)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  curve((t) => (1 + Math.cos(t) ** 2) / 2, th.ampNeg);
  curve(() => 5 / 6, th.accent2);
  curve(() => 2 / 3, withAlpha(th.muted, 0.7), [3, 4]);
  const t = api.settings.theta;
  ctx.strokeStyle = th.cursor;
  ctx.beginPath();
  ctx.moveTo(X((t * 180) / Math.PI), box.y0);
  ctx.lineTo(X((t * 180) / Math.PI), box.y1);
  ctx.stroke();
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = th.ampNeg;
  ctx.fillText('CNOT copier: (1 + cos²θ)/2', X(4), Y(0.98));
  ctx.fillStyle = th.accent2;
  ctx.fillText('optimal cloner: 5/6 for every state', X(60), Y(5 / 6) - 4);
  ctx.fillStyle = th.muted;
  ctx.fillText('CNOT copier averaged over all states: 2/3', X(60), Y(2 / 3) - 4);
  ctx.textAlign = 'center';
  ctx.fillText('input tilt θ (degrees from |0⟩)', (box.x0 + box.x1) / 2, h);
}

function drawBudget(api) {
  const { ctx, w, h } = prep(api.canvas('budget'));
  const th = api.theme;
  const { views: vs } = api.model.mono;
  const names = ['A', 'B', 'C'];
  const box = { x0: 70, y0: 26, x1: w - 20, y1: h - 30 };
  const X = xAxis(ctx, box, [0, 1], th);
  const row = (box.y1 - box.y0) / 3;
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('each qubit’s entanglement budget C²(X, rest), and how it is spent', box.x0, 4);
  vs.forEach((v, i) => {
    const y = box.y0 + i * row + row * 0.2;
    const bh = row * 0.55;
    const seg = (from, len, color, label) => {
      if (len <= 1e-6) return;
      ctx.fillStyle = color;
      ctx.fillRect(X(from), y, X(from + len) - X(from), bh);
      if (X(from + len) - X(from) > 70) {
        ctx.fillStyle = th.surfaceSolid;
        ctx.font = MONO;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, (X(from) + X(from + len)) / 2, y + bh / 2);
      }
    };
    ctx.strokeStyle = th.axis;
    ctx.strokeRect(X(0), y, X(1) - X(0), bh);
    seg(0, v.withY, th.accent2, `with ${names[v.y]} ${fmt(v.withY, 2)}`);
    seg(v.withY, v.withZ, th.ampNeg, `with ${names[v.z]} ${fmt(v.withZ, 2)}`);
    seg(v.withY + v.withZ, Math.max(0, v.tangle), th.marked, `all three ${fmt(v.tangle, 2)}`);
    ctx.fillStyle = th.text;
    ctx.font = `600 ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`qubit ${names[v.x]}`, box.x0 - 8, y + bh / 2);
  });
}

const STEPS = [
  {
    title: 'A copying machine?',
    preset: { machine: 'cnot', theta: 0, phi: 0 },
    focus: ['The original and its copies', 'How good is each copy?'],
    html: `<p>Classical bits copy freely. A CNOT seems to copy qubits too: it maps |0⟩|0⟩ → |0⟩|0⟩ and |1⟩|0⟩ → |1⟩|1⟩. Here the original is |0⟩, and both outputs are perfect copies (fidelity 100%).</p>`,
    predict: {
      q: 'Now the original is |+⟩ = (|0⟩ + |1⟩)/√2. What comes out of the CNOT copier?',
      options: ['Two copies of |+⟩', 'A Bell pair: neither output is |+⟩', '|+⟩ and |0⟩', 'Nothing changes'],
      answer: 1,
      why: 'Linearity gives (|00⟩ + |11⟩)/√2: the "copies" are entangled with each other, and each alone is a fair coin.',
    },
  },
  {
    title: 'Superpositions don’t copy',
    preset: { machine: 'cnot', theta: Math.PI / 2, phi: 0 },
    focus: ['The original and its copies', 'How good is each copy?'],
    html: `<p>Feed in |+⟩ and the output is the Bell state (|00⟩ + |11⟩)/√2. Each "copy" has no Bloch arrow at all, so fidelity 50%, no better than a guess. Drag the input tilt: only |0⟩ and |1⟩ copy perfectly.</p>`,
  },
  {
    title: 'No machine can do it',
    preset: { machine: 'cnot', theta: 1.1, phi: 0.8 },
    focus: ['The original and its copies', 'How good is each copy?'],
    html: `<p>This isn't a weakness of the CNOT. <b>No</b> device can copy an unknown quantum state (Wootters–Zurek and Dieks, 1982). A copier that worked for |0⟩ and |1⟩ would, by linearity, turn |+⟩ into an entangled state instead of |+⟩|+⟩.</p>`,
    math: `Suppose U|ψ⟩|0⟩ = |ψ⟩|ψ⟩ for all ψ. Take the inner product of the equations for ψ and φ:
      <span class="eq">⟨ψ|φ⟩ = ⟨ψ|φ⟩²</span>
      so ⟨ψ|φ⟩ is 0 or 1: only orthogonal (or identical) states can be copied by the same machine.`,
  },
  {
    title: 'The best possible copier',
    preset: { machine: 'optimal', theta: 1.1, phi: 0.8 },
    focus: ['The original and its copies', 'How good is each copy?'],
    html: `<p>If perfect copies are impossible, how good can approximate ones be? The <b>optimal universal cloner</b> (Bužek and Hillery, 1996) uses one extra qubit of its own. Each copy points exactly along the original, but shrunk to 2/3 of its length.</p>
      <p>That gives fidelity 5/6 ≈ 83% for <b>every</b> input, and no machine does better for all states. Drag the input: the copies stay at 5/6.</p>`,
    math: `<span class="eq">|0⟩ → √(2/3)|00⟩|0⟩ + √(1/6)(|01⟩ + |10⟩)|1⟩</span>
      <span class="eq">|1⟩ → √(2/3)|11⟩|1⟩ + √(1/6)(|01⟩ + |10⟩)|0⟩</span>
      Each copy's density matrix is (I + (2/3) r·σ)/2, so F = (1 + 2/3)/2 = 5/6.`,
  },
  {
    title: 'Entanglement can’t be shared freely either',
    preset: { three: 'w' },
    focus: ['Sharing entanglement'],
    html: `<p>A cousin of no-cloning: if A is maximally entangled with B, A can't be entangled with anyone else. For three qubits this is exact: <b>C²(A,B) + C²(A,C) ≤ C²(A,BC)</b> (Coffman, Kundu and Wootters, 2000).</p>
      <p>The bars show each qubit's total budget and how it is spent: on each partner, and on entanglement shared by all three (the <b>three-tangle</b>). Here, in the W state, it's all spent on pairs.</p>`,
  },
  {
    title: 'GHZ: spent on the group',
    preset: { three: 'ghz' },
    focus: ['Sharing entanglement'],
    html: `<p>In GHZ every qubit's budget is full (C² = 1), but nothing is spent on any pair: it all goes to the three-tangle. W and GHZ are the two extremes, and no local operations can turn one into the other.</p>
      <p>Slide between them with the GHZ↔W mix, or press <b>Random state</b> to check the inequality on a random state.</p>`,
    predict: {
      q: 'A random three-qubit state is chosen. Can the two pair bars of qubit A ever add up to more than its total budget?',
      options: ['Yes, for highly entangled states', 'Never: that is the monogamy inequality', 'Only if A is in |0⟩', 'Only for W states'],
      answer: 1,
      why: 'The CKW inequality holds for every three-qubit state; the leftover is the three-tangle, which is never negative.',
    },
  },
  {
    title: 'Why it matters',
    preset: { three: 'random', seed: 3 },
    focus: ['Sharing entanglement'],
    html: `<p>No-cloning and monogamy are why quantum key distribution is secure. An eavesdropper can't copy the photons, and if Alice and Bob check that their pairs are maximally entangled, monogamy guarantees that Eve can hold no entanglement with them at all.</p>
      <p>They also explain why quantum error correction must spread a qubit out (α|000⟩ + β|111⟩) rather than copy it.</p>`,
  },
  {
    title: 'Your turn',
    preset: { machine: 'optimal', theta: 2, phi: 1, three: 'mix', mix: 0.6 },
    html: `<p>Try both copiers on any input, and explore how three qubits can share their entanglement.</p>`,
  },
];

runLesson({
  slug: 'no-cloning',
  settings: { machine: 'cnot', theta: 0, phi: 0, three: 'w', mix: 0.6, seed: 1 },
  controls: [
    { id: 'machine', label: 'Copier', type: 'choice', options: [['cnot', 'CNOT copier'], ['optimal', 'Optimal cloner']] },
    { id: 'theta', label: 'Input tilt θ', type: 'range', min: 0, max: Math.PI, step: Math.PI / 72, format: deg },
    { id: 'phi', label: 'Input phase φ', type: 'range', min: 0, max: 2 * Math.PI, step: Math.PI / 36, format: angleLabel },
    { id: 'three', label: 'Three-qubit state', type: 'select', options: [['ghz', 'GHZ'], ['w', 'W'], ['mix', 'Mix of GHZ and W'], ['random', 'Random state']] },
    { id: 'mix', label: 'GHZ ↔ W', type: 'range', min: 0, max: Math.PI / 2, step: Math.PI / 90, format: (v) => `${Math.round((v / (Math.PI / 2)) * 100)}% W`, show: (s) => s.three === 'mix' },
    { type: 'button', label: 'Random state', onClick: (api) => api.set({ three: 'random', seed: api.settings.seed + 1 }) },
  ],
  cards: [
    { id: 'copies', title: 'The original and its copies', kind: 'html' },
    { id: 'fid', title: 'How good is each copy?', legend: 'fidelity with the original', height: 220 },
    { id: 'budget', title: 'Sharing entanglement', legend: 'squared concurrences (CKW)', height: 210 },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    drawCopies(api);
    drawFidelity(api);
    drawBudget(api);
  },
});
