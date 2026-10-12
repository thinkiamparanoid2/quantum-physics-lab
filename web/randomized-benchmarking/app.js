import { cliffords, fitDecay, NOISE, runRB, twirledF } from '../lib/rb.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Single-qubit randomized benchmarking on density matrices (lib/rb.js): random Clifford sequences
// with their inverse, noise after every gate, state-preparation and readout errors, and a fit of
// A f^m + B. The tests check the fitted f against the exact twirled value for three noise types.

const LENGTHS = [1, 10, 25, 50, 100, 150, 200, 300, 400, 500];
const STRENGTH = {
  depolarizing: { label: 'Depolarizing probability p', make: (x) => NOISE.depolarizing(x), max: 0.02 },
  damping: { label: 'Damping probability γ (T₁)', make: (x) => NOISE.damping(x), max: 0.02 },
  overrotation: { label: 'Over-rotation ε (rad)', make: (x) => NOISE.overrotation(x * 10), max: 0.02 },
};
const cache = new Map();

function compute(s) {
  const key = JSON.stringify(s);
  if (cache.has(key)) return cache.get(key);
  const noise = STRENGTH[s.noise].make(s.strength);
  const points = runRB({ noise, lengths: LENGTHS, samples: s.samples, prepError: s.spam ? 0.03 : 0, readError: s.spam ? 0.04 : 0, seed: s.seed });
  const fit = fitDecay(points);
  const r = { points, fit, exact: twirledF(noise) };
  cache.set(key, r);
  return r;
}

function drawDecay(api) {
  const { ctx, w, h } = prep(api.canvas('decay'));
  const th = api.theme;
  const { points, fit, exact } = api.model;
  const box = { x0: 56, y0: 16, x1: w - 16, y1: h - 40 };
  const X = (m) => box.x0 + (m / 500) * (box.x1 - box.x0);
  const lo = Math.min(0.45, ...points.map((p) => p.mean - 2 * p.err));
  const Y = (v) => box.y1 - ((v - lo) / (1.01 - lo)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0.5, 0.75, 1]) {
    if (v < lo) continue;
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(v));
    ctx.lineTo(box.x1, Y(v));
    ctx.stroke();
    ctx.fillText(String(v), box.x0 - 6, Y(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const m of [0, 100, 200, 300, 400, 500]) ctx.fillText(String(m), X(m), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('sequence length m (random Cliffords, then the inverse)', (box.x0 + box.x1) / 2, box.y1 + 22);
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let m = 0; m <= 500; m += 5) (m ? ctx.lineTo : ctx.moveTo).call(ctx, X(m), Y(fit.A * fit.f ** m + fit.B));
  ctx.stroke();
  for (const p of points) {
    ctx.strokeStyle = th.accent2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(p.m), Y(p.mean - p.err));
    ctx.lineTo(X(p.m), Y(p.mean + p.err));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(p.m), Y(p.mean), 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = th.accent2;
    ctx.fill();
  }
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.fillStyle = th.text;
  ctx.textBaseline = 'top';
  ctx.fillText(`survival probability of |0⟩ (mean ± standard error) · fit A·f^m + B: f = ${fit.f.toFixed(5)} (exact twirl ${exact.toFixed(5)})`, box.x0 + 6, box.y0);
}

function readout(api) {
  const { fit, exact } = api.model;
  const r = (1 - fit.f) / 2;
  api.el('readout').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Error per Clifford r = (1 − f)/2</span><b>${r.toExponential(2)}</b></div>
      <div class="stat"><span>Average gate fidelity (1 + f)/2</span><b>${(1 - r).toFixed(5)}</b></div>
      <div class="stat"><span>Exact value from the noise model</span><b>${((1 - exact) / 2).toExponential(2)}</b></div>
      <div class="stat"><span>Fit A, B</span><b>${fit.A.toFixed(3)}, ${fit.B.toFixed(3)}</b></div></div>`;
}

function sequenceHtml(api) {
  const { list } = cliffords();
  const names = Array.from({ length: 6 }, (_, k) => list[(k * 7 + api.settings.seed * 5) % 24].name);
  api.el('sequence').innerHTML = `<p class="mono">C₁ … C₆ = ${names.join(' · ')} · then C_inv = (C₆ ⋯ C₁)⁻¹</p>
    <p class="hint">The 24 single-qubit Cliffords, each written as a product of H and S. Without noise every sequence returns exactly to |0⟩.</p>`;
}

const STEPS = [
  {
    title: 'How good are my gates?',
    preset: { noise: 'depolarizing', strength: 0.005, samples: 100, spam: false, seed: 1 },
    focus: ['A random sequence'],
    html: `<p>Characterising a gate fully (process tomography) needs many measurements, and it mixes the gate's errors with errors in preparing the state and reading it out (SPAM). <b>Randomized benchmarking</b> (Knill et al. 2008; Magesan, Gambetta and Emerson 2011) measures one number, the average error per gate, robustly.</p>
      <p>The recipe: apply m randomly chosen Clifford gates, then the single Clifford that undoes them all. With perfect gates you always get |0⟩ back.</p>`,
  },
  {
    title: 'An exponential decay',
    preset: { noise: 'depolarizing', strength: 0.005, samples: 100, spam: false, seed: 1 },
    focus: ['Survival against sequence length', 'Numbers'],
    html: `<p>With noise, the probability of getting |0⟩ back falls as the sequences lengthen. Averaged over random sequences it follows A f<sup>m</sup> + B exactly. The error per Clifford is r = (1 − f)/2. Here each gate is followed by depolarizing noise with p = 0.005, and the fit returns f = 0.995, the exact value.</p>`,
    math: `<span class="eq">P(m) = A f^m + B,  r = (1 − f)/2,  F_avg = 1 − r</span>
      Averaging over the Clifford group (a unitary 2-design) twirls any noise channel Λ into a depolarizing one with f = (Tr of Λ's Pauli transfer matrix − 1)/3.`,
  },
  {
    title: 'Robust to SPAM errors',
    preset: { noise: 'depolarizing', strength: 0.005, samples: 100, spam: true, seed: 1 },
    focus: ['Survival against sequence length', 'Numbers'],
    html: `<p>Now add a 3% state-preparation error and a 4% readout error. The whole curve shifts and A shrinks, but the decay rate f is unchanged. That is the point of RB: SPAM errors go into A and B, gate errors into f.</p>`,
    predict: {
      q: 'Readout errors of 10% would change which fitted quantity?',
      options: ['f only', 'A and B, but not f', 'Everything equally', 'Nothing'],
      answer: 1,
      why: 'They act once per sequence, not once per gate, so they rescale the curve without changing its decay rate.',
    },
  },
  {
    title: 'Coherent errors are twirled too',
    preset: { noise: 'overrotation', strength: 0.01, samples: 400, spam: false, seed: 1 },
    focus: ['Survival against sequence length', 'Numbers'],
    html: `<p>A systematic over-rotation by 0.1 rad after every gate is a coherent error, not random noise. Single sequences scatter widely (more samples are needed here), but the average still decays exponentially with the twirled f = (1 + 2 cos ε)/3. RB reports the <i>average</i> error, and the tests check that the fit recovers it.</p>
      <p>Coherent errors can add up far worse in a specific circuit than the average suggests, which is why RB is complemented by other methods (gate set tomography, cycle benchmarking).</p>`,
  },
  {
    title: 'What the number means',
    preset: { noise: 'damping', strength: 0.002, samples: 100, spam: false, seed: 1 },
    focus: ['Numbers'],
    html: `<p>Energy relaxation (amplitude damping) is not unital, so B moves away from ½, but the fitted f still matches the exact twirl. Today's best single-qubit gates reach errors per Clifford around 10⁻⁴. Caveats: gate-dependent noise and leakage make the interpretation subtler (Proctor et al. 2017), and two-qubit RB needs the much larger two-qubit Clifford group.</p>`,
  },
  {
    title: 'Your turn',
    preset: { noise: 'depolarizing', strength: 0.01, samples: 30, spam: true, seed: 2 },
    html: `<p>With only 30 sequences per length, how far is the fit from the exact value? Change the seed to see the scatter, then increase the number of sequences.</p>`,
  },
];

runLesson({
  slug: 'randomized-benchmarking',
  settings: { noise: 'depolarizing', strength: 0.005, samples: 100, spam: false, seed: 1 },
  controls: [
    { id: 'noise', label: 'Noise after each gate', type: 'choice', options: [['depolarizing', 'Depolarizing'], ['damping', 'Damping (T₁)'], ['overrotation', 'Over-rotation']] },
    { id: 'strength', label: 'Strength (p, γ, or ε/10 in rad)', type: 'range', min: 0, max: 0.02, step: 0.001, format: (v) => v.toFixed(3) },
    { id: 'samples', label: 'Sequences per length', type: 'choice', options: [[30, '30'], [100, '100'], [400, '400']] },
    { id: 'spam', label: 'Add SPAM errors (3% prep, 4% readout)', type: 'check' },
    { id: 'seed', label: 'Random seed', type: 'range', min: 1, max: 20, step: 1 },
  ],
  cards: [
    { id: 'sequence', title: 'A random sequence', kind: 'html' },
    { id: 'decay', title: 'Survival against sequence length', height: 290 },
    { id: 'readout', title: 'Numbers', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    sequenceHtml(api);
    drawDecay(api);
    readout(api);
  },
});
