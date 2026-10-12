import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// Confinement and string breaking in the lattice Schwinger model: ground states with two static
// charges at every separation, by Lanczos in a Web Worker (lib/schwinger.js stringPotential). The
// tests check the energies and particle numbers against an independent numpy build.

const runs = new Map(); // key -> { status, progress, results }
let task = null;
let lessonApi = null;
const keyOf = (s) => `${s.N}|${s.x}|${s.mass}|${s.g}`;

function start(s) {
  const key = keyOf(s);
  if (runs.has(key)) return;
  task?.cancel();
  const entry = { status: 'running', progress: 0, results: null };
  runs.set(key, entry);
  task = runTask(new URL('../lib/schwinger.js', import.meta.url), 'stringPotential', { N: s.N, x: s.x, mass: s.mass, g: s.g }, {
    onProgress: (p) => {
      entry.progress = p;
      lessonApi?.redraw();
    },
  });
  task.promise
    .then((results) => {
      entry.status = 'done';
      entry.results = results;
      lessonApi?.redraw();
    })
    .catch(() => {
      if (entry.status === 'running') runs.delete(key);
    });
}

const current = (s) => {
  const e = runs.get(keyOf(s));
  if (!e?.results) return { entry: e, row: null, vac: null };
  const len = s.len % 2 ? s.len : s.len + 1;
  const row = e.results.find((r) => r.length === Math.min(len, s.N - 3)) ?? e.results[e.results.length - 1];
  return { entry: e, row, vac: e.results[0] };
};

function waiting(ctx, w, h, th, entry) {
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Finding ground states… ${Math.round((entry?.progress ?? 0) * 100)}%`, w / 2, h / 2);
}

function drawString(api) {
  const { ctx, w, h } = prep(api.canvas('string'));
  const th = api.theme;
  const s = api.settings;
  const { entry, row, vac } = current(s);
  if (!row) return waiting(ctx, w, h, th, entry);
  const N = s.N;
  const x0 = 46;
  const x1 = w - 46;
  const X = (n) => x0 + (n / (N - 1)) * (x1 - x0);
  const yF = h * 0.36;
  const yS = h * 0.7;
  // field on links
  for (let n = 0; n + 1 < N; n++) {
    const L = row.field[n];
    const xm = (X(n) + X(n + 1)) / 2;
    const hgt = Math.max(-1.3, Math.min(1.3, L)) * (h * 0.2);
    ctx.fillStyle = withAlpha(L >= 0 ? th.marked : th.accent, 0.85);
    ctx.fillRect(xm - 9, yF - Math.max(0, hgt), 18, Math.abs(hgt));
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fmt(L, 2), xm, yF + 4);
  }
  ctx.strokeStyle = withAlpha(th.muted, 0.4);
  ctx.beginPath();
  ctx.moveTo(x0, yF);
  ctx.lineTo(x1, yF);
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('electric field ⟨L⟩ on each link: the flux string', 8, yF - h * 0.2 - 6);
  // sites: extra particles relative to the vacuum, and the static charges
  for (let n = 0; n < N; n++) {
    const extra = row.particles[n] - vac.particles[n];
    const col = n % 2 ? th.accent2 : th.ampNeg;
    ctx.beginPath();
    ctx.arc(X(n), yS, 15, 0, 2 * Math.PI);
    ctx.fillStyle = th.surfaceSolid;
    ctx.fill();
    ctx.strokeStyle = withAlpha(col, 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (extra > 0.01) {
      ctx.beginPath();
      ctx.arc(X(n), yS, 15 * Math.sqrt(Math.min(1, extra)), 0, 2 * Math.PI);
      ctx.fillStyle = col;
      ctx.fill();
    }
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fmt(extra, 2), X(n), yS + 20);
    if (n === row.a || n === row.b) {
      const plus = n === row.a;
      ctx.beginPath();
      ctx.arc(X(n), yS - 40, 13, 0, 2 * Math.PI);
      ctx.fillStyle = plus ? th.marked : th.accent;
      ctx.fill();
      ctx.fillStyle = th.surfaceSolid;
      ctx.font = '700 16px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(plus ? '+' : '−', X(n), yS - 39);
    }
  }
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('sites: particles beyond the vacuum’s own (pink = particle sites, blue = antiparticle sites) · discs above = static charges', 8, h - 4);
}

function drawPotential(api) {
  const { ctx, w, h } = prep(api.canvas('potential'));
  const th = api.theme;
  const s = api.settings;
  const { entry, row } = current(s);
  if (!row) return waiting(ctx, w, h, th, entry);
  const res = entry.results;
  const box = { x0: 56, y0: 18, x1: w - 16, y1: h - 36 };
  const lmax = s.N - 2;
  const vmax = Math.max(...res.map((r) => r.energy), s.g * lmax * 0.6) * 1.15;
  const X = (l) => box.x0 + (l / lmax) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - (v / vmax) * (box.y1 - box.y0);
  ctx.strokeStyle = th.axis;
  ctx.beginPath();
  ctx.moveTo(box.x0, box.y0);
  ctx.lineTo(box.x0, box.y1);
  ctx.lineTo(box.x1, box.y1);
  ctx.stroke();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let l = 0; l <= lmax; l++) ctx.fillText(String(l), X(l), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('separation ℓ (links of flux string)', (box.x0 + box.x1) / 2, box.y1 + 18);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = MONO;
  for (let v = 0; v <= vmax; v += 1) ctx.fillText(String(v), box.x0 - 6, Y(v));
  // the bare string g ℓ
  ctx.strokeStyle = withAlpha(th.text, 0.5);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(Math.min(lmax, vmax / s.g)), Y(Math.min(vmax, s.g * lmax)));
  ctx.stroke();
  ctx.setLineDash([]);
  // the computed potential
  ctx.strokeStyle = th.ampNeg;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  res.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.length), Y(r.energy)));
  ctx.stroke();
  for (const r of res) {
    ctx.beginPath();
    ctx.arc(X(r.length), Y(r.energy), r === row ? 7 : 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = r.extra > 1 ? th.marked : th.ampNeg;
    ctx.fill();
  }
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.text;
  ctx.fillText('V(ℓ) = E₀(with charges) − E₀(vacuum)', box.x0 + 10, box.y0);
  ctx.fillStyle = withAlpha(th.text, 0.6);
  ctx.fillText('dashed: g ℓ, an unbroken string of unit flux', box.x0 + 10, box.y0 + 18);
  ctx.fillStyle = th.marked;
  ctx.fillText('amber: a pair has appeared', box.x0 + 10, box.y0 + 36);
}

function readout(api) {
  const s = api.settings;
  const { entry, row } = current(s);
  const box = api.el('readout');
  if (!row) {
    box.innerHTML = '<p class="hint">Computing ground states in the background…</p>';
    return;
  }
  const broken = row.extra > 1;
  box.innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Separation ℓ</span><b>${row.length}</b></div>
      <div class="stat"><span>Energy V(ℓ)</span><b>${fmt(row.energy, 3)}</b></div>
      <div class="stat"><span>Particles beyond the vacuum</span><b>${fmt(row.extra, 2)}</b></div>
      <div class="stat"><span>String</span><b>${broken ? 'broken' : 'intact'}</b></div></div>
    <p class="hint">${broken ? 'A particle–antiparticle pair has come out of the vacuum and sits next to the static charges, screening them: the flux between them is mostly gone.' : 'The flux string stretches between the charges; its energy grows with its length.'} Ground states on ${s.N} sites (hopping x = ${s.x}), ${entry.results.length - 1} separations.</p>`;
}

const STEPS = [
  {
    title: 'Two static charges',
    preset: { N: 12, x: 0.5, mass: 0.8, g: 0.5, len: 1 },
    focus: ['The flux string', 'String or no string'],
    html: `<p>Place a heavy positive and a heavy negative charge in the Schwinger model's vacuum, one link apart. They do not move: think of them as a quark and an antiquark. Gauss's law forces an electric flux of one unit along the link between them, a <b>flux string</b>.</p>
      <p>Everything here is the exact ground state of 12 qubits, found by the Lanczos method.</p>`,
  },
  {
    title: 'Pull them apart',
    preset: { N: 12, x: 0.5, mass: 0.8, g: 0.5, len: 5 },
    focus: ['The flux string', 'Energy against separation'],
    html: `<p>Five links apart, the string is five links long. Its energy is g per link, so the energy grows linearly with separation: the force between the charges does not weaken with distance. That is <b>confinement</b>.</p>
      <p>Honesty note: in one dimension even classical electrostatics gives a linear potential (field lines cannot spread out). In 3D QCD the gluon field squeezes itself into a tube to the same effect. The genuinely quantum part comes next.</p>`,
    math: `<span class="eq">V(ℓ) ≈ g ℓ   (strong coupling, no pairs)</span>
      With hopping the string is dressed by virtual pairs, so the slope is slightly less than g.`,
  },
  {
    title: 'The string breaks',
    preset: { N: 12, x: 0.5, mass: 0.8, g: 0.5, len: 7 },
    focus: ['The flux string', 'Energy against separation', 'String or no string'],
    html: `<p>At seven links the string's energy would exceed the cost of creating a particle–antiparticle pair. So the ground state changes character: a pair appears out of the vacuum, the antiparticle settles next to the + charge and the particle next to the − charge, and the flux between them almost vanishes. The energy stops rising.</p>
      <p>In QCD this is why you never see a free quark: pulling a quark–antiquark pair apart makes new pairs, and the result is two mesons. Lattice QCD sees the same flattening, and in 2024–2025 several groups began observing string breaking on quantum processors.</p>`,
    predict: {
      q: 'Make the particles heavier (m = 1.2). Where does the string break?',
      options: ['At a shorter separation', 'At a longer separation, or not on this lattice', 'At the same place', 'It never forms'],
      answer: 1,
      why: 'A heavier pair costs more, so the string must store more energy, and be longer, before breaking pays.',
    },
  },
  {
    title: 'Heavier pairs, longer strings',
    preset: { N: 12, x: 0.5, mass: 1.2, g: 0.5, len: 7 },
    focus: ['Energy against separation', 'String or no string'],
    html: `<p>With m = 1.2 the string survives at seven links and breaks only at nine. The break happens where the string's energy g ℓ overtakes the energy of the broken configuration: the pair's rest mass plus the field and hopping energy of the screened charges. Here that is about 2.8 at m = 0.8 and about 3.6 at m = 1.2, more than the bare 2m, so the naive estimate ℓ ≈ 2m/g comes out too short.</p>`,
  },
  {
    title: 'A stronger string breaks sooner',
    preset: { N: 12, x: 0.5, mass: 0.8, g: 1, len: 5 },
    focus: ['Energy against separation', 'String or no string'],
    html: `<p>Double the coupling g and the string tension doubles: the energy rises twice as steeply and reaches the pair threshold at a shorter separation.</p>`,
  },
  {
    title: 'How we know it is right',
    preset: { N: 12, x: 0.5, mass: 0.8, g: 0.5, len: 7 },
    html: `<p>The tests rebuild the Hamiltonian independently in numpy, straight from bit strings (mass, Gauss's law, hopping between neighbouring sites), diagonalise it in the neutral sector, and compare ground energies and particle numbers with these Lanczos results to 10⁻⁸. A smaller 6-site case is also compared with full dense diagonalisation.</p>`,
  },
  {
    title: 'Your turn',
    preset: { N: 12, x: 0.5, mass: 0.8, g: 0.5, len: 3 },
    html: `<p>Find the parameters where the string breaks at the shortest separation, and where it survives the whole lattice. What does more hopping x do to the sharpness of the break?</p>`,
  },
];

lessonApi = runLesson({
  slug: 'string-breaking',
  settings: { N: 12, x: 0.5, mass: 0.8, g: 0.5, len: 1 },
  controls: [
    { id: 'len', label: 'Separation ℓ (odd)', type: 'range', min: 1, max: 9, step: 2 },
    { id: 'mass', label: 'Mass m', type: 'range', min: 0.2, max: 2, step: 0.1, format: (v) => v.toFixed(1) },
    { id: 'g', label: 'Coupling g (string tension)', type: 'range', min: 0.2, max: 1.5, step: 0.1, format: (v) => v.toFixed(1) },
    { id: 'x', label: 'Hopping x', type: 'range', min: 0.1, max: 1.5, step: 0.1, format: (v) => v.toFixed(1) },
    { id: 'N', label: 'Sites', type: 'choice', options: [[10, '10'], [12, '12']] },
  ],
  cards: [
    { id: 'string', title: 'The flux string', legend: 'exact ground state', height: 300 },
    { id: 'potential', title: 'Energy against separation', legend: 'one ground state per separation', height: 280 },
    { id: 'readout', title: 'String or no string', kind: 'html' },
  ],
  steps: STEPS,
  draw(api) {
    start(api.settings);
    drawString(api);
    drawPotential(api);
    readout(api);
  },
});
