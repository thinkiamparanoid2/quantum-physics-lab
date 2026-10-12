import { berryLoop, landauZener, lzProbability, wrap } from '../lib/adiabatic.js';
import { percent } from '../lib/format.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis, yAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// A spin in a field that changes with time: b(t) = (Δ, 0, αt), swept through an avoided crossing.
// Slowly, the spin follows the field (the adiabatic theorem); quickly, it jumps with the
// Landau–Zener probability. lib/adiabatic.js integrates the Schrödinger equation with exact
// two-level steps; the tests check the Landau–Zener formula and Berry's phase.

let sphere = null;

function compute(s) {
  const alpha = 10 ** s.logRate;
  const T = 30 / Math.sqrt(alpha) + (8 * s.Delta) / alpha;
  const run = landauZener({ Delta: s.Delta, alpha, T, steps: 6000, samples: 400 });
  // the formula against a few simulated sweeps at other rates, for the chart
  const curve = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((lr) => {
    const a = 10 ** lr;
    const Tx = 30 / Math.sqrt(a) + (8 * s.Delta) / a;
    return { lr, p: landauZener({ Delta: s.Delta, alpha: a, T: Tx, steps: 6000, samples: 2 }).diabatic };
  });
  const berry = berryLoop({ B: 4, theta: s.theta, Tloop: 300, steps: 20000 });
  return { alpha, T, run, curve, berry };
}

function sampleAt(api) {
  const { samples } = api.model.run;
  const t = -api.model.T + api.t;
  let i = 0;
  while (i < samples.length - 1 && samples[i + 1].t <= t) i++;
  return samples[i];
}

function drawEnergies(api) {
  const { ctx, w, h } = prep(api.canvas('levels'));
  const th = api.theme;
  const { Delta } = api.settings;
  const { alpha, T } = api.model;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const tShow = Math.min(T, (4 * Math.max(Delta, 1)) / alpha);
  const Emax = (alpha * tShow) / 2 + 0.2;
  const X = xAxis(ctx, box, [-tShow, tShow], th);
  const Y = yAxis(ctx, box, [-Emax, Emax], th);
  const line = (f, color, dash = [], width = 2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const t = -tShow + (2 * tShow * i) / 200;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(t), Y(f(t)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line((t) => (alpha * t) / 2, withAlpha(th.muted, 0.6), [5, 4], 1.5);
  line((t) => (-alpha * t) / 2, withAlpha(th.muted, 0.6), [5, 4], 1.5);
  line((t) => Math.hypot(alpha * t, Delta) / 2, th.ampNeg);
  line((t) => -Math.hypot(alpha * t, Delta) / 2, th.accent2);
  const s = sampleAt(api);
  if (Math.abs(s.t) <= tShow) {
    const E = Math.hypot(alpha * s.t, Delta) / 2;
    // dot sizes show how much is in the ground and excited states right now
    for (const [sign, p, color] of [
      [-1, s.pGround, th.accent2],
      [1, 1 - s.pGround, th.ampNeg],
    ]) {
      if (p < 0.005) continue;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(X(s.t), Y(sign * E), 4 + 10 * Math.sqrt(p), 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`gap Δ = ${fmt(Delta)} at the crossing`, box.x0 + 6, box.y0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('time (crossing at t = 0)', (box.x0 + box.x1) / 2, h);
}

function drawSphere(api) {
  const box = api.el('sphere');
  if (!sphere) {
    box.innerHTML = '<canvas class="bloch-hero ball-canvas" role="img" aria-label="The spin and the direction of the field"></canvas><p class="hint" id="sphere-note"></p>';
    sphere = new BlochView(box.querySelector('canvas'), { labels: 'poles' });
  }
  const s = sampleAt(api);
  const { Delta } = api.settings;
  const field = [Delta, 0, api.model.alpha * s.t];
  const B = Math.hypot(...field);
  // the ground state points against the field (energy (b . sigma)/2)
  sphere.axis = field.map((v) => -v / B);
  sphere.axisLabel = 'ground state';
  sphere.vector = s.bloch;
  sphere.trail = api.model.run.samples.filter((x) => x.t <= s.t).map((x) => x.bloch);
  sphere.draw(api.theme);
  box.querySelector('#sphere-note').innerHTML = `Dashed line: the direction of the ground state, which turns from the north pole (|0⟩) to the south pole (|1⟩) as the field sweeps. Chance of being in the ground state now: <b>${percent(s.pGround)}</b>.`;
}

function drawRates(api) {
  const { ctx, w, h } = prep(api.canvas('rates'));
  const th = api.theme;
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1], th);
  const X = xAxis(ctx, box, [-1.6, 1.6], th);
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const lr = -1.6 + (3.2 * i) / 200;
    (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(lr), Y(lzProbability(api.settings.Delta, 10 ** lr)));
  }
  ctx.stroke();
  ctx.fillStyle = th.accent2;
  for (const { lr, p } of api.model.curve) {
    ctx.beginPath();
    ctx.arc(X(lr), Y(p), 5, 0, 2 * Math.PI);
    ctx.fill();
  }
  const cur = api.settings.logRate;
  ctx.strokeStyle = th.cursor;
  ctx.beginPath();
  ctx.moveTo(X(cur), box.y0);
  ctx.lineTo(X(cur), box.y1);
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('sweep rate α (log₁₀)', (box.x0 + box.x1) / 2, h);
}

function berryText(api) {
  const r = api.model.berry;
  const measured = wrap(r.total - r.dynamic);
  const theta = api.settings.theta;
  api.el('berry').innerHTML = `<div class="readout-grid">
    <div class="stat"><span>Cone angle θ</span><b>${Math.round((theta * 180) / Math.PI)}°</b></div>
    <div class="stat"><span>Solid angle Ω = 2π(1 − cos θ)</span><b>${fmt(2 * Math.PI * (1 - Math.cos(theta)), 3)}</b></div>
    <div class="stat"><span>Phase left after removing the dynamic phase</span><b>${fmt(measured, 3)}</b></div>
    <div class="stat"><span>Berry’s prediction −Ω/2 (mod 2π)</span><b>${fmt(wrap(r.geometric), 3)}</b></div></div>
    <p class="hint">Simulated: a field of fixed strength carried once around a cone, slowly. The phase that is left over depends only on the cone's solid angle, not on how long the loop took.</p>`;
}

const STEPS = [
  {
    title: 'Change it slowly',
    preset: { Delta: 1, logRate: -1.2 },
    play: true,
    focus: ['The spin and the field', 'Energy levels'],
    html: `<p>A spin sits in the ground state of a magnetic field. Now the field slowly turns from one direction to the opposite one, through a point where it is small (only Δ remains). The spin <b>follows</b>: it ends in the new ground state, flipped over.</p>
      <p>This is the <b>adiabatic theorem</b>: change a Hamiltonian slowly enough and a system stays in the same instantaneous eigenstate.</p>`,
  },
  {
    title: 'An avoided crossing',
    preset: { Delta: 1, logRate: -1.2 },
    focus: ['Energy levels'],
    html: `<p>Without the coupling the two levels would cross (dashed lines). The coupling Δ opens a gap, and the true levels <b>avoid</b> each other (solid). Following the lower solid line means swapping character: the ground state starts as |0⟩ and ends as |1⟩.</p>
      <p>The dots show how much of the state is on each level.</p>`,
  },
  {
    title: 'Too fast: it jumps',
    preset: { Delta: 1, logRate: 0.8 },
    play: true,
    focus: ['The spin and the field', 'Energy levels'],
    html: ({ model }) => `<p>Sweep fast and the spin can't keep up: it stays in its old state and ends on the <b>upper</b> level. Here it makes that diabatic jump with probability ${percent(model.run.diabatic)}.</p>`,
    predict: {
      q: 'The gap Δ is doubled at the same sweep rate. The chance of jumping…',
      options: ['doubles', 'halves', 'drops sharply (it depends on Δ² in an exponent)', 'stays the same'],
      answer: 2,
      why: 'P = exp(−πΔ²/2α): doubling Δ raises the exponent fourfold.',
    },
  },
  {
    title: 'The Landau–Zener formula',
    preset: { Delta: 1, logRate: 0 },
    focus: ['Jump probability against sweep rate', 'Energy levels'],
    html: `<p>For a linear sweep through an avoided crossing, Landau and Zener (1932) found the exact jump probability P = exp(−πΔ²/2ħα). The dots are full simulations at seven rates; the line is the formula.</p>
      <p>"Slow enough" means the time spent near the crossing, Δ/α, is long compared with ħ/Δ, the time the gap needs to act.</p>`,
    math: `With H(t) = (αt σz + Δ σx)/2 (ħ = 1), the probability of ending in the excited state after t: −∞ → ∞ is
      <span class="eq">P_LZ = exp(−π Δ² / (2α))</span>
      Adiabatic when Δ² ≫ α; sudden when Δ² ≪ α.`,
  },
  {
    title: 'A phase from geometry',
    preset: { Delta: 1, logRate: 0, theta: 1.2 },
    focus: ['Berry’s phase'],
    html: `<p>Even a perfectly adiabatic loop leaves a trace. Carry a field around a cone and back: the spin returns to its starting state, but with an extra phase beyond the usual −Et. That <b>Berry phase</b> equals minus half the solid angle the field swept out.</p>
      <p>It is geometric: it doesn't depend on how fast the loop goes, only on its shape. Berry phases underlie the Aharonov–Bohm effect, topological insulators and some proposals for robust quantum gates.</p>`,
    math: `For a spin-½ in its ground state following a field around a closed loop,
      <span class="eq">γ = −Ω/2</span>
      where Ω is the solid angle subtended by the loop; for a cone of half-angle θ, Ω = 2π(1 − cos θ).`,
  },
  {
    title: 'Your turn',
    preset: { Delta: 0.7, logRate: -0.3, theta: 2 },
    html: `<p>Change the gap and the sweep rate and replay, or the cone angle of the Berry loop. Adiabatic sweeps like these are how adiabatic quantum computers and quantum annealers try to reach a ground state; see the adiabatic algorithm lesson.</p>`,
  },
];

runLesson({
  slug: 'adiabatic',
  settings: { Delta: 1, logRate: -1.2, theta: 1.2 },
  controls: [
    { id: 'Delta', label: 'Gap Δ', type: 'range', min: 0.2, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
    { id: 'logRate', label: 'Sweep rate α', type: 'range', min: -1.5, max: 1.5, step: 0.05, format: (v) => fmt(10 ** v, 3) },
    { id: 'theta', label: 'Berry loop: cone angle', type: 'range', min: 0.1, max: 3, step: 0.05, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
  ],
  cards: [
    { id: 'sphere', title: 'The spin and the field', kind: 'html' },
    { id: 'levels', title: 'Energy levels', legend: 'solid = true levels · dashed = without the coupling', height: 230 },
    { id: 'rates', title: 'Jump probability against sweep rate', legend: 'line = Landau–Zener · dots = simulation', height: 210, folded: true },
    { id: 'berry', title: 'Berry’s phase', kind: 'html', folded: true },
  ],
  steps: STEPS,
  compute,
  player: { duration: (api) => 2 * api.model.T },
  draw(api) {
    drawSphere(api);
    drawEnergies(api);
    drawRates(api);
    berryText(api);
  },
});
