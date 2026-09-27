import { blochAngles, blochVector, rotateVector, rotationMatrix, rotationOf, withoutGlobalPhase } from '../lib/bloch.js';
import { GATES, applyGate, rx, ry, rz, zeroState } from '../lib/circuit.js';
import { angleLabel, formatState, percent } from '../lib/format.js';
import { BlochView } from '../ui/bloch.js';
import { theme } from '../ui/charts.js';
import { drawDials, drawPhaseWheel } from '../ui/dials.js';
import { mountLesson } from '../ui/lesson.js';

const TURN_MS = 1100;
const PAUSE_MS = 350;

const NAMED = {
  X: GATES.X,
  Y: GATES.Y,
  Z: GATES.Z,
  H: GATES.H,
  S: GATES.S,
  T: GATES.T,
  'S†': GATES.SDG,
  'T†': GATES.TDG,
};

const STEPS = [
  {
    title: 'The Bloch sphere',
    setup: [],
    play: [],
    html: `<p>A qubit's state can be drawn as an arrow on a sphere. Straight up is |0⟩ and straight down is |1⟩. Every other point on the surface is a <b>superposition</b> of the two.</p>
      <p>Drag the sphere to look around it. Double-click to reset the view.</p>`,
  },
  {
    title: 'X flips the arrow',
    setup: [],
    play: ['X'],
    html: `<p><b>X</b> is the quantum NOT gate. On the sphere it is a half-turn about the x axis (the amber dashed line), carrying |0⟩ to |1⟩.</p>
      <p>Every single-qubit gate works like this: it is a rotation of the sphere.</p>`,
  },
  {
    title: 'H: into superposition',
    setup: [],
    play: ['H'],
    html: `<p>The <b>Hadamard</b> gate turns the arrow half a turn about the axis halfway between x and z. |0⟩ lands on the equator, at the point called |+⟩.</p>
      <p>Now P(0) = P(1) = 50%. The height of the arrow sets the odds: at the equator it is 50/50.</p>`,
  },
  {
    title: 'Z: same odds, new phase',
    setup: ['H'],
    play: ['Z'],
    html: `<p><b>Z</b> turns the arrow half a turn about the vertical axis, carrying |+⟩ to the opposite side of the equator, |−⟩.</p>
      <p>The height did not change, so the odds are still 50/50. What changed is the <b>phase</b>: the direction around the equator. You cannot see it in one measurement, but interference can.</p>`,
  },
  {
    title: 'S and T: smaller phase turns',
    setup: ['H'],
    play: ['S', 'T'],
    html: `<p><b>S</b> is a quarter turn about z, taking |+⟩ to |+i⟩. <b>T</b> is an eighth of a turn.</p>
      <p>The longitude of the arrow is the <b>relative phase</b> between |0⟩ and |1⟩. Compare the colours of the two dials in the State panel.</p>`,
  },
  {
    title: 'Any angle',
    setup: [],
    play: ['Ry(π/3)'],
    html: `<p>Gates do not have to be half-turns. <b>Ry(θ)</b> tilts the arrow by any angle θ away from |0⟩, and the chance of reading 0 becomes cos²(θ/2).</p>
      <p>Here θ = π/3, so P(0) = 75%. Try the rotation buttons in <b>Try it</b> with other angles.</p>`,
  },
  {
    title: 'Your turn',
    setup: [],
    play: [],
    challenge: true,
    html: `<p>Use the gate buttons to move the arrow to <b>|−i⟩</b>, the point on the equator facing away along y. Then bring it back to |0⟩ in as few gates as you can.</p>
      <p>Every gate on one qubit is some rotation of this sphere. That is the whole story for a single qubit.</p>`,
  },
];

function gateFor(name, angle) {
  if (NAMED[name]) return NAMED[name];
  if (name.startsWith('Ry(π/3)')) return ry(Math.PI / 3);
  const kind = name.slice(0, 2);
  return { Rx: rx, Ry: ry, Rz: rz }[kind](angle);
}

// ----- page -----

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div class="split">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Bloch sphere</h2><span class="legend">drag to turn it, double-click to reset</span></figcaption>
      <canvas id="sphere" class="bloch-hero" role="img" aria-label="The qubit's state as an arrow on the Bloch sphere"></canvas>
      <p id="gate-caption" class="hint" aria-live="polite"></p>
      <p id="applied" class="hint"></p>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>State</h2><span class="legend"><canvas class="phase-wheel" width="18" height="18" aria-hidden="true"></canvas> phase colour</span></figcaption>
      <p id="formula" class="state-formula"></p>
      <canvas id="dials" class="chart"></canvas>
      <table class="amp-table">
        <tr><td>P(0)</td><td><div class="prob-bar"><span id="bar0"></span></div></td><td id="p0"></td></tr>
        <tr><td>P(1)</td><td><div class="prob-bar"><span id="bar1"></span></div></td><td id="p1"></td></tr>
        <tr><td>θ</td><td class="muted">tilt away from |0⟩</td><td id="theta"></td></tr>
        <tr><td>φ</td><td class="muted">phase, around the equator</td><td id="phi"></td></tr>
      </table>
      <p class="hint">Written with the |0⟩ amplitude made real. Multiplying the whole state by a phase changes nothing measurable.</p>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <p class="label">Apply a gate</p>
    <div class="gate-palette" id="palette">${Object.keys(NAMED).map((g) => `<button type="button" data-gate="${g}">${g}</button>`).join('')}</div>
    <label class="field"><span class="label">Rotate by any angle <output id="angle-out"></output></span>
      <input id="angle" type="range" min="${-Math.PI}" max="${Math.PI}" step="${Math.PI / 24}" value="${Math.PI / 4}"></label>
    <div class="gate-palette" style="grid-template-columns: repeat(3, 1fr)">
      <button type="button" data-rot="Rx">Rx</button><button type="button" data-rot="Ry">Ry</button><button type="button" data-rot="Rz">Rz</button>
    </div>
    <div class="row" style="margin-top: 12px">
      <button id="undo" class="btn" type="button">Undo</button>
      <button id="reset" class="btn" type="button">Reset to |0⟩</button>
    </div>
  </div>`;

const $ = (id) => document.getElementById(id);
const view = new BlochView($('sphere'), { yaw: -0.7, pitch: 0.3 });
drawPhaseWheel(stage.querySelector('.phase-wheel'));

let psi = zeroState(1);
let shown = psi;
let applied = [];
let undoStack = [];
let queue = [];
let active = null;
let index = 0;
let solved = { minusI: false, back: false };

const lesson = mountLesson({ slug: 'qubit', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  const step = STEPS[i];
  psi = zeroState(1);
  applied = [];
  undoStack = [];
  queue = [];
  active = null;
  view.trail = [];
  view.axis = null;
  for (const name of step.setup) applyNow(name);
  step.play.forEach((name) => queue.push({ name, gate: gateFor(name) }));
  solved = { minusI: false, back: false };
  shown = psi;
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  window.history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  $('gate-caption').textContent = '';
  render();
  kick();
}

function applyNow(name, gate = gateFor(name)) {
  undoStack.push(psi);
  psi = applyGate(structuredClone(psi), 0, gate);
  applied.push(name);
}

function describe({ axis, angle }) {
  const names = [
    [[1, 0, 0], 'the x axis'],
    [[0, 1, 0], 'the y axis'],
    [[0, 0, 1], 'the z axis'],
    [[Math.SQRT1_2, 0, Math.SQRT1_2], 'the axis between x and z'],
  ];
  const hit = names.find(([a]) => Math.abs(a[0] * axis[0] + a[1] * axis[1] + a[2] * axis[2]) > 0.999);
  return `${Math.round((angle * 180) / Math.PI)}° about ${hit ? hit[1] : 'a tilted axis'}`;
}

function kick() {
  if (!active && queue.length) {
    const { name, gate } = queue.shift();
    const rot = rotationOf(gate);
    active = { name, gate, rot, from: psi, start: performance.now() + (applied.length ? PAUSE_MS : 150) };
    view.axis = rot.axis;
    view.axisLabel = name;
    $('gate-caption').innerHTML = `Applying <b>${name}</b>: a turn of ${describe(rot)}.`;
  }
  requestAnimationFrame(frame);
}

function frame(now) {
  if (active) {
    const t = Math.max(0, Math.min(1, (now - active.start) / TURN_MS));
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    shown = applyGate(structuredClone(active.from), 0, rotationMatrix(active.rot.axis, active.rot.angle * e));
    view.trail.push(blochVector(shown, 0));
    if (view.trail.length > 120) view.trail.shift();
    if (t >= 1) {
      undoStack.push(active.from);
      psi = applyGate(structuredClone(active.from), 0, active.gate);
      applied.push(active.name);
      shown = psi;
      view.axis = null;
      active = null;
      if (queue.length) return kick();
    }
  } else {
    shown = psi;
  }
  render();
  if (active) requestAnimationFrame(frame);
}

function render() {
  const th = theme();
  const step = STEPS[index];
  const v = blochVector(shown, 0);
  view.vector = v;
  view.draw(th);

  const clean = withoutGlobalPhase(psi.re, psi.im);
  $('formula').innerHTML = `<span class="label">State</span>${formatState(clean.re, clean.im, 1)}`;
  const shownClean = withoutGlobalPhase(shown.re, shown.im);
  drawDials($('dials'), { theme: th, re: shownClean.re, im: shownClean.im, n: 1 });
  const p0 = shown.re[0] ** 2 + shown.im[0] ** 2;
  $('p0').textContent = percent(p0);
  $('p1').textContent = percent(1 - p0);
  $('bar0').style.width = `${p0 * 100}%`;
  $('bar1').style.width = `${(1 - p0) * 100}%`;
  const { theta, phi } = blochAngles(shown.re, shown.im);
  $('theta').textContent = `${Math.round((theta * 180) / Math.PI)}°`;
  $('phi').textContent = theta < 1e-6 || Math.abs(theta - Math.PI) < 1e-6 ? 'undefined at a pole' : `${Math.round((phi * 180) / Math.PI)}°`;
  $('applied').textContent = applied.length ? `Gates applied: ${applied.join(' → ')}` : 'No gates applied yet.';

  let html = step.html;
  if (step.challenge && !active) {
    const vpsi = blochVector(psi, 0);
    if (vpsi[1] < -0.999) solved.minusI = true;
    if (solved.minusI && vpsi[2] > 0.999) solved.back = true;
    const chip = (ok, text) => `<span class="bit-chip" style="${ok ? 'border-color: var(--accent-2)' : ''}">${ok ? '✓' : '○'} ${text}</span>`;
    html += `<div class="bits">${chip(solved.minusI, 'Reached |−i⟩')}${chip(solved.back, `Back to |0⟩${solved.back ? ` (${applied.length} gates)` : ''}`)}</div>`;
  }
  lesson.render(STEPS.map((s, i) => ({ title: s.title, html: i === index ? html : '' })), index);
}

$('palette').addEventListener('click', (e) => {
  const b = e.target.closest('[data-gate]');
  if (!b) return;
  queue.push({ name: b.dataset.gate, gate: NAMED[b.dataset.gate] });
  kick();
});

const angle = $('angle');
const angleOut = $('angle-out');
const showAngle = () => (angleOut.textContent = angleLabel(Number(angle.value)));
angle.addEventListener('input', showAngle);
showAngle();
document.querySelectorAll('[data-rot]').forEach((b) =>
  b.addEventListener('click', () => {
    const a = Number(angle.value);
    queue.push({ name: `${b.dataset.rot}(${angleLabel(a)})`, gate: gateFor(b.dataset.rot, a) });
    kick();
  }),
);
$('undo').addEventListener('click', () => {
  if (active || !undoStack.length) return;
  psi = undoStack.pop();
  applied.pop();
  view.trail = [];
  shown = psi;
  render();
});
$('reset').addEventListener('click', () => {
  queue = [];
  active = null;
  psi = zeroState(1);
  shown = psi;
  applied = [];
  undoStack = [];
  view.trail = [];
  view.axis = null;
  $('gate-caption').textContent = '';
  render();
});

window.addEventListener('themechange', () => {
  drawPhaseWheel(stage.querySelector('.phase-wheel'));
  render();
});
new ResizeObserver(() => render()).observe(stage);

const start = Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1));
enterStep(start);
