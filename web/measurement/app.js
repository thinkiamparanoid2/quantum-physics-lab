import { angleLabel, percent } from '../lib/format.js';
import { BlochView } from '../ui/bloch.js';
import { barChart, theme } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// A single qubit prepared at polar angle theta and azimuth phi, measured along z or x.
const STEPS = [
  {
    title: 'Measuring gives 0 or 1',
    preset: { theta: 0, phi: 0, basis: 'z' },
    html: `<p>Measuring a qubit always gives a single ordinary bit: 0 or 1. For |0⟩ the answer is 0 every time.</p>
      <p>Press <b>Measure once</b> a few times to check.</p>`,
  },
  {
    title: 'An equal superposition',
    preset: { theta: Math.PI / 2, phi: 0, basis: 'z' },
    html: `<p>Now the qubit is prepared in |+⟩, on the equator. Press <b>Prepare and measure ×100</b>.</p>
      <p>Each result is random, and not because we lack information: the state itself fixes only the <b>odds</b>, here 50/50.</p>`,
  },
  {
    title: 'The Born rule',
    preset: { theta: Math.PI / 3, phi: 0, basis: 'z' },
    html: (s) => `<p>Tilt the arrow and the odds change. Measured along z, the chance of 0 is the square of the |0⟩ amplitude, cos²(θ/2), here <b>${percent(s.p0)}</b>.</p>
      <p>With few measurements the counts wobble. With thousands they settle on the prediction. Drag θ in <b>Try it</b> to explore.</p>`,
  },
  {
    title: 'Measuring changes the state',
    preset: { theta: Math.PI / 2, phi: 0, basis: 'z' },
    html: `<p>Press <b>Measure once</b>. The arrow jumps to |0⟩ or |1⟩ and the superposition is gone: this is called <b>collapse</b>.</p>
      <p>Measure again and you get the same answer every time. To see fresh randomness you must prepare a new qubit, which is what <b>×100</b> does 100 times.</p>`,
  },
  {
    title: 'Asking a different question',
    preset: { theta: 0, phi: 0, basis: 'x' },
    html: `<p>Measuring along <b>x</b> asks "|+⟩ or |−⟩?" instead of "|0⟩ or |1⟩?". For |0⟩ that answer is 50/50.</p>
      <p>Set θ to 90° with φ = 0 (the state |+⟩) and measuring along x gives + every time. Which question you ask is part of the experiment.</p>`,
  },
  {
    title: 'Your turn',
    preset: { theta: (2 * Math.PI) / 3, phi: Math.PI / 4, basis: 'z' },
    html: `<p>Prepare any state with θ and φ and measure along z or x. Can you find a state that gives 0 along z <i>and</i> + along x with high probability? (Hint: you can't have both at 100%. That is the uncertainty principle at work.)</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div class="split">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Prepared state</h2><span class="legend">amber line = measurement axis</span></figcaption>
      <canvas id="sphere" class="bloch-hero" role="img" aria-label="The prepared state on the Bloch sphere"></canvas>
      <p id="collapse-note" class="hint" aria-live="polite"></p>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Outcomes</h2><span class="legend"><span class="key block"></span>measured <span class="key outline"></span>predicted</span></figcaption>
      <div class="sampler-controls">
        <button id="once" class="btn btn-primary" type="button">Measure once</button>
        <button id="many" class="btn" type="button">Prepare and measure ×100</button>
        <button id="thousand" class="btn" type="button">×1000</button>
      </div>
      <canvas id="bars" class="chart tall" role="img" aria-label="Measured frequencies against predicted probabilities"></canvas>
      <p id="stats" class="hint" aria-live="polite"></p>
      <div class="row" style="margin-top: 10px">
        <button id="prepare" class="btn" type="button">Prepare again</button>
        <button id="clear" class="btn" type="button">Clear counts</button>
      </div>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">θ (tilt from |0⟩) <output id="theta-out"></output></span>
      <input id="theta" type="range" min="0" max="${Math.PI}" step="${Math.PI / 48}"></label>
    <label class="field"><span class="label">φ (phase) <output id="phi-out"></output></span>
      <input id="phi" type="range" min="0" max="${2 * Math.PI}" step="${Math.PI / 24}"></label>
    <label class="field"><span class="label">Measure along</span>
      <select id="basis"><option value="z">z: is it |0⟩ or |1⟩?</option><option value="x">x: is it |+⟩ or |−⟩?</option></select></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const view = new BlochView($('sphere'), { yaw: -0.7, pitch: 0.3 });
const settings = { theta: 0, phi: 0, basis: 'z' };
let index = 0;
let collapsed = null; // outcome index while the prepared qubit sits collapsed
let counts = [0, 0];
let last = -1;
let anim = null;

const lesson = mountLesson({ slug: 'measurement', onNavigate: (i) => enterStep(i) });

const prepared = () => [
  Math.sin(settings.theta) * Math.cos(settings.phi),
  Math.sin(settings.theta) * Math.sin(settings.phi),
  Math.cos(settings.theta),
];
const axis = () => (settings.basis === 'z' ? [0, 0, 1] : [1, 0, 0]);
const labels = () => (settings.basis === 'z' ? ['|0⟩', '|1⟩'] : ['|+⟩', '|−⟩']);

// Probability of the first outcome (0 or +): (1 + v.axis) / 2 for Bloch vector v.
function firstOutcomeProbability() {
  if (collapsed !== null) return collapsed === 0 ? 1 : 0;
  const v = prepared();
  const a = axis();
  return (1 + v[0] * a[0] + v[1] * a[1] + v[2] * a[2]) / 2;
}

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  collapsed = null;
  counts = [0, 0];
  last = -1;
  anim = null;
  syncControls();
  writeHash();
  render();
}

function syncControls() {
  $('theta').value = String(settings.theta);
  $('phi').value = String(settings.phi);
  $('basis').value = settings.basis;
  $('theta-out').textContent = `${Math.round((settings.theta * 180) / Math.PI)}°`;
  $('phi-out').textContent = angleLabel(settings.phi);
}

function writeHash() {
  const p = new URLSearchParams();
  if (index > 0) p.set('step', index + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
}

function measure(shots, fresh) {
  const p = fresh ? (collapsed = null, firstOutcomeProbability()) : firstOutcomeProbability();
  for (let k = 0; k < shots; k++) {
    last = Math.random() < p ? 0 : 1;
    counts[last]++;
  }
  if (!fresh) {
    const from = collapsed === null ? prepared() : view.vector;
    collapsed = last;
    const a = axis();
    anim = { from, to: last === 0 ? a : a.map((c) => -c), start: performance.now() };
    requestAnimationFrame(frame);
  }
  render();
}

function frame(now) {
  if (!anim) return;
  const t = Math.min(1, (now - anim.start) / 450);
  const e = 1 - (1 - t) ** 3;
  const v = anim.from.map((c, k) => c + (anim.to[k] - c) * e);
  const len = Math.hypot(...v) || 1;
  view.vector = v.map((c) => c / len);
  view.draw(theme());
  if (t < 1) requestAnimationFrame(frame);
  else {
    anim = null;
    render();
  }
}

function render() {
  const th = theme();
  const p0 = firstOutcomeProbability();
  const total = counts[0] + counts[1];

  if (!anim) {
    const a = axis();
    view.vector = collapsed === null ? prepared() : collapsed === 0 ? a : a.map((c) => -c);
    view.axis = a;
    view.axisLabel = settings.basis === 'z' ? 'z' : 'x';
    view.draw(th);
  }
  $('collapse-note').textContent =
    collapsed === null
      ? 'Freshly prepared. Measuring once will collapse it.'
      : `Collapsed onto ${labels()[collapsed]} by the last measurement. Press "Prepare again" to restore it.`;

  barChart($('bars'), {
    theme: th,
    labels: labels(),
    exact: total ? [counts[0] / total, counts[1] / total] : [0, 0],
    trotter: [p0, 1 - p0],
    yMax: 1,
  });

  if (total) {
    const f = counts[0] / total;
    const wobble = Math.sqrt((p0 * (1 - p0)) / total);
    $('stats').innerHTML = `${total.toLocaleString()} measurement${total === 1 ? '' : 's'}, last result <b>${labels()[last]}</b>.
      Measured ${labels()[0]}: <b>${percent(f)}</b>; predicted ${percent(p0)}${wobble > 0 ? `, typical wobble ±${percent(wobble)}` : ''}.`;
  } else {
    $('stats').textContent = 'No measurements yet.';
  }

  const s = { p0: Math.cos(settings.theta / 2) ** 2 };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(s) : st.html) : '' })),
    index,
  );
}

$('once').addEventListener('click', () => measure(1, false));
$('many').addEventListener('click', () => {
  measure(100, true);
});
$('thousand').addEventListener('click', () => measure(1000, true));
$('prepare').addEventListener('click', () => {
  collapsed = null;
  render();
});
$('clear').addEventListener('click', () => {
  counts = [0, 0];
  last = -1;
  render();
});
for (const id of ['theta', 'phi']) {
  $(id).addEventListener('input', () => {
    settings[id] = Number($(id).value);
    collapsed = null;
    counts = [0, 0];
    syncControls();
    render();
  });
}
$('basis').addEventListener('change', () => {
  settings.basis = $('basis').value;
  collapsed = null;
  counts = [0, 0];
  render();
});

window.addEventListener('themechange', () => render());
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
