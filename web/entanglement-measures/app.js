import { GATES, applyGate, ry, zeroState } from '../lib/circuit.js';
import {
  blochOfRho,
  concurrence,
  concurrenceMatrix,
  negativity,
  partialTrace,
  purity,
  pureDensity,
  reducedDensity,
  vonNeumann,
  werner,
} from '../lib/entanglement.js';
import { angleLabel } from '../lib/format.js';
import { hermitianEigen } from '../lib/linalg.js';
import { BlochView } from '../ui/bloch.js';
import { MONO, prep, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { drawMatrix } from '../ui/matrix-plot.js';

// Two qubits in cos(θ/2)|00⟩ + sin(θ/2)|11⟩, turned locally by Ry(a) and Ry(b); a Werner state
// p|Φ+⟩⟨Φ+| + (1 − p)I/4; or three qubits in GHZ or W. Every number on the page comes from
// lib/entanglement.js, which is checked against numpy and exact formulas.

const deg = (v) => `${Math.round((v * 180) / Math.PI)}°`;

function build(s) {
  if (s.family === 'three') {
    const st = zeroState(3);
    if (s.three === 'ghz') {
      applyGate(st, 0, GATES.H);
      applyGate(st, 1, GATES.X, [0]);
      applyGate(st, 2, GATES.X, [1]);
    } else {
      st.re[0] = 0;
      for (const b of [1, 2, 4]) st.re[b] = 1 / Math.sqrt(3);
    }
    const rho = pureDensity(st);
    const singles = [0, 1, 2].map((q) => reducedDensity(st, [q]));
    return { n: 3, state: st, rho, singles, pairs: concurrenceMatrix(st), pure: true };
  }
  let rho;
  let state = null;
  if (s.family === 'werner') {
    rho = werner(s.p);
  } else {
    state = zeroState(2);
    applyGate(state, 0, ry(s.theta));
    applyGate(state, 1, GATES.X, [0]);
    applyGate(state, 0, ry(s.a));
    applyGate(state, 1, ry(s.b));
    rho = pureDensity(state);
  }
  const singles = [0, 1].map((q) => partialTrace(rho, 2, [q]));
  return { n: 2, state, rho, singles, pure: s.family === 'pure' };
}

let spheres = [];

function drawSpheres(api) {
  const box = api.el('spheres');
  const { model, theme } = api;
  if (spheres.length !== model.n) {
    box.innerHTML = `<div class="bloch-row">${'<canvas></canvas>'.repeat(model.n)}</div><p class="hint" id="sphere-note"></p>`;
    spheres = [...box.querySelectorAll('canvas')].map((c, q) => {
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', `Bloch sphere of qubit ${q}`);
      return new BlochView(c, { title: model.n === 2 ? ['qubit A', 'qubit B'][q] : `qubit ${q}`, labels: 'poles' });
    });
  }
  const lengths = model.singles.map((r, q) => {
    const v = blochOfRho(r);
    spheres[q].vector = v;
    const len = Math.hypot(...v);
    spheres[q].note = len < 0.02 ? 'no direction of its own' : `arrow length ${len.toFixed(2)}`;
    spheres[q].draw(theme);
    return len;
  });
  box.querySelector('#sphere-note').innerHTML =
    model.pure && model.n === 2
      ? `For a pure state of two qubits both arrows always have the same length, √(1 − C²) = ${fmt(lengths[0])}.`
      : model.n === 3
        ? 'Each arrow is the state of one qubit with the others ignored.'
        : 'For a mixed state the arrows no longer tell the whole story: they are zero here at every p.';
}

function drawWeights(api) {
  const { ctx, w, h } = prep(api.canvas('weights'));
  const th = api.theme;
  const { model } = api;
  // Schmidt weights for pure states; eigenvalues of ρ for mixed ones.
  const vals = model.pure ? eigs(model.singles[0]) : eigs(model.rho);
  const box = { x0: 52, y0: 12, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const slot = (box.x1 - box.x0) / vals.length;
  vals.forEach((v, i) => {
    const cx = box.x0 + (i + 0.5) * slot;
    const bw = Math.min(70, slot * 0.6);
    ctx.fillStyle = th.accent2;
    ctx.fillRect(cx - bw / 2, Y(v), bw, box.y1 - Y(v));
    ctx.font = MONO;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(v.toFixed(3), cx, Y(v) - 3);
    ctx.fillStyle = th.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(model.pure ? `λ${'₁₂₃₄'[i]}²` : `p${'₁₂₃₄'[i]}`, cx, box.y1 + 6);
  });
}

// Eigenvalues of a density matrix, largest first.
const eigs = (rho) => hermitianEigen(rho.re, rho.im, rho.dim).values.map((v) => Math.max(0, v)).sort((a, b) => b - a);

function readout(api) {
  const { model } = api;
  const stat = (label, value) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`;
  let html;
  if (model.n === 3) {
    const S = model.singles.map((r) => vonNeumann(r));
    html = [
      stat('Each qubit with the other two', `${fmt(S[0], 3)} bit`),
      stat('Pair (0, 1) on its own: C', fmt(model.pairs[1], 3)),
      stat('Pair (1, 2) on its own: C', fmt(model.pairs[5], 3)),
      stat('Pair (0, 2) on its own: C', fmt(model.pairs[2], 3)),
    ].join('');
  } else {
    const C = concurrence(model.rho);
    const SA = vonNeumann(model.singles[0]);
    html = [
      model.pure ? stat('Entanglement entropy S(A)', `${fmt(SA, 3)} bit`) : stat('Entropy of the pair S(AB)', `${fmt(vonNeumann(model.rho), 3)} bit`),
      stat('Concurrence C', fmt(C, 3)),
      stat('Negativity N', fmt(negativity(model.rho), 3)),
      stat('Purity of the pair, tr ρ²', fmt(purity(model.rho), 3)),
    ].join('');
  }
  api.el('measures').innerHTML = `<div class="readout-grid">${html}</div>`;
}

const STEPS = [
  {
    title: 'Two separate qubits',
    preset: { family: 'pure', theta: 0, a: 0.7, b: -1.1 },
    html: `<p>Two qubits, each in its own state: |ψ⟩ = |a⟩|b⟩. Each has a full-length Bloch arrow, and there is exactly one way to describe the pair: one state per qubit.</p>
      <p>The bar chart shows the pair's <b>Schmidt weights</b>. A product state has a single weight, 1.</p>`,
    predict: {
      q: 'An entangling gate is applied, a little at a time. What happens to the two arrows?',
      options: ['They turn, staying full length', 'They shrink towards the centre', 'They grow longer', 'One shrinks while the other grows'],
      answer: 1,
      why: 'Entanglement means each qubit alone is less certain: its state becomes mixed, and mixed states sit inside the sphere.',
    },
  },
  {
    title: 'Entangle a little',
    preset: { family: 'pure', theta: Math.PI / 3, a: 0, b: 0 },
    html: ({ settings }) => `<p>Now the pair is cos(θ/2)|00⟩ + sin(θ/2)|11⟩ with θ = ${deg(settings.theta)}. Neither qubit has a state of its own any more, so both arrows have shrunk, to |cos θ| = ${fmt(Math.abs(Math.cos(settings.theta)))}.</p>
      <p>Two Schmidt weights appear: cos²(θ/2) and sin²(θ/2). Drag θ in <b>Try it</b>.</p>`,
    math: `Any pure state of two systems can be written in the <b>Schmidt form</b>
      <span class="eq">|ψ⟩ = λ₁|a₁⟩|b₁⟩ + λ₂|a₂⟩|b₂⟩,  λ₁² + λ₂² = 1</span>
      with orthonormal |a₁⟩, |a₂⟩ and |b₁⟩, |b₂⟩. The weights λᵢ² are the eigenvalues of either qubit's reduced density matrix ρ_A = tr_B |ψ⟩⟨ψ|. One nonzero weight means a product state.`,
  },
  {
    title: 'Maximally entangled',
    preset: { family: 'pure', theta: Math.PI / 2, a: 0, b: 0 },
    html: `<p>At θ = 90° the pair is the Bell state (|00⟩ + |11⟩)/√2. The two weights are equal, both arrows have vanished, and the entanglement entropy is exactly <b>1 bit</b>: one "ebit".</p>
      <p>Everything there is to know is in the correlations; nothing is left in either qubit alone.</p>`,
  },
  {
    title: 'Local turns change nothing',
    preset: { family: 'pure', theta: Math.PI / 3, a: 1.2, b: -0.8 },
    html: `<p>Same entangled state, but each qubit has been rotated on its own (Ry on A, Ry on B). The arrows <b>turn</b>, but their lengths, the weights and every measure stay exactly the same.</p>
      <p>That's the defining property of an entanglement measure: nothing done to one qubit alone can create or destroy entanglement. Try the two local-turn sliders.</p>`,
    predict: {
      q: 'Can turning just qubit A ever make the pair less entangled?',
      options: ['Yes, if you turn it far enough', 'No: local operations can’t change entanglement', 'Only if A is measured', 'Only for the Bell state'],
      answer: 1,
      why: 'Local unitaries leave the Schmidt weights unchanged, so every entanglement measure is unchanged. (Measuring one qubit is different: it breaks the entanglement.)',
    },
  },
  {
    title: 'Three numbers, one story',
    preset: { family: 'pure', theta: 2.1, a: 0.4, b: 0.9 },
    html: `<p>For pure states of two qubits all the measures agree, because they are all functions of the one weight λ₁²:</p>
      <p><b>entanglement entropy</b> S (bits of entanglement), <b>concurrence</b> C (0 to 1), and the <b>arrow length</b> √(1 − C²). The density matrix on the right shows the off-diagonal "coherences" that make it all possible.</p>`,
    math: `<span class="eq">S = −λ₁² log₂ λ₁² − λ₂² log₂ λ₂²</span>
      <span class="eq">C = 2λ₁λ₂ = 2|ad − bc|  for  a|00⟩ + b|01⟩ + c|10⟩ + d|11⟩</span>
      <span class="eq">|r_A| = |r_B| = λ₁² − λ₂² = √(1 − C²)</span>`,
  },
  {
    title: 'Noise hides entanglement',
    preset: { family: 'werner', p: 0.8 },
    focus: ['Concurrence and friends', 'The density matrix ρ', 'Weights'],
    html: ({ settings }) => `<p>Mix the Bell pair with random noise: ρ = p|Φ⁺⟩⟨Φ⁺| + (1 − p)I/4, here p = ${fmt(settings.p)}. Outcomes are still correlated, but is it still entangled?</p>
      <p>The <b>concurrence</b> (Wootters' formula) answers: C = max(0, (3p − 1)/2). Below p = 1/3 the state is a mixture of product states, even though it still shows correlations. The <b>negativity</b> (from the partial transpose) gives the same verdict.</p>`,
    math: `For mixed states the entropy no longer measures entanglement (noise adds entropy too). Wootters' concurrence:
      <span class="eq">C = max(0, l₁ − l₂ − l₃ − l₄)</span>
      where lᵢ are the square roots, largest first, of the eigenvalues of ρ ρ̃ with ρ̃ = (Y⊗Y) ρ* (Y⊗Y). Peres–Horodecki: a two-qubit state is entangled exactly when its partial transpose has a negative eigenvalue.`,
    predict: {
      q: 'At p = 0.3 the outcomes are still correlated. Is the state entangled?',
      options: ['Yes, any correlation means entanglement', 'No, it is separable below p = 1/3', 'Only in the x basis', 'It depends on the measurement'],
      answer: 1,
      why: 'Classical mixtures of product states can be correlated too. The Werner state is entangled only for p > 1/3.',
    },
  },
  {
    title: 'Three qubits: GHZ',
    preset: { family: 'three', three: 'ghz' },
    html: `<p>(|000⟩ + |111⟩)/√2. Every qubit is maximally entangled with the other two (1 bit each), yet <b>no pair</b> is entangled on its own: every pairwise concurrence is zero.</p>
      <p>The entanglement belongs to all three together. Lose one qubit and the other two are left merely correlated.</p>`,
  },
  {
    title: 'Three qubits: W',
    preset: { family: 'three', three: 'w' },
    html: `<p>(|001⟩ + |010⟩ + |100⟩)/√3 spreads its entanglement over the pairs instead: each pair has C = 2/3, and each qubit has 0.918 bits with the rest.</p>
      <p>Entanglement can't be shared freely: the more A is entangled with B, the less it can be with C. That is <b>monogamy</b>, the subject of a later lesson.</p>`,
  },
  {
    title: 'Your turn',
    preset: { family: 'pure', theta: 1.2, a: 0, b: 0 },
    html: `<p>Explore any of the three families in <b>Try it</b>. Every circuit lesson and the circuit sandbox now has an <b>Entanglement</b> view too (fold it open under the Bloch spheres), showing the same measures for whatever circuit you build.</p>`,
  },
];

runLesson({
  slug: 'entanglement-measures',
  settings: { family: 'pure', theta: 0, a: 0.7, b: -1.1, p: 0.8, three: 'ghz' },
  controls: [
    { id: 'family', label: 'State', type: 'choice', options: [['pure', 'Two qubits'], ['werner', 'Noisy Bell pair'], ['three', 'Three qubits']] },
    { id: 'theta', label: 'Entangling angle θ', type: 'range', min: 0, max: Math.PI, step: Math.PI / 72, format: deg, show: (s) => s.family === 'pure' },
    { id: 'a', label: 'Local turn on A', type: 'range', min: -Math.PI, max: Math.PI, step: Math.PI / 36, format: angleLabel, show: (s) => s.family === 'pure' },
    { id: 'b', label: 'Local turn on B', type: 'range', min: -Math.PI, max: Math.PI, step: Math.PI / 36, format: angleLabel, show: (s) => s.family === 'pure' },
    { id: 'p', label: 'Bell-pair fraction p', type: 'range', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2), show: (s) => s.family === 'werner', hint: 'The rest is completely random noise.' },
    { id: 'three', label: 'Three-qubit state', type: 'choice', options: [['ghz', 'GHZ'], ['w', 'W']], show: (s) => s.family === 'three' },
  ],
  cards: [
    { id: 'spheres', title: 'Each qubit on its own', legend: 'shorter arrow = more entangled', kind: 'html' },
    { id: 'measures', title: 'Concurrence and friends', kind: 'html' },
    { id: 'weights', title: 'Weights', legend: 'Schmidt weights λ² (pure) or eigenvalues of ρ (mixed)', height: 200 },
    { id: 'density', title: 'The density matrix ρ', legend: 'disc size = |ρᵢⱼ|, colour = phase', height: 300 },
  ],
  steps: STEPS,
  compute: (s) => build(s),
  draw(api) {
    drawSpheres(api);
    readout(api);
    drawWeights(api);
    drawMatrix(api.canvas('density'), { theme: api.theme, re: api.model.rho.re, im: api.model.rho.im, dim: api.model.rho.dim });
  },
});
