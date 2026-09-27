import { matrixElement, perturbed } from '../lib/approx.js';
import { eigenstates, makeGrid, potentialFrom } from '../lib/wave.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// H = H0 + lambda W. First- and second-order perturbation theory from the unperturbed states,
// against exact energies from diagonalising H on the same grid. Tested in tests/approx.test.js
// (linear field on the oscillator: second-order coefficient -1/2, matching the exact shift).

const SYSTEMS = {
  oscillator: { name: 'Harmonic oscillator', grid: makeGrid(900, -10, 10), V: (x) => (x * x) / 2, xRange: [-6, 6] },
  box: { name: 'Box (width π)', grid: makeGrid(700, 0, Math.PI), V: () => 0, xRange: [-0.2, Math.PI + 0.2] },
};
const PERTURBATIONS = {
  field: { name: 'Electric field: W = x', W: (x, sys) => (sys === 'box' ? x - Math.PI / 2 : x), lmax: 1 },
  quartic: { name: 'Stiffer spring: W = x⁴', W: (x, sys) => (sys === 'box' ? (x - Math.PI / 2) ** 4 : x ** 4), lmax: 0.4 },
  bump: { name: 'A bump in the middle', W: (x, sys) => 2 * Math.exp(-(((sys === 'box' ? x - Math.PI / 2 : x) / 0.4) ** 2)), lmax: 3 },
};

const STEPS = [
  {
    title: 'When you can’t solve it exactly',
    preset: { sys: 'oscillator', pert: 'quartic', n: 0, lambda: 0.1 },
    html: `<p>Almost no real problem has an exact solution. But many are a solvable one plus a small extra: H = H<sub>0</sub> + λW. Here: an oscillator with a slightly stiffer spring, W = x⁴.</p>
      <p><b>Perturbation theory</b> builds the answer as a series in λ, using only the states of H<sub>0</sub>. The charts compare it with the exact answer, computed numerically.</p>`,
  },
  {
    title: 'First order: average the extra',
    preset: { sys: 'oscillator', pert: 'quartic', n: 0, lambda: 0.05 },
    html: ({ r }) => `<p>To first order, the energy shifts by the <b>average of W</b> over the unperturbed state: E ≈ E<sub>0</sub> + λ⟨n|W|n⟩. Here ⟨0|x⁴|0⟩ = ${r.first.toFixed(4)} (exactly 3/4).</p>
      <p>That's the straight line in <b>Energy against λ</b>, tangent to the exact curve at λ = 0.</p>`,
  },
  {
    title: 'When the average is zero',
    preset: { sys: 'oscillator', pert: 'field', n: 0, lambda: 0.6 },
    html: `<p>Put a charged oscillator in an electric field: W = x. The average of x is zero by symmetry, so the first-order shift vanishes. Yet the exact energy clearly drops.</p>
      <p>The field pulls the state sideways, and the shift appears at <b>second order</b>: −λ²/2, which here happens to be exact. This is the quadratic Stark effect; its coefficient measures how easily the system is polarised.</p>`,
  },
  {
    title: 'Second order: levels repel',
    preset: { sys: 'oscillator', pert: 'field', n: 1, lambda: 0.6 },
    html: `<p>The second-order term is a sum over all other levels: |⟨m|W|n⟩|²/(E<sub>n</sub> − E<sub>m</sub>). Levels above push down, levels below push up, and closer levels push harder.</p>
      <p>So the ground state is always pushed <b>down</b> at second order. The table lists each order next to the exact energy.</p>`,
  },
  {
    title: 'The state changes too',
    preset: { sys: 'box', pert: 'field', n: 0, lambda: 1 },
    html: `<p>A tilted box: the particle leans toward the low side. To first order the new state is the old one plus a little of each other state, with amplitude ⟨m|W|n⟩/(E<sub>n</sub> − E<sub>m</sub>).</p>
      <p>The lower chart overlays the unperturbed state, that first-order estimate and the exact one.</p>`,
  },
  {
    title: 'Where it breaks down',
    preset: { sys: 'oscillator', pert: 'quartic', n: 2, lambda: 0.35 },
    html: ({ r, exact }) => `<p>Push λ up and the series drifts away from the truth: here second order gives ${r.order2.toFixed(3)} against the exact ${exact.toFixed(3)}. For x⁴ the full series never converges at all, yet its first terms are excellent for small λ.</p>
      <p>Perturbation theory is how the Zeeman and Stark effects, hydrogen's fine structure and quantum electrodynamics' famous precision are calculated.</p>`,
  },
  {
    title: 'Your turn',
    preset: { sys: 'box', pert: 'bump', n: 1, lambda: 1 },
    html: `<p>A bump in the middle of a box shifts level 1 (a node in the middle) far less than level 0: the average of W depends on where the state lives. Try other levels and perturbations.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Energy against λ</h2><span class="legend">cyan = exact; amber dashed = 1st order; violet dotted = 2nd order</span></figcaption>
      <canvas id="energy" class="chart" style="height: 320px" role="img" aria-label="Energy against perturbation strength"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>The numbers</h2><span class="legend" id="num-legend"></span></figcaption>
      <div id="table"></div>
    </figure>
  </div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>The state</h2><span class="legend">grey = unperturbed; dashed = first-order estimate; cyan = exact</span></figcaption>
    <canvas id="state" class="chart" role="img" aria-label="The wavefunction before and after the perturbation"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Solvable system H₀</span>
      <select id="sys">${Object.entries(SYSTEMS)
        .map(([k, s]) => `<option value="${k}">${s.name}</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Perturbation W</span>
      <select id="pert">${Object.entries(PERTURBATIONS)
        .map(([k, s]) => `<option value="${k}">${s.name}</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Level n <output id="n-out"></output></span><input id="n" type="range" min="0" max="5" step="1"></label>
    <label class="field"><span class="label">Strength λ <output id="lambda-out"></output></span><input id="lambda" type="range" min="0" max="1" step="0.01"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { sys: 'oscillator', pert: 'quartic', n: 0, lambda: 0.1 };
let index = 0;
let model = null;

function rebuild() {
  const sys = SYSTEMS[settings.sys];
  const g = sys.grid;
  const V0 = potentialFrom(g, sys.V);
  const W = Float64Array.from(g.x, (x) => PERTURBATIONS[settings.pert].W(x, settings.sys));
  const states = eigenstates(V0, g.dx, 40);
  const lmax = PERTURBATIONS[settings.pert].lmax;
  const n = settings.n;
  const coeff = perturbed(states, W, g.dx, n, 1);
  const lambdas = Array.from({ length: 31 }, (_, i) => (i / 30) * lmax);
  const exact = lambdas.map((l) => eigenstates(Float64Array.from(V0, (v, i) => v + l * W[i]), g.dx, n + 1)[n].E);
  model = { g, V0, W, states, lmax, coeff, lambdas, exact };
}

function exactAt(l) {
  const { g, V0, W } = model;
  return eigenstates(Float64Array.from(V0, (v, i) => v + l * W[i]), g.dx, settings.n + 1)[settings.n];
}

function drawEnergy(th) {
  const { ctx, w, h } = prep($('energy'));
  const box = { x0: 52, y0: 14, x1: w - 14, y1: h - 30 };
  const { lambdas, exact, coeff, lmax } = model;
  const o1 = lambdas.map((l) => coeff.E0 + l * coeff.first);
  const o2 = lambdas.map((l) => coeff.E0 + l * coeff.first + l * l * coeff.second);
  const all = [...exact, ...o1, ...o2];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 0.5;
  const Y = yAxis(ctx, box, [lo - pad, hi + pad], th);
  const X = xAxis(ctx, box, [0, lmax], th);
  const line = (vals, color, width, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(lambdas[i]), Y(v)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line(exact, th.ampPos, 3, []);
  line(o1, th.marked, 2, [7, 5]);
  line(o2, th.accent, 2.5, [2, 4]);
  ctx.strokeStyle = withAlpha(th.text, 0.5);
  ctx.beginPath();
  ctx.moveTo(Math.round(X(settings.lambda)) + 0.5, box.y0);
  ctx.lineTo(Math.round(X(settings.lambda)) + 0.5, box.y1);
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`strength λ; level n = ${settings.n}`, (box.x0 + box.x1) / 2, h);
}

function drawState(th, ex) {
  const { ctx, w, h } = prep($('state'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 28 };
  const { g, states } = model;
  const n = settings.n;
  // first-order state: psi_n + lambda sum_m <m|W|n>/(E_n - E_m) psi_m
  const first = Float64Array.from(states[n].psi);
  for (let m = 0; m < states.length; m++) {
    if (m === n) continue;
    const c = (settings.lambda * matrixElement(states, model.W, g.dx, m, n)) / (states[n].E - states[m].E);
    for (let i = 0; i < first.length; i++) first[i] += c * states[m].psi[i];
  }
  let norm = 0;
  for (const v of first) norm += v * v * g.dx;
  for (let i = 0; i < first.length; i++) first[i] /= Math.sqrt(norm);
  // align the sign of the exact state with the unperturbed one
  let dot = 0;
  for (let i = 0; i < ex.psi.length; i++) dot += ex.psi[i] * states[n].psi[i];
  const exPsi = dot < 0 ? ex.psi.map((v) => -v) : ex.psi;
  const peak = Math.max(...states[n].psi.map(Math.abs), ...exPsi.map(Math.abs), ...first.map(Math.abs));
  const Y = yAxis(ctx, box, [-peak * 1.1, peak * 1.1], th);
  const X = xAxis(ctx, box, SYSTEMS[settings.sys].xRange, th);
  const line = (vals, color, width, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(g.x[i]), Y(v)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line(states[n].psi, withAlpha(th.muted, 0.9), 1.5);
  line(first, th.marked, 2, [7, 5]);
  line(exPsi, th.ampPos, 2.5);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('position x', (box.x0 + box.x1) / 2, h);
}

// 4 decimals without a stray minus sign on zero
const clean = (v) => (Math.abs(v) < 5e-5 ? 0 : v).toFixed(4);

function render() {
  const th = theme();
  drawEnergy(th);
  const ex = exactAt(settings.lambda);
  drawState(th, ex);
  const r = perturbed(model.states, model.W, model.g.dx, settings.n, settings.lambda);
  const err = (v) => (v - ex.E).toExponential(1);
  $('table').innerHTML = `<table class="data-table"><tbody>
    <tr><td>Unperturbed E<sub>${settings.n}</sub></td><td>${r.E0.toFixed(5)}</td><td>${err(r.E0)}</td></tr>
    <tr><td>+ first order λ⟨n|W|n⟩</td><td>${r.order1.toFixed(5)}</td><td>${err(r.order1)}</td></tr>
    <tr><td>+ second order</td><td>${r.order2.toFixed(5)}</td><td>${err(r.order2)}</td></tr>
    <tr><td><b>Exact</b> (numerical)</td><td><b>${ex.E.toFixed(5)}</b></td><td></td></tr>
  </tbody></table>
  <p class="hint" style="margin-top: 10px">Right column: error against the exact energy. ⟨n|W|n⟩ = ${clean(r.first)}, second-order coefficient ${clean(r.second)}.</p>`;
  $('num-legend').textContent = `at λ = ${settings.lambda.toFixed(2)}`;
  const ctx = { ...settings, r, exact: ex.E };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function syncControls() {
  $('sys').value = settings.sys;
  $('pert').value = settings.pert;
  const lmax = PERTURBATIONS[settings.pert].lmax;
  $('lambda').max = String(lmax);
  $('lambda').step = String(lmax / 100);
  settings.lambda = Math.min(settings.lambda, lmax);
  $('lambda').value = String(settings.lambda);
  $('lambda-out').textContent = settings.lambda.toFixed(2);
  $('n').value = String(settings.n);
  $('n-out').textContent = String(settings.n);
}

for (const k of ['sys', 'pert']) {
  $(k).addEventListener('change', () => {
    settings[k] = $(k).value;
    syncControls();
    rebuild();
    render();
  });
}
$('n').addEventListener('input', () => {
  settings.n = Number($('n').value);
  syncControls();
  rebuild();
  render();
});
$('lambda').addEventListener('input', () => {
  settings.lambda = Number($('lambda').value);
  syncControls();
  render();
});

const lesson = mountLesson({ slug: 'perturbation', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  rebuild();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
