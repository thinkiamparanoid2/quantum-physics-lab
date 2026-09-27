import { eigenstates, makeGrid, shoot } from '../lib/wave.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { withAlpha } from '../ui/bloch.js';
import { mountLesson } from '../ui/lesson.js';

// The shooting method: start at the left wall with psi = 0, integrate the Schrodinger equation
// to the right (Numerov) for a trial energy, and look at what the solution does at the far wall.
// Levels found by bisection are checked against the finite-difference matrix solver
// (a different method) and, where there is one, the textbook formula.
const POTENTIALS = {
  oscillator: {
    label: 'Harmonic oscillator',
    grid: makeGrid(1000, -6, 6),
    V: (x) => (x * x) / 2,
    eRange: [0, 8],
    xRange: [-5, 5],
    formula: (k) => k + 0.5,
    formulaLabel: 'n + ½',
  },
  box: {
    label: 'Infinite box (width π)',
    grid: makeGrid(800, 0, Math.PI),
    V: () => 0,
    eRange: [0, 14],
    xRange: [-0.4, Math.PI + 0.4],
    formula: (k) => (k + 1) ** 2 / 2,
    formulaLabel: 'n²/2',
    walls: true,
  },
  well: {
    label: 'Finite well (depth 6)',
    grid: makeGrid(1000, -5, 5),
    V: (x) => (Math.abs(x) < 1.5 ? 0 : 6),
    eRange: [0, 7.5],
    xRange: [-4, 4],
  },
  double: {
    label: 'Double well',
    grid: makeGrid(1000, -5, 5),
    V: (x) => 0.08 * (x * x - 6.25) ** 2,
    eRange: [0, 6],
    xRange: [-4.6, 4.6],
  },
};
for (const p of Object.values(POTENTIALS)) {
  p.values = Float64Array.from(p.grid.x, p.V);
  p.matrix = eigenstates(p.values, p.grid.dx, 8).map((s) => s.E);
  p.found = new Map();
}

const STEPS = [
  {
    title: 'Solving for allowed energies',
    preset: { pot: 'oscillator', E: 1.2 },
    html: `<p>The Schrödinger equation is a recipe: know ψ and its slope at one point, and it tells you how ψ bends at the next. So <b>guess an energy</b>, start at the left wall with ψ = 0 and follow the recipe to the right.</p>
      <p>At E = 1.2 the solution looks fine in the middle, but past the parabola it flies off to infinity. A wavefunction that blows up can't be normalised: <b>this energy is not allowed</b>.</p>`,
  },
  {
    title: 'Tune the energy',
    preset: { pot: 'oscillator', E: 0.45 },
    html: `<p>At E = 0.45 the tail flies <b>up</b>. Drag <b>Energy</b> slowly past 0.5: the tail flips and flies <b>down</b>. Somewhere in between it must land exactly on zero, and that energy is allowed.</p>
      <p>The lower chart shows the tail at the far wall for every energy (on a log scale). Every crossing of zero is an energy level.</p>`,
  },
  {
    title: 'Home in by halving',
    preset: { pot: 'oscillator', E: 0.2 },
    find: true,
    html: `<p>Computers find the crossing by <b>bisection</b>: keep an energy where the tail goes up and one where it goes down, try the midpoint, keep the half where the sign still flips. Each try halves the uncertainty.</p>
      <p>Fifty halvings pin the level to 15 digits. The table compares it with the formula n + ½ and with a completely different method (diagonalising a matrix). Press <b>Find the next level</b> to go on.</p>`,
  },
  {
    title: 'Count the nodes',
    preset: { pot: 'oscillator', E: 3.2 },
    html: ({ nodes }) => `<p>At E = 3.2 the solution crosses zero ${nodes} times, and exactly ${nodes} levels lie below 3.2 (0.5, 1.5, 2.5). That's no coincidence: the <b>oscillation theorem</b> says the number of nodes counts the levels below E.</p>
      <p>So to find level k, bisect on "more than k nodes or not". No guessing where the levels are, and none can be skipped.</p>`,
  },
  {
    title: 'The box, by shooting',
    preset: { pot: 'box', E: 1 },
    find: true,
    html: `<p>The same method works for any potential. In the box the far wall forces ψ = 0 there too, so allowed energies make the wave land exactly on the right wall.</p>
      <p>Shooting reproduces E<sub>n</sub> = n²/2 from the particle-in-a-box lesson. Keep pressing <b>Find the next level</b>.</p>`,
  },
  {
    title: 'A finite well: only a few fit',
    preset: { pot: 'well', E: 0.3 },
    find: true,
    html: `<p>With walls of finite height the wave leaks into them and decays: the tails you saw in tunnelling. Now there is no formula, but shooting and the matrix method still agree.</p>
      <p>Only four levels fit below the rim. Push the energy above 6 and the particle is no longer bound.</p>`,
  },
  {
    title: 'Double well: levels in pairs',
    preset: { pot: 'double', E: 0.5 },
    find: 2,
    html: ({ split }) => `<p>Two wells separated by a hump. The levels come in <b>pairs</b>: the lower one is symmetric (no node in the middle), the upper one antisymmetric (a node at the centre).</p>
      <p>The tiny gap within a pair${split ? `, here ΔE = ${split.toFixed(4)},` : ''} is set by tunnelling through the hump: a particle placed in one well hops to the other in a time π/ΔE${
        split ? ` ≈ ${Math.round(Math.PI / split)}` : ''
      }. Ammonia molecules flip exactly like this, which gave the first maser.</p>`,
  },
  {
    title: 'Your turn',
    preset: { pot: 'double', E: 2.8 },
    html: `<p>Pick a potential, drag the energy, and find every level. Notice how the higher pair of the double well is split much more than the lowest: near the top of the hump tunnelling is easy.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>Shooting from the left wall</h2><span class="legend">ψ(x) drawn on the amber energy line; found levels in violet</span></figcaption>
    <canvas id="shot" class="chart tall" role="img" aria-label="The shooting solution for the chosen energy"></canvas>
    <dl class="facts" id="facts"></dl>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Tail at the far wall</h2><span class="legend">zero = allowed energy</span></figcaption>
      <canvas id="tail" class="chart" style="height: 260px" role="img" aria-label="Value of the solution at the far wall against energy"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Levels found</h2><span class="legend">shooting vs matrix method</span></figcaption>
      <div id="table"></div>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Potential</span>
      <select id="pot">${Object.entries(POTENTIALS)
        .map(([k, p]) => `<option value="${k}">${p.label}</option>`)
        .join('')}</select></label>
    <label class="field"><span class="label">Energy E <output id="E-out"></output></span>
      <input id="E" type="range" step="0.0005"></label>
    <div class="row" style="margin-top: 12px">
      <button class="btn btn-primary" type="button" id="find">Find the next level</button>
      <button class="btn" type="button" id="clear">Clear</button>
    </div>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { pot: 'oscillator', E: 1 };
let index = 0;
let search = null; // running bisection: { a, b, k, it, timer }
let queued = null; // timer for the next of several finds

const pot = () => POTENTIALS[settings.pot];

// Scale for drawing: the largest |psi| where the particle is classically allowed (V < E),
// so a diverging tail visibly flies off the plot.
function run(p, E) {
  const { psi, nodes, wall } = shoot(p.values, p.grid.dx, E);
  let inside = 0;
  for (let i = 1; i < psi.length; i++) if (psi[i] * psi[i - 1] < 0) inside++;
  let scale = 0;
  for (let i = 0; i < psi.length; i++) if (p.values[i] < E) scale = Math.max(scale, Math.abs(psi[i]));
  if (scale === 0) for (let i = 0; i < psi.length / 2; i++) scale = Math.max(scale, Math.abs(psi[i]));
  return { psi, nodes, inside, scale, tail: wall / scale };
}

const signedLog = (r) => Math.sign(r) * Math.log10(1 + Math.abs(r));

function tailCurve(p) {
  if (!p.tailCurve) {
    const [e0, e1] = p.eRange;
    const energies = Array.from({ length: 500 }, (_, i) => e0 + ((i + 0.5) / 500) * (e1 - e0));
    // Extra samples close to each level, so nearly equal pairs (double well) both show up.
    for (const L of p.matrix) for (let j = -40; j <= 40; j++) energies.push(L + Math.sign(j) * 1e-4 * 1.25 ** Math.abs(j));
    p.tailCurve = energies
      .filter((E) => E > e0 && E < e1)
      .sort((a, b) => a - b)
      .map((E) => [E, signedLog(run(p, E).tail)]);
  }
  return p.tailCurve;
}

function syncControls() {
  const p = pot();
  $('pot').value = settings.pot;
  $('E').min = String(p.eRange[0]);
  $('E').max = String(p.eRange[1]);
  $('E').value = String(settings.E);
  $('E-out').textContent = settings.E.toFixed(4);
}

function stopSearch() {
  if (search) clearTimeout(search.timer);
  clearTimeout(queued);
  search = null;
  $('find').disabled = false;
}

// Bisect for the first level above the current energy, showing each midpoint.
function findNext(times = 1) {
  stopSearch();
  const p = pot();
  // Start a hair above E, so standing exactly on a found level moves on to the next one.
  const start = settings.E + 1e-7;
  const k = run(p, start).nodes;
  let b = start;
  let db = 0.25;
  while (run(p, b).nodes <= k) {
    b += db;
    db *= 1.5;
    if (b > p.eRange[1] * 4) return;
  }
  search = { a: start, b, k, it: 0 };
  $('find').disabled = true;
  const tick = () => {
    const m = (search.a + search.b) / 2;
    if (run(p, m).nodes > search.k) search.b = m;
    else search.a = m;
    search.it++;
    settings.E = Math.min(p.eRange[1], (search.a + search.b) / 2);
    if (search.it >= 52) {
      const E = (search.a + search.b) / 2;
      p.found.set(search.k, E);
      settings.E = E;
      stopSearch();
      if (times > 1) queued = setTimeout(() => findNext(times - 1), 700);
    } else {
      search.timer = setTimeout(tick, search.it < 14 ? 220 : 25);
    }
    syncControls();
    render();
  };
  search.timer = setTimeout(tick, 150);
  render();
}

function drawShot(th, p, shot) {
  const { ctx, w, h } = prep($('shot'));
  const box = { x0: 48, y0: 12, x1: w - 14, y1: h - 28 };
  const [e0, e1] = p.eRange;
  const Y = yAxis(ctx, box, [e0, e1], th);
  const X = xAxis(ctx, box, p.xRange, th);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  const { x } = p.grid;
  // potential
  ctx.beginPath();
  ctx.moveTo(X(x[0]), box.y1);
  for (let i = 0; i < x.length; i += 2) ctx.lineTo(X(x[i]), Math.max(box.y0, Y(p.values[i])));
  ctx.lineTo(X(x[x.length - 1]), box.y1);
  ctx.closePath();
  ctx.fillStyle = withAlpha(th.muted, 0.13);
  ctx.fill();
  ctx.strokeStyle = th.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < x.length; i += 2) {
    const y = Math.max(box.y0 - 2, Y(p.values[i]));
    if (i === 0) ctx.moveTo(X(x[i]), y);
    else ctx.lineTo(X(x[i]), y);
  }
  ctx.stroke();
  // hard walls at the ends of the grid
  ctx.fillStyle = withAlpha(th.muted, 0.35);
  ctx.fillRect(box.x0, box.y0, X(p.grid.xmin) - box.x0, box.y1 - box.y0);
  ctx.fillRect(X(p.grid.xmax), box.y0, box.x1 - X(p.grid.xmax), box.y1 - box.y0);
  // levels found so far
  ctx.font = MONO;
  for (const [k, E] of p.found) {
    ctx.strokeStyle = withAlpha(th.accent, 0.75);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(box.x0, Math.round(Y(E)) + 0.5);
    ctx.lineTo(box.x1, Math.round(Y(E)) + 0.5);
    ctx.stroke();
    ctx.fillStyle = th.accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`E${String(k).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d])}`, box.x0 + 4, Y(E) - 2);
  }
  // psi on the energy line
  const amp = 0.14 * (box.y1 - box.y0);
  const base = Y(settings.E);
  ctx.strokeStyle = th.marked;
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(box.x0, Math.round(base) + 0.5);
  ctx.lineTo(box.x1, Math.round(base) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(X(p.grid.xmin), base);
  const clamp = (v) => Math.max(-8, Math.min(8, v));
  for (let i = 0; i < x.length; i++) ctx.lineTo(X(x[i]), base - clamp(shot.psi[i] / shot.scale) * amp);
  ctx.stroke();
  ctx.fillStyle = th.text;
  for (let i = 1; i < x.length - 1; i++) {
    if (shot.psi[i] * shot.psi[i + 1] < 0) {
      ctx.beginPath();
      ctx.arc(X(x[i]), base, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.font = FONT;
  ctx.fillStyle = th.marked;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`E = ${settings.E.toFixed(4)}`, box.x1 - 4, base - 4);
}

function drawTail(th, p) {
  const { ctx, w, h } = prep($('tail'));
  const box = { x0: 48, y0: 12, x1: w - 14, y1: h - 28 };
  const curve = tailCurve(p);
  const m = Math.max(0.5, ...curve.map(([, v]) => Math.abs(v)));
  const X = xAxis(ctx, box, p.eRange, th);
  const Y = yAxis(ctx, box, [-m, m], th);
  ctx.strokeStyle = th.axis;
  ctx.beginPath();
  ctx.moveTo(box.x0, Math.round(Y(0)) + 0.5);
  ctx.lineTo(box.x1, Math.round(Y(0)) + 0.5);
  ctx.stroke();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = withAlpha(th.accent, 0.6);
  for (const E of p.matrix) {
    if (E > p.eRange[1]) continue;
    ctx.beginPath();
    ctx.moveTo(Math.round(X(E)) + 0.5, box.y0);
    ctx.lineTo(Math.round(X(E)) + 0.5, box.y1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2;
  ctx.beginPath();
  curve.forEach(([E, v], i) => (i === 0 ? ctx.moveTo(X(E), Y(v)) : ctx.lineTo(X(E), Y(v))));
  ctx.stroke();
  const v = signedLog(run(p, settings.E).tail);
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(X(settings.E), Y(Math.max(-m, Math.min(m, v))), 5, 0, 2 * Math.PI);
  ctx.fill();
  if (search) {
    ctx.fillStyle = withAlpha(th.marked, 0.18);
    ctx.fillRect(X(search.a), box.y0, Math.max(1, X(search.b) - X(search.a)), box.y1 - box.y0);
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('energy E', (box.x0 + box.x1) / 2, h);
}

function drawTable(p) {
  const rows = p.matrix
    .map((E, k) => [k, E])
    .filter(([, E]) => E < p.eRange[1])
    .map(([k, E]) => {
      const s = p.found.get(k);
      const ref = p.formula ? p.formula(k) : E;
      return `<tr><td>${k}</td><td>${s === undefined ? '<span class="muted">not yet</span>' : s.toFixed(6)}</td><td>${E.toFixed(6)}</td>${
        p.formula ? `<td>${ref.toFixed(6)}</td>` : ''
      }<td>${s === undefined ? '' : Math.abs(s - ref).toExponential(1)}</td></tr>`;
    })
    .join('');
  $('table').innerHTML = `<div class="table-scroll"><table class="data-table"><thead><tr><th>level</th><th>shooting</th><th>matrix</th>${
    p.formula ? `<th>${p.formulaLabel}</th>` : ''
  }<th>difference</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function render() {
  const th = theme();
  const p = pot();
  const shot = run(p, settings.E);
  drawShot(th, p, shot);
  drawTail(th, p);
  drawTable(p);
  const r = shot.tail;
  const verdict = Math.abs(r) < 0.02 ? '<b>lands on zero: allowed!</b>' : r > 0 ? 'flies up: not allowed' : 'flies down: not allowed';
  $('facts').innerHTML = `
    <dt>Tail at the far wall</dt><dd>${verdict}</dd>
    <dt>Nodes</dt><dd>${
      Math.abs(r) < 0.02
        ? `${shot.inside}, so this is level ${shot.inside}`
        : `${shot.nodes} (counting the far wall), so ${shot.nodes} level${shot.nodes === 1 ? '' : 's'} below this energy`
    }</dd>
    ${search ? `<dt>Bisection</dt><dd>try ${search.it}: level inside a window of width ${(search.b - search.a).toExponential(1)}</dd>` : ''}`;
  const f = p.found;
  const ctx = { ...settings, nodes: shot.nodes, split: f.has(0) && f.has(1) ? f.get(1) - f.get(0) : null };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

const lesson = mountLesson({ slug: 'shooting-method', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  stopSearch();
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
  if (STEPS[i].find) findNext(STEPS[i].find === true ? 1 : STEPS[i].find);
}

$('pot').addEventListener('change', () => {
  stopSearch();
  settings.pot = $('pot').value;
  settings.E = pot().eRange[0] + 0.1;
  syncControls();
  render();
});
$('E').addEventListener('input', () => {
  stopSearch();
  settings.E = Number($('E').value);
  $('E-out').textContent = settings.E.toFixed(4);
  render();
});
$('find').addEventListener('click', () => findNext());
$('clear').addEventListener('click', () => {
  stopSearch();
  pot().found.clear();
  render();
});
window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
