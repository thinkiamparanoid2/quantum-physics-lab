import { boundEnergy, boundState, doubleDeltaLevels, doubleDeltaState, scattering, scatteringState } from '../lib/delta.js';
import { percent } from '../lib/format.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { drawPhaseWheel } from '../ui/dials.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { drawDensity } from '../ui/wave-plot.js';

// The delta potential: an infinitely thin, infinitely deep (or tall) spike. Everything here is in
// closed form (lib/delta.js); the tests check it against the grid solvers of lib/wave.js.

const XS = Float64Array.from({ length: 1201 }, (_, i) => -12 + i * 0.02);

function drawSpike(ctx, X, y0, y1, th, sign) {
  ctx.strokeStyle = th.text;
  ctx.fillStyle = th.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X, y0);
  ctx.lineTo(X, y1);
  ctx.stroke();
  const dir = sign > 0 ? 1 : -1; // arrow head pointing down for an attractive well
  ctx.beginPath();
  ctx.moveTo(X, y1);
  ctx.lineTo(X - 5, y1 - 8 * dir);
  ctx.lineTo(X + 5, y1 - 8 * dir);
  ctx.closePath();
  ctx.fill();
}

function drawStates(api) {
  const { ctx, w, h } = prep(api.canvas('states'));
  const th = api.theme;
  const s = api.settings;
  const box = { x0: 52, y0: 16, x1: w - 14, y1: h - 28 };
  const X = xAxis(ctx, box, [-8, 8], th);
  if (s.mode === 'double') {
    const lv = doubleDeltaLevels(s.alpha, s.a);
    const Emin = lv.even.E * 1.25;
    const Y = yAxis(ctx, box, [Emin, 0.3 * Math.abs(Emin)], th);
    const zero = Y(0);
    ctx.strokeStyle = th.axis;
    ctx.beginPath();
    ctx.moveTo(box.x0, zero);
    ctx.lineTo(box.x1, zero);
    ctx.stroke();
    for (const c of [-s.a, s.a]) drawSpike(ctx, X(c), zero, box.y1 - 4, th, 1);
    const amp = (box.y1 - box.y0) * 0.22; // pixels for the largest |psi|
    for (const [parity, color] of [
      ['even', th.accent2],
      ['odd', th.marked],
    ]) {
      const st = doubleDeltaState(XS, s.alpha, s.a, parity);
      if (!st) continue;
      const y = Y(st.E);
      ctx.strokeStyle = withAlpha(color, 0.5);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(box.x0, y);
      ctx.lineTo(box.x1, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const peak = st.psi.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      XS.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), y - (st.psi[i] / peak) * amp));
      ctx.stroke();
      ctx.font = MONO;
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${parity} E = ${fmt(st.E, 3)}`, box.x1 - 4, y - 3);
    }
    if (!lv.odd) {
      ctx.font = FONT;
      ctx.fillStyle = th.muted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('no odd bound state: the spikes are too close (αa ≤ 1/2)', box.x0 + 6, box.y0);
    }
    return;
  }
  if (s.sign < 0) {
    // A repulsive spike: V >= 0 everywhere, so there is no bound state to draw.
    const Y = yAxis(ctx, box, [-1, 1], th);
    ctx.strokeStyle = th.axis;
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(0));
    ctx.lineTo(box.x1, Y(0));
    ctx.stroke();
    drawSpike(ctx, X(0), Y(0), box.y0 + 6, th, -1);
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('A repulsive spike has no bound state: the potential is never below zero.', (box.x0 + box.x1) / 2, Y(-0.5));
    return;
  }
  const E0 = boundEnergy(s.alpha);
  const Y = yAxis(ctx, box, [E0 * 1.4, Math.abs(E0) * 0.9], th);
  const zero = Y(0);
  ctx.strokeStyle = th.axis;
  ctx.beginPath();
  ctx.moveTo(box.x0, zero);
  ctx.lineTo(box.x1, zero);
  ctx.stroke();
  drawSpike(ctx, X(0), zero, box.y1 - 4, th, 1);
  const y = Y(E0);
  ctx.strokeStyle = withAlpha(th.marked, 0.6);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x0, y);
  ctx.lineTo(box.x1, y);
  ctx.stroke();
  ctx.setLineDash([]);
  const amp = (box.y1 - box.y0) * 0.35; // pixels at the peak, psi(0) = sqrt(alpha)
  ctx.strokeStyle = th.accent2;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  XS.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), y - (boundState(x, s.alpha) / Math.sqrt(s.alpha)) * amp));
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.marked;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`E = −α²/2 = ${fmt(E0, 3)}`, box.x1 - 4, y - 4);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.fillText(`size of the state 1/α = ${fmt(1 / s.alpha)}`, box.x0 + 6, box.y0 + 14);
}

function drawScatter(api) {
  const th = api.theme;
  const s = api.settings;
  const k = Math.sqrt(2 * s.E);
  const alpha = s.sign > 0 ? s.alpha : -s.alpha;
  const st = scatteringState(XS, k, alpha, api.t);
  drawDensity(api.canvas('wave'), { theme: th, x: XS, re: st.re, im: st.im, V: null, vRange: [0, 1], yMax: 4.4, xRange: [-8, 8] });
  const { ctx } = { ctx: api.canvas('wave').getContext('2d') };
  const w = api.canvas('wave').getBoundingClientRect().width;
  const h = api.canvas('wave').getBoundingClientRect().height;
  const X0 = 48 + ((0 + 8) / 16) * (w - 14 - 48);
  drawSpike(ctx, X0, 14, h - 30, th, s.sign);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('incoming + reflected', 54, 14);
  ctx.textAlign = 'right';
  ctx.fillText('transmitted', w - 20, 14);
}

function drawT(api) {
  const { ctx, w, h } = prep(api.canvas('T'));
  const th = api.theme;
  const s = api.settings;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const X = xAxis(ctx, box, [0, 4], th);
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 1; i <= 200; i++) {
    const E = (i / 200) * 4;
    (i > 1 ? ctx.lineTo : ctx.moveTo).call(ctx, X(E), Y(scattering(Math.sqrt(2 * E), s.alpha).T));
  }
  ctx.stroke();
  const T = scattering(Math.sqrt(2 * s.E), s.alpha).T;
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(X(s.E), Y(T), 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`T = ${percent(T)} at E = ${fmt(s.E)}`, X(s.E) + 10, Y(T) - 4);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.fillText('energy E', (box.x0 + box.x1) / 2, h);
}

const STEPS = [
  {
    title: 'A spike of zero width',
    preset: { mode: 'single', sign: 1, alpha: 1, E: 1 },
    focus: ['Bound states'],
    html: `<p>Imagine a well that is infinitely narrow and infinitely deep, with finite area α: V(x) = −α δ(x). It's the simplest model of a short-range attraction, like an electron caught by a defect.</p>
      <p>It holds exactly <b>one</b> bound state, ψ(x) = √α e^(−α|x|), with energy −α²/2. Notice the sharp <b>kink</b> at the spike.</p>`,
    math: `Integrate −½ψ″ − αδ(x)ψ = Eψ across x = 0: the kink is fixed by
      <span class="eq">ψ′(0⁺) − ψ′(0⁻) = −2α ψ(0)</span>
      Away from 0, ψ = e^(−κ|x|) with E = −κ²/2; the kink condition gives κ = α.`,
    predict: {
      q: 'The spike is made weaker (smaller α). What happens to the bound state?',
      options: ['It disappears at some α', 'It becomes shallower and much wider', 'It gets deeper', 'A second state appears'],
      answer: 1,
      why: 'E = −α²/2 → 0 and the size 1/α grows, but in 1D any attractive spike, however weak, keeps one bound state.',
    },
  },
  {
    title: 'Weak but never zero',
    preset: { mode: 'single', sign: 1, alpha: 0.4, E: 1 },
    focus: ['Bound states'],
    html: ({ settings }) => `<p>With α = ${fmt(settings.alpha)} the state is shallow (E = ${fmt(boundEnergy(settings.alpha), 3)}) and spread over a size 1/α = ${fmt(1 / settings.alpha)}. In one dimension <b>every</b> attractive potential has at least one bound state; in three dimensions a weak one need not.</p>`,
  },
  {
    title: 'Scattering off a spike',
    preset: { mode: 'single', sign: 1, alpha: 1, E: 0.3 },
    focus: ['A wave meets the spike', 'Transmission T(E)'],
    play: true,
    html: ({ settings }) => `<p>Send in a wave of energy E. Part reflects, part passes: T = 1/(1 + α²/2E), here ${percent(scattering(Math.sqrt(2 * settings.E), settings.alpha).T)}. Slow waves mostly bounce; fast waves barely notice the spike.</p>
      <p>On the left, the incoming and reflected waves beat against each other (the ripples in |ψ|²); on the right there is only a smooth transmitted wave.</p>`,
    math: `With t = ik/(ik + α) and r = t − 1:
      <span class="eq">T = |t|² = k²/(k² + α²) = 1/(1 + α²/2E),  R = α²/(k² + α²)</span>`,
  },
  {
    title: 'Attractive or repulsive: same T',
    preset: { mode: 'single', sign: -1, alpha: 1, E: 0.3 },
    focus: ['A wave meets the spike', 'Transmission T(E)'],
    play: true,
    html: `<p>Flip the spike upwards (a repulsive barrier, V = +αδ). Classically a well and a wall are opposites, but the transmission is exactly the same, because T depends only on α². Only the <b>phase</b> of the transmitted wave differs.</p>`,
    predict: {
      q: 'Does a repulsive spike have a bound state?',
      options: ['Yes, one', 'No', 'Yes, infinitely many', 'Only for large α'],
      answer: 1,
      why: 'A bound state needs E < 0 somewhere below the potential; with V ≥ 0 everywhere there is none.',
    },
  },
  {
    title: 'Two spikes: a toy molecule',
    preset: { mode: 'double', sign: 1, alpha: 1, a: 1.2 },
    focus: ['Bound states'],
    html: ({ settings }) => {
      const lv = doubleDeltaLevels(settings.alpha, settings.a);
      return `<p>Two spikes at ±a are a one-dimensional model of a molecule (like H₂⁺). The single level splits in two: an <b>even</b> state that piles up between the spikes (bonding) and an <b>odd</b> one with a node in the middle (antibonding).</p>
      <p>Here the splitting is ${fmt(lv.odd ? lv.odd.E - lv.even.E : NaN, 3)}. Bring the spikes closer and it grows; the odd state disappears altogether when αa ≤ 1/2.</p>`;
    },
    math: `Matching e^(−κ|x|) outside to cosh or sinh between the spikes:
      <span class="eq">even: κ(1 + tanh κa) = 2α,  odd: κ(1 + coth κa) = 2α</span>
      As a → ∞ both give κ → α, the single-spike state.`,
  },
  {
    title: 'Your turn',
    preset: { mode: 'single', sign: 1, alpha: 1.2, E: 1, a: 1 },
    html: `<p>Explore one spike or two, attractive or repulsive, and any energy.</p>`,
  },
];

runLesson({
  slug: 'delta-potential',
  settings: { mode: 'single', sign: 1, alpha: 1, E: 1, a: 1.2 },
  controls: [
    { id: 'mode', label: 'Potential', type: 'choice', options: [['single', 'One spike'], ['double', 'Two spikes']] },
    { id: 'sign', label: 'Spike', type: 'choice', options: [[1, 'Attractive'], [-1, 'Repulsive']], show: (s) => s.mode === 'single' },
    { id: 'alpha', label: 'Strength α', type: 'range', min: 0.2, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
    { id: 'E', label: 'Energy of the incoming wave', type: 'range', min: 0.05, max: 4, step: 0.05, format: (v) => v.toFixed(2), show: (s) => s.mode === 'single' },
    { id: 'a', label: 'Half-separation a', type: 'range', min: 0.1, max: 3, step: 0.05, format: (v) => v.toFixed(2), show: (s) => s.mode === 'double' },
  ],
  cards: [
    { id: 'states', title: 'Bound states', legend: 'wavefunctions drawn at their energies', height: 260 },
    { id: 'wave', title: 'A wave meets the spike', legend: '<canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> |ψ|², colour = phase', height: 220 },
    { id: 'T', title: 'Transmission T(E)', legend: 'exact', height: 200 },
  ],
  steps: STEPS,
  player: { duration: () => 40, speed: 2 },
  draw(api) {
    const wheel = document.querySelector('.phase-wheel');
    if (wheel) drawPhaseWheel(wheel);
    drawStates(api);
    drawScatter(api);
    drawT(api);
  },
});
