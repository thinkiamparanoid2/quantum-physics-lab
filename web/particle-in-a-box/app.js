import { gaussianPacket, makeGrid, normalize, positionStats, potentialFrom, project, superpose } from '../lib/wave.js';
import { theme } from '../ui/charts.js';
import { drawPhaseWheel } from '../ui/dials.js';
import { mountLesson } from '../ui/lesson.js';
import { Player } from '../ui/player.js';
import { drawCarpet, drawDensity, drawStates } from '../ui/wave-plot.js';

// A box from 0 to pi with the exact textbook states psi_n = sqrt(2/L) sin(n x), E_n = n^2 / 2, so
// every phase realigns exactly at the revival time 4 pi. (The numerical solver reproduces these
// states; see tests/wave.test.js. Exact ones keep the revival perfect for fast packets.)
const L = Math.PI;
const GRID = makeGrid(600, -0.25, L + 0.25);
const V = potentialFrom(GRID, (x) => (x < 0 || x > L ? 5000 : 0));
const STATES = Array.from({ length: 70 }, (_, j) => ({
  E: (j + 1) ** 2 / 2,
  psi: Float64Array.from(GRID.x, (x) => (x > 0 && x < L ? Math.sqrt(2 / L) * Math.sin((j + 1) * x) : 0)),
}));
const REVIVAL = 4 * Math.PI;
const X_RANGE = [-0.2, L + 0.2];

const STEPS = [
  {
    title: 'Trapped between two walls',
    preset: { mode: 'single', n: 1 },
    html: `<p>A particle is trapped between two walls it can never pass. Its wave must vanish at both walls, so only waves that fit a whole number of half-wavelengths are allowed, like a guitar string.</p>
      <p>This is the lowest one, the <b>ground state</b>: one gentle hump, most likely found in the middle.</p>`,
  },
  {
    title: 'Energy comes in steps',
    preset: { mode: 'single', n: 1 },
    html: `<p>Because only certain wavelengths fit, only certain energies are allowed: E<sub>n</sub> = n²π²ħ²/(2mL²). With this box, E<sub>n</sub> = n²/2: 0.5, 2, 4.5, 8, … (see <b>Energy levels</b>).</p>
      <p>The lowest energy isn't zero. A confined particle can never sit perfectly still: that's <b>zero-point energy</b>, a direct consequence of the uncertainty principle.</p>`,
  },
  {
    title: 'More energy, more wiggles',
    preset: { mode: 'single', n: 3 },
    html: ({ n }) => `<p>State n has n − 1 <b>nodes</b>, points where the particle is never found. This is state ${n}, with ${n - 1} node${n === 2 ? '' : 's'}.</p>
      <p>Drag <b>Level n</b> in Try it. Higher states wiggle faster, which means shorter wavelength, more momentum and more energy.</p>`,
  },
  {
    title: 'Stationary states stand still',
    preset: { mode: 'single', n: 2 },
    play: true,
    html: `<p>Press <b>Play</b>. The probability density doesn't move at all, which is why these are called <b>stationary states</b>.</p>
      <p>Only the phase changes (the colour cycles), and at a rate set by the energy: e<sup>−iEt/ħ</sup>. A single phase that affects everything equally is invisible in any measurement.</p>`,
  },
  {
    title: 'Mix two states: it sloshes',
    preset: { mode: 'pair', n: 1 },
    play: true,
    html: `<p>Put the particle in a superposition of levels 1 and 2. Now the two phases turn at <b>different</b> rates, and where they line up the waves add, where they don't they cancel.</p>
      <p>The result: the particle sloshes from side to side with period 2π/(E<sub>2</sub> − E<sub>1</sub>) = 2π/1.5 ≈ 4.19. Motion in quantum mechanics is always interference between energy levels.</p>`,
  },
  {
    title: 'Bounce, blur and revive',
    preset: { mode: 'packet', n: 1 },
    play: true,
    html: `<p>Start with a narrow wave packet moving right (made of about 50 levels). It bounces off the walls and soon blurs into a mess.</p>
      <p>But because the energies are exactly n²/2, all the phases realign at t = 4π ≈ 12.6 and the packet <b>revives</b> perfectly. The <b>quantum carpet</b> shows the whole history: time runs down the page.</p>`,
  },
  {
    title: 'Your turn',
    preset: { mode: 'mix', n: 1 },
    html: `<p>Choose any combination of levels in Try it and watch the pattern they make. Try 1 + 3 (symmetric: no sloshing, it breathes) versus 1 + 2 (it sloshes).</p>
      <p>Or set a packet's starting point and speed and find the half-way revival at t = 2π, when the packet reappears mirrored.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div id="player"></div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Where the particle is: |ψ(x, t)|²</h2><span class="legend"><canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> colour = phase; amber line = average energy</span></figcaption>
    <canvas id="density" class="chart tall" role="img" aria-label="Probability density in the box"></canvas>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Energy levels</h2><span class="legend">highlighted = in the superposition</span></figcaption>
      <canvas id="levels" class="chart" style="height: 300px" role="img" aria-label="Energy levels and stationary states"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Quantum carpet</h2><span class="legend">x across, time t = 0 → 4π downwards</span></figcaption>
      <canvas id="carpet" class="chart" style="height: 300px" role="img" aria-label="Probability density over position and time"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">In the box</span>
      <select id="mode">
        <option value="single">One energy level</option>
        <option value="pair">Levels 1 and 2</option>
        <option value="mix">Levels I choose</option>
        <option value="packet">A moving wave packet</option>
      </select></label>
    <label class="field" data-for="single"><span class="label">Level n <output id="n-out"></output></span>
      <input id="n" type="range" min="1" max="8" step="1"></label>
    <div class="field" data-for="mix"><span class="label">Levels</span>
      <div class="bit-toggles" id="mix">${[1, 2, 3, 4, 5, 6].map((k) => `<button type="button" data-k="${k}" aria-pressed="${k <= 2}">${k}</button>`).join('')}</div></div>
    <label class="field" data-for="packet"><span class="label">Packet speed k <output id="k-out"></output></span>
      <input id="k" type="range" min="0" max="16" step="1" value="10"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { mode: 'single', n: 1, mix: new Set([1, 2]), k: 10 };
let coeffs = [];
let carpet = [];
let index = 0;
let t = 0;

function buildCoefficients() {
  coeffs = STATES.map(() => [0, 0]);
  if (settings.mode === 'single') coeffs[settings.n - 1] = [1, 0];
  else if (settings.mode === 'pair') coeffs[0] = coeffs[1] = [Math.SQRT1_2, 0];
  else if (settings.mode === 'mix') {
    const a = 1 / Math.sqrt(settings.mix.size || 1);
    for (const k of settings.mix) coeffs[k - 1] = [a, 0];
  } else {
    const psi = normalize(gaussianPacket(GRID, { x0: L / 4, sigma: 0.12, k0: settings.k }), GRID.dx);
    coeffs = project(STATES, psi, GRID.dx);
  }
  carpet = Array.from({ length: 180 }, (_, r) => {
    const p = superpose(STATES, coeffs, (r / 179) * REVIVAL);
    return Float32Array.from(p.re, (v, i) => v * v + p.im[i] ** 2);
  });
  carpet.peak = Math.max(...carpet.map((f) => Math.max(...f)));
}

const lesson = mountLesson({ slug: 'particle-in-a-box', onNavigate: (i) => enterStep(i) });
const player = new Player($('player'), { duration: REVIVAL, speed: 1.2, onTime: (time) => ((t = time), render()) });

function syncControls() {
  $('mode').value = settings.mode;
  $('n').value = String(settings.n);
  $('n-out').textContent = String(settings.n);
  $('k-out').textContent = String(settings.k);
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== settings.mode));
  document.querySelectorAll('#mix [data-k]').forEach((b) => b.setAttribute('aria-pressed', String(settings.mix.has(Number(b.dataset.k)))));
}

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  buildCoefficients();
  player.pause();
  player.seek(0);
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  if (STEPS[i].play) player.play();
}

function render() {
  const th = theme();
  const psi = superpose(STATES, coeffs, t);
  const included = new Set(coeffs.flatMap(([r, im], j) => (r * r + im * im > 1e-3 ? [j] : [])));
  const meanE = coeffs.reduce((s, [r, im], j) => s + (r * r + im * im) * STATES[j].E, 0);
  drawDensity($('density'), {
    theme: th,
    x: GRID.x,
    re: psi.re,
    im: psi.im,
    V,
    vRange: [0, Math.max(10, meanE * 1.3)],
    yMax: carpet.peak * 1.05,
    xRange: X_RANGE,
    energy: meanE,
    energyLabel: `⟨E⟩ = ${meanE.toFixed(2)}`,
    stats: positionStats(GRID, psi),
  });
  drawStates($('levels'), {
    theme: th,
    x: GRID.x,
    V,
    states: STATES.slice(0, 6),
    vRange: [0, 20],
    xRange: X_RANGE,
    selected: new Set([...included].filter((j) => j < 6)),
  });
  drawCarpet($('carpet'), { theme: th, frames: carpet, x: GRID.x, xRange: X_RANGE, tMax: REVIVAL, currentT: t });
  const ctx = { ...settings };
  lesson.render(
    STEPS.map((s, i) => ({ title: s.title, html: i === index ? (typeof s.html === 'function' ? s.html(ctx) : s.html) : '' })),
    index,
  );
}

const rebuild = () => {
  syncControls();
  buildCoefficients();
  player.seek(t);
};
$('mode').addEventListener('change', () => {
  settings.mode = $('mode').value;
  rebuild();
});
$('n').addEventListener('input', () => {
  settings.n = Number($('n').value);
  rebuild();
});
$('k').addEventListener('input', () => {
  settings.k = Number($('k').value);
  rebuild();
});
$('mix').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  const k = Number(b.dataset.k);
  if (settings.mix.has(k) && settings.mix.size > 1) settings.mix.delete(k);
  else settings.mix.add(k);
  rebuild();
});
window.addEventListener('themechange', () => {
  drawPhaseWheel(stage.querySelector('.phase-wheel'));
  render();
});
new ResizeObserver(() => coeffs.length && render()).observe(stage);
drawPhaseWheel(stage.querySelector('.phase-wheel'));

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
