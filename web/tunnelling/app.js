import { percent } from '../lib/format.js';
import { Propagator, gaussianPacket, makeGrid, transmission } from '../lib/wave.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { withAlpha } from '../ui/bloch.js';
import { drawPhaseWheel } from '../ui/dials.js';
import { mountLesson } from '../ui/lesson.js';
import { Player } from '../ui/player.js';
import { drawDensity } from '../ui/wave-plot.js';

// A wave packet scattering off a potential, by split-operator propagation, next to the exact
// transmission curve T(E) from Numerov integration. Edge cells of the potential are weighted by
// how much of the cell the barrier covers, so a barrier of width 1 really has width 1 on the grid
// (otherwise the simulated transmission is off by ~10%). The two agree to about 0.2%.
const GRID = makeGrid(4096, -120, 120);
const T_GRID = makeGrid(2400, -12, 12);
const DT = 0.05;
const FRAME_DT = 0.4;
const SHOW = 72; // frames keep only |x| < SHOW, which is all the plot ever shows
const WALL = 0.5; // thickness of each wall in the double barrier
const FILL_BATCH = 12;

const pieces = ({ shape, V0, a }) =>
  shape === 'barrier'
    ? [[-a / 2, a / 2, V0]]
    : shape === 'well'
      ? [[-a / 2, a / 2, -V0]]
      : [
          [-a / 2 - WALL, -a / 2, V0],
          [a / 2, a / 2 + WALL, V0],
        ];

function potential(grid, parts) {
  const h = grid.dx / 2;
  return Float64Array.from(grid.x, (x) => {
    let v = 0;
    for (const [l, r, height] of parts) v += (height * Math.max(0, Math.min(r, x + h) - Math.max(l, x - h))) / grid.dx;
    return v;
  });
}

// Transmission averaged over the packet's Gaussian spread of momenta (width 1/(2 sigma)).
function packetTransmission(parts, E, sigma) {
  const V = potential(T_GRID, parts);
  const k0 = Math.sqrt(2 * E);
  const dk = 1 / (2 * sigma);
  let sum = 0;
  let weight = 0;
  for (let j = -80; j <= 80; j++) {
    const k = k0 + (j / 20) * dk;
    if (k <= 0.01) continue;
    const g = Math.exp(-((k - k0) ** 2) / (2 * dk * dk));
    sum += g * transmission(V, T_GRID.dx, (k * k) / 2).T;
    weight += g;
  }
  return sum / weight;
}

const STEPS = [
  {
    title: 'A ball and a wall',
    preset: { shape: 'barrier', V0: 1, a: 1, E: 0.5, sigma: 6 },
    html: `<p>A particle with energy E = 0.5 (the amber line) heads for a wall of height V<sub>0</sub> = 1. A classical ball without enough energy to get over bounces back, every time.</p>
      <p>Press <b>Play</b> and watch what the quantum particle does.</p>`,
  },
  {
    title: 'Waves leak through',
    preset: { shape: 'barrier', V0: 1, a: 1, E: 0.5, sigma: 6 },
    play: true,
    html: ({ predicted }) => `<p>Most of the packet reflects, but part of it appears on the far side, where a classical particle could never be. That's <b>quantum tunnelling</b>.</p>
      <p>Inside the wall the wave doesn't oscillate, it decays; if the wall is thin, something is left at the other side. The curve predicts <b>${percent(predicted)}</b> gets through: the bar under the plot shows how much ends up on the right.</p>`,
  },
  {
    title: 'Thicker walls, exponentially less',
    preset: { shape: 'barrier', V0: 1, a: 2.5, E: 0.5, sigma: 6 },
    play: true,
    html: ({ predicted }) => `<p>Make the wall 2.5 times thicker and only ${percent(predicted)} gets through. Tunnelling falls off <b>exponentially</b> with thickness b, roughly as e<sup>−2κb</sup> with κ = √(2m(V<sub>0</sub> − E))/ħ.</p>
      <p>And κ grows with the mass. That's why electrons and protons tunnel all the time, but you'll never walk through a door.</p>`,
  },
  {
    title: 'Enough energy is not enough',
    preset: { shape: 'barrier', V0: 1, a: 1, E: 1.4, sigma: 6 },
    play: true,
    html: ({ predicted }) => `<p>Now E = 1.4 is <b>above</b> the wall. A classical ball would always pass, yet the quantum packet still partly reflects: only ${percent(predicted)} passes. The wave changes wavelength at each edge, and every change of wavelength reflects a little.</p>
      <p><b>Transmission T(E)</b> shows every energy at once: below the top T climbs smoothly, above it wobbles up toward 1.</p>`,
  },
  {
    title: 'A well that turns invisible',
    preset: { shape: 'well', V0: 1.5, a: 3, E: 0.69, sigma: 10 },
    play: true,
    html: ({ predicted }) => `<p>Swap the wall for a <b>well</b>. Even a dip reflects part of a wave, except at special energies where the reflections from its two edges cancel exactly and the well becomes transparent: T = 1. Here ${percent(predicted)} passes.</p>
      <p>Set the energy to 0.3 and about a quarter bounces off a hole. This is the Ramsauer–Townsend effect: slow electrons fly through argon atoms as if they weren't there.</p>`,
  },
  {
    title: 'Resonant tunnelling',
    preset: { shape: 'double', V0: 1.5, a: 3, E: 0.246, sigma: 15 },
    play: true,
    html: ({ predicted, single }) => `<p>Two thin walls with a gap. One wall on its own lets through ${percent(single)} of this packet. Two walls in a row should let through less, but here <b>${percent(predicted)}</b> passes.</p>
      <p>At a resonant energy the wave rings back and forth between the walls and builds up until it leaks out forwards; notice part of it waiting in the gap. The sharp peaks in T(E) are these resonances. Resonant-tunnelling diodes work this way.</p>`,
  },
  {
    title: 'Tunnelling everywhere',
    preset: { shape: 'barrier', V0: 1, a: 1, E: 0.7, sigma: 6 },
    html: `<p>Alpha particles tunnel out of nuclei (radioactive decay), protons tunnel through their electric repulsion to fuse in the Sun, and electrons tunnel into the tip of a scanning tunnelling microscope and through the insulator of flash memory.</p>
      <p>Your turn: change the shape, height, width, energy and packet length in <b>Try it</b>. A longer packet has a sharper energy, so it follows the curve's peaks more closely.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div id="player"></div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>The packet meets the potential</h2><span class="legend"><canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> colour = phase; amber line = energy E</span></figcaption>
    <canvas id="density" class="chart tall" role="img" aria-label="Wave packet scattering off a potential"></canvas>
    <canvas id="shares" class="chart" style="height: 52px; margin-top: 8px" role="img" aria-label="Probability reflected, inside the potential and transmitted"></canvas>
    <dl class="facts" id="facts"></dl>
  </figure>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Transmission T(E)</h2><span class="legend">curve = exact for each energy; band = the packet's energies</span></figcaption>
    <canvas id="curve" class="chart" role="img" aria-label="Transmission probability against energy"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Potential</span>
      <select id="shape"><option value="barrier">A barrier</option><option value="well">A well</option><option value="double">Two thin barriers</option></select></label>
    <label class="field"><span class="label"><span data-name="V0">Height V₀</span> <output id="V0-out"></output></span>
      <input id="V0" type="range" min="0.25" max="3" step="0.05"></label>
    <label class="field"><span class="label"><span data-name="a">Width</span> <output id="a-out"></output></span>
      <input id="a" type="range" min="0.5" max="6" step="0.1"></label>
    <label class="field"><span class="label">Energy E <output id="E-out"></output></span>
      <input id="E" type="range" min="0.1" max="3" step="0.01"></label>
    <label class="field"><span class="label">Packet length σ <output id="sigma-out"></output></span>
      <input id="sigma" type="range" min="4" max="16" step="1"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { shape: 'barrier', V0: 1, a: 1, E: 0.5, sigma: 6 };
const lo = GRID.x.findIndex((x) => x > -SHOW);
const hi = GRID.x.findLastIndex((x) => x < SHOW) + 1;
const X_SHOWN = GRID.x.subarray(lo, hi);
let sim = null;
let index = 0;
let t = 0;
let fillTimer = null;

function recompute() {
  const parts = pieces(settings);
  const { E, sigma } = settings;
  const k0 = Math.sqrt(2 * E);
  const x0 = -(3 * sigma + 12);
  const V = potential(GRID, parts);
  const Vt = potential(T_GRID, parts);
  const edges = parts.flatMap(([l, r]) => [l, r]);
  const eMax = Math.max(3, settings.V0 * 2.2);
  sim = {
    V,
    region: [Math.min(...edges), Math.max(...edges)],
    prop: new Propagator(GRID, V, DT, { absorb: 15 }),
    psi: gaussianPacket(GRID, { x0, sigma, k0 }),
    frames: [],
    shares: [],
    duration: Math.min(200, (-x0 + 30) / k0),
    peak: 1 / (sigma * Math.sqrt(2 * Math.PI)),
    predicted: packetTransmission(parts, E, sigma),
    single: settings.shape === 'double' ? packetTransmission(parts.slice(0, 1), E, sigma) : null,
    atE: transmission(Vt, T_GRID.dx, E).T,
    eMax,
    curve: Array.from({ length: 300 }, (_, i) => {
      const e = 0.005 + (i / 299) * eMax;
      return [e, transmission(Vt, T_GRID.dx, e).T];
    }),
  };
  record();
  player.speed = sim.duration / 12;
  player.setDuration(sim.duration);
  clearTimeout(fillTimer);
  const current = sim;
  const fill = () => {
    if (sim === current && ensure(sim.frames.length + FILL_BATCH - 1)) fillTimer = setTimeout(fill, 0);
  };
  fillTimer = setTimeout(fill, 0);
}

function record() {
  const { psi, region } = sim;
  let left = 0;
  let inside = 0;
  let right = 0;
  for (let i = 0; i < GRID.n; i++) {
    const p = (psi.re[i] ** 2 + psi.im[i] ** 2) * GRID.dx;
    if (GRID.x[i] < region[0]) left += p;
    else if (GRID.x[i] > region[1]) right += p;
    else inside += p;
  }
  sim.frames.push({ re: Float32Array.from(psi.re.subarray(lo, hi)), im: Float32Array.from(psi.im.subarray(lo, hi)) });
  sim.shares.push({ left, inside, right });
}

// Propagates until frame f exists; returns false once the whole run is computed.
function ensure(f) {
  const last = Math.ceil(sim.duration / FRAME_DT);
  const target = Math.min(f, last);
  while (sim.frames.length <= target) {
    sim.prop.step(sim.psi, Math.round(FRAME_DT / DT));
    record();
  }
  return sim.frames.length <= last;
}

const lesson = mountLesson({ slug: 'tunnelling', onNavigate: (i) => enterStep(i) });
const player = new Player($('player'), { duration: 40, onTime: (time) => ((t = time), render()) });

function syncControls() {
  for (const id of ['V0', 'a', 'E', 'sigma']) {
    $(id).value = String(settings[id]);
    $(`${id}-out`).textContent = id === 'sigma' ? String(settings[id]) : settings[id].toFixed(2);
  }
  $('shape').value = settings.shape;
  document.querySelector('[data-name="V0"]').textContent = settings.shape === 'well' ? 'Depth V₀' : 'Height V₀';
  document.querySelector('[data-name="a"]').textContent = settings.shape === 'double' ? 'Gap' : 'Width';
}

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  player.pause();
  recompute();
  player.seek(0);
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  if (STEPS[i].play) player.play();
}

function drawShares(th, s) {
  const { ctx, w } = prep($('shares'));
  const total = s.left + s.inside + s.right || 1;
  const parts = [
    [s.left / total, th.ampNeg, 'on the left'],
    [s.inside / total, th.marked, settings.shape === 'double' ? 'in the gap' : 'inside'],
    [s.right / total, th.ampPos, 'on the right'],
  ];
  const x0 = 48;
  const width = w - x0 - 14;
  let x = x0;
  for (const [f, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillRect(x, 4, f * width, 16);
    x += f * width;
  }
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = parts[0][1];
  ctx.fillText(`← ${parts[0][2]} ${percent(parts[0][0])}`, x0, 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = parts[2][1];
  ctx.fillText(`${parts[2][2]} ${percent(parts[2][0])} →`, x0 + width, 28);
  if (parts[1][0] > 0.005) {
    ctx.textAlign = 'center';
    ctx.fillStyle = parts[1][1];
    ctx.fillText(`${parts[1][2]} ${percent(parts[1][0])}`, x0 + width / 2, 28);
  }
}

function drawCurve(th) {
  const { ctx, w, h } = prep($('curve'));
  const box = { x0: 48, y0: 12, x1: w - 14, y1: h - 28 };
  const Y = yAxis(ctx, box, [0, 1.05], th);
  const X = xAxis(ctx, box, [0, sim.eMax], th);
  const { E, sigma } = settings;
  const k0 = Math.sqrt(2 * E);
  const dk = 1 / sigma; // band = +/- 2 standard deviations of k
  const eLo = (Math.max(0, k0 - dk) ** 2) / 2;
  const eHi = Math.min(sim.eMax, ((k0 + dk) ** 2) / 2);
  ctx.fillStyle = withAlpha(th.marked, 0.16);
  ctx.fillRect(X(eLo), box.y0, X(eHi) - X(eLo), box.y1 - box.y0);
  const vline = (e, color, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(Math.round(X(e)) + 0.5, box.y0);
    ctx.lineTo(Math.round(X(e)) + 0.5, box.y1);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (settings.shape !== 'well' && settings.V0 < sim.eMax) {
    vline(settings.V0, withAlpha(th.muted, 0.7), [4, 4]);
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('E = V₀', X(settings.V0) + 4, box.y0 + 2);
  }
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  sim.curve.forEach(([e, T], i) => (i === 0 ? ctx.moveTo(X(e), Y(T)) : ctx.lineTo(X(e), Y(T))));
  ctx.stroke();
  vline(E, th.marked, []);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('energy E', (box.x0 + box.x1) / 2, h);
}

function render() {
  if (!sim) return;
  const th = theme();
  const f = Math.min(Math.ceil(sim.duration / FRAME_DT), Math.round(t / FRAME_DT));
  ensure(f);
  const frame = sim.frames[f];
  const half = Math.max(40, 3 * settings.sigma + 22);
  const vMin = settings.shape === 'well' ? -settings.V0 - 0.15 : 0;
  drawDensity($('density'), {
    theme: th,
    x: X_SHOWN,
    re: frame.re,
    im: frame.im,
    V: sim.V.subarray(lo, hi),
    vRange: [vMin, Math.max(settings.V0, settings.E) * 1.5 + 0.1],
    yMax: sim.peak * 1.8,
    xRange: [-half, half],
    energy: settings.E,
    energyLabel: `E = ${settings.E.toFixed(2)}`,
  });
  drawShares(th, sim.shares[f]);
  const classical =
    settings.shape === 'well' ? '100% (a dip never stops a ball)' : settings.E < settings.V0 ? '0% (it always bounces)' : '100% (it always passes)';
  $('facts').innerHTML = `
    <dt>Predicted for this packet</dt><dd><b>${percent(sim.predicted)}</b> transmitted</dd>
    <dt>T at exactly E = ${settings.E.toFixed(2)}</dt><dd>${percent(sim.atE)}</dd>
    <dt>Classical ball</dt><dd>${classical}</dd>`;
  drawCurve(th);
  const ctx = { ...settings, predicted: sim.predicted, single: sim.single };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

let pending = null;
const scheduleRecompute = () => {
  clearTimeout(pending);
  pending = setTimeout(() => {
    const was = t;
    recompute();
    player.seek(Math.min(was, sim.duration));
  }, 150);
};
for (const id of ['V0', 'a', 'E', 'sigma']) {
  $(id).addEventListener('input', () => {
    settings[id] = Number($(id).value);
    syncControls();
    scheduleRecompute();
  });
}
$('shape').addEventListener('change', () => {
  settings.shape = $('shape').value;
  syncControls();
  scheduleRecompute();
});
window.addEventListener('themechange', () => {
  drawPhaseWheel(stage.querySelector('.phase-wheel'));
  render();
});
new ResizeObserver(() => render()).observe(stage);
drawPhaseWheel(stage.querySelector('.phase-wheel'));

const initial = new URLSearchParams(location.hash.slice(1));
enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(initial.get('step')) || 1) - 1)));
// #t=45 opens paused at that moment, for links prepared before class.
if (Number(initial.get('t')) > 0) {
  player.pause();
  player.seek(Math.min(sim.duration, Number(initial.get('t'))));
}
