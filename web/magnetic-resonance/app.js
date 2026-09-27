import { rotateVector } from '../lib/bloch.js';
import { seededRandom } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { blochOf, ensembleAt, rabiProbability, resonance, upAlong } from '../lib/spin.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';
import { Player } from '../ui/player.js';

// A spin in a static field B0 along z (Larmor frequency W0) plus, optionally, a weak field rotating
// in the x-y plane at frequency w with strength W (the radio-frequency drive of NMR and MRI).
// lib/spin.js solves this exactly in the rotating frame (tested against direct integration).
// The spin-echo steps follow an ensemble of spins with slightly different Larmor frequencies.

const W0 = 8;
const SPIN_NAMES = ['↑z', '↓z', '↑x', '↓x', '↑y', '↓y'];
const ECHO_SPINS = 48;

const STEPS = [
  {
    title: 'A spinning top in a magnetic field',
    preset: { mode: 'larmor', tilt: 60, frame: 'lab' },
    play: true,
    html: `<p>A spin is a tiny magnet that also behaves like a gyroscope. Put it in a magnetic field B<sub>0</sub> (dashed, along z) with its arrow tilted, and it doesn't swing into line. It <b>precesses</b> around the field, like a tilted spinning top.</p>
      <p>The rate is the <b>Larmor frequency</b>, ω<sub>0</sub> = γB<sub>0</sub>. For the protons in water in a 1.5 tesla MRI magnet it is 63.9 MHz.</p>`,
  },
  {
    title: 'Precession is just a phase',
    preset: { mode: 'larmor', tilt: 60, frame: 'lab' },
    play: true,
    html: `<p>In quantum terms: spin up and spin down have energies +ħω<sub>0</sub>/2 and −ħω<sub>0</sub>/2, and each picks up the phase e<sup>−iEt/ħ</sup>. The <b>relative</b> phase between them turns at ω<sub>0</sub>, and that turning phase <i>is</i> the arrow going round.</p>
      <p>The chance of measuring up (the height of the arrow) never changes. On a qubit this is exactly an R<sub>z</sub> rotation.</p>`,
  },
  {
    title: 'Push in rhythm: it flips',
    preset: { mode: 'rabi', detune: 0, W: 0.8, pulse: 'cw', frame: 'lab' },
    play: true,
    html: `<p>Now add a weak second field that rotates around z at frequency ω. When it turns <b>in step</b> with the precession (ω = ω<sub>0</sub>) its tiny pushes add up, and the spin spirals all the way down to ↓z and back again.</p>
      <p>These are <b>Rabi oscillations</b>. The flip probability follows sin²(Ωt/2), where Ω is set by the strength of the weak field (see the chart).</p>`,
  },
  {
    title: 'Ride along with the field',
    preset: { mode: 'rabi', detune: 0, W: 0.8, pulse: 'cw', frame: 'rot' },
    play: true,
    html: `<p>Same motion, seen from a frame that turns along with the drive. The fast precession disappears, the rotating field stands still (dashed, along x), and the spin simply <b>rotates about it</b>.</p>
      <p>This rotating frame is how physicists think about NMR. Switch <b>View from</b> in Try it to compare.</p>`,
  },
  {
    title: 'Out of step: the flip fails',
    preset: { mode: 'rabi', detune: 1.2, W: 0.8, pulse: 'cw', frame: 'rot' },
    play: true,
    html: ({ maxFlip }) => `<p>Drive slightly off resonance (ω − ω<sub>0</sub> = −1.2). In the rotating frame the spin now turns about a <b>tilted</b> axis, so it never reaches the bottom: at most ${percent(maxFlip)} flips, but faster.</p>
      <p><b>The resonance line</b> shows the best flip chance for every drive frequency: a sharp peak at ω<sub>0</sub>. An NMR machine sweeps for these peaks; since ω<sub>0</sub> depends on each nucleus's surroundings, the peaks reveal chemistry.</p>`,
  },
  {
    title: 'π and π/2 pulses',
    preset: { mode: 'rabi', detune: 0, W: 0.8, pulse: 'pi2', frame: 'lab' },
    play: true,
    html: `<p>Switch the drive off at the right moment. A <b>π/2 pulse</b> leaves the spin on the equator, where it precesses and its rotating magnetism induces the signal an MRI coil picks up. A <b>π pulse</b> flips it exactly upside down.</p>
      <p>On a qubit a π pulse is the X gate, and pulses like these are how spin-based and NMR quantum computers apply gates. Try both in <b>Pulse</b>.</p>`,
  },
  {
    title: 'Many spins drift apart',
    preset: { mode: 'echo', spread: 0.6, tau: 6, echoPulse: false },
    play: true,
    html: `<p>A real sample has billions of spins, and the field isn't perfectly even, so each precesses at a slightly different rate. Seen from the rotating frame after a π/2 pulse, the thin arrows <b>fan out</b> and the total magnetisation (thick arrow) shrinks.</p>
      <p>The signal fades even though no spin has changed its tilt. This dephasing is called T<sub>2</sub>*.</p>`,
  },
  {
    title: 'The spin echo',
    preset: { mode: 'echo', spread: 0.6, tau: 6, echoPulse: true },
    play: true,
    html: ({ tau }) => `<p>At t = ${tau} apply a π pulse: it flips the whole fan over, so the fast spins end up behind the slow ones. They catch up together, and at t = ${2 * tau} the signal comes back: a <b>spin echo</b> (Hahn, 1950).</p>
      <p>Every MRI scan uses echoes. Truly random disturbances (T<sub>2</sub>) can't be undone this way, so in a real sample each echo is a little weaker; here they are left out.</p>`,
  },
  {
    title: 'Your turn',
    preset: { mode: 'rabi', detune: 0.5, W: 1, pulse: 'cw', frame: 'rot' },
    html: `<p>Change the drive frequency and strength, and watch the flip probability and the tilt of the axis. How far off resonance can you drive before the flip drops below half? (The answer is Δ = Ω: the width of the resonance line is set by the drive strength.)</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div id="player"></div>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2 id="sphere-title">The spin</h2><span class="legend" id="sphere-legend"></span></figcaption>
      <canvas id="bloch" class="chart" style="height: 360px" role="img" aria-label="Bloch sphere of the spin"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2 id="signal-title">Chance of having flipped</h2><span class="legend" id="signal-legend"></span></figcaption>
      <canvas id="signal" class="chart" style="height: 360px" role="img" aria-label="Probability or signal over time"></canvas>
    </figure>
  </div>
  <figure class="panel card" id="line-card">
    <figcaption class="card-head"><h2>The resonance line</h2><span class="legend">best flip chance for each drive frequency</span></figcaption>
    <canvas id="line" class="chart" role="img" aria-label="Maximum flip probability against drive frequency"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Experiment</span>
      <select id="mode"><option value="larmor">Precession only</option><option value="rabi">Driven: magnetic resonance</option><option value="echo">Many spins: spin echo</option></select></label>
    <div data-for="larmor" style="margin-top: 14px"><label class="field"><span class="label">Starting tilt <output id="tilt-out"></output></span>
      <input id="tilt" type="range" min="0" max="180" step="5"></label></div>
    <div data-for="rabi" style="margin-top: 14px">
      <label class="field"><span class="label">Drive detuning ω − ω₀ <output id="detune-out"></output></span>
        <input id="detune" type="range" min="-4" max="4" step="0.1"></label>
      <label class="field"><span class="label">Drive strength Ω <output id="W-out"></output></span>
        <input id="W" type="range" min="0.2" max="2" step="0.05"></label>
      <label class="field"><span class="label">Pulse</span>
        <select id="pulse"><option value="cw">Always on</option><option value="pi">π pulse, then off</option><option value="pi2">π/2 pulse, then off</option></select></label>
    </div>
    <div data-for="larmor rabi" style="margin-top: 14px"><label class="field"><span class="label">View from</span>
      <select id="frame"><option value="lab">The lab</option><option value="rot">A frame turning with the drive</option></select></label></div>
    <div data-for="echo" style="margin-top: 14px">
      <label class="field"><span class="label">Spread of frequencies <output id="spread-out"></output></span>
        <input id="spread" type="range" min="0.1" max="1.5" step="0.05"></label>
      <label class="field"><span class="label">π pulse at τ = <output id="tau-out"></output></span>
        <input id="tau" type="range" min="2" max="12" step="0.5"></label>
      <label class="field" style="display: flex; gap: 8px; align-items: center"><input id="echoPulse" type="checkbox"> Apply the π pulse</label>
    </div>
  </div>`;

const $ = (id) => document.getElementById(id);
const bloch = new BlochView($('bloch'), { names: SPIN_NAMES });
const settings = { mode: 'larmor', tilt: 60, detune: 0, W: 0.8, pulse: 'cw', frame: 'lab', spread: 0.6, tau: 6, echoPulse: true };
let index = 0;
let t = 0;
let offsets = [];

const drive = () => ({ w0: W0, w: settings.mode === 'rabi' ? W0 + settings.detune : W0, W: settings.mode === 'rabi' ? settings.W : 0 });
const pulseLength = () => (settings.pulse === 'pi' ? Math.PI / settings.W : settings.pulse === 'pi2' ? Math.PI / (2 * settings.W) : Infinity);
const psi0 = () => (settings.mode === 'larmor' ? upAlong((settings.tilt * Math.PI) / 180, 0) : [1, 0, 0, 0]);

// Lab-frame spinor at time t, with the drive switched off after the pulse.
function spinorAt(time) {
  const d = drive();
  const T = pulseLength();
  if (time <= T) return resonance(psi0(), d, time);
  return resonance(resonance(psi0(), d, T), { ...d, W: 0 }, time - T);
}

function vectorAt(time) {
  const v = blochOf(spinorAt(time));
  return settings.frame === 'rot' && settings.mode !== 'larmor' ? rotateVector(v, [0, 0, 1], -drive().w * time) : v;
}

function duration() {
  if (settings.mode === 'larmor') return (4 * 2 * Math.PI) / W0;
  if (settings.mode === 'echo') return 3 * settings.tau;
  const T = pulseLength();
  if (Number.isFinite(T)) return T + (3 * 2 * Math.PI) / W0;
  const g = Math.hypot(settings.detune, settings.W);
  return Math.min(40, (2 * 2 * Math.PI) / g);
}

function echoPulses() {
  return [{ t: 0, angle: Math.PI / 2 }, ...(settings.echoPulse ? [{ t: settings.tau, angle: Math.PI }] : [])];
}

function netSignal(vs) {
  const x = vs.reduce((s, v) => s + v[0], 0) / vs.length;
  const y = vs.reduce((s, v) => s + v[1], 0) / vs.length;
  return Math.hypot(x, y);
}

function rebuild() {
  if (settings.mode === 'echo') {
    const rng = seededRandom(1950);
    // Normally distributed offsets (Box-Muller), sorted so neighbouring arrows have neighbouring speeds.
    offsets = Array.from({ length: ECHO_SPINS }, () => settings.spread * Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())).sort((a, b) => a - b);
  }
  const d = duration();
  player.speed = d / 12;
  player.setDuration(d);
}

// ----- drawing -----

function drawSphere(th) {
  bloch.trail = [];
  bloch.others = [];
  if (settings.mode === 'echo') {
    const vs = ensembleAt(offsets, echoPulses(), t);
    bloch.others = vs;
    bloch.vector = [0, 1, 2].map((k) => vs.reduce((s, v) => s + v[k], 0) / vs.length);
    bloch.axis = [0, 0, 1];
    bloch.axisLabel = '';
    bloch.note = 'rotating frame; thick arrow = total';
  } else {
    const steps = Math.min(900, Math.ceil(t / 0.02));
    for (let i = 0; i <= steps; i++) bloch.trail.push(vectorAt((i / Math.max(1, steps)) * t));
    bloch.vector = vectorAt(t);
    const on = settings.mode === 'rabi' && t <= pulseLength();
    if (settings.frame === 'rot' && settings.mode === 'rabi') {
      const g = Math.hypot(settings.W, settings.detune);
      // effective field in the rotating frame: (W, 0, w0 - w) / g
      bloch.axis = on ? [settings.W / g, 0, -settings.detune / g] : [0, 0, 1];
      bloch.axisLabel = on ? 'B_eff' : '';
    } else {
      bloch.axis = [0, 0, 1];
      bloch.axisLabel = 'B₀';
    }
    bloch.note = settings.mode === 'rabi' && Number.isFinite(pulseLength()) ? (on ? 'drive on' : 'drive off') : '';
  }
  bloch.draw(th);
}

function chartFrame(canvas, th, tMax, yr, yLabel) {
  const { ctx, w, h } = prep(canvas);
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, yr, th);
  const X = xAxis(ctx, box, [0, tMax], th);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('time t', (box.x0 + box.x1) / 2, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(yLabel, box.x0 + 4, box.y0);
  return { ctx, box, X, Y };
}

function curve(ctx, X, Y, pts, color, width = 2.5, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([a, b], i) => (i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))));
  ctx.stroke();
  ctx.setLineDash([]);
}

function cursor(ctx, box, x, th) {
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, box.y0);
  ctx.lineTo(Math.round(x) + 0.5, box.y1);
  ctx.stroke();
}

function drawSignal(th) {
  const tMax = player.duration;
  const N = 600;
  if (settings.mode === 'echo') {
    const { ctx, box, X, Y } = chartFrame($('signal'), th, tMax, [0, 1.05], 'signal |M⊥|');
    const pts = Array.from({ length: N + 1 }, (_, i) => {
      const s = (i / N) * tMax;
      return [s, netSignal(ensembleAt(offsets, echoPulses(), s))];
    });
    curve(ctx, X, Y, pts, th.ampPos);
    for (const p of echoPulses()) {
      ctx.fillStyle = withAlpha(th.accent, 0.8);
      ctx.fillRect(X(p.t) - 1.5, box.y0, 3, box.y1 - box.y0);
      ctx.font = MONO;
      ctx.fillStyle = th.accent;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(p.angle > 2 ? 'π pulse' : 'π/2 pulse', X(p.t) + 5, box.y1 - 4);
    }
    cursor(ctx, box, X(t), th);
    return;
  }
  const { ctx, box, X, Y } = chartFrame($('signal'), th, tMax, [0, 1.05], 'P(↓z)');
  const down = (s) => {
    const [, , br, bi] = spinorAt(s);
    return br * br + bi * bi;
  };
  const pts = Array.from({ length: N + 1 }, (_, i) => [(i / N) * tMax, down((i / N) * tMax)]);
  if (settings.mode === 'rabi' && !Number.isFinite(pulseLength())) {
    // Rabi's formula, drawn dashed on top of the exact solution
    const g2 = settings.detune ** 2 + settings.W ** 2;
    curve(ctx, X, Y, [[0, settings.W ** 2 / g2], [tMax, settings.W ** 2 / g2]], withAlpha(th.muted, 0.7), 1, [3, 4]);
    curve(ctx, X, Y, pts, th.ampPos);
    curve(ctx, X, Y, pts.map(([s]) => [s, rabiProbability(drive(), s)]), th.marked, 1.5, [5, 5]);
  } else {
    curve(ctx, X, Y, pts, th.ampPos);
    if (settings.mode === 'rabi') {
      const T = pulseLength();
      ctx.fillStyle = withAlpha(th.accent, 0.12);
      ctx.fillRect(X(0), box.y0, X(T) - X(0), box.y1 - box.y0);
    }
  }
  cursor(ctx, box, X(t), th);
}

function drawLine(th) {
  const { ctx, w, h } = prep($('line'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const Y = yAxis(ctx, box, [0, 1.05], th);
  const X = xAxis(ctx, box, [-4, 4], th);
  const W = settings.W;
  const pts = Array.from({ length: 401 }, (_, i) => {
    const D = -4 + (i / 400) * 8;
    return [D, (W * W) / (W * W + D * D)];
  });
  ctx.fillStyle = withAlpha(th.ampPos, 0.12);
  ctx.beginPath();
  ctx.moveTo(X(-4), Y(0));
  pts.forEach(([a, b]) => ctx.lineTo(X(a), Y(b)));
  ctx.lineTo(X(4), Y(0));
  ctx.fill();
  curve(ctx, X, Y, pts, th.ampPos);
  const D = settings.detune;
  ctx.fillStyle = th.marked;
  ctx.beginPath();
  ctx.arc(X(D), Y((W * W) / (W * W + D * D)), 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('drive detuning ω − ω₀', (box.x0 + box.x1) / 2, h);
}

function render() {
  const th = theme();
  drawSphere(th);
  drawSignal(th);
  $('line-card').hidden = settings.mode !== 'rabi';
  if (settings.mode === 'rabi') drawLine(th);
  $('sphere-title').textContent = settings.mode === 'echo' ? `${ECHO_SPINS} spins` : 'The spin';
  $('sphere-legend').textContent =
    settings.mode === 'echo' ? 'thin = each spin' : settings.frame === 'rot' && settings.mode === 'rabi' ? 'seen from the turning frame' : 'seen from the lab';
  $('signal-title').textContent = settings.mode === 'echo' ? 'Signal from the sample' : 'Chance of having flipped';
  $('signal-legend').textContent =
    settings.mode === 'echo' ? 'bars = pulses' : settings.mode === 'rabi' && settings.pulse === 'cw' ? 'solid = exact; dashed = Rabi’s formula' : '';
  const W = settings.W;
  const ctx = { ...settings, maxFlip: (W * W) / (W * W + settings.detune ** 2) };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

const lesson = mountLesson({ slug: 'magnetic-resonance', onNavigate: (i) => enterStep(i) });
const player = new Player($('player'), { duration: 10, onTime: (time) => ((t = time), render()) });

const fmt = { tilt: (v) => `${v}°`, detune: (v) => v.toFixed(1), W: (v) => v.toFixed(2), spread: (v) => v.toFixed(2), tau: (v) => String(v) };

function syncControls() {
  $('mode').value = settings.mode;
  for (const k of Object.keys(fmt)) {
    $(k).value = String(settings[k]);
    $(`${k}-out`).textContent = fmt[k](settings[k]);
  }
  $('pulse').value = settings.pulse;
  $('frame').value = settings.frame;
  $('echoPulse').checked = settings.echoPulse;
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = !el.dataset.for.split(' ').includes(settings.mode)));
}

function changed() {
  syncControls();
  rebuild();
  player.seek(Math.min(t, player.duration));
}

for (const k of Object.keys(fmt)) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    changed();
  });
}
for (const k of ['mode', 'pulse', 'frame']) {
  $(k).addEventListener('change', () => {
    settings[k] = $(k).value;
    if (k !== 'frame') player.seek(0);
    changed();
  });
}
$('echoPulse').addEventListener('change', () => {
  settings.echoPulse = $('echoPulse').checked;
  changed();
});

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  player.pause();
  rebuild();
  player.seek(0);
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  if (STEPS[i].play) player.play();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

const initial = new URLSearchParams(location.hash.slice(1));
enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(initial.get('step')) || 1) - 1)));
if (Number(initial.get('t')) > 0) {
  player.pause();
  player.seek(Number(initial.get('t')));
}
