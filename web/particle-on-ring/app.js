import { energy, evolve, meanAngularMomentum, modeOf, modeState, revivalTime, ringPacket, toModes } from '../lib/ring.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { drawPhaseWheel, phaseColor } from '../ui/dials.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { drawCarpet } from '../ui/wave-plot.js';

// A particle confined to a ring (radius R = 1, ħ = m = 1), possibly threaded by a magnetic flux.
// States are kept as Fourier modes (lib/ring.js), so their evolution is exact; tests check the
// revival time and the flux-shifted levels against a finite-difference ring.

const N = 256;
const R = 1;
const T_REV = revivalTime(R);

function initial(s) {
  if (s.state === 'eigen') return modeState(N, s.n);
  if (s.state === 'standing') return modeState(N, Math.max(1, Math.abs(s.n)), true);
  return ringPacket(N, Math.PI, 0.3, s.k0);
}

function compute(s) {
  const psi0 = initial(s);
  const modes = toModes(psi0.re, psi0.im);
  // space-time map for the carpet
  const frames = [];
  for (let k = 0; k <= 240; k++) {
    const p = evolve(modes, (k / 240) * s.tmax, R, s.flux);
    frames.push(Float64Array.from(p.re, (v, i) => v * v + p.im[i] ** 2));
  }
  return { modes, frames };
}

function drawRing(api) {
  const { ctx, w, h } = prep(api.canvas('ring'));
  const th = api.theme;
  const psi = evolve(api.model.modes, api.t, R, api.settings.flux);
  const cx = w / 2;
  const cy = h / 2;
  const r0 = Math.min(w, h) * 0.3;
  let peak = 1e-9;
  for (let j = 0; j < N; j++) peak = Math.max(peak, psi.re[j] ** 2 + psi.im[j] ** 2);
  const scale = Math.min(w, h) * 0.17 / Math.max(peak, 1 / (2 * Math.PI) * 1.2);
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r0, 0, 2 * Math.PI);
  ctx.stroke();
  for (let j = 0; j < N; j++) {
    const phi = (j / N) * 2 * Math.PI;
    const d = psi.re[j] ** 2 + psi.im[j] ** 2;
    const len = d * scale;
    if (len < 0.3) continue;
    ctx.strokeStyle = phaseColor(Math.atan2(psi.im[j], psi.re[j]), 0.95);
    ctx.lineWidth = (2 * Math.PI * r0) / N + 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + r0 * Math.cos(phi), cy - r0 * Math.sin(phi));
    ctx.lineTo(cx + (r0 + len) * Math.cos(phi), cy - (r0 + len) * Math.sin(phi));
    ctx.stroke();
  }
  // flux through the middle
  if (api.settings.flux > 0) {
    ctx.fillStyle = withAlpha(th.marked, 0.15 + 0.5 * api.settings.flux);
    ctx.beginPath();
    ctx.arc(cx, cy, r0 * 0.25, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = th.marked;
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Φ = ${fmt(api.settings.flux)}`, cx, cy);
  }
  const L = meanAngularMomentum(api.model.modes, api.settings.flux);
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`t = ${fmt(api.t)}   ·   revival at 4πR² = ${fmt(T_REV)}`, 8, 6);
  ctx.fillText(`⟨velocity around the ring⟩ = ${fmt(L / R)} ${Math.abs(L) < 1e-9 ? '(no net flow)' : L > 0 ? '(anticlockwise)' : '(clockwise)'}`, 8, 22);
}

function drawLevels(api) {
  const { ctx, w, h } = prep(api.canvas('levels'));
  const th = api.theme;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const X = xAxis(ctx, box, [-1, 1], th);
  const Y = yAxis(ctx, box, [0, 2.2], th);
  const weights = new Map();
  const m = api.model.modes;
  let tot = 0;
  for (let j = 0; j < N; j++) {
    const wgt = m.re[j] ** 2 + m.im[j] ** 2;
    tot += wgt;
    if (wgt > 1e-6) weights.set(modeOf(j, N), (weights.get(modeOf(j, N)) ?? 0) + wgt);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  for (let n = -3; n <= 3; n++) {
    const wn = (weights.get(n) ?? 0) / tot;
    ctx.strokeStyle = wn > 0.01 ? th.accent2 : withAlpha(th.muted, 0.5);
    ctx.lineWidth = wn > 0.01 ? 1.5 + 4 * wn : 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const f = -1 + (2 * i) / 120;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(f), Y(energy(n, R, f)));
    }
    ctx.stroke();
  }
  ctx.restore();
  // label each parabola near its lowest visible point
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let n = -2; n <= 2; n++) {
    const f = Math.max(-0.9, Math.min(0.9, n));
    ctx.fillText(`n=${n}`, X(f), Y(energy(n, R, f)) - 3);
  }
  const f = api.settings.flux;
  ctx.strokeStyle = th.cursor;
  ctx.beginPath();
  ctx.moveTo(X(f), box.y0);
  ctx.lineTo(X(f), box.y1);
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('flux Φ (flux quanta)', (box.x0 + box.x1) / 2, h);
}

function drawTimeline(api) {
  const x = Float64Array.from({ length: N }, (_, j) => (j / N) * 360);
  drawCarpet(api.canvas('carpet'), { theme: api.theme, frames: api.model.frames, x, xRange: [0, 360], tMax: api.settings.tmax, currentT: Math.min(api.t, api.settings.tmax) });
}

const STEPS = [
  {
    title: 'A wave that must close on itself',
    preset: { state: 'eigen', n: 3, flux: 0, tmax: T_REV },
    focus: ['The ring', 'Energy levels'],
    html: `<p>Put a particle on a ring. Going once around must bring the wavefunction back to itself, so it can only wind a <b>whole number</b> of times: ψₙ = e^(inφ)/√(2π) with n = 0, ±1, ±2, …</p>
      <p>Here n = 3: the colour (the phase) cycles three times around the ring, while |ψ|² is the same everywhere.</p>`,
    math: `With arc length s = Rφ and ħ = m = 1:
      <span class="eq">−(1/2R²) ψ″(φ) = Eψ,  ψ(φ + 2π) = ψ(φ)  ⇒  Eₙ = n²/(2R²)</span>
      n is the angular momentum in units of ħ.`,
  },
  {
    title: 'No zero-point energy',
    preset: { state: 'eigen', n: 0, flux: 0, tmax: T_REV },
    focus: ['The ring', 'Energy levels'],
    html: `<p>Unlike a box, the ring has no walls: n = 0, a constant wavefunction, is allowed and has <b>zero</b> energy. Every other level is doubly degenerate: n and −n go round the same way at the same energy, one clockwise and one anticlockwise.</p>`,
    predict: {
      q: 'Add equal amounts of n = 2 and n = −2. What does the probability look like around the ring?',
      options: ['Uniform', 'Two peaks and two nodes', 'Four peaks and four nodes', 'One peak'],
      answer: 2,
      why: 'e^(2iφ) + e^(−2iφ) ∝ cos(2φ), whose square has four peaks and four nodes around the ring.',
    },
  },
  {
    title: 'Clockwise plus anticlockwise',
    preset: { state: 'standing', n: 2, flux: 0, tmax: T_REV },
    focus: ['The ring', 'Energy levels'],
    html: `<p>cos(2φ) is an equal mix of n = 2 and n = −2. It is a standing wave: four peaks, four nodes, and <b>no net flow</b> around the ring, because the two directions cancel.</p>`,
  },
  {
    title: 'A packet goes round',
    preset: { state: 'packet', k0: 4, flux: 0, tmax: 2 },
    play: true,
    focus: ['The ring', 'Angle and time'],
    html: `<p>A packet made of many n around n = 4 circulates anticlockwise, and spreads out as it goes, because the different n travel at different speeds.</p>`,
  },
  {
    title: 'It comes back together',
    preset: { state: 'packet', k0: 0, flux: 0, tmax: T_REV },
    focus: ['Angle and time', 'The ring'],
    html: `<p>Start a packet at rest. It spreads all the way round the ring, yet because every energy is n²/2R², all the phases line up again at t = 4πR² ≈ ${fmt(T_REV)}: the packet <b>revives</b> exactly. Half-way through it reappears on the opposite side, and at simple fractions of the revival time it splits into a few copies.</p>
      <p>The space-time map (angle across, time down) is a quantum carpet. Drag the time slider to a quarter, a third or half of the revival.</p>`,
  },
  {
    title: 'A flux the particle never touches',
    preset: { state: 'eigen', n: 0, flux: 0.3, tmax: T_REV },
    focus: ['Energy levels', 'The ring'],
    html: ({ settings }) => `<p>Thread a magnetic flux Φ through the middle of the ring, where the particle never goes. The field on the ring is zero, yet every level shifts: Eₙ = (n − Φ)²/2R² (the <b>Aharonov–Bohm effect</b>).</p>
      <p>Now even the ground state carries a current around the ring, a <b>persistent current</b>, here ${fmt(-settings.flux / R)} (in units ħ/mR). At Φ = ½ the levels n = 0 and n = 1 cross.</p>`,
    math: `The vector potential enters the kinetic energy as (p − eA)²/2m. On the ring it shifts n → n − Φ/Φ₀ with Φ₀ = h/e, and the spectrum is periodic in Φ with period Φ₀.`,
  },
  {
    title: 'Your turn',
    preset: { state: 'packet', k0: 2, flux: 0, tmax: T_REV },
    html: `<p>Choose a state and a flux, then play. Persistent currents like these flow in tiny metal and superconducting rings, and the flux-periodic spectrum is the principle behind the SQUID and flux qubits.</p>`,
  },
];

runLesson({
  slug: 'particle-on-ring',
  settings: { state: 'eigen', n: 3, k0: 4, flux: 0, tmax: T_REV },
  controls: [
    { id: 'state', label: 'State', type: 'choice', options: [['eigen', 'One level'], ['standing', 'Standing wave'], ['packet', 'Packet']] },
    { id: 'n', label: 'Winding number n', type: 'range', min: -4, max: 4, step: 1, show: (s) => s.state !== 'packet' },
    { id: 'k0', label: 'Packet’s mean n', type: 'range', min: -6, max: 6, step: 1, show: (s) => s.state === 'packet' },
    { id: 'flux', label: 'Flux Φ through the ring', type: 'range', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
  ],
  cards: [
    { id: 'ring', title: 'The ring', legend: '<canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> bar length = |ψ|², colour = phase', height: 320 },
    { id: 'levels', title: 'Energy levels', legend: 'against the flux · thick = levels in this state', height: 220 },
    { id: 'carpet', title: 'Angle and time', legend: 'angle (degrees) across, time down', height: 260, folded: true },
  ],
  steps: STEPS,
  compute,
  player: { duration: (api) => api.settings.tmax, speed: 1 },
  draw(api) {
    const wheel = document.querySelector('.phase-wheel');
    if (wheel) drawPhaseWheel(wheel);
    drawRing(api);
    drawLevels(api);
    drawTimeline(api);
  },
});
