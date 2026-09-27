import { seededRandom } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { machZehnder } from '../lib/optics.js';
import { withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { drawInterferometer } from '../ui/interferometer.js';
import { mountLesson } from '../ui/lesson.js';

// Single photons through a Mach-Zehnder interferometer. Probabilities from lib/optics.js, which is
// tested against the same experiment built from qubit gates (Rx(-pi/2), phase, Rx(-pi/2)).

const STEPS = [
  {
    title: 'A photon meets a half-silvered mirror',
    preset: { phi: 0, block: null, markDeg: 0, secondSplitter: false },
    html: `<p>A half-silvered mirror (a <b>beam splitter</b>) lets half the light through and reflects half. Send single photons at it: each one is detected <b>whole</b>, at D1 or at D2, at random, 50/50.</p>
      <p>Press <b>Fire a photon</b> a few times, then <b>100 at once</b>.</p>`,
  },
  {
    title: 'Add a second splitter',
    preset: { phi: 0, block: null, markDeg: 0, secondSplitter: true },
    html: `<p>Now bring the two paths back together at a second beam splitter. If each photon took one path, it should still land 50/50.</p>
      <p>Instead <b>every photon goes to D1</b>. D2 never clicks. Each photon somehow "knows" about both paths.</p>`,
  },
  {
    title: 'Why D2 stays dark',
    preset: { phi: 0, block: null, markDeg: 0, secondSplitter: true },
    html: `<p>Look at the dials. Each reflection at a splitter turns an amplitude by 90° (multiplies it by i). One route to D2 goes <b>through both</b> splitters (×1); the other is <b>reflected by both</b> (×i×i = −1). The two amplitudes point in opposite directions and cancel.</p>
      <p>Each route to D1 has exactly one reflection, so both are turned by the same 90° and they add. (The mirrors treat both paths alike, so they don't matter.)</p>
      <p>Same arithmetic as the dials in the <a href="../interference/">interference</a> lesson.</p>`,
  },
  {
    title: 'Lengthen one path',
    preset: { phi: 90, block: null, markDeg: 0, secondSplitter: true },
    html: ({ pD1 }) => `<p>A slab of glass in arm b delays it by a phase φ. The cancellation at D2 is no longer complete: now D1 gets ${percent(pD1)} of the photons, following cos²(φ/2).</p>
      <p>Drag <b>Phase</b>: a shift of half a wavelength (180°) sends every photon to D2 instead. Interferometers like this measure distances to a fraction of a wavelength.</p>`,
  },
  {
    title: 'Block a path',
    preset: { phi: 0, block: 'a', markDeg: 0, secondSplitter: true },
    html: `<p>Put a shutter in arm a. Half the photons are absorbed. The rest came along arm b, so there's nothing left to cancel with, and they split 50/50 at the second splitter.</p>
      <p>So blocking a path makes <b>D2 click</b>, a quarter of the time. D2 was dark only because both paths were open.</p>`,
  },
  {
    title: 'Mark the path',
    preset: { phi: 0, block: null, markDeg: 90, secondSplitter: true },
    html: ({ markDeg }) => `<p>Instead of blocking arm b, turn the photon's polarisation there by ${markDeg}°. Nothing is absorbed, but now the path could in principle be read off from the polarisation.</p>
      <p>That alone destroys the interference: 50/50 again. A partial tag gives partial interference (visibility cos of the tag angle). Try 45°.</p>`,
  },
  {
    title: 'The path is a qubit',
    preset: { phi: 60, block: null, markDeg: 0, secondSplitter: true },
    html: `<p>Call "arm a" |0⟩ and "arm b" |1⟩: the photon's path is a <b>qubit</b>. A beam splitter is the gate R<sub>x</sub>(−π/2), the glass is a phase gate, and the whole interferometer is a three-gate circuit.</p>
      <p>The tests check exactly this: the optics formulas agree with the circuit engine to machine precision. Photonic quantum computers are built from splitters and phase shifters like these.</p>`,
  },
  {
    title: 'Your turn',
    preset: { phi: 0, block: 'b', markDeg: 0, secondSplitter: true },
    html: `<p>Here arm b is blocked. What happens to D2 when you change the phase now? (Nothing: with one path there is nothing to interfere with.) Next lesson: use that dark detector to find a bomb without touching it.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The interferometer</h2><span class="legend">dials: size = probability, hand = phase; glow = photon in flight</span></figcaption>
    <canvas id="table" class="chart" style="height: 420px" role="img" aria-label="Mach-Zehnder interferometer with beam paths and detectors"></canvas>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px">
      <button id="fire1" class="btn btn-primary" type="button">Fire a photon</button>
      <button id="fire100" class="btn" type="button">100 at once</button>
      <button id="clear" class="btn" type="button">Clear counts</button>
    </div>
  </figure>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Chance of D1 against the phase</h2><span class="legend">line = prediction; dot = your counts at this phase</span></figcaption>
    <canvas id="curve" class="chart" role="img" aria-label="Probability of detector 1 against phase"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Phase φ in arm b <output id="phi-out"></output></span>
      <input id="phi" type="range" min="0" max="360" step="5"></label>
    <label class="field"><span class="label">Shutter</span>
      <select id="block"><option value="">none</option><option value="a">blocks arm a</option><option value="b">blocks arm b</option></select></label>
    <label class="field"><span class="label">Polarisation tag in arm b <output id="markDeg-out"></output></span>
      <input id="markDeg" type="range" min="0" max="90" step="5"></label>
    <label class="field" style="display: flex; gap: 8px; align-items: center"><input id="secondSplitter" type="checkbox"> Second beam splitter</label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { phi: 0, block: null, markDeg: 0, secondSplitter: true };
let index = 0;
let counts = { D1: 0, D2: 0, blocked: 0 };
let flight = null; // { start, outcome }
let outcome = null;
let rng = seededRandom(1891);

const marked = () => 1 - Math.cos((settings.markDeg * Math.PI) / 180);

function model() {
  const phi = (settings.phi * Math.PI) / 180;
  const r = machZehnder({ phi, block: settings.block, marked: marked(), secondSplitter: settings.secondSplitter });
  const s = Math.SQRT1_2;
  const [a, b] = [r.arms.a, r.arms.b];
  const coherent = settings.secondSplitter && marked() === 0;
  // amplitudes into each detector: D1 = i a + b, D2 = a + i b (over sqrt 2)
  const out1 = coherent ? [s * (-a[1] + b[0]), s * (a[0] + b[1])] : null;
  const out2 = coherent ? [s * (a[0] - b[1]), s * (a[1] + b[0])] : null;
  const a0 = [s, 0];
  const b0 = [-s * Math.sin(phi), s * Math.cos(phi)];
  return { ...r, amps: { a, b, out1, out2, a0, b0 } };
}

function sample(m) {
  const u = rng();
  return u < m.pBlocked ? 'blocked' : u < m.pBlocked + m.pD1 ? 'D1' : 'D2';
}

function count(o) {
  counts[o]++;
}

function drawCurve(th) {
  const { ctx, w, h } = prep($('curve'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1.05], th);
  const X = xAxis(ctx, box, [0, 360], th);
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 360; i += 2) {
    const m = machZehnder({ phi: (i * Math.PI) / 180, block: settings.block, marked: marked(), secondSplitter: settings.secondSplitter });
    if (i === 0) ctx.moveTo(X(i), Y(m.pD1));
    else ctx.lineTo(X(i), Y(m.pD1));
  }
  ctx.stroke();
  const total = counts.D1 + counts.D2 + counts.blocked;
  const m = model();
  ctx.strokeStyle = withAlpha(th.marked, 0.6);
  ctx.beginPath();
  ctx.moveTo(Math.round(X(settings.phi)) + 0.5, box.y0);
  ctx.lineTo(Math.round(X(settings.phi)) + 0.5, box.y1);
  ctx.stroke();
  if (total) {
    ctx.fillStyle = th.marked;
    ctx.beginPath();
    ctx.arc(X(settings.phi), Y(counts.D1 / total), 6, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`phase φ (degrees); predicted P(D1) = ${percent(m.pD1)}`, (box.x0 + box.x1) / 2, h);
}

function render(now = performance.now()) {
  const th = theme();
  const m = model();
  const packet = flight ? Math.min(1, (now - flight.start) / 1400) : null;
  drawInterferometer($('table'), th, {
    ...m,
    phi: (settings.phi * Math.PI) / 180,
    block: settings.block,
    markDeg: settings.markDeg,
    secondSplitter: settings.secondSplitter,
    packet: packet !== null && packet < 1 ? packet : null,
    outcome,
    counts,
  });
  drawCurve(th);
  const ctx = { ...settings, pD1: m.pD1 };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

function tick(now) {
  if (!flight) return;
  if (now - flight.start >= 1400) {
    outcome = flight.outcome;
    count(outcome);
    flight = null;
    render(now);
    return;
  }
  render(now);
  requestAnimationFrame(tick);
}

// ----- controls -----

function syncControls() {
  $('phi').value = String(settings.phi);
  $('phi-out').textContent = `${settings.phi}°`;
  $('block').value = settings.block ?? '';
  $('markDeg').value = String(settings.markDeg);
  $('markDeg-out').textContent = settings.markDeg ? `${settings.markDeg}°` : 'none';
  $('secondSplitter').checked = settings.secondSplitter;
}

function changed() {
  counts = { D1: 0, D2: 0, blocked: 0 };
  outcome = null;
  syncControls();
  render();
}

for (const k of ['phi', 'markDeg']) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    changed();
  });
}
$('block').addEventListener('change', () => {
  settings.block = $('block').value || null;
  changed();
});
$('secondSplitter').addEventListener('change', () => {
  settings.secondSplitter = $('secondSplitter').checked;
  changed();
});
$('fire1').addEventListener('click', () => {
  if (flight) {
    count(flight.outcome);
    outcome = flight.outcome;
  }
  outcome = null;
  flight = { start: performance.now(), outcome: sample(model()) };
  requestAnimationFrame(tick);
});
$('fire100').addEventListener('click', () => {
  const m = model();
  for (let i = 0; i < 100; i++) count(sample(m));
  outcome = null;
  render();
});
$('clear').addEventListener('click', changed);

const lesson = mountLesson({ slug: 'mach-zehnder', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  rng = seededRandom(1891 + i);
  flight = null;
  changed();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
}

window.addEventListener('themechange', () => render());
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
