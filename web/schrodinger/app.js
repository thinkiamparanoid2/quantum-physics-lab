import { ExprError, compile } from '../lib/expr.js';
import { eigenstates, gaussianPacket, makeGrid, normalize, positionStats, project, superpose } from '../lib/wave.js';
import { barChart, theme } from '../ui/charts.js';
import { drawPhaseWheel } from '../ui/dials.js';
import { Player } from '../ui/player.js';
import { mountShell, shareButton } from '../ui/shell.js';
import { drawDensity, drawStates } from '../ui/wave-plot.js';

mountShell();

const GRID = makeGrid(700, -10, 10);
const COUNT = 110;
const SHOWN_BARS = 30;
const SHARE_POINTS = 140;
// Matches the plot box drawDensity uses, for turning pointer positions into (x, V).
const BOX = (w, h) => ({ x0: 48, y0: 12, x1: w - 14, y1: h - 28 });

const PRESETS = [
  { name: 'Harmonic oscillator', f: '0.5*x^2', desc: 'A particle on a spring. Evenly spaced levels; a displaced packet swings without spreading.', packet: [-4, 0.71, 0], duration: 20 },
  { name: 'Box', f: '0', desc: 'Nothing but the hard walls at ±10. Watch the packet bounce and blur; run for t = 1000 to catch it reviving (fully at t = 1600/π ≈ 509).', packet: [-5, 1, 3], duration: 60 },
  { name: 'Finite well', f: '6*(abs(x) > 2)', desc: 'A well of depth 6 and width 4: a few bound levels, then a continuum above the rim.', packet: [0, 0.6, 0], duration: 20 },
  { name: 'Double well', f: '0.1*(x^2 - 4)^2', desc: 'Two wells and a hump. Levels 0 and 1 together make a particle that tunnels from well to well, every 46 time units.', levels: [0, 1], duration: 200 },
  { name: 'Barrier in a box', f: '3*(abs(x) < 0.5)', desc: 'A thin wall higher than the packet’s energy. Part tunnels through each time it hits.', packet: [-5, 1.2, 2], duration: 20 },
  { name: 'Step', f: '2*(x > 0)', desc: 'A step up of height 2. The packet has just enough energy to climb it, yet part reflects.', packet: [-5, 1.5, 2.2], duration: 20 },
  { name: 'Crystal lattice', f: '1.5 + 1.5*cos(2*pi*x/2.5)', desc: 'A periodic potential, like atoms in a crystal. The levels bunch into bands with gaps between them.', packet: [-5, 1.5, 1], duration: 60 },
  { name: 'Constant force', f: '1.5*abs(x)', desc: 'A V-shaped potential: a constant force always pushes toward the middle. Its antisymmetric states are exactly those of a quantum ball bouncing on a floor under gravity.', packet: [5, 0.6, 0], duration: 20 },
  { name: 'Molecule (Morse)', f: '6*(1 - exp(-0.6*(x + 3)))^2', desc: 'The Morse potential of a chemical bond. Levels crowd together toward the dissociation energy 6.', packet: [-1.5, 0.4, 0], duration: 60 },
];

const $ = (id) => document.getElementById(id);
const state = {
  preset: 0,
  formula: PRESETS[0].f,
  drawn: null, // Float64Array when the potential was drawn by hand
  mode: 'packet',
  x0: -4,
  sigma: 0.71,
  k0: 0,
  levels: new Set([0, 1]),
  view: 'density',
  duration: 20,
};
let V = null;
let states = null;
let coeffs = [];
let captured = 1;
let meanE = 0;
let vRange = [0, 10];
let xRange = [-10, 10];
let peak = 1;
let drawing = false;
let frozenRange = null;
let t = 0;

$('preset').innerHTML = PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('') + '<option value="-1" hidden>Your own</option>';

const player = new Player($('player'), { duration: 20, onTime: (time) => ((t = time), render()) });

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.has('preset')) applyPreset(Math.max(0, Math.min(PRESETS.length - 1, Number(p.get('preset')) || 0)));
  if (p.has('V')) {
    state.formula = p.get('V').slice(0, 500);
    state.drawn = null;
    state.preset = -1;
  }
  if (p.has('drawn')) {
    const vals = p.get('drawn').split(/[_,]/).map(Number).slice(0, SHARE_POINTS);
    if (vals.length === SHARE_POINTS && vals.every(Number.isFinite)) {
      state.drawn = Float64Array.from(GRID.x, (x) => {
        const u = ((x - GRID.xmin) / (GRID.xmax - GRID.xmin)) * (SHARE_POINTS - 1);
        const i = Math.min(SHARE_POINTS - 2, Math.floor(u));
        return vals[i] + (u - i) * (vals[i + 1] - vals[i]);
      });
      state.preset = -1;
    }
  }
  for (const k of ['x0', 'sigma', 'k0']) if (p.has(k) && Number.isFinite(Number(p.get(k)))) state[k] = Number(p.get(k));
  if (p.get('mode') === 'levels' || p.get('mode') === 'packet') state.mode = p.get('mode');
  if (p.has('levels')) {
    const lv = p.get('levels').split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < COUNT);
    if (lv.length) state.levels = new Set(lv);
  }
  if (['20', '60', '200', '1000'].includes(p.get('t'))) state.duration = Number(p.get('t'));
}

function writeHash() {
  const p = new URLSearchParams();
  if (state.drawn) {
    const vals = Array.from({ length: SHARE_POINTS }, (_, i) => {
      const x = GRID.xmin + (i / (SHARE_POINTS - 1)) * (GRID.xmax - GRID.xmin);
      const j = Math.max(0, Math.min(GRID.n - 1, Math.round((x - GRID.x[0]) / GRID.dx)));
      return String(Math.round(state.drawn[j] * 100) / 100);
    });
    p.set('drawn', vals.join('_'));
  } else if (state.preset >= 0) p.set('preset', String(state.preset));
  else p.set('V', state.formula);
  p.set('mode', state.mode);
  if (state.mode === 'packet') for (const k of ['x0', 'sigma', 'k0']) p.set(k, String(state[k]));
  else p.set('levels', [...state.levels].sort((a, b) => a - b).join(','));
  p.set('t', String(state.duration));
  history.replaceState(null, '', `#${p}`);
}

function applyPreset(i) {
  const pr = PRESETS[i];
  state.preset = i;
  state.formula = pr.f;
  state.drawn = null;
  state.duration = pr.duration;
  if (pr.levels) {
    state.mode = 'levels';
    state.levels = new Set(pr.levels);
  } else {
    state.mode = 'packet';
    [state.x0, state.sigma, state.k0] = pr.packet;
  }
}

function syncControls() {
  $('preset').value = String(state.preset);
  $('preset-desc').textContent = state.preset >= 0 ? PRESETS[state.preset].desc : state.drawn ? 'A potential you drew.' : 'Your own formula.';
  if (document.activeElement !== $('formula')) $('formula').value = state.drawn ? '(drawn by hand)' : state.formula;
  $('mode').value = state.mode;
  for (const k of ['x0', 'sigma', 'k0']) {
    $(k).value = String(state[k]);
    $(`${k}-out`).textContent = state[k].toFixed(2);
  }
  $('view').value = state.view;
  $('duration').value = String(state.duration);
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== state.mode));
  $('draw').setAttribute('aria-pressed', String(drawing));
  $('draw-hint').hidden = !drawing;
  $('density').style.cursor = drawing ? 'crosshair' : '';
  $('density-legend').textContent = state.view === 'parts' ? 'violet = Re ψ, cyan = Im ψ' : 'colour = phase; amber = ⟨E⟩';
}

// Potential from the formula (or the drawing). Returns false and shows an error if it fails.
function buildPotential() {
  const err = $('formula-error');
  if (state.drawn) {
    V = Float64Array.from(state.drawn);
  } else {
    try {
      const f = compile(state.formula);
      const values = Float64Array.from(GRID.x, (x) => f(x));
      const bad = values.findIndex((v) => !Number.isFinite(v));
      if (bad >= 0) throw new ExprError(`V is not a finite number at x = ${GRID.x[bad].toFixed(2)}`);
      V = values;
    } catch (e) {
      if (!(e instanceof ExprError)) throw e;
      err.textContent = e.message;
      err.hidden = false;
      return false;
    }
  }
  err.hidden = true;
  // Keep the numbers in a range the solver handles well; walls higher than this act as hard walls anyway.
  for (let i = 0; i < V.length; i++) V[i] = Math.max(-1e4, Math.min(1e4, V[i]));
  states = eigenstates(V, GRID.dx, COUNT);
  return true;
}

function buildState() {
  if (state.mode === 'packet') {
    const psi = normalize(gaussianPacket(GRID, { x0: state.x0, sigma: state.sigma, k0: state.k0 }), GRID.dx);
    coeffs = project(states, psi, GRID.dx);
  } else {
    const a = 1 / Math.sqrt(state.levels.size || 1);
    coeffs = states.map((_, n) => (state.levels.has(n) ? [a, 0] : [0, 0]));
  }
  const w = coeffs.map(([r, i]) => r * r + i * i);
  captured = w.reduce((s, v) => s + v, 0);
  meanE = w.reduce((s, v, n) => s + v * states[n].E, 0) / (captured || 1);
  let vMax = -Infinity;
  let vMin = Infinity;
  for (const v of V) {
    vMax = Math.max(vMax, v);
    vMin = Math.min(vMin, v);
  }
  const top = Math.max(meanE * 1.6 + 0.5, Math.min(vMax, 3 * Math.abs(meanE) + 3) * 1.15, vMin + 1);
  vRange = frozenRange ?? [Math.min(0, vMin) - 0.05 * (top - vMin), top];
  // Zoom to where the potential is below the top of the plot (the full width while drawing).
  const inside = GRID.x.filter((_, i) => V[i] < vRange[1]);
  xRange =
    drawing || inside.length < 2
      ? [GRID.xmin, GRID.xmax]
      : [Math.max(GRID.xmin, inside[0] - 1.5), Math.min(GRID.xmax, inside[inside.length - 1] + 1.5)];
  peak = 0;
  for (let f = 0; f <= 12; f++) {
    const p = superpose(states, coeffs, (f / 12) * Math.min(state.duration, 20));
    for (let i = 0; i < GRID.n; i++) peak = Math.max(peak, p.re[i] ** 2 + p.im[i] ** 2);
  }
}

function rebuild({ potential = false } = {}) {
  if (potential && !buildPotential()) return;
  buildState();
  player.speed = state.duration / 20;
  player.setDuration(state.duration);
  syncControls();
  writeHash();
  render();
}

function render() {
  if (!states) return;
  const th = theme();
  const psi = superpose(states, coeffs, t);
  const stats = positionStats(GRID, psi);
  drawDensity($('density'), {
    theme: th,
    x: GRID.x,
    re: psi.re,
    im: psi.im,
    V,
    vRange,
    yMax: peak * 1.1,
    xRange,
    energy: meanE,
    energyLabel: `⟨E⟩ = ${meanE.toFixed(2)}`,
    stats: state.view === 'density' ? stats : null,
    parts: state.view === 'parts',
  });
  const shown = states.filter((s) => s.E < vRange[1]).length;
  const selected = new Set(coeffs.flatMap(([r, i], n) => (r * r + i * i > 0.01 && n < shown ? [n] : [])));
  drawStates($('levels'), {
    theme: th,
    x: GRID.x,
    V,
    states: states.slice(0, Math.max(1, Math.min(14, shown))),
    vRange,
    xRange,
    selected,
    firstN: 0,
  });
  const all = coeffs.map(([r, i]) => r * r + i * i);
  let last = 0;
  all.forEach((v, n) => v > 1e-3 && (last = n));
  const w = all.slice(0, Math.min(SHOWN_BARS, Math.max(10, last + 4)));
  barChart($('bars'), {
    theme: th,
    labels: w.map((_, n) => String(n)),
    exact: w,
    trotter: w.map(() => 0),
    yMax: Math.min(1, Math.max(0.1, ...w) * 1.15),
  });
  const warn = captured < 0.995 ? ' <span class="error">(narrow or fast packet: some energies lie above the levels computed)</span>' : '';
  $('stats').innerHTML = `
    <div>⟨E⟩ = <b>${meanE.toFixed(3)}</b></div>
    <div>⟨x⟩ = ${stats.mean.toFixed(2)}, Δx = ${stats.spread.toFixed(2)}</div>
    <div>Lowest levels: ${states
      .slice(0, 4)
      .map((s) => s.E.toFixed(3))
      .join(', ')}, …</div>
    <div>Captured by ${COUNT} levels: ${(captured * 100).toFixed(captured > 0.9999 ? 2 : 1)}%${warn}</div>`;
}

// ----- drawing the potential with the pointer -----

let lastPoint = null;
function pointToXV(e) {
  const c = $('density');
  const r = c.getBoundingClientRect();
  const box = BOX(r.width, r.height);
  const px = e.clientX - r.left;
  const py = e.clientY - r.top;
  const x = xRange[0] + ((px - box.x0) / (box.x1 - box.x0)) * (xRange[1] - xRange[0]);
  const v = vRange[0] + ((box.y1 - py) / (box.y1 - box.y0)) * (vRange[1] - vRange[0]);
  return [x, Math.max(vRange[0], Math.min(vRange[1] * 1.5, v))];
}
function paint(a, b) {
  const [xa, va] = a;
  const [xb, vb] = b;
  const lo = Math.min(xa, xb);
  const hi = Math.max(xa, xb);
  for (let i = 0; i < GRID.n; i++) {
    const x = GRID.x[i];
    if (x < lo - GRID.dx / 2 || x > hi + GRID.dx / 2) continue;
    const u = hi === lo ? 0 : (x - xa) / (xb - xa);
    state.drawn[i] = va + Math.max(0, Math.min(1, u)) * (vb - va);
  }
}
$('density').addEventListener('pointerdown', (e) => {
  if (!drawing) return;
  e.preventDefault();
  try {
    $('density').setPointerCapture(e.pointerId);
  } catch {
    // synthetic events have no capturable pointer
  }
  if (!state.drawn) state.drawn = Float64Array.from(V);
  state.preset = -1;
  frozenRange = [...vRange];
  lastPoint = pointToXV(e);
  paint(lastPoint, lastPoint);
  V = Float64Array.from(state.drawn);
  render();
});
$('density').addEventListener('pointermove', (e) => {
  if (!drawing || !lastPoint) return;
  const p = pointToXV(e);
  paint(lastPoint, p);
  lastPoint = p;
  V = Float64Array.from(state.drawn);
  render();
});
const endStroke = () => {
  if (!lastPoint) return;
  lastPoint = null;
  rebuild({ potential: true });
  frozenRange = null;
};
$('density').addEventListener('pointerup', endStroke);
$('density').addEventListener('pointercancel', endStroke);

$('draw').addEventListener('click', () => {
  drawing = !drawing;
  if (drawing) player.pause();
  rebuild();
});
$('smooth').addEventListener('click', () => {
  const src = state.drawn ?? V;
  const out = Float64Array.from(src, (_, i) => {
    let s = 0;
    let n = 0;
    for (let j = i - 4; j <= i + 4; j++) {
      if (j < 0 || j >= src.length) continue;
      s += src[j];
      n++;
    }
    return s / n;
  });
  state.drawn = out;
  state.preset = -1;
  rebuild({ potential: true });
});

// ----- the other controls -----

$('preset').addEventListener('change', () => {
  applyPreset(Number($('preset').value));
  t = 0;
  rebuild({ potential: true });
  player.seek(0);
});
let typing = null;
$('formula').addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => {
    state.formula = $('formula').value;
    state.drawn = null;
    state.preset = PRESETS.findIndex((p) => p.f === state.formula.trim());
    rebuild({ potential: true });
  }, 350);
});
$('mode').addEventListener('change', () => {
  state.mode = $('mode').value;
  rebuild();
});
for (const k of ['x0', 'sigma', 'k0']) {
  $(k).addEventListener('input', () => {
    state[k] = Number($(k).value);
    player.pause();
    player.seek(0);
    rebuild();
  });
}
$('view').addEventListener('change', () => {
  state.view = $('view').value;
  syncControls();
  render();
});
$('duration').addEventListener('change', () => {
  state.duration = Number($('duration').value);
  rebuild();
});
$('levels').addEventListener('click', (e) => {
  const c = $('levels');
  const r = c.getBoundingClientRect();
  const y = e.clientY - r.top;
  const box = { y0: 12, y1: r.height - 28 };
  const E = vRange[0] + ((box.y1 - y) / (box.y1 - box.y0)) * (vRange[1] - vRange[0]);
  const shown = states.slice(0, 14).filter((s) => s.E < vRange[1]);
  if (!shown.length) return;
  let n = 0;
  shown.forEach((s, j) => Math.abs(s.E - E) < Math.abs(shown[n].E - E) && (n = j));
  if (state.mode !== 'levels') {
    state.mode = 'levels';
    state.levels = new Set([n]);
  } else if (state.levels.has(n) && state.levels.size > 1) state.levels.delete(n);
  else state.levels.add(n);
  rebuild();
});

shareButton($('share'));
window.addEventListener('themechange', () => {
  drawPhaseWheel(document.querySelector('.phase-wheel'));
  render();
});
new ResizeObserver(() => render()).observe(document.querySelector('.viz'));
drawPhaseWheel(document.querySelector('.phase-wheel'));

applyPreset(0);
readHash();
rebuild({ potential: true });
