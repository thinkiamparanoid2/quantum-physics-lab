import { dimOf, mOf, spinMatrices, tiltedProbabilities } from '../lib/angular.js';
import { percent } from '../lib/format.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Angular momentum as operators: quantised Jz, the vector model, ladder operators, and measuring a
// spin-j along a tilted axis. Matrices and probabilities come from lib/angular.js, where tests
// check the commutators, J² and the rotations against Wigner's formula.

const half = (v) => (Number.isInteger(v) ? String(v) : `${Math.round(v * 2)}/2`).replace('-', '−');
const mAt = (s) => mOf(s.j, Math.min(s.k, dimOf(s.j) - 1));
const deg = (v) => `${Math.round((v * 180) / Math.PI)}°`;

function drawCone(api) {
  const { ctx, w, h } = prep(api.canvas('cone'));
  const th = api.theme;
  const { j } = api.settings;
  const m = mAt(api.settings);
  const L = Math.sqrt(j * (j + 1));
  const scale = Math.min(w * 0.36, h * 0.4) / Math.max(L, 1);
  const cx = w / 2;
  const cy = h / 2 + 10;
  // simple oblique projection: x to the right, y into the screen (foreshortened), z up
  const P = ([x, y, z]) => [cx + scale * (x + 0.35 * y), cy - scale * (z + 0.25 * y)];
  // z axis
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(...P([0, 0, -L * 1.15]));
  ctx.lineTo(...P([0, 0, L * 1.15]));
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.fillText('z', ...P([0.05, 0, L * 1.15]));
  // every allowed m as a faint cone, the chosen one bright
  for (let k = 0; k < dimOf(j); k++) {
    const mm = mOf(j, k);
    const r = Math.sqrt(Math.max(0, L * L - mm * mm));
    const on = Math.abs(mm - m) < 1e-9;
    ctx.strokeStyle = on ? th.accent2 : withAlpha(th.muted, 0.28);
    ctx.lineWidth = on ? 2 : 1;
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * 2 * Math.PI;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, ...P([r * Math.cos(a), r * Math.sin(a), mm]));
    }
    ctx.stroke();
    ctx.fillStyle = on ? th.accent2 : th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const [lx, ly] = P([-r, 0, mm]);
    ctx.fillText(`m = ${half(mm)}`, lx - 8, ly);
  }
  // the vector itself, precessing (its x and y are never known together)
  const r = Math.sqrt(Math.max(0, L * L - m * m));
  const a = api.t * 1.4;
  const tip = P([r * Math.cos(a), r * Math.sin(a), m]);
  ctx.strokeStyle = withAlpha(th.accent2, 0.35);
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(...P([0, 0, 0]));
  ctx.lineTo(...P([0, 0, m]));
  ctx.lineTo(...tip);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(...P([0, 0, 0]));
  ctx.lineTo(...tip);
  ctx.stroke();
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(tip[0], tip[1], 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`|J| = √(j(j+1)) = ${fmt(L, 3)}   ·   Jz = m = ${half(m)}`, 8, 6);
  ctx.fillText(`ΔJx = ΔJy = √((j(j+1) − m²)/2) = ${fmt(Math.sqrt((L * L - m * m) / 2), 3)}`, 8, 22);
}

function drawLadder(api) {
  const { ctx, w, h } = prep(api.canvas('ladder'));
  const th = api.theme;
  const { j } = api.settings;
  const m = mAt(api.settings);
  const d = dimOf(j);
  const top = 20;
  const bottom = h - 20;
  const Y = (mm) => top + ((j - mm) / Math.max(1, 2 * j)) * (bottom - top);
  const x0 = w * 0.28;
  const x1 = w * 0.62;
  for (let k = 0; k < d; k++) {
    const mm = mOf(j, k);
    const on = Math.abs(mm - m) < 1e-9;
    ctx.strokeStyle = on ? th.accent2 : th.axis;
    ctx.lineWidth = on ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, Y(mm));
    ctx.lineTo(x1, Y(mm));
    ctx.stroke();
    ctx.font = MONO;
    ctx.fillStyle = on ? th.accent2 : th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`|${half(j)}, ${half(mm)}⟩`, x0 - 10, Y(mm));
  }
  // J+ and J- from the chosen rung
  const up = Math.sqrt(j * (j + 1) - m * (m + 1));
  const down = Math.sqrt(j * (j + 1) - m * (m - 1));
  const arrow = (xa, ya, yb, color, label) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xa, ya);
    ctx.lineTo(xa, yb);
    ctx.stroke();
    const dir = yb < ya ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(xa, yb);
    ctx.lineTo(xa - 5, yb + 8 * dir);
    ctx.lineTo(xa + 5, yb + 8 * dir);
    ctx.closePath();
    ctx.fill();
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, xa + 10, (ya + yb) / 2);
  };
  const gap = (bottom - top) / Math.max(1, 2 * j);
  if (up > 1e-9) arrow(x1 - 30, Y(m) - 4, Y(m + 1) + 4, th.marked, `J₊ × ${fmt(up, 3)}`);
  else {
    ctx.font = FONT;
    ctx.fillStyle = th.marked;
    ctx.textAlign = 'left';
    ctx.fillText('J₊ gives 0: top rung', x1 + 8, Y(m) - gap * 0.3);
  }
  if (down > 1e-9) arrow(x1 + 40, Y(m) + 4, Y(m - 1) - 4, th.ampNeg, `J₋ × ${fmt(down, 3)}`);
  else {
    ctx.font = FONT;
    ctx.fillStyle = th.ampNeg;
    ctx.textAlign = 'left';
    ctx.fillText('J₋ gives 0: bottom rung', x1 + 8, Y(m) + gap * 0.3);
  }
}

function drawMagnet(api) {
  const { ctx, w, h } = prep(api.canvas('sg'));
  const th = api.theme;
  const { j, beta } = api.settings;
  const p = tiltedProbabilities(j, beta);
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const slot = (box.x1 - box.x0) / p.length;
  const bw = Math.min(56, slot * 0.6);
  p.forEach((v, k) => {
    const cx = box.x0 + (k + 0.5) * slot;
    ctx.fillStyle = th.accent2;
    ctx.fillRect(cx - bw / 2, Y(v), bw, box.y1 - Y(v));
    ctx.font = MONO;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(percent(v), cx, Y(v) - 2);
    ctx.fillStyle = th.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(`m′ = ${half(mOf(j, k))}`, cx, box.y1 + 6);
  });
}

function matrices(api) {
  const { j } = api.settings;
  const { d, Jz, Jp } = spinMatrices(j);
  if (d > 5) {
    api.el('mats').innerHTML = '<p class="hint">For j > 2 the matrices are large; Jz is diagonal (j, …, −j) and J₊ has its numbers just above the diagonal.</p>';
    return;
  }
  const table = (M) =>
    `<table class="mini-matrix">${Array.from({ length: d }, (_, r) => `<tr>${Array.from({ length: d }, (_, c) => `<td>${fmt(M.re[r * d + c], 2).replace(/\.00$/, '').replace(/^−?0$/, '0')}</td>`).join('')}</tr>`).join('')}</table>`;
  api.el('mats').innerHTML = `<div class="kraus-row"><div><span class="label">Jz</span>${table(Jz)}</div><div><span class="label">J₊</span>${table(Jp)}</div></div>
    <p class="hint">Rows and columns are m = ${half(j)}, …, ${half(-j)}. Jx = (J₊ + J₋)/2 and Jy = (J₊ − J₋)/2i; the tests check [Jx, Jy] = iJz and J² = j(j+1) for every j here.</p>`;
}

const STEPS = [
  {
    title: 'Angular momentum comes in steps',
    preset: { j: 1, k: 0, beta: 0 },
    focus: ['The vector model', 'Ladder of states'],
    play: true,
    html: `<p>Measure the z component of an angular momentum and you only ever get <b>Jz = mħ</b>, with m running in whole steps from −j to j: 2j + 1 values. For j = 1 that's m = 1, 0, −1.</p>
      <p>The length is √(j(j+1))ħ, which is always more than jħ, so the vector can never point exactly along z.</p>`,
  },
  {
    title: 'The other components are fuzzy',
    preset: { j: 1, k: 0, beta: 0 },
    focus: ['The vector model'],
    play: true,
    html: `<p>The components don't commute: [Jx, Jy] = iħJz. In a state with definite Jz, Jx and Jy are uncertain. The <b>vector model</b> pictures this as the vector lying somewhere on a cone with its x and y unknown (the precession is only a picture, not a motion).</p>`,
    math: `<span class="eq">[Jx, Jy] = iħJz  (and cyclic),  [J², Jz] = 0</span>
      In |j, m⟩: ⟨Jx²⟩ = ⟨Jy²⟩ = (j(j+1) − m²)ħ²/2, never zero for j > 0.`,
    predict: {
      q: 'In the state m = j (the top of the ladder), is the uncertainty in Jx zero?',
      options: ['Yes, the vector points along z', 'No: (j(j+1) − j²)/2 = j/2 > 0', 'Only for spin ½', 'It is infinite'],
      answer: 1,
      why: 'Even the most aligned state keeps ⟨Jx²⟩ = jħ²/2; that is why |J| exceeds jħ.',
    },
  },
  {
    title: 'Climbing the ladder',
    preset: { j: 2, k: 2, beta: 0 },
    focus: ['Ladder of states', 'The operators as matrices'],
    html: ({ settings }) => `<p>The <b>ladder operators</b> J± = Jx ± iJy move one rung up or down without changing j: J₊|j, m⟩ = √(j(j+1) − m(m+1)) |j, m+1⟩. Here j = ${half(settings.j)} and m = ${half(mAt(settings))}.</p>
      <p>At the top rung J₊ gives zero, and that is how the whole ladder, and the rule m = −j … j, is derived without any wavefunctions.</p>`,
  },
  {
    title: 'Half-integer j: spin',
    preset: { j: 0.5, k: 0, beta: 0 },
    focus: ['Ladder of states', 'The operators as matrices', 'The vector model'],
    html: `<p>The algebra allows j = ½, 3/2, … as well as whole numbers. Orbital angular momentum only uses whole numbers (its wavefunction must be single-valued around the z axis), but electrons, protons and neutrons carry an intrinsic <b>spin ½</b>: two states, the qubit of the Stern–Gerlach experiment.</p>
      <p>For j = ½ the matrices are ħ/2 times the Pauli matrices.</p>`,
  },
  {
    title: 'Tilt the magnet',
    preset: { j: 1, k: 0, beta: Math.PI / 3 },
    focus: ['A tilted Stern–Gerlach magnet', 'The vector model'],
    html: ({ settings }) => `<p>Prepare |j, j⟩ (as aligned with z as possible) and measure along an axis tilted by ${deg(settings.beta)}. A spin-j particle gives 2j + 1 beams, with probabilities |d^j_{m′j}(β)|² from the rotation matrix.</p>
      <p>For spin ½ this is the cos²(β/2) of the Stern–Gerlach lesson.</p>`,
    math: `<span class="eq">P(m′) = |⟨j, m′| e^(−iβJy) |j, j⟩|² = C(2j, j−m′) cos^(2(j+m′))(β/2) sin^(2(j−m′))(β/2)</span>
      a binomial distribution: a spin j behaves like 2j aligned spin-½ particles.`,
  },
  {
    title: 'Large j looks classical',
    preset: { j: 5, k: 0, beta: Math.PI / 3 },
    focus: ['A tilted Stern–Gerlach magnet'],
    html: `<p>For j = 5 the probabilities bunch around m′ ≈ j cos β, the classical projection of an arrow tilted by β, with a width that shrinks relative to j as j grows. The relative fuzziness of the cone, ΔJ/|J| ~ 1/√j, is the quantum part that fades.</p>`,
  },
  {
    title: 'Your turn',
    preset: { j: 1.5, k: 1, beta: 1 },
    html: `<p>Pick any j, any rung and any tilt.</p>`,
  },
];

runLesson({
  slug: 'angular-momentum',
  settings: { j: 1, k: 0, beta: 0 },
  controls: [
    { id: 'j', label: 'j', type: 'choice', options: [[0.5, '½'], [1, '1'], [1.5, '3/2'], [2, '2'], [5, '5']] },
    { id: 'k', label: 'Rung m', type: 'range', min: 0, max: 10, step: 1, format: (v, s) => half(mOf(s.j, Math.min(v, dimOf(s.j) - 1))), hint: 'From the top rung (m = j) down.' },
    { id: 'beta', label: 'Magnet tilt β', type: 'range', min: 0, max: Math.PI, step: Math.PI / 72, format: deg },
  ],
  cards: [
    { id: 'cone', title: 'The vector model', legend: 'cones of fixed Jz', height: 300 },
    { id: 'ladder', title: 'Ladder of states', legend: 'J₊ up, J₋ down', height: 230 },
    { id: 'sg', title: 'A tilted Stern–Gerlach magnet', legend: 'probability of each beam for |j, j⟩', height: 210 },
    { id: 'mats', title: 'The operators as matrices', kind: 'html', folded: true },
  ],
  steps: STEPS,
  player: { duration: () => 60, speed: 1 },
  draw(api) {
    drawCone(api);
    drawLadder(api);
    drawMagnet(api);
    matrices(api);
  },
});
