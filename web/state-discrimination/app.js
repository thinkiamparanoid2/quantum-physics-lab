import { seededRandom } from '../lib/circuit.js';
import { helstrom, helstromSuccess, ket, overlap, unambiguous } from '../lib/discrimination.js';
import { percent } from '../lib/format.js';
import { withAlpha } from '../ui/bloch.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Alice sends |ψ0⟩ or |ψ1⟩ (Bloch angles ∓δ/2 from +z, in the x-z plane); Bob gets one copy and
// must say which. Every probability comes from lib/discrimination.js; the tally is a simulation
// that samples those probabilities.

const deg = (v) => `${Math.round((v * 180) / Math.PI)}°`;
const angleOf = ([a, b]) => 2 * Math.atan2(b, a); // Bloch polar angle of a real ket

function model(s) {
  const t0 = -s.delta / 2;
  const t1 = s.delta / 2;
  const h = helstrom(t0, t1, s.q0);
  const u = unambiguous(t0, t1);
  const strategy = s.strategy === 'unambiguous' ? u : h;
  const priors = s.strategy === 'unambiguous' ? [0.5, 0.5] : [s.q0, 1 - s.q0];
  // Monte Carlo tally
  const rng = seededRandom(s.seed);
  const counts = [new Array(3).fill(0), new Array(3).fill(0)];
  for (let i = 0; i < s.shots; i++) {
    const k = rng() < priors[0] ? 0 : 1;
    let u0 = rng();
    let o = 0;
    while (o < strategy.table[k].length - 1 && u0 >= strategy.table[k][o]) u0 -= strategy.table[k][o++];
    counts[k][o]++;
  }
  return { t0, t1, h, u, strategy, priors, counts, s: overlap(t0, t1) };
}

function drawPlane(api) {
  const { ctx, w, h } = prep(api.canvas('plane'));
  const th = api.theme;
  const m = api.model;
  const R = Math.min(w, h) / 2 - 40;
  const cx = w / 2;
  const cy = h / 2 + 4;
  const P = (t, r = 1) => [cx + R * r * Math.sin(t), cy - R * r * Math.cos(t)];
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [
    [0, '|0⟩'],
    [Math.PI, '|1⟩'],
    [Math.PI / 2, '|+⟩'],
    [-Math.PI / 2, '|−⟩'],
  ].forEach(([t, l]) => ctx.fillText(l, ...P(t, 1.16)));

  const arrow = (t, color, label, len = 1, width = 3) => {
    const [x, y] = P(t, len);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, width + 2, 0, 2 * Math.PI);
    ctx.fill();
    if (label) {
      ctx.font = `600 ${FONT}`;
      const [lx, ly] = P(t, len + 0.13);
      ctx.fillText(label, lx, ly);
    }
  };

  if (api.settings.strategy === 'helstrom') {
    // The measurement: two antipodal directions; the half-plane around each is "guess k".
    const a0 = angleOf(m.h.axes[0]);
    ctx.strokeStyle = withAlpha(th.marked, 0.9);
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(...P(a0, 1.05));
    ctx.lineTo(...P(a0 + Math.PI, 1.05));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.marked;
    ctx.font = FONT;
    ctx.fillText('guess ψ0', ...P(a0, 0.72));
    ctx.fillText('guess ψ1', ...P(a0 + Math.PI, 0.72));
  } else {
    // POVM elements E0 ∝ |ψ1⊥⟩⟨ψ1⊥| and E1 ∝ |ψ0⊥⟩⟨ψ0⊥|, drawn with length = weight 1/(1 + s).
    const wgt = 1 / (1 + m.s);
    arrow(m.t1 + Math.PI, withAlpha(th.accent2, 0.7), 'E₀: surely ψ0', wgt, 2);
    arrow(m.t0 + Math.PI, withAlpha(th.ampNeg, 0.7), 'E₁: surely ψ1', wgt, 2);
  }
  arrow(m.t0, th.accent2, 'ψ0');
  arrow(m.t1, th.ampNeg, 'ψ1');
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`overlap |⟨ψ0|ψ1⟩| = cos(δ/2) = ${fmt(m.s, 3)}`, 10, 6);
}

function drawOutcomes(api) {
  const { ctx, w, h } = prep(api.canvas('outcomes'));
  const th = api.theme;
  const { strategy } = api.model;
  const names = api.settings.strategy === 'unambiguous' ? ['says ψ0', 'says ψ1', "don't know"] : ['guess ψ0', 'guess ψ1'];
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const groups = names.length;
  const slot = (box.x1 - box.x0) / groups;
  const bw = Math.min(46, slot * 0.3);
  names.forEach((name, o) => {
    const cx = box.x0 + (o + 0.5) * slot;
    [0, 1].forEach((k) => {
      const v = strategy.table[k][o];
      const x = cx + (k === 0 ? -bw - 2 : 2);
      ctx.fillStyle = k === 0 ? th.accent2 : th.ampNeg;
      ctx.fillRect(x, Y(v), bw, box.y1 - Y(v));
      ctx.font = MONO;
      ctx.fillStyle = th.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(percent(v), x + bw / 2, Y(v) - 2);
    });
    ctx.fillStyle = th.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(name, cx, box.y1 + 7);
  });
}

function drawCurve(api) {
  const { ctx, w, h } = prep(api.canvas('curve'));
  const th = api.theme;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const X = xAxis(ctx, box, [0, 1], th);
  const line = (f, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const s = i / 200;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(s), Y(f(s)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line((s) => helstromSuccess(s, 0.5), th.accent2);
  line((s) => 1 - s, th.marked, [6, 4]);
  line(() => 0.5, withAlpha(th.muted, 0.6), [2, 4]);
  const s = api.model.s;
  ctx.strokeStyle = th.cursor;
  ctx.beginPath();
  ctx.moveTo(X(s), box.y0);
  ctx.lineTo(X(s), box.y1);
  ctx.stroke();
  // Label each curve beside itself, on a halo so the other curve can't run through the text.
  const label = (text, x, y, color) => {
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = th.surfaceSolid;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  label('best guess (Helstrom): right this often', X(0.38), Y(helstromSuccess(0.38)) - 14, th.accent2);
  label('never wrong: conclusive this often', X(0.5), Y(0.5) + 14, th.marked);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('overlap |⟨ψ0|ψ1⟩|', (box.x0 + box.x1) / 2, h);
}

function tally(api) {
  const { counts, strategy } = api.model;
  const unamb = api.settings.strategy === 'unambiguous';
  const total = counts[0].reduce((a, b) => a + b, 0) + counts[1].reduce((a, b) => a + b, 0);
  const right = counts[0][0] + counts[1][1];
  const wrong = counts[0][1] + counts[1][0];
  const unsure = counts[0][2] + counts[1][2];
  const expected = unamb ? 1 - api.model.s : api.model.priors[0] * strategy.table[0][0] + api.model.priors[1] * strategy.table[1][1];
  const row = (k) => `<tr><th scope="row">sent ψ${k}</th><td>${counts[k][0]}</td><td>${counts[k][1]}</td>${unamb ? `<td>${counts[k][2]}</td>` : ''}</tr>`;
  api.el('shots').innerHTML = `<table class="tally"><thead><tr><th></th><th>${unamb ? 'says ψ0' : 'guess ψ0'}</th><th>${unamb ? 'says ψ1' : 'guess ψ1'}</th>${unamb ? "<th>don't know</th>" : ''}</tr></thead>
    <tbody>${row(0)}${row(1)}</tbody></table>
    <p class="hint">${total} photons: right <b>${percent(right / total)}</b> (theory ${percent(expected)}), wrong <b>${percent(wrong / total)}</b>${unamb ? `, don't know <b>${percent(unsure / total)}</b>` : ''}.</p>`;
}

function neumark(api) {
  const box = api.el('neumark');
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div><p class="hint">U turns qubit + ancilla so that ψ0 and ψ1 land on |0⟩ and |1⟩ when the ancilla reads 0, and on the same state when it reads 1 ("don\'t know"). A three-outcome measurement on one qubit is an ordinary measurement on two.</p>';
  drawCircuit(box.querySelector('.circuit-scroll'), {
    n: 2,
    labels: ['qubit', 'ancilla'],
    applied: 3,
    ops: [
      { gate: 'BLOCK', targets: [0, 1], label: 'U', apply: () => {} },
      { gate: 'MEASURE', target: 1, bit: 1 },
      { gate: 'MEASURE', target: 0, bit: 0 },
    ],
  });
}

const STEPS = [
  {
    title: 'Two states, one copy',
    preset: { delta: Math.PI, strategy: 'helstrom', q0: 0.5 },
    html: `<p>Alice sends Bob one qubit, either |ψ0⟩ or |ψ1⟩, at random. Bob must say which. Here the two are opposite on the Bloch sphere (orthogonal, overlap 0), and measuring along their axis tells them apart <b>every time</b>.</p>`,
    predict: {
      q: 'Now the two states are only 60° apart on the Bloch sphere. What is the best possible chance of naming the right one?',
      options: ['100% with the right measurement', '75%', '93%', '50%: it’s a pure guess'],
      answer: 1,
      why: 'The overlap is cos 30° ≈ 0.87, and Helstrom’s bound gives ½(1 + √(1 − 0.75)) = 75%.',
    },
  },
  {
    title: 'The best guess: Helstrom',
    preset: { delta: Math.PI / 3, strategy: 'helstrom', q0: 0.5 },
    html: ({ model }) => `<p>Non-orthogonal states can't be told apart for sure. The best Bob can do is the <b>Helstrom measurement</b>: measure along the dashed axis and guess the state on that side. It's right ${percent(model.h.success)} of the time.</p>
      <p>The tally sends 400 photons and checks Bob's guesses against what Alice really sent.</p>`,
    math: `For priors q₀, q₁ the minimum error is reached by measuring in the eigenbasis of q₀ρ₀ − q₁ρ₁:
      <span class="eq">P(right) = ½(1 + √(1 − 4q₀q₁|⟨ψ₀|ψ₁⟩|²))</span>`,
  },
  {
    title: 'Closer states, more mistakes',
    preset: { delta: Math.PI / 6, strategy: 'helstrom', q0: 0.5 },
    html: ({ model }) => `<p>At 30° apart the overlap is ${fmt(model.s, 3)} and the best guess is right only ${percent(model.h.success)} of the time. As the overlap tends to 1 the states become identical and Bob is left with a coin flip (the dotted 50% line).</p>`,
  },
  {
    title: 'When one state is more likely',
    preset: { delta: Math.PI / 3, strategy: 'helstrom', q0: 0.85 },
    html: ({ model }) => `<p>If Alice sends ψ0 85% of the time, the best measurement tilts towards ψ1: Bob should only say "ψ1" when the evidence is strong. Success rises to ${percent(model.h.success)}, from 85% for always guessing ψ0.</p>`,
  },
  {
    title: 'Never wrong, sometimes unsure',
    preset: { delta: (2 * Math.PI) / 3, strategy: 'unambiguous', q0: 0.5 },
    focus: ['The two states and the measurement', 'Outcome probabilities', 'Send photons', 'Best guess or never wrong?'],
    html: ({ model }) => `<p>A different goal: never be wrong, at the price of sometimes saying "don't know". Bob uses three outcomes. "Surely ψ0" fires only on the part of the state orthogonal to ψ1, so it can never fire for ψ1, and vice versa.</p>
      <p>He is conclusive with probability 1 − overlap = ${percent(model.u.conclusive)}, and in the tally he is never wrong.</p>`,
  },
  {
    title: 'Three outcomes from one qubit?',
    preset: { delta: (2 * Math.PI) / 3, strategy: 'unambiguous', q0: 0.5 },
    focus: ['A POVM is a measurement on a bigger system', 'The two states and the measurement'],
    html: `<p>A projective measurement on a qubit has only two outcomes. Three-outcome measurements, <b>POVMs</b>, are ordinary measurements on the qubit plus an extra qubit (an ancilla), after a joint unitary U (Neumark's theorem).</p>
      <p>The test suite builds that U and checks the circuit gives exactly the POVM's probabilities.</p>`,
    math: `A POVM is a set of positive operators with Σ Eₖ = I, and P(k) = ⟨ψ|Eₖ|ψ⟩. Here
      <span class="eq">E₀ = |ψ₁⊥⟩⟨ψ₁⊥|/(1 + s),  E₁ = |ψ₀⊥⟩⟨ψ₀⊥|/(1 + s),  E? = I − E₀ − E₁</span>
      with s = |⟨ψ₀|ψ₁⟩|, so P(conclusive) = 1 − s (Ivanovic–Dieks–Peres).`,
  },
  {
    title: 'Why it matters',
    preset: { delta: Math.PI / 2, strategy: 'unambiguous', q0: 0.5 },
    html: `<p>If non-orthogonal states could be told apart perfectly, you could copy them: identify, then prepare two. So the limits on this page are the <b>no-cloning theorem</b> in action.</p>
      <p>They also secure quantum key distribution: the B92 protocol uses just two non-orthogonal states, and an eavesdropper's unambiguous measurement fails often enough to be noticed.</p>`,
  },
  {
    title: 'Your turn',
    preset: { delta: Math.PI / 2, strategy: 'helstrom', q0: 0.5 },
    html: `<p>Change the angle between the states, the strategy and the priors, and send more photons. Compare the two strategies at the same overlap on the bottom chart.</p>`,
  },
];

runLesson({
  slug: 'state-discrimination',
  settings: { delta: Math.PI, strategy: 'helstrom', q0: 0.5, shots: 400, seed: 1 },
  controls: [
    { id: 'strategy', label: 'Bob’s goal', type: 'choice', options: [['helstrom', 'Best guess'], ['unambiguous', 'Never wrong']] },
    { id: 'delta', label: 'Angle between the states (Bloch sphere)', type: 'range', min: 0.05, max: Math.PI, step: Math.PI / 72, format: deg },
    { id: 'q0', label: 'Chance Alice sends ψ0', type: 'range', min: 0.05, max: 0.95, step: 0.01, format: (v) => v.toFixed(2), show: (s) => s.strategy === 'helstrom' },
    { type: 'button', label: 'Send 400 more', primary: true, onClick: (api) => api.set({ seed: api.settings.seed + 1 }) },
  ],
  cards: [
    { id: 'plane', title: 'The two states and the measurement', legend: 'x-z plane of the Bloch sphere', height: 340 },
    { id: 'outcomes', title: 'Outcome probabilities', legend: '<span class="key block positive"></span> sent ψ0 <span class="key block negative"></span> sent ψ1', height: 220 },
    { id: 'shots', title: 'Send photons', kind: 'html' },
    { id: 'curve', title: 'Best guess or never wrong?', legend: 'against the overlap', height: 220 },
    { id: 'neumark', title: 'A POVM is a measurement on a bigger system', kind: 'html', folded: true },
  ],
  steps: STEPS,
  compute: model,
  draw(api) {
    drawPlane(api);
    drawOutcomes(api);
    tally(api);
    drawCurve(api);
    neumark(api);
  },
});
