import { eigenstates, gaussianPacket, makeGrid, positionStats, potentialFrom, project, superpose } from '../lib/wave.js';
import { barChart, theme } from '../ui/charts.js';
import { drawPhaseWheel } from '../ui/dials.js';
import { mountLesson } from '../ui/lesson.js';
import { Player } from '../ui/player.js';
import { drawDensity, drawStates } from '../ui/wave-plot.js';

// V = x^2 / 2 (hbar = m = omega = 1): levels at n + 1/2, classical period 2 pi.
const GRID = makeGrid(768, -12, 12);
const V = potentialFrom(GRID, (x) => (x * x) / 2);
const STATES = eigenstates(V, GRID.dx, 40);
const PERIOD = 2 * Math.PI;
const X_RANGE = [-7, 7];
const SHOWN_COEFFS = 21;

const STEPS = [
  {
    title: 'A quantum spring',
    preset: { mode: 'eigen', n: 0 },
    html: `<p>A particle on a spring: V = ½ mω²x², the parabola in grey. Almost anything that vibrates gently looks like this: atoms in a molecule, ions in a trap, a mode of light in a cavity.</p>
      <p>This is the ground state, a Gaussian hump centred at the bottom.</p>`,
  },
  {
    title: 'A ladder of equal steps',
    preset: { mode: 'eigen', n: 0 },
    html: `<p>The energies are E<sub>n</sub> = (n + ½)ħω: perfectly evenly spaced, like rungs of a ladder (see <b>Energy levels</b>). Climbing one rung always costs the same energy ħω.</p>
      <p>Operators a† and a move up and down the ladder: a†|n⟩ = √(n+1) |n+1⟩. And the bottom rung is at ½ħω, not zero: <b>zero-point energy</b>.</p>`,
  },
  {
    title: 'The states',
    preset: { mode: 'eigen', n: 3 },
    html: ({ n }) => `<p>Level n has n nodes. These shapes are Hermite polynomials times a Gaussian. This is n = ${n}, with energy ${(n + 0.5).toFixed(1)}.</p>
      <p>Drag <b>Level n</b> in Try it. The wavefunction leaks a little beyond the parabola, into the region a classical particle could never reach.</p>`,
  },
  {
    title: 'Where would a ball be?',
    preset: { mode: 'eigen', n: 20 },
    html: `<p>A classical ball on a spring moves fastest in the middle and slowest at the turning points, so it's most often found near the edges. The dashed curve is that classical probability for the same energy.</p>
      <p>At n = 20 the quantum density follows it closely, apart from the wiggles. At high energies quantum mechanics blends into classical physics: the <b>correspondence principle</b>.</p>`,
  },
  {
    title: 'A coherent state swings',
    preset: { mode: 'coherent', alpha: 2.5 },
    play: true,
    html: `<p>Take the ground-state hump and shift it off-centre. Press <b>Play</b>: it swings back and forth exactly like a classical pendulum, with period 2π/ω, and it <b>never spreads</b>.</p>
      <p>This is a coherent state, the most classical state a quantum oscillator can be in. A laser beam is a coherent state of light.</p>`,
  },
  {
    title: 'Built from rungs',
    preset: { mode: 'coherent', alpha: 2.5 },
    html: ({ alpha }) => `<p>Which ladder rungs make up the swinging hump? <b>Made of levels</b> shows the probability of each n: a Poisson distribution with average |α|² = ${(alpha * alpha).toFixed(2)}.</p>
      <p>The outlines are the Poisson formula; the filled bars are computed by projecting the actual state onto each level. They match.</p>`,
  },
  {
    title: 'A squeezed state breathes',
    preset: { mode: 'squeezed', alpha: 0 },
    play: true,
    html: `<p>Start with a hump narrower than the ground state. Its width now oscillates twice per period, squeezed in position, then in momentum, then back.</p>
      <p>Squeezed light is used for real: LIGO injects it to push measurement noise below the usual quantum limit.</p>`,
  },
  {
    title: 'Your turn',
    preset: { mode: 'coherent', alpha: 1.5 },
    html: `<p>Switch between single levels, coherent states and squeezed states. Try a tiny displacement (α = 0.5): the state is mostly the ground state with a little of level 1, yet it still swings as a whole.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div id="player"></div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>|ψ(x, t)|² in the parabola</h2><span class="legend"><canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> colour = phase; dashed = classical ball</span></figcaption>
    <canvas id="density" class="chart tall" role="img" aria-label="Probability density in the harmonic potential"></canvas>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Energy levels</h2><span class="legend">E = n + ½</span></figcaption>
      <canvas id="levels" class="chart" style="height: 300px" role="img" aria-label="Energy levels of the oscillator"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Made of levels</h2><span class="legend"><span class="key block"></span> |c<sub>n</sub>|² <span class="key outline"></span> Poisson</span></figcaption>
      <canvas id="coeffs" class="chart" style="height: 300px" role="img" aria-label="Probability of each energy level"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">State</span>
      <select id="mode">
        <option value="eigen">One energy level</option>
        <option value="coherent">Coherent state (shifted hump)</option>
        <option value="squeezed">Squeezed state (narrow hump)</option>
      </select></label>
    <label class="field" data-for="eigen"><span class="label">Level n <output id="n-out"></output></span>
      <input id="n" type="range" min="0" max="30" step="1"></label>
    <label class="field" data-for="coherent squeezed"><span class="label">Displacement α <output id="alpha-out"></output></span>
      <input id="alpha" type="range" min="0" max="3.5" step="0.25"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { mode: 'eigen', n: 0, alpha: 2 };
let coeffs = [];
let peak = 1;
let index = 0;
let t = 0;

function build() {
  if (settings.mode === 'eigen') {
    coeffs = STATES.map((_, j) => (j === settings.n ? [1, 0] : [0, 0]));
  } else {
    const sigma = settings.mode === 'squeezed' ? 0.35 : Math.SQRT1_2;
    const psi = gaussianPacket(GRID, { x0: settings.alpha * Math.SQRT2, sigma, k0: 0 });
    coeffs = project(STATES, psi, GRID.dx);
  }
  peak = 0;
  for (let f = 0; f <= 16; f++) {
    const p = superpose(STATES, coeffs, (f / 16) * PERIOD);
    for (let i = 0; i < GRID.n; i++) peak = Math.max(peak, p.re[i] ** 2 + p.im[i] ** 2);
  }
}

function classical(E) {
  const A = Math.sqrt(2 * E);
  return Float64Array.from(GRID.x, (x) => (Math.abs(x) < A * 0.999 ? 1 / (Math.PI * Math.sqrt(A * A - x * x)) : NaN));
}

const lesson = mountLesson({ slug: 'harmonic-oscillator', onNavigate: (i) => enterStep(i) });
const player = new Player($('player'), { duration: 2 * PERIOD, speed: 1.5, onTime: (time) => ((t = time), render()) });

function syncControls() {
  $('mode').value = settings.mode;
  $('n').value = String(settings.n);
  $('n-out').textContent = String(settings.n);
  $('alpha').value = String(settings.alpha);
  $('alpha-out').textContent = settings.alpha.toFixed(2);
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = !el.dataset.for.split(' ').includes(settings.mode)));
}

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  build();
  player.pause();
  player.seek(0);
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  if (STEPS[i].play) player.play();
}

function factorial(n) {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

function render() {
  const th = theme();
  const psi = superpose(STATES, coeffs, t);
  const weights = coeffs.map(([r, im]) => r * r + im * im);
  const meanE = weights.reduce((s, w, j) => s + w * STATES[j].E, 0);
  const included = new Set(weights.flatMap((w, j) => (w > 0.02 ? [j] : [])));
  drawDensity($('density'), {
    theme: th,
    x: GRID.x,
    re: psi.re,
    im: psi.im,
    V,
    vRange: [0, Math.max(8, meanE * 1.6)],
    yMax: peak * 1.1,
    xRange: X_RANGE,
    energy: meanE,
    energyLabel: `⟨E⟩ = ${meanE.toFixed(2)}`,
    stats: positionStats(GRID, psi),
    overlay: settings.mode === 'eigen' && settings.n >= 2 ? { values: classical(STATES[settings.n].E), color: th.text } : null,
  });
  drawStates($('levels'), {
    theme: th,
    x: GRID.x,
    V,
    states: STATES.slice(0, 8),
    vRange: [0, 9],
    xRange: X_RANGE,
    firstN: 0,
    selected: new Set([...included].filter((j) => j < 8)),
  });
  const mean = settings.alpha * settings.alpha;
  const poisson = weights.slice(0, SHOWN_COEFFS).map((_, n) =>
    settings.mode === 'coherent' ? (Math.exp(-mean) * mean ** n) / factorial(n) : 0,
  );
  barChart($('coeffs'), {
    theme: th,
    labels: weights.slice(0, SHOWN_COEFFS).map((_, n) => String(n)),
    exact: weights.slice(0, SHOWN_COEFFS),
    trotter: poisson,
    yMax: Math.min(1, Math.max(0.2, ...weights.slice(0, SHOWN_COEFFS)) * 1.1),
  });
  const ctx = { ...settings };
  lesson.render(
    STEPS.map((s, i) => ({ title: s.title, html: i === index ? (typeof s.html === 'function' ? s.html(ctx) : s.html) : '' })),
    index,
  );
}

const rebuild = () => {
  syncControls();
  build();
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
$('alpha').addEventListener('input', () => {
  settings.alpha = Number($('alpha').value);
  rebuild();
});
window.addEventListener('themechange', () => {
  drawPhaseWheel(stage.querySelector('.phase-wheel'));
  render();
});
new ResizeObserver(() => coeffs.length && render()).observe(stage);
drawPhaseWheel(stage.querySelector('.phase-wheel'));

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
