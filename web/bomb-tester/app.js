import { seededRandom } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { machZehnder, zenoSuccess } from '../lib/optics.js';
import { withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { drawInterferometer } from '../ui/interferometer.js';
import { mountLesson } from '../ui/lesson.js';

// The Elitzur-Vaidman bomb tester (1993): a bomb whose trigger fires on a single photon sits in
// arm b of a Mach-Zehnder interferometer. A live bomb absorbs the photon if it takes arm b (and
// explodes); a dud lets it through. Probabilities from lib/optics.js.

const STEPS = [
  {
    title: 'A bomb with a hair trigger',
    preset: { bomb: 'live', mode: 'known', zeno: 10 },
    html: `<p>A warehouse is full of bombs. Each has a sensor so sensitive that a <b>single photon</b> hitting it sets it off. Some are duds whose sensor is missing: light passes straight through them.</p>
      <p>How do you find a live bomb without setting it off? To see the sensor you must bounce light off it, and that's exactly what triggers it. Classically, it can't be done.</p>`,
  },
  {
    title: 'A dud in the interferometer',
    preset: { bomb: 'dud', mode: 'known', zeno: 10 },
    html: `<p>Put the bomb in arm b of a Mach–Zehnder interferometer, tuned so every photon goes to D1. A dud is invisible to light, so the interferometer works as before.</p>
      <p>Fire some photons: they <b>all</b> reach D1. D2 never clicks.</p>`,
  },
  {
    title: 'A live bomb',
    preset: { bomb: 'live', mode: 'known', zeno: 10 },
    html: `<p>A live bomb absorbs any photon in arm b, so it acts like a detector on that path. Now: half the time the photon goes via arm b and the bomb <b>explodes</b>. Otherwise it went via arm a, and with nothing to cancel against it lands 50/50: D1 or <b>D2</b>.</p>
      <p>A click at D2 is impossible with a dud. So D2 tells you the bomb is live, and the photon that told you <b>never touched it</b>. This is an <b>interaction-free measurement</b> (Elitzur and Vaidman, 1993).</p>`,
  },
  {
    title: 'Sort the warehouse',
    preset: { bomb: 'unknown', mode: 'game', zeno: 10 },
    html: `<p>Now the bomb could be live or a dud. Fire one photon at a time:</p>
      <p><b>D2</b>: certainly live, keep it. <b>Boom</b>: it was live, and it's gone. <b>D1</b>: can't tell yet, fire again. If D1 keeps clicking, it's probably a dud. Try a few bombs; you can save about a third of the live ones.</p>`,
  },
  {
    title: 'Can we do better?',
    preset: { bomb: 'live', mode: 'known', zeno: 10 },
    html: ({ zeno }) => `<p>Yes, with the <b>quantum Zeno effect</b>. Instead of one 50/50 split, rotate the photon's polarisation by a small angle π/(2N) on each of N passes, with the bomb only on the "rotated" path. A live bomb keeps catching the photon in its unrotated state, freezing its evolution; a dud lets it rotate all the way.</p>
      <p>With N = ${zeno} passes a live bomb is found without exploding ${percent(zenoSuccess(zeno))} of the time, and the chance heads to 100% as N grows (right). Kwiat and colleagues demonstrated this in 1995.</p>`,
  },
  {
    title: 'Your turn',
    preset: { bomb: 'unknown', mode: 'game', zeno: 25 },
    html: `<p>Sort as many bombs as you like. Keep track: what fraction of the live bombs did you save? (The best possible with this interferometer is 1/3: of the live-bomb outcomes, D2 has probability 1/4 against 1/2 for an explosion.)</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The interferometer with a bomb</h2><span class="legend" id="bomb-legend"></span></figcaption>
    <canvas id="table" class="chart" style="height: 420px" role="img" aria-label="Mach-Zehnder interferometer with a bomb in one arm"></canvas>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px">
      <button id="fire1" class="btn btn-primary" type="button">Fire a photon</button>
      <button id="fire100" class="btn" type="button" data-mode="known">100 at once</button>
      <button id="next-bomb" class="btn" type="button" data-mode="game">Next bomb</button>
      <button id="call-dud" class="btn" type="button" data-mode="game">Call it a dud</button>
    </div>
    <p class="hint" id="verdict" style="margin-top: 10px"></p>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Your warehouse</h2><span class="legend">bombs sorted so far</span></figcaption>
      <div id="tally"></div>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Quantum Zeno upgrade</h2><span class="legend">live bombs found without exploding</span></figcaption>
      <canvas id="zeno" class="chart" style="height: 240px" role="img" aria-label="Success probability against number of passes"></canvas>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">In arm b</span>
      <select id="bomb"><option value="live">A live bomb</option><option value="dud">A dud</option><option value="unknown">A mystery bomb (game)</option></select></label>
    <label class="field"><span class="label">Zeno passes N <output id="zeno-out"></output></span>
      <input id="zeno-n" type="range" min="1" max="60" step="1"></label>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { bomb: 'live', zeno: 10 };
let index = 0;
let counts = { D1: 0, D2: 0, blocked: 0 };
let flight = null;
let outcome = null;
let rng = seededRandom(1993);
let hidden = 'live'; // the real kind of a mystery bomb
let resolved = null; // 'live-saved' | 'exploded' | 'dud-called' once the current mystery bomb is decided
let tally = { saved: 0, exploded: 0, dudsCalled: 0, liveCalledDud: 0, dudsRight: 0 };

const kind = () => (settings.bomb === 'unknown' ? hidden : settings.bomb);

function model() {
  const r = machZehnder({ phi: 0, block: kind() === 'live' ? 'b' : null });
  const s = Math.SQRT1_2;
  const [a, b] = [r.arms.a, r.arms.b];
  const coherent = kind() === 'dud';
  return {
    ...r,
    amps: {
      a,
      b,
      a0: [s, 0],
      b0: [0, s],
      out1: coherent ? [s * (-a[1] + b[0]), s * (a[0] + b[1])] : null,
      out2: coherent ? [s * (a[0] - b[1]), s * (a[1] + b[0])] : null,
    },
  };
}

function sample(m) {
  const u = rng();
  return u < m.pBlocked ? 'blocked' : u < m.pBlocked + m.pD1 ? 'D1' : 'D2';
}

function land(o) {
  counts[o]++;
  outcome = o;
  if (settings.bomb !== 'unknown' || resolved) return;
  if (o === 'D2') {
    resolved = 'live-saved';
    tally.saved++;
  } else if (o === 'blocked') {
    resolved = 'exploded';
    tally.exploded++;
  }
}

function newBomb() {
  hidden = rng() < 0.5 ? 'live' : 'dud';
  resolved = null;
  counts = { D1: 0, D2: 0, blocked: 0 };
  outcome = null;
}

function drawZeno(th) {
  const { ctx, w, h } = prep($('zeno'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1.05], th);
  const X = xAxis(ctx, box, [1, 60], th, { integer: true });
  ctx.strokeStyle = th.ampPos;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let n = 1; n <= 60; n++) {
    if (n === 1) ctx.moveTo(X(n), Y(zenoSuccess(n)));
    else ctx.lineTo(X(n), Y(zenoSuccess(n)));
  }
  ctx.stroke();
  // the simple interferometer: 1/4 per photon, 1/3 with repeats
  for (const [v, label] of [
    [0.25, 'one photon, basic tester'],
    [1 / 3, 'basic tester, repeated'],
  ]) {
    ctx.strokeStyle = withAlpha(th.muted, 0.7);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(box.x0, Math.round(Y(v)) + 0.5);
    ctx.lineTo(box.x1, Math.round(Y(v)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = v < 0.3 ? 'top' : 'bottom';
    ctx.fillText(label, box.x1 - 4, Y(v) + (v < 0.3 ? 3 : -3));
  }
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(X(settings.zeno), Y(zenoSuccess(settings.zeno)), 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('number of passes N', (box.x0 + box.x1) / 2, h);
}

function drawTally() {
  const t = tally;
  const decided = t.saved + t.exploded + t.dudsCalled;
  $('tally').innerHTML = `<table class="data-table"><tbody>
    <tr><td>Live bombs certified without exploding</td><td>${t.saved}</td></tr>
    <tr><td>Exploded</td><td>${t.exploded}</td></tr>
    <tr><td>Called duds (correctly)</td><td>${t.dudsRight} of ${t.dudsCalled}</td></tr>
    <tr><td>Live bombs saved</td><td>${t.saved + t.exploded + t.liveCalledDud ? percent(t.saved / (t.saved + t.exploded + t.liveCalledDud)) : '—'}</td></tr>
  </tbody></table>
  <p class="hint" style="margin-top: 8px">${decided ? `${decided} bomb${decided === 1 ? '' : 's'} sorted.` : 'Choose "A mystery bomb" to play.'}</p>`;
}

function render(now = performance.now()) {
  const th = theme();
  const m = model();
  const packet = flight ? Math.min(1, (now - flight.start) / 1400) : null;
  const game = settings.bomb === 'unknown';
  drawInterferometer($('table'), th, {
    ...m,
    phi: undefined,
    block: kind() === 'live' ? 'b' : null,
    secondSplitter: true,
    bomb: game && !resolved ? 'unknown' : kind(),
    hideAmps: game && !resolved,
    packet: packet !== null && packet < 1 ? packet : null,
    outcome,
    counts,
  });
  $('bomb-legend').textContent = game ? 'is it live?' : kind() === 'live' ? 'live bomb in arm b' : 'dud in arm b';
  document.querySelectorAll('[data-mode]').forEach((el) => (el.hidden = (el.dataset.mode === 'game') !== game));
  $('call-dud').disabled = !!resolved;
  $('next-bomb').disabled = !resolved;
  $('fire1').disabled = game && !!resolved;
  $('verdict').innerHTML = !game
    ? `Predicted: boom ${percent(m.pBlocked)}, D1 ${percent(m.pD1)}, D2 ${percent(m.pD2)}.`
    : resolved === 'live-saved'
      ? '<b>D2 clicked: this bomb is live</b>, and it never saw a photon. Press <b>Next bomb</b>.'
      : resolved === 'exploded'
        ? '<b>Boom.</b> It was live. Press <b>Next bomb</b>.'
        : resolved === 'dud-called'
          ? hidden === 'dud'
            ? 'Correct: it was a dud. Press <b>Next bomb</b>.'
            : '<b>Wrong: it was live</b>, and now it is in the dud bin. Press <b>Next bomb</b>.'
          : `${counts.D1} photon${counts.D1 === 1 ? '' : 's'} at D1 so far: no verdict yet.`;
  drawTally();
  drawZeno(th);
  const ctx = { ...settings };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

function tick(now) {
  if (!flight) return;
  if (now - flight.start >= 1400) {
    land(flight.outcome);
    flight = null;
    render(now);
    return;
  }
  render(now);
  requestAnimationFrame(tick);
}

// ----- controls -----

function syncControls() {
  $('bomb').value = settings.bomb;
  $('zeno-n').value = String(settings.zeno);
  $('zeno-out').textContent = String(settings.zeno);
}

$('bomb').addEventListener('change', () => {
  settings.bomb = $('bomb').value;
  newBomb();
  render();
});
$('zeno-n').addEventListener('input', () => {
  settings.zeno = Number($('zeno-n').value);
  syncControls();
  render();
});
$('fire1').addEventListener('click', () => {
  if (flight) land(flight.outcome);
  outcome = null;
  flight = { start: performance.now(), outcome: sample(model()) };
  requestAnimationFrame(tick);
});
$('fire100').addEventListener('click', () => {
  const m = model();
  for (let i = 0; i < 100; i++) land(sample(m));
  outcome = null;
  render();
});
$('next-bomb').addEventListener('click', () => {
  if (!resolved) return;
  newBomb();
  render();
});
$('call-dud').addEventListener('click', () => {
  if (resolved) return;
  resolved = 'dud-called';
  tally.dudsCalled++;
  if (hidden === 'dud') tally.dudsRight++;
  else tally.liveCalledDud++;
  render();
});

const lesson = mountLesson({ slug: 'bomb-tester', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  const { mode, ...pre } = STEPS[i].preset;
  Object.assign(settings, pre);
  rng = seededRandom(1993 + i);
  flight = null;
  newBomb();
  syncControls();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', () => render());
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
