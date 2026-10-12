import { percent } from '../lib/format.js';
import { Propagator, eigenstates, gaussianPacket, makeGrid, normalize, probabilityBeyond, probabilityCurrent, smoothBarrier, superpose } from '../lib/wave.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { drawPhaseWheel } from '../ui/dials.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { drawDensity } from '../ui/wave-plot.js';

// The probability current j = (ħ/m) Im(ψ* ∂ψ/∂x): where probability flows, and how fast. A packet
// evolves by split-operator steps (lib/wave.js); at a "gate" the time integral of j is compared
// with the probability that actually crossed it, the continuity equation in action. Potential
// edges are smooth on the grid scale, which keeps the current accurate (see the tests).

const GRID = makeGrid(4096, -60, 60);
const DT = 0.01;
const FRAME_DT = 0.2;
const SHOW = 40;
const lo = GRID.x.findIndex((x) => x > -SHOW);
const hi = GRID.x.findLastIndex((x) => x < SHOW) + 1;
const XS = GRID.x.subarray(lo, hi);

function potential(s) {
  if (s.shape === 'barrier') return Float64Array.from(GRID.x, smoothBarrier(s.V0, 0, 1.2));
  if (s.shape === 'step') return Float64Array.from(GRID.x, (x) => s.V0 * 0.5 * (1 + Math.tanh(x / 0.08)));
  return new Float64Array(GRID.n);
}

function compute(s) {
  const V = potential(s);
  if (s.shape === 'standing') {
    // A box state is real: it has no current anywhere.
    const box = makeGrid(1200, -10, 10);
    const st = eigenstates(new Float64Array(box.n), box.dx, 3);
    const psi = superpose(st, [[0, 0], [0, 0], [1, 0]], 0);
    return { standing: true, box, psi, V: new Float64Array(box.n) };
  }
  const prop = new Propagator(GRID, V, DT, { absorb: 12 });
  const psi = normalize(gaussianPacket(GRID, { x0: -18, sigma: 3, k0: s.k0 }), GRID.dx);
  const gi = GRID.x.findIndex((x) => x > s.gate);
  const xg = GRID.x[gi] - GRID.dx / 2;
  const jGate = () => {
    // current at the midpoint between grid points gi - 1 and gi
    const a = gi - 1;
    const d = (i, arr) => (arr[i + 1] - arr[i - 1]) / (2 * GRID.dx);
    const j = (i) => psi.re[i] * d(i, psi.im) - psi.im[i] * d(i, psi.re);
    return (j(a) + j(gi)) / 2;
  };
  const start = probabilityBeyond(GRID, psi, xg);
  const duration = Math.min(60, (s.gate + 34) / Math.max(0.4, s.k0));
  const frames = [];
  let flux = 0;
  let jPrev = jGate();
  const record = () =>
    frames.push({
      re: Float32Array.from(psi.re.subarray(lo, hi)),
      im: Float32Array.from(psi.im.subarray(lo, hi)),
      j: Float32Array.from(probabilityCurrent(GRID, psi).subarray(lo, hi)),
      crossed: probabilityBeyond(GRID, psi, xg) - start,
      flux,
      jg: jPrev,
    });
  record();
  const sub = Math.round(FRAME_DT / DT);
  for (let f = 1; f * FRAME_DT <= duration + 1e-9; f++) {
    for (let k = 0; k < sub; k++) {
      prop.step(psi);
      const jn = jGate();
      flux += ((jPrev + jn) / 2) * DT;
      jPrev = jn;
    }
    record();
  }
  let jMax = 0;
  for (const f of frames) for (const v of f.j) jMax = Math.max(jMax, Math.abs(v));
  return { frames, V: V.subarray(lo, hi), duration, xg, jMax };
}

const frameOf = (api) => api.model.frames[Math.min(api.model.frames.length - 1, Math.round(api.t / FRAME_DT))];

function drawGate(canvas, x, th) {
  const { ctx } = { ctx: canvas.getContext('2d') };
  const w = canvas.getBoundingClientRect().width;
  const box = { x0: 48, x1: w - 14 };
  const X = box.x0 + ((x + SHOW) / (2 * SHOW)) * (box.x1 - box.x0);
  ctx.save();
  ctx.strokeStyle = th.marked;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(X, 12);
  ctx.lineTo(X, canvas.getBoundingClientRect().height - 28);
  ctx.stroke();
  ctx.fillStyle = th.marked;
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('gate', X + 4, 14);
  ctx.restore();
}

function drawWave(api) {
  const th = api.theme;
  const m = api.model;
  if (m.standing) {
    drawDensity(api.canvas('density'), { theme: th, x: m.box.x, re: m.psi.re, im: m.psi.im, V: m.V, vRange: [0, 1], yMax: 0.2, xRange: [-10, 10] });
    return;
  }
  const f = frameOf(api);
  const vTop = Math.max(api.settings.V0 * 1.6, api.settings.k0 ** 2);
  drawDensity(api.canvas('density'), {
    theme: th,
    x: XS,
    re: f.re,
    im: f.im,
    V: m.V,
    vRange: [0, vTop],
    yMax: 0.17,
    xRange: [-SHOW, SHOW],
    energy: api.settings.k0 ** 2 / 2,
    energyLabel: `E = ${fmt(api.settings.k0 ** 2 / 2)}`,
  });
  drawGate(api.canvas('density'), api.settings.gate, th);
}

function drawCurrent(api) {
  const { ctx, w, h } = prep(api.canvas('current'));
  const th = api.theme;
  const m = api.model;
  const box = { x0: 48, y0: 12, x1: w - 14, y1: h - 28 };
  let xs;
  let j;
  if (m.standing) {
    xs = m.box.x;
    j = probabilityCurrent(m.box, m.psi);
  } else {
    xs = XS;
    j = frameOf(api).j;
  }
  const range = m.standing ? [-10, 10] : [-SHOW, SHOW];
  const top = m.standing ? 0.05 : Math.max(0.01, m.jMax * 1.1);
  const X = xAxis(ctx, box, range, th);
  const Y = yAxis(ctx, box, [-top, top], th);
  const zero = Y(0);
  for (const sign of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(X(xs[0]), zero);
    for (let i = 0; i < xs.length; i += 2) {
      const v = sign > 0 ? Math.max(0, j[i]) : Math.min(0, j[i]);
      ctx.lineTo(X(xs[i]), Y(Math.max(-top, Math.min(top, v))));
    }
    ctx.lineTo(X(xs[xs.length - 1]), zero);
    ctx.closePath();
    ctx.fillStyle = withAlpha(sign > 0 ? th.ampPos : th.ampNeg, 0.55);
    ctx.fill();
  }
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(m.standing ? 'j = 0 everywhere' : 'flowing right ↑   flowing left ↓', box.x0 + 6, box.y0);
  if (!m.standing) drawGate(api.canvas('current'), api.settings.gate, th);
}

function drawFlux(api) {
  const { ctx, w, h } = prep(api.canvas('flux'));
  const th = api.theme;
  const m = api.model;
  const box = { x0: 52, y0: 12, x1: w - 14, y1: h - 28 };
  if (m.standing) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.fillText('No flow: nothing crosses any gate.', box.x0, box.y0 + 20);
    return;
  }
  const Y = yAxis(ctx, box, [0, 1], th);
  const X = xAxis(ctx, box, [0, m.duration], th);
  const upto = Math.round(api.t / FRAME_DT);
  ctx.strokeStyle = th.accent2;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  m.frames.forEach((f, i) => i <= upto && (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i * FRAME_DT), Y(f.crossed)));
  ctx.stroke();
  ctx.fillStyle = th.marked;
  m.frames.forEach((f, i) => {
    if (i > upto || i % 5) return;
    ctx.beginPath();
    ctx.arc(X(i * FRAME_DT), Y(f.flux), 3, 0, 2 * Math.PI);
    ctx.fill();
  });
  const f = frameOf(api);
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.accent2;
  ctx.fillText(`probability now beyond the gate: ${percent(f.crossed)}`, box.x0 + 6, box.y0);
  ctx.fillStyle = th.marked;
  ctx.fillText(`∫ j dt at the gate so far: ${percent(f.flux)}`, box.x0 + 6, box.y0 + 16);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = MONO;
  ctx.fillText('time', (box.x0 + box.x1) / 2, h);
}

const STEPS = [
  {
    title: 'Probability flows',
    preset: { shape: 'free', k0: 1.5, gate: 10 },
    play: true,
    html: `<p>A free wave packet moves to the right. Its probability density |ψ|² slides along, so probability is <b>flowing</b>: out of the region behind the packet and into the region ahead of it.</p>
      <p>The middle chart shows that flow, the <b>probability current</b> j(x, t). Here it is positive (rightward) wherever the packet is.</p>`,
  },
  {
    title: 'Current = density × velocity',
    preset: { shape: 'free', k0: 1.5, gate: 10 },
    html: ({ settings }) => `<p>For a packet with momentum ħk₀ the current is about |ψ|² × (ħk₀/m): density times velocity. Here k₀ = ${fmt(settings.k0)}, so the current curve is the density curve scaled by ${fmt(settings.k0)}.</p>
      <p>It comes from the phase: the colour rotates along the packet, and the faster it rotates, the faster probability flows.</p>`,
    math: `<span class="eq">j(x, t) = (ħ/m) Im(ψ* ∂ψ/∂x)</span>
      Writing ψ = √ρ e^(iS/ħ) gives j = ρ (∂S/∂x)/m: the density times a local velocity. For ψ = A e^(ikx), j = |A|² ħk/m.`,
  },
  {
    title: 'Standing waves don’t flow',
    preset: { shape: 'standing' },
    focus: ['The packet', 'Current j(x)'],
    html: `<p>A stationary state in a box is a <b>real</b> function (up to an overall phase that is the same everywhere). Its current is exactly zero, even though classically a particle in a box bounces back and forth.</p>
      <p>That's why stationary states are stationary: no probability flows anywhere, so |ψ|² can't change.</p>`,
    predict: {
      q: 'Which of these carries zero current?',
      options: ['e^(ikx)', 'cos(kx)', 'e^(−ikx)', 'A moving Gaussian packet'],
      answer: 1,
      why: 'cos(kx) is real, so Im(ψ*ψ′) = 0: it is equal parts right-moving and left-moving wave.',
    },
  },
  {
    title: 'Nothing disappears',
    preset: { shape: 'free', k0: 1.5, gate: 10 },
    focus: ['The packet', 'What crossed the gate'],
    play: true,
    html: `<p>Probability can't vanish here and reappear there: whatever appears beyond the gate must have flowed through it. The bottom chart checks this live: the probability beyond the gate (line) and the current at the gate added up over time (dots) agree.</p>`,
    math: `The continuity equation, from the Schrödinger equation:
      <span class="eq">∂|ψ|²/∂t + ∂j/∂x = 0</span>
      Integrated over x > x_g: d/dt P(x > x_g) = j(x_g, t).`,
  },
  {
    title: 'Flow at a barrier',
    preset: { shape: 'barrier', V0: 1.4, k0: 1.4, gate: 6 },
    play: true,
    html: `<p>Now the packet meets a barrier. The current on the left turns <b>negative</b> where the reflected wave runs back, while a weaker positive current leaks through the barrier.</p>
      <p>At the end, the probability that crossed the gate is the transmission probability. Again the flux through the gate accounts for every bit of it.</p>`,
  },
  {
    title: 'A step up',
    preset: { shape: 'step', V0: 0.8, k0: 1.6, gate: 8 },
    play: true,
    html: `<p>Above a step the wave slows down: its wavelength grows and the transmitted packet bunches up. So the size of the transmitted wave alone is not the transmission probability. What carries over the step is the <b>current</b>, density × speed, and that is what the gate measures.</p>`,
    math: `For stationary scattering off a step with k = √(2E) on the left and q = √(2(E − V₀)) on the right:
      <span class="eq">T = (q/k) |t|² = 4kq/(k + q)²</span>
      The factor q/k is the ratio of velocities.`,
  },
  {
    title: 'Your turn',
    preset: { shape: 'barrier', V0: 1, k0: 1.3, gate: 8 },
    html: `<p>Change the potential, the momentum and the gate position. Wherever you put the gate, the flux through it matches the probability that passed.</p>`,
  },
];

runLesson({
  slug: 'probability-current',
  settings: { shape: 'free', V0: 1.4, k0: 1.5, gate: 10 },
  controls: [
    { id: 'shape', label: 'Potential', type: 'select', options: [['free', 'Free space'], ['barrier', 'A barrier'], ['step', 'A step up'], ['standing', 'A box (standing wave)']] },
    { id: 'k0', label: 'Momentum k₀', type: 'range', min: 0.6, max: 2.4, step: 0.05, format: (v) => v.toFixed(2), show: (s) => s.shape !== 'standing' },
    { id: 'V0', label: 'Height V₀', type: 'range', min: 0.2, max: 2.5, step: 0.05, format: (v) => v.toFixed(2), show: (s) => s.shape === 'barrier' || s.shape === 'step' },
    { id: 'gate', label: 'Gate position', type: 'range', min: 2, max: 20, step: 1, show: (s) => s.shape !== 'standing' },
  ],
  cards: [
    { id: 'density', title: 'The packet', legend: '<canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> colour = phase', height: 230 },
    { id: 'current', title: 'Current j(x)', legend: 'positive = flowing right', height: 200 },
    { id: 'flux', title: 'What crossed the gate', legend: 'line = probability beyond the gate · dots = ∫ j dt', height: 200 },
  ],
  steps: STEPS,
  compute,
  player: { duration: (api) => (api.model.standing ? 1 : api.model.duration), speed: 4 },
  draw(api) {
    const wheel = document.querySelector('.phase-wheel');
    if (wheel) drawPhaseWheel(wheel);
    drawWave(api);
    drawCurrent(api);
    drawFlux(api);
  },
});
