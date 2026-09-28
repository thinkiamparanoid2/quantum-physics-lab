import { kpBands, kronigPenney } from '../lib/approx.js';
import { eigenstates, makeGrid, potentialFrom } from '../lib/wave.js';
import { withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// A chain of N square wells (width a) separated by barriers (width b, height V0), between hard walls,
// solved exactly on a grid, next to the Kronig-Penney bands of the infinite crystal.
// The tests check that the chain's levels fall inside the Kronig-Penney bands.

const A = 1;
const E_MAX = 14;

const STEPS = [
  {
    title: 'One well',
    preset: { N: 1, V0: 6, b: 0.4, fill: 1, level: 0 },
    html: `<p>Start with one atom: an electron in a single well, with a few allowed energies (the lines on the left chart, where the horizontal axis is the number of wells).</p>
      <p>A crystal is this well repeated, over and over.</p>`,
  },
  {
    title: 'Two wells: every level splits',
    preset: { N: 2, V0: 6, b: 0.4, fill: 1, level: 1 },
    html: `<p>Put two wells side by side. Each level becomes a <b>pair</b>: a symmetric state a little lower and an antisymmetric one a little higher, just as in the double well. The electron can tunnel between the atoms.</p>
      <p>This is also how a chemical bond forms: the lower, symmetric state is the <b>bonding orbital</b>.</p>`,
  },
  {
    title: 'Many wells: bands',
    preset: { N: 8, V0: 6, b: 0.4, fill: 1, level: 3 },
    html: ({ N }) => `<p>With ${N} wells, each level splits into ${N} closely spaced levels. Drag <b>Wells</b> up: the levels fill in the shaded regions, the <b>energy bands</b>, and never stray into the gaps between them.</p>
      <p>A real crystal has about 10²³ atoms, so each band is effectively continuous.</p>`,
  },
  {
    title: 'The infinite crystal',
    preset: { N: 12, V0: 6, b: 0.4, fill: 1, level: 0 },
    html: `<p>For an endless crystal, Bloch's theorem says each state is a plane wave e<sup>ikx</sup> times a pattern that repeats with the lattice. Allowed energies satisfy the Kronig–Penney condition |f(E)| ≤ 1, which gives the shaded bands exactly.</p>
      <p><b>E(k)</b> (right) shows each band as a curve. The dashed parabola is a free electron: the lattice bends it and opens <b>gaps</b> at the zone edge.</p>`,
  },
  {
    title: 'Thicker walls, narrower bands',
    preset: { N: 12, V0: 10, b: 0.8, fill: 1, level: 0 },
    html: `<p>Make the barriers higher or thicker and tunnelling between atoms gets harder. The bands shrink toward the single-atom levels and the gaps widen. With thin, low barriers the electron barely notices the lattice and the bands merge.</p>`,
  },
  {
    title: 'Metals and insulators',
    preset: { N: 12, V0: 6, b: 0.4, fill: 1, level: 0 },
    html: ({ fill, metal }) => `<p>Each level holds two electrons (spin up and down), so a band of N levels holds 2N. With ${fill} electron${fill > 1 ? 's' : ''} per atom, the electrons fill the lowest levels up to the <b>Fermi level</b> (amber).</p>
      <p>${
        metal
          ? 'The top band is only partly full: an electron can move into an empty level just above for the tiniest push. That is a <b>metal</b>, like sodium or copper.'
          : 'The band is exactly full and the next empty level is across a gap. A small voltage can’t move anyone: an <b>insulator</b>, like diamond (or a semiconductor, if the gap is small).'
      } Switch <b>Electrons per atom</b> between 1 and 2. (In three dimensions bands can overlap, which is why magnesium, with 2 outer electrons per atom, is still a metal.)</p>`,
  },
  {
    title: 'Your turn',
    preset: { N: 6, V0: 4, b: 0.3, fill: 2, level: 6 },
    html: `<p>Change the wells, the barriers and the filling. Pick a level with <b>Show level</b> to see its wavefunction spread over the whole chain: band states belong to the crystal, not to any one atom.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The chain and one of its states</h2><span class="legend" id="chain-legend"></span></figcaption>
    <canvas id="chain" class="chart tall" role="img" aria-label="A chain of wells with its energy levels"></canvas>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Levels against the number of wells</h2><span class="legend">shaded = bands of the infinite crystal</span></figcaption>
      <canvas id="levels" class="chart" style="height: 320px" role="img" aria-label="Energy levels for 1 to 12 wells"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>E(k) of the infinite crystal</h2><span class="legend">dashed = free electron</span></figcaption>
      <canvas id="ek" class="chart" style="height: 320px" role="img" aria-label="Band structure: energy against crystal momentum"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Wells N <output id="N-out"></output></span><input id="N" type="range" min="1" max="12" step="1"></label>
    <label class="field"><span class="label">Barrier height V₀ <output id="V0-out"></output></span><input id="V0" type="range" min="1" max="12" step="0.5"></label>
    <label class="field"><span class="label">Barrier width <output id="b-out"></output></span><input id="b" type="range" min="0.1" max="1" step="0.05"></label>
    <label class="field"><span class="label">Electrons per atom</span><select id="fill"><option value="1">1</option><option value="2">2</option></select></label>
    <label class="field"><span class="label">Show level <output id="level-out"></output></span><input id="level" type="range" min="0" max="30" step="1"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { N: 8, V0: 6, b: 0.4, fill: 1, level: 0 };
let index = 0;
let chains = []; // chains[N] = { grid, V, states }
let bands = [];

function chain(N) {
  const period = A + settings.b;
  const L = N * period + settings.b;
  const grid = makeGrid(Math.min(2400, 260 * N + 200), 0, L);
  const V = potentialFrom(grid, (x) => ((x % period) < settings.b ? settings.V0 : 0));
  const states = eigenstates(V, grid.dx, 4 * N + 3).filter((s) => s.E < E_MAX);
  return { grid, V, states };
}

function rebuild() {
  chains = [];
  for (let N = 1; N <= 12; N++) chains[N] = chain(N);
  bands = kpBands({ V0: settings.V0, a: A, b: settings.b }, E_MAX);
}

// Energy levels with 2 electrons each; with `fill` electrons per atom the top filled level is
// number N*fill/2 (rounded up). Returns the Fermi level and whether its band is only partly full.
function fermi(N) {
  const { states } = chains[N];
  const electrons = N * settings.fill;
  const lastLevel = Math.ceil(electrons / 2) - 1;
  const Ef = states[Math.min(lastLevel, states.length - 1)]?.E ?? 0;
  const band = bands.findIndex(([lo, hi]) => Ef >= lo - 0.05 && Ef <= hi + 0.05);
  const levelsInBand = band < 0 ? 0 : states.filter((s) => s.E >= bands[band][0] - 0.05 && s.E <= bands[band][1] + 0.05).length;
  const below = band < 0 ? 0 : states.filter((s) => s.E < bands[band][0] - 0.05).length;
  const filledInBand = lastLevel + 1 - below;
  return { Ef, metal: filledInBand < levelsInBand || electrons % 2 === 1 };
}

function drawLevels(th) {
  const { ctx, w, h } = prep($('levels'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, E_MAX], th);
  const X = xAxis(ctx, box, [0.5, 12.5], th, { integer: true });
  ctx.fillStyle = withAlpha(th.ampPos, 0.14);
  for (const [lo, hi] of bands) ctx.fillRect(box.x0, Y(hi), box.x1 - box.x0, Y(lo) - Y(hi));
  for (let N = 1; N <= 12; N++) {
    const sel = N === settings.N;
    ctx.strokeStyle = sel ? th.accent2 : withAlpha(th.text, 0.75); // amber is reserved for filled levels
    ctx.lineWidth = sel ? 2 : 1.2;
    for (const s of chains[N].states) {
      ctx.beginPath();
      ctx.moveTo(X(N) - 16, Math.round(Y(s.E)) + 0.5);
      ctx.lineTo(X(N) + 16, Math.round(Y(s.E)) + 0.5);
      ctx.stroke();
    }
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('number of wells', (box.x0 + box.x1) / 2, h);
}

function drawEk(th) {
  const { ctx, w, h } = prep($('ek'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 30 };
  const period = A + settings.b;
  const kMax = Math.PI / period;
  const Y = yAxis(ctx, box, [0, E_MAX], th);
  const X = (k) => box.x0 + (k / kMax) * (box.x1 - box.x0);
  ctx.fillStyle = withAlpha(th.ampPos, 0.1);
  for (const [lo, hi] of bands) ctx.fillRect(box.x0, Y(hi), box.x1 - box.x0, Y(lo) - Y(hi));
  // free electron, folded into the first zone
  ctx.strokeStyle = withAlpha(th.muted, 0.8);
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.25;
  for (let fold = 0; fold < 6; fold++) {
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const k = (i / 200) * kMax;
      const K = fold % 2 === 0 ? k + fold * kMax : (fold + 1) * kMax - k;
      const E = (K * K) / 2;
      if (E > E_MAX) break;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(k), Y(E));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // bands: k(E) = acos(f(E)) / period
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  for (const [lo, hi] of bands) {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 300; i++) {
      const E = lo + (i / 300) * (Math.min(hi, E_MAX) - lo);
      const f = Math.max(-1, Math.min(1, kronigPenney(E, { V0: settings.V0, a: A, b: settings.b })));
      const k = Math.acos(f) / period;
      if (!started) ctx.moveTo(X(k), Y(E));
      else ctx.lineTo(X(k), Y(E));
      started = true;
    }
    ctx.stroke();
  }
  const { Ef } = fermi(settings.N);
  ctx.strokeStyle = th.marked;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x0, Math.round(Y(Ef)) + 0.5);
  ctx.lineTo(box.x1, Math.round(Y(Ef)) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = MONO;
  ctx.fillStyle = th.marked;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Fermi level', box.x1 - 4, Y(Ef) - 3);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('crystal momentum k (0 to π/period)', (box.x0 + box.x1) / 2, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${bands.length} bands below E = ${E_MAX}`, box.x0 + 4, box.y0);
}

function drawChain(th) {
  const { grid, V, states } = chains[settings.N];
  const sel = Math.min(settings.level, states.length - 1);
  const { ctx, w, h } = prep($('chain'));
  const box = { x0: 44, y0: 12, x1: w - 14, y1: h - 28 };
  const Y = yAxis(ctx, box, [0, E_MAX], th);
  const X = xAxis(ctx, box, [grid.xmin, grid.xmax], th);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  // bands of the infinite crystal
  ctx.fillStyle = withAlpha(th.ampPos, 0.08);
  for (const [lo, hi] of bands) ctx.fillRect(box.x0, Y(hi), box.x1 - box.x0, Y(lo) - Y(hi));
  // barriers
  ctx.fillStyle = withAlpha(th.muted, 0.22);
  const period = A + settings.b;
  for (let k = 0; k <= settings.N; k++) ctx.fillRect(X(k * period), Y(settings.V0), X(k * period + settings.b) - X(k * period), box.y1 - Y(settings.V0));
  // levels: occupied ones in amber (two electrons each)
  const occupied = Math.ceil((settings.N * settings.fill) / 2);
  states.forEach((st, n) => {
    ctx.strokeStyle = n < occupied ? withAlpha(th.marked, 0.75) : withAlpha(th.text, 0.35);
    ctx.lineWidth = n === sel ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(box.x0, Math.round(Y(st.E)) + 0.5);
    ctx.lineTo(box.x1, Math.round(Y(st.E)) + 0.5);
    ctx.stroke();
  });
  // the chosen state
  const st = states[sel];
  let peak = 0;
  for (const v of st.psi) peak = Math.max(peak, Math.abs(v));
  const amp = 0.14 * (box.y1 - box.y0);
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  grid.x.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(x), Y(st.E) - (st.psi[i] / peak) * amp));
  ctx.stroke();
  ctx.restore();
  ctx.font = MONO;
  ctx.fillStyle = th.ampPos;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`level ${sel}: E = ${st.E.toFixed(3)}`, box.x1 - 4, Y(st.E) - amp - 4 > box.y0 + 12 ? Y(st.E) - amp - 4 : box.y0 + 14);
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.fillText('position', (box.x0 + box.x1) / 2, h);
  $('chain-legend').textContent = `${settings.N} well${settings.N > 1 ? 's' : ''}; amber levels are filled with electrons`;
}

function render() {
  const th = theme();
  drawChain(th);
  drawLevels(th);
  drawEk(th);
  const ctx = { ...settings, metal: fermi(settings.N).metal };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

const fmt = { N: String, V0: (v) => v.toFixed(1), b: (v) => v.toFixed(2), level: String };

function syncControls() {
  for (const k of Object.keys(fmt)) {
    $(k).value = String(settings[k]);
    $(`${k}-out`).textContent = fmt[k](settings[k]);
  }
  $('level').max = String(chains.length ? chains[settings.N].states.length - 1 : 30);
  $('fill').value = String(settings.fill);
}

let pending = null;
for (const k of Object.keys(fmt)) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    $(`${k}-out`).textContent = fmt[k](settings[k]);
    if (k === 'V0' || k === 'b') {
      clearTimeout(pending);
      pending = setTimeout(() => {
        rebuild();
        syncControls();
        render();
      }, 80);
    } else {
      syncControls();
      render();
    }
  });
}
$('fill').addEventListener('change', () => {
  settings.fill = Number($('fill').value);
  render();
});

const lesson = mountLesson({ slug: 'bands', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  rebuild();
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
