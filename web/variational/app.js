import { eigenstates, makeGrid, potentialFrom } from '../lib/wave.js';
import { withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// The variational principle: for any trial state, <H> >= E0. Trial energies are computed on a grid
// (kinetic energy from finite differences, the same discretisation the exact solver uses), so the
// bound holds exactly here too. tests/approx.test.js checks the Gaussian case analytically.

const GRID = makeGrid(900, -9, 9);
const POTENTIALS = {
  oscillator: { name: 'Harmonic oscillator', V: (x) => (x * x) / 2, yMax: 4 },
  quartic: { name: 'Quartic well x⁴', V: (x) => x ** 4, yMax: 4 },
  vee: { name: 'V-shaped well |x|', V: (x) => Math.abs(x), yMax: 4 },
  double: { name: 'Double well', V: (x) => 0.25 * (x * x - 4) ** 2, yMax: 6 },
};
const FAMILIES = {
  gauss: 'One Gaussian: width s',
  pair: 'Two Gaussians at ±c: width s',
};

const STEPS = [
  {
    title: 'Guess a wavefunction',
    preset: { pot: 'quartic', fam: 'gauss', s: 1.2, c: 0 },
    html: `<p>For most potentials the ground state can't be written down. So <b>guess</b>: a Gaussian bump (amber) with an adjustable width s.</p>
      <p>Its average energy ⟨H⟩ = ⟨kinetic⟩ + ⟨potential⟩ is easy to compute. A narrow bump costs kinetic energy (it curves sharply); a wide one costs potential energy (it spreads up the walls).</p>`,
  },
  {
    title: 'You can never go too low',
    preset: { pot: 'quartic', fam: 'gauss', s: 0.3, c: 0 },
    html: ({ E, E0 }) => `<p>Here ⟨H⟩ = ${E.toFixed(4)}, and the true ground energy is ${E0.toFixed(4)} (dashed). Drag the width: the curve of ⟨H⟩ always stays <b>above</b> the dashed line.</p>
      <p>This is the <b>variational principle</b>: every trial state is a mix of the true states, and mixing in any excited state can only raise the average energy.</p>`,
  },
  {
    title: 'The best guess',
    preset: { pot: 'quartic', fam: 'gauss', s: 0.5, c: 0, optimise: true },
    html: ({ E, E0 }) => `<p>So the lowest ⟨H⟩ is the best estimate, and it's guaranteed to be an upper bound. The best Gaussian gives ${E.toFixed(4)}, only ${(((E - E0) / E0) * 100).toFixed(1)}% above the exact ${E0.toFixed(4)}.</p>
      <p>The trial (amber) and the exact state (cyan) nearly coincide: energy errors are second order in wavefunction errors, which is why the method is so forgiving.</p>`,
  },
  {
    title: 'When the guess is right',
    preset: { pot: 'oscillator', fam: 'gauss', s: 0.5, c: 0, optimise: true },
    html: `<p>For the harmonic oscillator the true ground state <b>is</b> a Gaussian, so the best trial lands exactly on the answer: ⟨H⟩ = ½ at width s = 1/√2.</p>`,
  },
  {
    title: 'A better family of guesses',
    preset: { pot: 'double', fam: 'gauss', s: 0.6, c: 0, optimise: true },
    html: ({ E, E0 }) => `<p>In a double well one bump in the middle is a poor guess: its best energy ${E.toFixed(3)} is far above ${E0.toFixed(3)}. Switch the <b>Trial</b> to two Gaussians at ±c and optimise again.</p>
      <p>A trial that captures the right physics (one lump per well) gets far closer. Choosing good trial families is the whole art of the method.</p>`,
  },
  {
    title: 'Chemistry and quantum computers',
    preset: { pot: 'double', fam: 'pair', s: 0.5, c: 2, optimise: true },
    html: `<p>Quantum chemistry runs on this idea: molecular orbitals are optimised combinations of atomic ones. The variational quantum eigensolver (VQE) does the same on a quantum computer: a parametrised circuit prepares the trial state and the hardware measures ⟨H⟩.</p>
      <p>The guarantee never changes: whatever you get is an upper bound on the true energy.</p>`,
  },
  {
    title: 'Your turn',
    preset: { pot: 'vee', fam: 'gauss', s: 1, c: 0 },
    html: `<p>Find the best Gaussian for the V-shaped well by hand, then press <b>Optimise</b> to check. How close can a Gaussian get to a state whose true shape is an Airy function?</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>Trial and exact ground state</h2><span class="legend">amber = your trial; cyan = exact; grey = potential</span></figcaption>
    <canvas id="wave" class="chart tall" role="img" aria-label="Trial wavefunction against the exact ground state"></canvas>
    <dl class="facts" id="facts"></dl>
  </figure>
  <figure class="panel card">
    <figcaption class="card-head"><h2>⟨H⟩ against the width</h2><span class="legend">dashed = true ground energy; dot = your trial</span></figcaption>
    <canvas id="curve" class="chart" role="img" aria-label="Trial energy against width"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Potential</span>
      <select id="pot">${Object.entries(POTENTIALS)
        .map(([k, p]) => `<option value="${k}">${p.name}</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Trial</span>
      <select id="fam">${Object.entries(FAMILIES)
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Width s <output id="s-out"></output></span><input id="s" type="range" min="0.1" max="3" step="0.01"></label>
    <label class="field" data-for="pair"><span class="label">Separation c <output id="c-out"></output></span><input id="c" type="range" min="0" max="4" step="0.02"></label>
    <button id="optimise" class="btn btn-primary" type="button" style="margin-top: 14px">Optimise</button>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { pot: 'quartic', fam: 'gauss', s: 1, c: 0 };
let index = 0;
let exact = null;
let V = null;

function trial(s, c) {
  const g = (x0) => (x) => Math.exp(-((x - x0) ** 2) / (4 * s * s));
  const f = settings.fam === 'pair' ? (x) => g(-c)(x) + g(c)(x) : g(0);
  const psi = Float64Array.from(GRID.x, f);
  let n = 0;
  for (const v of psi) n += v * v * GRID.dx;
  const k = 1 / Math.sqrt(n);
  for (let i = 0; i < psi.length; i++) psi[i] *= k;
  return psi;
}

// <H> with the same finite-difference kinetic energy as the exact solver (psi = 0 beyond the grid).
function energyOf(psi) {
  const dx = GRID.dx;
  let T = 0;
  let U = 0;
  for (let i = 0; i < psi.length; i++) {
    const next = i + 1 < psi.length ? psi[i + 1] : 0;
    T += 0.5 * ((next - psi[i]) / dx) ** 2 * dx;
    U += V[i] * psi[i] * psi[i] * dx;
  }
  T += 0.5 * (psi[0] / dx) ** 2 * dx;
  return T + U;
}

const E = (s, c = settings.c) => energyOf(trial(s, c));

function optimise() {
  // coordinate descent with golden-section line searches
  const golden = (f, lo, hi) => {
    const g = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 60; i++) {
      const a = hi - g * (hi - lo);
      const b = lo + g * (hi - lo);
      if (f(a) < f(b)) hi = b;
      else lo = a;
    }
    return (lo + hi) / 2;
  };
  for (let round = 0; round < (settings.fam === 'pair' ? 6 : 1); round++) {
    settings.s = golden((s) => E(s), 0.1, 3);
    if (settings.fam === 'pair') settings.c = golden((c) => E(settings.s, c), 0, 4);
  }
}

function rebuild() {
  V = potentialFrom(GRID, POTENTIALS[settings.pot].V);
  const [st] = eigenstates(V, GRID.dx, 1);
  let peak = 0;
  for (const v of st.psi) if (Math.abs(v) > Math.abs(peak)) peak = v;
  exact = { E: st.E, psi: peak < 0 ? st.psi.map((v) => -v) : st.psi };
}

function drawWave(th, psi) {
  const { ctx, w, h } = prep($('wave'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 28 };
  const X = xAxis(ctx, box, [-5, 5], th);
  const peak = Math.max(...exact.psi, ...psi) * 1.15;
  const Y = yAxis(ctx, box, [0, peak], th);
  const yMax = POTENTIALS[settings.pot].yMax;
  const Yv = (v) => box.y1 - (v / yMax) * (box.y1 - box.y0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  ctx.fillStyle = withAlpha(th.muted, 0.12);
  ctx.beginPath();
  ctx.moveTo(X(GRID.x[0]), box.y1);
  GRID.x.forEach((x, i) => ctx.lineTo(X(x), Math.max(box.y0, Yv(V[i]))));
  ctx.lineTo(X(GRID.x[GRID.n - 1]), box.y1);
  ctx.fill();
  const line = (vals, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(GRID.x[i]), Y(v)));
    ctx.stroke();
  };
  line(exact.psi, th.ampPos, 2.5);
  line(psi, th.marked, 2.5);
  ctx.restore();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('position x', (box.x0 + box.x1) / 2, h);
}

function drawCurve(th, Enow) {
  const { ctx, w, h } = prep($('curve'));
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const ss = Array.from({ length: 120 }, (_, i) => 0.1 * 30 ** (i / 119));
  const es = ss.map((s) => E(s));
  const best = Math.min(...es);
  const lo = exact.E - 0.15 * Math.max(0.3, best - exact.E + 0.3);
  const hi = exact.E + Math.max(1, 5 * (best - exact.E) + 0.6);
  const Y = yAxis(ctx, box, [lo, hi], th);
  const X = xAxis(ctx, box, [0, 3], th);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  ctx.strokeStyle = th.ampPos;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(box.x0, Math.round(Y(exact.E)) + 0.5);
  ctx.lineTo(box.x1, Math.round(Y(exact.E)) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ss.forEach((s, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(s), Y(es[i])));
  ctx.stroke();
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(X(settings.s), Y(Enow), 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`width s${settings.fam === 'pair' ? ` (at c = ${settings.c.toFixed(2)})` : ''}`, (box.x0 + box.x1) / 2, h);
}

function render() {
  const th = theme();
  const psi = trial(settings.s, settings.c);
  const Enow = energyOf(psi);
  drawWave(th, psi);
  drawCurve(th, Enow);
  let overlap = 0;
  for (let i = 0; i < psi.length; i++) overlap += psi[i] * exact.psi[i] * GRID.dx;
  $('facts').innerHTML = `
    <dt>Trial energy ⟨H⟩</dt><dd><b>${Enow.toFixed(4)}</b></dd>
    <dt>True ground energy</dt><dd>${exact.E.toFixed(4)} (${Enow >= exact.E - 1e-9 ? `${(((Enow - exact.E) / Math.abs(exact.E)) * 100).toFixed(2)}% above` : 'below?!'})</dd>
    <dt>Overlap with the true state</dt><dd>${(overlap * overlap * 100).toFixed(1)}%</dd>`;
  const ctx = { ...settings, E: Enow, E0: exact.E };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function syncControls() {
  $('pot').value = settings.pot;
  $('fam').value = settings.fam;
  for (const k of ['s', 'c']) {
    $(k).value = String(settings[k]);
    $(`${k}-out`).textContent = settings[k].toFixed(2);
  }
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== settings.fam));
}

for (const k of ['s', 'c']) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    syncControls();
    render();
  });
}
for (const k of ['pot', 'fam']) {
  $(k).addEventListener('change', () => {
    settings[k] = $(k).value;
    if (k === 'fam' && settings.fam === 'pair' && settings.c === 0) settings.c = 1.5;
    rebuild();
    syncControls();
    render();
  });
}
$('optimise').addEventListener('click', () => {
  optimise();
  syncControls();
  render();
});

const lesson = mountLesson({ slug: 'variational', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  const { optimise: opt, ...pre } = STEPS[i].preset;
  Object.assign(settings, pre);
  rebuild();
  if (opt) optimise();
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
