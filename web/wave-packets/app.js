import { percent } from '../lib/format.js';
import { Propagator, gaussianPacket, makeGrid, momentumDistribution, normalize, positionStats } from '../lib/wave.js';
import { FONT, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { drawPhaseWheel } from '../ui/dials.js';
import { mountLesson } from '../ui/lesson.js';
import { Player } from '../ui/player.js';
import { drawDensity, drawMomentum } from '../ui/wave-plot.js';

const GRID = makeGrid(1024, -40, 40);
const DT = 0.02;
const FRAME_DT = 0.1;
const DURATION = 12;
const K_RANGE = [-6, 6];

const STEPS = [
  {
    title: 'A particle is a wave',
    preset: { sigma: 1.5, k0: 0, shape: 'gaussian' },
    html: `<p>In quantum mechanics a particle is described by a <b>wavefunction</b> ψ(x). The filled curve is |ψ(x)|², the probability density: where the particle is likely to be found if you look.</p>
      <p>ψ is a complex number at every point. The <b>colour</b> shows its phase, using the same colour wheel as the amplitude dials. One colour everywhere means the particle isn't going anywhere.</p>`,
  },
  {
    title: 'Momentum is wavelength',
    preset: { sigma: 1.5, k0: 2, shape: 'gaussian' },
    html: ({ k0 }) => `<p>Give the packet momentum and the phase starts to wind: the colours cycle along x. The faster they cycle, the higher the momentum. This is de Broglie's rule, p = ħk = h/λ.</p>
      <p>Here k = ${k0}, so the wavelength is 2π/k ≈ ${(2 * Math.PI / Math.abs(k0 || 1)).toFixed(2)}. The <b>Momentum</b> panel shows the packet's momenta: a peak near k = ${k0}.</p>`,
  },
  {
    title: 'Squeeze it',
    preset: { sigma: 0.5, k0: 2, shape: 'gaussian' },
    html: `<p>Make the packet narrower in position and its momentum spread gets <b>wider</b>. A short burst of wave needs many wavelengths to build it.</p>
      <p>Drag <b>Width</b> in Try it back and forth and watch the two panels trade off.</p>`,
  },
  {
    title: "Heisenberg's limit",
    preset: { sigma: 1, k0: 2, shape: 'gaussian' },
    html: ({ product }) => `<p>The spreads can't both be small: Δx · Δp ≥ ħ/2. Here the product is <b>${product.toFixed(3)}</b> (in units of ħ).</p>
      <p>A Gaussian packet sits exactly on the limit, 0.5. Switch <b>Shape</b> to "Square" or "Two bumps" and the product rises above it. No shape can go below.</p>`,
  },
  {
    title: 'Let it go',
    preset: { sigma: 1, k0: 2, shape: 'gaussian' },
    play: true,
    html: `<p>Press <b>Play</b>. The packet moves at speed v = ħk/m and, at the same time, it <b>spreads</b>.</p>
      <p>Its momentum spread doesn't change (nothing pushes on it), but different momenta travel at different speeds, so the packet disperses. Δx grows; Δp stays put.</p>`,
  },
  {
    title: 'Sharper spreads faster',
    preset: { sigma: 0.5, k0: 2, shape: 'gaussian' },
    play: true,
    html: `<p>Start narrower and it spreads much faster: Δx(t) = σ√(1 + (t / 2σ²)²). Squeezing the position widened the momentum spread, and that spread is what makes it disperse.</p>
      <p>The chart under <b>Uncertainty</b> compares the simulation (dots) with this formula (line).</p>`,
  },
  {
    title: 'Your turn',
    preset: { sigma: 1.5, k0: -1.5, shape: 'twin' },
    html: `<p>Try "Two bumps": two packets side by side. Their momentum distribution shows <b>fringes</b>, the same interference as a double slit, but in momentum.</p>
      <p>Change width, momentum and shape, and switch the view to real and imaginary parts to see the wave underneath.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div id="player"></div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Position: |ψ(x)|²</h2><span class="legend"><canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> colour = phase; band = ⟨x⟩ ± Δx</span></figcaption>
    <canvas id="position" class="chart tall" role="img" aria-label="Probability density in position"></canvas>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Momentum: |φ(k)|²</h2><span class="legend">band = ⟨k⟩ ± Δk</span></figcaption>
      <canvas id="momentum" class="chart" role="img" aria-label="Probability density in momentum"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Uncertainty</h2><span class="legend">ħ = m = 1</span></figcaption>
      <dl class="facts" id="facts" style="margin-top: 0; border-top: 0; padding-top: 0"></dl>
      <canvas id="spread" class="chart" style="height: 150px" role="img" aria-label="Position spread over time"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Width σ <output id="sigma-out"></output></span>
      <input id="sigma" type="range" min="0.3" max="3" step="0.1"></label>
    <label class="field"><span class="label">Momentum k <output id="k0-out"></output></span>
      <input id="k0" type="range" min="-4" max="4" step="0.25"></label>
    <label class="field"><span class="label">Shape</span>
      <select id="shape"><option value="gaussian">Gaussian</option><option value="square">Square</option><option value="twin">Two bumps</option></select></label>
    <label class="field"><span class="label">Show</span>
      <select id="view"><option value="density">Probability density</option><option value="parts">Real and imaginary parts</option></select></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { sigma: 1.5, k0: 0, shape: 'gaussian' };
let frames = [];
let spreads = [];
let index = 0;
let t = 0;

function initial() {
  const { sigma, k0, shape } = settings;
  const x0 = Math.abs(k0) > 0.2 ? -Math.sign(k0) * 10 : 0;
  if (shape === 'gaussian') return gaussianPacket(GRID, { x0, sigma, k0 });
  const re = new Float64Array(GRID.n);
  const im = new Float64Array(GRID.n);
  for (let i = 0; i < GRID.n; i++) {
    const x = GRID.x[i];
    let a = 0;
    if (shape === 'square') a = Math.abs(x - x0) < Math.sqrt(3) * sigma ? 1 : 0;
    else a = Math.exp(-((x - x0 - 3 * sigma) ** 2) / (4 * sigma * sigma)) + Math.exp(-((x - x0 + 3 * sigma) ** 2) / (4 * sigma * sigma));
    re[i] = a * Math.cos(k0 * x);
    im[i] = a * Math.sin(k0 * x);
  }
  return normalize({ re, im }, GRID.dx);
}

function simulate() {
  const psi = initial();
  const prop = new Propagator(GRID, new Float64Array(GRID.n), DT, { absorb: 6 });
  frames = [];
  spreads = [];
  const steps = Math.round(FRAME_DT / DT);
  for (let f = 0; f <= DURATION / FRAME_DT; f++) {
    if (f > 0) prop.step(psi, steps);
    frames.push({ re: Float32Array.from(psi.re), im: Float32Array.from(psi.im) });
    spreads.push(positionStats(GRID, psi).spread);
  }
  frames.peak = Math.max(...frames[0].re.map((r, i) => r * r + frames[0].im[i] ** 2));
}

const lesson = mountLesson({ slug: 'wave-packets', onNavigate: (i) => enterStep(i) });
const player = new Player($('player'), { duration: DURATION, speed: 2, onTime: (time) => ((t = time), render()) });

function syncControls() {
  $('sigma').value = String(settings.sigma);
  $('k0').value = String(settings.k0);
  $('shape').value = settings.shape;
  $('sigma-out').textContent = settings.sigma.toFixed(1);
  $('k0-out').textContent = String(settings.k0);
}

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  simulate();
  player.pause();
  player.seek(0);
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  if (STEPS[i].play) player.play();
}

function drawSpreadChart(th) {
  const { ctx, w, h } = prep($('spread'));
  const box = { x0: 44, y0: 10, x1: w - 10, y1: h - 26 };
  const top = Math.max(...spreads) * 1.1;
  const Y = yAxis(ctx, box, [0, top], th);
  const X = xAxis(ctx, box, [0, DURATION], th);
  if (settings.shape === 'gaussian') {
    const s = settings.sigma;
    ctx.strokeStyle = th.exact;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const tt = (i / 100) * DURATION;
      const v = s * Math.sqrt(1 + (tt / (2 * s * s)) ** 2);
      if (i === 0) ctx.moveTo(X(tt), Y(v));
      else ctx.lineTo(X(tt), Y(v));
    }
    ctx.stroke();
  }
  ctx.fillStyle = th.accent2;
  spreads.forEach((v, f) => {
    const tt = f * FRAME_DT;
    if (tt > t + 1e-9 || f % 3) return;
    ctx.beginPath();
    ctx.arc(X(tt), Y(v), 2.5, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Δx over time', box.x0 + 6, box.y0);
}

function render() {
  const th = theme();
  const f = frames[Math.min(frames.length - 1, Math.round(t / FRAME_DT))];
  const psi = { re: f.re, im: f.im };
  const pos = positionStats(GRID, psi);
  const mom = momentumDistribution(GRID, psi);
  const parts = $('view').value === 'parts';
  drawDensity($('position'), {
    theme: th,
    x: GRID.x,
    re: f.re,
    im: f.im,
    V: null,
    vRange: [0, 1],
    yMax: frames.peak * 1.1,
    xRange: [-30, 30],
    stats: pos.total > 0.05 ? pos : null,
    parts,
  });
  drawMomentum($('momentum'), { theme: th, k: mom.k, prob: mom.prob, kRange: K_RANGE, stats: mom });
  const product = pos.spread * mom.spread;
  $('facts').innerHTML = `
    <dt>Position spread Δx</dt><dd>${pos.spread.toFixed(3)}</dd>
    <dt>Momentum spread Δp</dt><dd>${mom.spread.toFixed(3)}</dd>
    <dt>Δx · Δp</dt><dd><b>${product.toFixed(3)}</b> ${product < 0.5005 ? '(exactly the limit)' : `(${(product / 0.5).toFixed(2)}× the limit)`}</dd>
    <dt>Still on screen</dt><dd>${percent(pos.total)}</dd>`;
  drawSpreadChart(th);
  const ctx = { ...settings, product };
  lesson.render(
    STEPS.map((s, i) => ({ title: s.title, html: i === index ? (typeof s.html === 'function' ? s.html(ctx) : s.html) : '' })),
    index,
  );
}

for (const id of ['sigma', 'k0']) {
  $(id).addEventListener('input', () => {
    settings[id] = Number($(id).value);
    syncControls();
    simulate();
    player.seek(0);
  });
}
$('shape').addEventListener('change', () => {
  settings.shape = $('shape').value;
  simulate();
  player.seek(0);
});
$('view').addEventListener('change', render);
window.addEventListener('themechange', () => {
  drawPhase();
  render();
});
new ResizeObserver(() => frames.length && render()).observe(stage);

function drawPhase() {
  drawPhaseWheel(stage.querySelector('.phase-wheel'));
}
drawPhase();

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
