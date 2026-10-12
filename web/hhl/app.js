import { runHHL } from '../lib/hhl.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, prep } from '../ui/charts.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// The HHL algorithm on a 2 × 2 system, simulated gate by gate (lib/hhl.js): phase estimation, an
// eigenvalue-dependent rotation, uncomputation and postselection. The tests check the output against
// A⁻¹b and the success probability against C²‖A⁻¹b‖².

const compute = (s) => runHHL({ l1: s.l1, l2: s.l2, phi: s.phi, beta: s.beta, c: s.c });

function circuitHtml(api) {
  const box = api.el('circuit');
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div><p class="hint"></p>';
  const { circ } = api.model;
  const s = api.settings;
  const labels = ['system |b⟩', ...circ.clock.map((q, i) => `clock ${i}`), 'ancilla'];
  drawCircuit(box.querySelector('.circuit-scroll'), { n: circ.n, ops: circ.ops, applied: circ.ops.length, labels });
  box.querySelector('.hint').textContent = `Prepare |b⟩, estimate the eigenvalues of A into the ${s.c}-qubit clock (U = e^{iAt}), rotate the ancilla by an angle that depends on 1/λ, run the estimation backwards, and keep the runs where the ancilla reads 1.`;
}

function drawAnswer(api) {
  const { ctx, w, h } = prep(api.canvas('answer'));
  const th = api.theme;
  const s = api.settings;
  const m = api.model;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const R = Math.min(w, h) * 0.36;
  ctx.strokeStyle = withAlpha(th.muted, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - R - 10, cy);
  ctx.lineTo(cx + R + 10, cy);
  ctx.moveTo(cx, cy - R - 10);
  ctx.lineTo(cx, cy + R + 10);
  ctx.stroke();
  // eigenvector directions
  ctx.strokeStyle = withAlpha(th.muted, 0.35);
  ctx.setLineDash([3, 4]);
  for (const a of [s.phi, s.phi + Math.PI / 2]) {
    ctx.beginPath();
    ctx.moveTo(cx - R * Math.cos(a), cy + R * Math.sin(a));
    ctx.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const arrow = (v, color, width, label, dash = []) => {
    const [x, y] = [cx + R * v[0], cy - R * v[1]];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = FONT;
    ctx.textAlign = v[0] >= 0 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + (v[0] >= 0 ? 10 : -10), y);
  };
  arrow([Math.cos(s.beta), Math.sin(s.beta)], th.muted, 2, '|b⟩');
  const same = m.fidelity > 0.99995;
  arrow(m.exact, th.marked, 3, same ? '' : 'A⁻¹b (exact)', [6, 4]);
  arrow(m.x, th.accent2, 2.5, same ? 'HHL output = A⁻¹b' : 'HHL output');
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('the system qubit’s state as a real 2-vector (dashed lines: eigenvectors of A)', 8, 4);
}

function readout(api) {
  const s = api.settings;
  const m = api.model;
  const kappa = Math.max(s.l1, s.l2) / Math.min(s.l1, s.l2);
  api.el('readout').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Eigenvalues λ₁, λ₂</span><b>${fmt(s.l1, 2)}, ${fmt(s.l2, 2)}</b></div>
      <div class="stat"><span>Condition number κ</span><b>${fmt(kappa, 2)}</b></div>
      <div class="stat"><span>Success probability</span><b>${fmt(m.success, 3)}</b></div>
      <div class="stat"><span>Fidelity with A⁻¹b</span><b>${m.fidelity > 0.99995 ? '100%' : `${fmt(100 * m.fidelity, 3)}%`}</b></div></div>
    <p class="hint">${Number.isInteger(s.l1) && Number.isInteger(s.l2) && Math.max(s.l1, s.l2) < 2 ** s.c ? `Both eigenvalues are whole numbers below 2^${s.c}, so the ${s.c}-qubit clock reads them exactly and the answer is exact.` : `An eigenvalue is not a whole number below 2^${s.c}: phase estimation blurs it over neighbouring clock values and the answer is slightly off. More clock qubits sharpen it.`} On average 1/${fmt(m.success, 3)} ≈ ${fmt(1 / m.success, 1)} runs give one success.</p>`;
}

const CAVEATS = [
  ['Loading b', 'The input |b⟩ must be prepared quickly, for example from a quantum RAM. For general data, loading N numbers already takes about N steps, which would erase the speed-up.'],
  ['The matrix', 'A must be sparse (or have another efficient description) and well-conditioned: the cost grows with κ, and with the precision needed.'],
  ['The output', 'The answer is a quantum state, not the vector x. Reading out all N entries needs about N runs. HHL helps only when a few numbers about x are wanted, such as an expectation value ⟨x|M|x⟩.'],
  ['Classical competition', 'For low-rank matrices with sampling access, classical "dequantised" algorithms match the quantum scaling up to polynomial factors (Tang 2019; Chia et al. 2020).'],
];

function caveatsHtml(api) {
  api.el('caveats').innerHTML = `<table class="tally evidence"><thead><tr><th>fine print</th><th>what it means</th></tr></thead><tbody>
    ${CAVEATS.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>
    <p class="hint">After Aaronson, "Read the fine print" (Nature Physics, 2015). Modern algorithms for linear systems reach the optimal scaling, linear in κ and logarithmic in 1/ε (Costa et al., PRX Quantum 2022).</p>`;
}

const STEPS = [
  {
    title: 'The promise',
    preset: { l1: 1, l2: 3, phi: 0.5, beta: 1.2, c: 3 },
    focus: ['The circuit'],
    html: `<p>Harrow, Hassidim and Lloyd (2009) gave a quantum algorithm for linear systems A x = b that runs in time growing like log N in the size N of the system, where classical methods need time at least proportional to N. An exponential speed-up for one of the most common tasks in science, with conditions attached. Here is the whole algorithm on a 2 × 2 system.</p>`,
  },
  {
    title: 'Inverting eigenvalues',
    preset: { l1: 1, l2: 3, phi: 0.5, beta: 1.2, c: 3 },
    focus: ['The circuit'],
    html: `<p>Write |b⟩ in A's eigenvectors: |b⟩ = Σ βⱼ|uⱼ⟩. Phase estimation writes each eigenvalue λⱼ into a clock register. A rotation of an extra ancilla, controlled by the clock, puts amplitude C/λⱼ on its |1⟩ state. Undo the phase estimation and keep only runs where the ancilla is 1: what remains is Σ βⱼ (C/λⱼ)|uⱼ⟩ ∝ A⁻¹|b⟩.</p>`,
    math: `<span class="eq">Σ βⱼ |uⱼ⟩|λⱼ⟩|0⟩ → Σ βⱼ |uⱼ⟩|λⱼ⟩ (√(1 − C²/λⱼ²)|0⟩ + (C/λⱼ)|1⟩) → (ancilla = 1) Σ βⱼ (C/λⱼ) |uⱼ⟩</span>
      Success probability C²‖A⁻¹b‖², checked in the tests together with the output state.`,
  },
  {
    title: 'It works',
    preset: { l1: 1, l2: 3, phi: 0.5, beta: 1.2, c: 3 },
    focus: ['The answer', 'Numbers'],
    html: `<p>With eigenvalues 1 and 3 the 3-qubit clock reads them exactly, and the output points exactly along A⁻¹b. Note how A⁻¹ stretches the component along the small-eigenvalue direction.</p>`,
  },
  {
    title: 'The condition number',
    preset: { l1: 1, l2: 7, phi: 0.5, beta: 1.2, c: 3 },
    focus: ['The answer', 'Numbers'],
    html: `<p>With eigenvalues 1 and 7 (condition number κ = 7) the rotation for λ = 7 puts only amplitude 1/7 on the ancilla's |1⟩: the large-eigenvalue part mostly fails. Success becomes rare when b lies along that direction, and in general the cost of HHL grows with κ (as κ² with naive repetition, κ with amplitude amplification).</p>`,
    predict: {
      q: 'Why can C not be larger than the smallest eigenvalue?',
      options: ['It would be too slow', 'C/λ is a rotation amplitude and must not exceed 1', 'It would change A', 'It can'],
      answer: 1,
      why: 'The ancilla gets amplitude C/λ on |1⟩, which must be at most 1 for every eigenvalue.',
    },
  },
  {
    title: 'When the clock can’t hold λ',
    preset: { l1: 1, l2: 2.5, phi: 0.5, beta: 1.2, c: 3 },
    focus: ['The answer', 'Numbers'],
    html: `<p>An eigenvalue of 2.5 falls between clock values. Phase estimation spreads it over neighbours, the inversion is slightly wrong, and the fidelity drops below 100%. More clock qubits fix it at the price of a deeper circuit: precision costs time.</p>`,
  },
  {
    title: 'The fine print',
    preset: { l1: 1, l2: 3, phi: 0.5, beta: 1.2, c: 3 },
    focus: ['The fine print'],
    html: `<p>Each condition in the table can erase the speed-up. HHL is a genuine exponential speed-up for a carefully specified problem, and an important subroutine in quantum algorithms, but not a drop-in replacement for linear solvers on ordinary data.</p>`,
  },
  {
    title: 'Your turn',
    preset: { l1: 2, l2: 5, phi: 1, beta: 0.3, c: 3 },
    html: `<p>Change the eigenvalues, the direction of b and the clock size. When is the success probability highest? Can you make the answer exactly perpendicular to b?</p>`,
  },
];

runLesson({
  slug: 'hhl',
  settings: { l1: 1, l2: 3, phi: 0.5, beta: 1.2, c: 3 },
  controls: [
    { id: 'l1', label: 'Eigenvalue λ₁', type: 'range', min: 1, max: 4, step: 0.5, format: (v) => v.toFixed(1) },
    { id: 'l2', label: 'Eigenvalue λ₂', type: 'range', min: 1, max: 15, step: 0.5, format: (v) => v.toFixed(1) },
    { id: 'phi', label: 'Eigenvector angle', type: 'range', min: 0, max: Math.PI, step: 0.05, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    { id: 'beta', label: 'Direction of b', type: 'range', min: 0, max: Math.PI, step: 0.05, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    { id: 'c', label: 'Clock qubits', type: 'choice', options: [[2, '2'], [3, '3'], [4, '4']] },
  ],
  cards: [
    { id: 'circuit', title: 'The circuit', kind: 'html' },
    { id: 'answer', title: 'The answer', height: 300 },
    { id: 'readout', title: 'Numbers', kind: 'html' },
    { id: 'caveats', title: 'The fine print', kind: 'html', folded: true },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    circuitHtml(api);
    drawAnswer(api);
    readout(api);
    caveatsHtml(api);
  },
});
