import { boxPairDensity, meanSquaredSeparation } from '../lib/approx.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// Two particles in a box (width 1), one in level n1 and one in level n2: distinguishable, bosons
// (symmetric) or fermions (antisymmetric). The map shows the joint density |psi(x1, x2)|^2.
// lib/approx.js tests the exchange terms against the analytic result.

const RES = 120;
const KIND_NAMES = { distinguishable: 'distinguishable particles', bosons: 'identical bosons', fermions: 'identical fermions' };

const STEPS = [
  {
    title: 'Two particles in one box',
    preset: { kind: 'distinguishable', n1: 1, n2: 2, many: 6, manyKind: 'fermions' },
    html: `<p>Two particles share a box: one in level 1, one in level 2. The map shows where both are likely to be at once: particle 1's position across, particle 2's position up. The dashed diagonal is where they sit on top of each other.</p>
      <p>For two different particles (an electron and a muon, say) this is just the product of the two single-particle densities.</p>`,
  },
  {
    title: 'Identical means no labels',
    preset: { kind: 'bosons', n1: 1, n2: 2, many: 6, manyKind: 'fermions' },
    html: `<p>But two electrons are truly identical: nothing can tell "particle 1" from "particle 2". So swapping them can't change any probability: the map must be <b>mirror-symmetric</b> across the diagonal.</p>
      <p>That leaves two options for ψ itself: unchanged by the swap (<b>bosons</b>: photons, helium-4) or flipped in sign (<b>fermions</b>: electrons, protons, neutrons).</p>`,
  },
  {
    title: 'Bosons huddle together',
    preset: { kind: 'bosons', n1: 1, n2: 2, many: 6, manyKind: 'fermions' },
    html: ({ sep }) => `<p>For bosons the two arrangements add, and the density piles up <b>along the diagonal</b>: the particles are more likely to be found together. Their mean squared separation is ${sep.bosons.toFixed(4)}, against ${sep.distinguishable.toFixed(4)} for distinguishable particles.</p>
      <p>This bunching is what makes lasers and Bose–Einstein condensates possible.</p>`,
  },
  {
    title: 'Fermions keep apart',
    preset: { kind: 'fermions', n1: 1, n2: 2, many: 6, manyKind: 'fermions' },
    html: ({ sep }) => `<p>For fermions the two arrangements subtract, so ψ is <b>exactly zero on the diagonal</b>: two identical fermions with the same spin are never found at the same place. Their mean squared separation grows to ${sep.fermions.toFixed(4)}.</p>
      <p>No force pushes them apart: this "exchange hole" comes purely from the symmetry of the wavefunction.</p>`,
  },
  {
    title: 'The Pauli exclusion principle',
    preset: { kind: 'fermions', n1: 2, n2: 2, many: 6, manyKind: 'fermions' },
    html: `<p>Put both fermions (with the same spin) in the <b>same</b> level: the two arrangements are identical, they cancel completely, and the map is blank. There is no such state.</p>
      <p>Two identical fermions can never occupy the same quantum state: <b>Pauli's exclusion principle</b>. (Electrons also have spin, so two can share a level if their spins differ.)</p>`,
  },
  {
    title: 'Filling the levels',
    preset: { kind: 'fermions', n1: 1, n2: 2, many: 8, manyKind: 'fermions' },
    html: ({ many }) => `<p>Now add ${many} particles to the box. Fermions (lower chart) must stack up: two per level (spin up and down), filling to the <b>Fermi energy</b>. Switch to bosons: at zero temperature all of them drop into the lowest level.</p>
      <p>The stacked electrons carry a lot of energy even at absolute zero. That pressure holds up white dwarf stars against gravity.</p>`,
  },
  {
    title: 'The periodic table',
    preset: { kind: 'fermions', n1: 1, n2: 3, many: 10, manyKind: 'fermions' },
    html: `<p>In an atom the same rule stacks electrons into shells and subshells: 2 in 1s, then 2 in 2s and 6 in 2p, and so on. Atoms whose outer subshells are exactly full (helium, neon, argon) are inert; one electron beyond them (lithium, sodium, potassium) makes them eager to react.</p>
      <p>Chemistry, and the solidity of matter, rest on the antisymmetry of fermions.</p>`,
  },
  {
    title: 'Your turn',
    preset: { kind: 'fermions', n1: 1, n2: 3, many: 6, manyKind: 'bosons' },
    html: `<p>Try different pairs of levels. For levels 1 and 3 (both symmetric about the centre) the map shows a different pattern of bunching and avoidance: the exchange effect depends on the overlap of the two states.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2 id="map-title">Where both particles are</h2><span class="legend">brighter = more likely; dashed = same place</span></figcaption>
      <canvas id="map" class="chart" style="height: 380px" role="img" aria-label="Joint probability density of two particles"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>How far apart?</h2><span class="legend">probability of each separation |x₁ − x₂|</span></figcaption>
      <canvas id="sep" class="chart" style="height: 380px" role="img" aria-label="Distribution of the distance between the particles"></canvas>
    </figure>
  </div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Many particles in the box</h2><span class="legend" id="many-legend"></span></figcaption>
    <canvas id="many-chart" class="chart" style="height: 280px" role="img" aria-label="Filling of energy levels"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">The two particles are</span>
      <select id="kind">${Object.entries(KIND_NAMES)
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join('')}</select></label>
    <div class="row" style="margin-top: 14px">
      <label class="field"><span class="label">Level of one <output id="n1-out"></output></span><input id="n1" type="range" min="1" max="4" step="1"></label>
      <label class="field"><span class="label">Level of the other <output id="n2-out"></output></span><input id="n2" type="range" min="1" max="4" step="1"></label>
    </div>
    <label class="field"><span class="label">Particles in the lower chart <output id="many-out"></output></span><input id="many" type="range" min="1" max="12" step="1"></label>
    <label class="field"><span class="label">They are</span>
      <select id="manyKind"><option value="fermions">fermions with spin ½ (electrons)</option><option value="bosons">bosons</option></select></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { kind: 'distinguishable', n1: 1, n2: 2, many: 6, manyKind: 'fermions' };
let index = 0;

function drawMap(th) {
  const { ctx, w, h } = prep($('map'));
  const size = Math.min(w - 50, h - 40);
  const x0 = (w - size) / 2 + 12;
  const y0 = 8;
  const d = boxPairDensity(settings.n1, settings.n2, settings.kind, 1, RES);
  const peak = Math.max(1e-12, ...d);
  const img = new ImageData(RES, RES);
  const col = th.ampPos.match(/[0-9a-f]{2}/gi)?.map((c) => parseInt(c, 16)) ?? [46, 230, 245];
  for (let i = 0; i < RES; i++) {
    for (let j = 0; j < RES; j++) {
      const v = Math.sqrt(d[i * RES + j] / peak); // brightness ~ |psi|, so faint regions show
      const k = 4 * ((RES - 1 - j) * RES + i); // x1 across (i), x2 up (j)
      img.data[k] = col[0] * v;
      img.data[k + 1] = col[1] * v;
      img.data[k + 2] = col[2] * v;
      img.data[k + 3] = 255;
    }
  }
  const off = document.createElement('canvas');
  off.width = RES;
  off.height = RES;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, x0, y0, size, size);
  ctx.strokeStyle = withAlpha(th.text, 0.7);
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, y0 + size);
  ctx.lineTo(x0 + size, y0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = th.axis;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('x₁ (particle 1) →', x0 + size / 2, y0 + size + 6);
  ctx.save();
  ctx.translate(x0 - 10, y0 + size / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'bottom';
  ctx.fillText('x₂ (particle 2) →', 0, 0);
  ctx.restore();
  if (peak < 1e-10 || d.every((v) => v === 0)) {
    ctx.font = '600 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = th.ampNeg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ψ = 0 everywhere: no such state', x0 + size / 2, y0 + size / 2);
  }
}

function separationHist(kind) {
  const d = boxPairDensity(settings.n1, settings.n2, kind, 1, RES);
  const bins = 40;
  const out = new Array(bins).fill(0);
  let total = 0;
  for (let i = 0; i < RES; i++) {
    for (let j = 0; j < RES; j++) {
      const s = Math.abs(i - j) / RES;
      out[Math.min(bins - 1, Math.floor(s * bins))] += d[i * RES + j];
      total += d[i * RES + j];
    }
  }
  return total > 0 ? out.map((v) => (v / total) * bins) : out;
}

function drawSep(th) {
  const { ctx, w, h } = prep($('sep'));
  const box = { x0: 44, y0: 14, x1: w - 14, y1: h - 30 };
  const curves = ['distinguishable', 'bosons', 'fermions'].map((k) => [k, separationHist(k)]);
  const yMax = Math.max(1, ...curves.flatMap(([, c]) => c)) * 1.1;
  const Y = yAxis(ctx, box, [0, yMax], th);
  const X = xAxis(ctx, box, [0, 1], th);
  const colors = { distinguishable: withAlpha(th.muted, 0.9), bosons: th.marked, fermions: th.ampPos };
  for (const [k, c] of curves) {
    const on = k === settings.kind;
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = on ? 3 : 1.5;
    ctx.setLineDash(k === 'distinguishable' ? [5, 4] : []);
    ctx.beginPath();
    c.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X((i + 0.5) / c.length), Y(v)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.font = FONT;
  let ly = box.y0 + 4;
  for (const [k] of curves) {
    ctx.fillStyle = colors[k];
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(KIND_NAMES[k], box.x1 - 4, ly);
    ly += 16;
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('separation |x₁ − x₂| (box width 1)', (box.x0 + box.x1) / 2, h);
}

function drawMany(th) {
  const { ctx, w, h } = prep($("many-chart"));
  const box = { x0: 60, y0: 14, x1: w - 250, y1: h - 20 };
  const levels = 8;
  const E = (n) => n * n; // in units of E_1
  // levels drawn evenly spaced for legibility; their energies n^2 E1 are written beside them
  const Y = (n) => box.y1 - ((n - 0.5) / levels) * (box.y1 - box.y0);
  // occupation
  const occ = new Array(levels + 1).fill(0);
  if (settings.manyKind === 'bosons') occ[1] = settings.many;
  else for (let p = 0; p < settings.many; p++) occ[Math.floor(p / 2) + 1]++;
  let total = 0;
  let top = 1;
  for (let n = 1; n <= levels; n++) {
    const y = Math.round(Y(n)) + 0.5;
    ctx.strokeStyle = withAlpha(th.text, 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(box.x0, y);
    ctx.lineTo(box.x1, y);
    ctx.stroke();
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`n = ${n}`, box.x0 - 8, y);
    ctx.textAlign = 'left';
    ctx.fillText(`${E(n)} E₁`, box.x1 + 6, y);
    for (let k = 0; k < occ[n]; k++) {
      const x = box.x0 + 30 + k * 22;
      ctx.fillStyle = settings.manyKind === 'bosons' ? th.marked : k % 2 ? th.ampNeg : th.ampPos;
      ctx.beginPath();
      ctx.arc(x, y - 7, 7, 0, 2 * Math.PI);
      ctx.fill();
      if (settings.manyKind === 'fermions') {
        ctx.fillStyle = '#05060d';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(k % 2 ? '↓' : '↑', x, y - 7);
      }
    }
    total += occ[n] * E(n);
    if (occ[n]) top = n;
  }
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = [
    `${settings.many} ${settings.manyKind}`,
    `total energy: ${total} E₁`,
    settings.manyKind === 'fermions' ? `Fermi level: n = ${top}` : 'all in the ground state',
    `(${settings.manyKind === 'fermions' ? 'bosons' : 'fermions'} would have ${otherTotal()} E₁)`,
  ];
  lines.forEach((l, k) => ctx.fillText(l, box.x1 + 70, box.y0 + 10 + k * 22));
  $('many-legend').textContent = settings.manyKind === 'fermions' ? 'two per level: spin up (cyan) and down (pink)' : 'bosons can all share one level';
}

function otherTotal() {
  if (settings.manyKind === 'fermions') return settings.many; // all bosons in n = 1
  let t = 0;
  for (let p = 0; p < settings.many; p++) t += (Math.floor(p / 2) + 1) ** 2;
  return t;
}

function render() {
  const th = theme();
  drawMap(th);
  drawSep(th);
  drawMany(th);
  $('map-title').textContent = `Where both are: ${KIND_NAMES[settings.kind]}`;
  const sep = Object.fromEntries(['distinguishable', 'bosons', 'fermions'].map((k) => [k, meanSquaredSeparation(settings.n1, settings.n2, k, 1, 200)]));
  const ctx = { ...settings, sep };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function syncControls() {
  $('kind').value = settings.kind;
  $('manyKind').value = settings.manyKind;
  for (const k of ['n1', 'n2', 'many']) {
    $(k).value = String(settings[k]);
    $(`${k}-out`).textContent = String(settings[k]);
  }
}

for (const k of ['n1', 'n2', 'many']) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    syncControls();
    render();
  });
}
for (const k of ['kind', 'manyKind']) {
  $(k).addEventListener('change', () => {
    settings[k] = $(k).value;
    render();
  });
}

const lesson = mountLesson({ slug: 'identical-particles', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
