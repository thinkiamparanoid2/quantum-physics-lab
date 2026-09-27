import { entangleWithEnvironment, entropy, evolveNoisy, purity, rhoFromBloch } from '../lib/noise.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { phaseColor } from '../ui/dials.js';
import { mountLesson } from '../ui/lesson.js';
import { Player } from '../ui/player.js';

// Mixed states and decoherence. Three ways to shrink the Bloch arrow:
//   mix  - a pure state blended with a coin flip (a classical mixture)
//   env  - the qubit entangles with environment qubits; its reduced state is computed exactly from
//          the full statevector (lib/noise.js: entangleWithEnvironment, partial trace)
//   time - relaxation (T1) and dephasing (T2) over time, with precession at a detuning (Ramsey)

const STEPS = [
  {
    title: 'Pure states live on the surface',
    preset: { mode: 'mix', lambda: 0 },
    html: `<p>Every state in the earlier lessons was <b>pure</b>: its Bloch arrow reaches the surface of the sphere. This one is |+⟩ = (|0⟩ + |1⟩)/√2, pointing along x.</p>
      <p>The <b>density matrix</b> ρ (right) says the same thing: the diagonal holds the chances of 0 and 1, and the off-diagonal entry, the <b>coherence</b>, records that the two are in a definite superposition.</p>`,
  },
  {
    title: 'A coin flip is different',
    preset: { mode: 'mix', lambda: 1 },
    html: `<p>Now imagine a machine that prepares |0⟩ or |1⟩ by flipping a fair coin. Measured along z it looks exactly like |+⟩: 50/50. But measured along x, |+⟩ always gives +, while the coin flip still gives 50/50.</p>
      <p>This <b>mixed state</b> has no coherence: ρ is diagonal, and its arrow has shrunk to the centre. Drag <b>Mix with a coin flip</b> in between.</p>`,
  },
  {
    title: 'Touching the environment',
    preset: { mode: 'env', envs: 1, angle: 180 },
    html: `<p>Nobody flips coins in nature. Instead the qubit interacts with something else: a stray photon, a nearby atom. Here one environment qubit gets flipped if and only if our qubit is 1: the environment now "knows" the answer.</p>
      <p>The two together are still in a pure (entangled) state, but our qubit <b>on its own</b> has lost all coherence: its arrow is at the centre. That is <b>decoherence</b>, and it's the same effect that killed the fringes in the double slit.</p>`,
  },
  {
    title: 'Many gentle touches',
    preset: { mode: 'env', envs: 6, angle: 50 },
    html: ({ envs, angle }) => `<p>Real environments learn a little at a time. Each of these ${envs} environment qubits is nudged only ${angle}°, so each learns only a bit. But the coherence multiplies down: cos(θ/2)<sup>N</sup> = ${Math.cos((angle * Math.PI) / 360) ** envs < 0.001 ? '< 0.001' : (Math.cos((angle * Math.PI) / 360) ** envs).toFixed(3)}.</p>
      <p>With the billions of particles around a real object, coherence vanishes almost instantly. That is why cats are never seen in superposition.</p>`,
  },
  {
    title: 'Dephasing: T₂',
    preset: { mode: 'time', T1: 60, T2: 6, detune: 1.5, start: 'plus' },
    play: true,
    html: `<p>In a real qubit this happens continuously. Start in |+⟩ with a small detuning, so the arrow precesses around the equator (a <b>Ramsey</b> experiment). Random fluctuations in its frequency blur the phase, and the arrow <b>spirals in</b> toward the z axis.</p>
      <p>The time scale is T<sub>2</sub>. The chart shows the x component oscillating inside a decaying envelope: the classic Ramsey fringe, measured for every real qubit.</p>`,
  },
  {
    title: 'Relaxation: T₁',
    preset: { mode: 'time', T1: 5, T2: 10, detune: 0, start: 'one' },
    play: true,
    html: `<p>A qubit in |1⟩ (higher energy) eventually gives its energy away and falls to |0⟩. The arrow slides from the south pole to the north pole with time constant T<sub>1</sub>.</p>
      <p>Energy loss also destroys coherence, so always T<sub>2</sub> ≤ 2T<sub>1</sub>.</p>`,
  },
  {
    title: 'The race against the clock',
    preset: { mode: 'time', T1: 20, T2: 12, detune: 0.8, start: 'plus' },
    play: true,
    html: `<p>Today's superconducting qubits have T<sub>1</sub> and T<sub>2</sub> of roughly 100 microseconds, and a gate takes a few tens of nanoseconds: a few thousand gates before the information fades. Shor's algorithm for a useful number needs billions.</p>
      <p>The way out is <b>quantum error correction</b>: the next lesson.</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<div id="player"></div>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>The qubit's Bloch arrow</h2><span class="legend">inside the sphere = mixed</span></figcaption>
      <canvas id="bloch" class="chart" style="height: 340px" role="img" aria-label="Bloch sphere; a shorter arrow is a more mixed state"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Density matrix ρ</h2><span class="legend">diagonal = chances; off-diagonal = coherence</span></figcaption>
      <canvas id="rho" class="chart" style="height: 250px" role="img" aria-label="The 2 by 2 density matrix"></canvas>
      <dl class="facts" id="facts"></dl>
    </figure>
  </div>
  <figure class="panel card" id="env-card">
    <figcaption class="card-head"><h2>The circuit: qubit and environment</h2><span class="legend">top wire = our qubit</span></figcaption>
    <div id="circuit" class="circuit-scroll"></div>
  </figure>
  <figure class="panel card" id="chart-card">
    <figcaption class="card-head"><h2 id="chart-title">Coherence</h2><span class="legend" id="chart-legend"></span></figcaption>
    <canvas id="chart" class="chart" role="img" aria-label="Coherence against time or number of environment qubits"></canvas>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">What happens to the qubit</span>
      <select id="mode"><option value="mix">Mixed with a coin flip</option><option value="env">Entangled with an environment</option><option value="time">Noise over time (T₁, T₂)</option></select></label>
    <div data-for="mix" style="margin-top: 14px">
      <label class="field"><span class="label">Mix with a coin flip <output id="lambda-out"></output></span><input id="lambda" type="range" min="0" max="1" step="0.05"></label>
    </div>
    <div data-for="env" style="margin-top: 14px">
      <label class="field"><span class="label">Environment qubits N <output id="envs-out"></output></span><input id="envs" type="range" min="0" max="10" step="1"></label>
      <label class="field"><span class="label">Nudge per qubit θ <output id="angle-out"></output></span><input id="angle" type="range" min="0" max="180" step="5"></label>
    </div>
    <div data-for="time" style="margin-top: 14px">
      <label class="field"><span class="label">Start in</span><select id="start"><option value="plus">|+⟩ (superposition)</option><option value="one">|1⟩ (excited)</option></select></label>
      <label class="field"><span class="label">T₁ (relaxation) <output id="T1-out"></output></span><input id="T1" type="range" min="1" max="60" step="1"></label>
      <label class="field"><span class="label">T₂ (dephasing) <output id="T2-out"></output></span><input id="T2" type="range" min="1" max="60" step="1"></label>
      <label class="field"><span class="label">Detuning <output id="detune-out"></output></span><input id="detune" type="range" min="0" max="3" step="0.1"></label>
    </div>
  </div>`;

const $ = (id) => document.getElementById(id);
const bloch = new BlochView($('bloch'));
const settings = { mode: 'mix', lambda: 0, envs: 1, angle: 180, T1: 20, T2: 12, detune: 0.8, start: 'plus' };
let index = 0;
let t = 0;
const DURATION = 30;

const effT2 = () => Math.min(settings.T2, 2 * settings.T1);
const startVec = () => (settings.start === 'one' ? [0, 0, -1] : [1, 0, 0]);

function vectorNow() {
  if (settings.mode === 'mix') return [1 - settings.lambda, 0, 0];
  if (settings.mode === 'env') return entangleWithEnvironment(settings.envs, (settings.angle * Math.PI) / 180).bloch;
  return evolveNoisy(startVec(), t, { T1: settings.T1, T2: effT2(), detune: settings.detune });
}

function drawRho(th, v) {
  const { ctx, w, h } = prep($('rho'));
  const rho = rhoFromBloch(v);
  const size = Math.min((h - 16) / 2, (w - 60) / 2);
  const x0 = (w - 2 * size) / 2;
  const y0 = 10;
  const labels = ['0', '1'];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const k = 2 * r + c;
      const x = x0 + c * size;
      const y = y0 + r * size;
      ctx.strokeStyle = withAlpha(th.muted, 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      const re = rho.re[k];
      const im = rho.im[k];
      const mag = Math.hypot(re, im);
      const cx = x + size / 2;
      const cy = y + size / 2 - 6;
      const R = size * 0.36;
      if (r === c) {
        // a probability: a bar
        const bh = mag * (size - 34);
        ctx.fillStyle = th.exact;
        ctx.fillRect(x + size * 0.3, y + size - 22 - bh, size * 0.4, bh);
      } else {
        // a coherence: a dial whose radius is |rho_01| relative to its largest possible value 1/2
        ctx.strokeStyle = withAlpha(th.muted, 0.35);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 2 * Math.PI);
        ctx.stroke();
        if (mag > 1e-4) {
          const ph = Math.atan2(im, re);
          ctx.fillStyle = phaseColor(ph, 0.85);
          ctx.beginPath();
          ctx.arc(cx, cy, R * Math.min(1, 2 * mag), 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.font = MONO;
      ctx.fillStyle = th.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(im === 0 || Math.abs(im) < 5e-4 ? re.toFixed(3) : `${re.toFixed(2)}${im < 0 ? '−' : '+'}${Math.abs(im).toFixed(2)}i`, cx, y + size - 4);
    }
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  labels.forEach((l, r) => ctx.fillText(`⟨${l}|`, x0 - 6, y0 + (r + 0.5) * size));
}

function drawChart(th) {
  const { ctx, w, h } = prep($('chart'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  ctx.font = MONO;
  if (settings.mode === 'env') {
    const Y = yAxis(ctx, box, [0, 1.05], th);
    const X = xAxis(ctx, box, [0, 10], th, { integer: true });
    const c = Math.cos((settings.angle * Math.PI) / 360);
    ctx.strokeStyle = th.ampPos;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let n = 0; n <= 10; n++) (n ? ctx.lineTo : ctx.moveTo).call(ctx, X(n), Y(c ** n));
    ctx.stroke();
    for (let n = 0; n <= 10; n++) {
      ctx.fillStyle = n === settings.envs ? th.marked : th.ampPos;
      ctx.beginPath();
      ctx.arc(X(n), Y(c ** n), n === settings.envs ? 6 : 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('environment qubits N', (box.x0 + box.x1) / 2, h);
    return;
  }
  // time mode: x component and P(1) against time
  const Y = yAxis(ctx, box, [-1.05, 1.05], th);
  const X = xAxis(ctx, box, [0, DURATION], th);
  ctx.strokeStyle = th.axis;
  ctx.beginPath();
  ctx.moveTo(box.x0, Math.round(Y(0)) + 0.5);
  ctx.lineTo(box.x1, Math.round(Y(0)) + 0.5);
  ctx.stroke();
  const opts = { T1: settings.T1, T2: effT2(), detune: settings.detune };
  const line = (f, color, width, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= 600; i++) {
      const s = (i / 600) * DURATION;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(s), Y(f(s)));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line((s) => Math.hypot(...evolveNoisy(startVec(), s, opts).slice(0, 2)), withAlpha(th.muted, 0.8), 1.25, [4, 4]);
  line((s) => evolveNoisy(startVec(), s, opts)[0], th.ampPos, 2.5);
  line((s) => (1 - evolveNoisy(startVec(), s, opts)[2]) / 2, th.marked, 2);
  ctx.strokeStyle = th.text;
  ctx.beginPath();
  ctx.moveTo(Math.round(X(t)) + 0.5, box.y0);
  ctx.lineTo(Math.round(X(t)) + 0.5, box.y1);
  ctx.stroke();
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('time', (box.x0 + box.x1) / 2, h);
}

function render() {
  const th = theme();
  const v = vectorNow();
  bloch.vector = v;
  bloch.trail = [];
  if (settings.mode === 'time') {
    const n = Math.ceil(t / 0.05);
    for (let i = 0; i <= n; i++) bloch.trail.push(evolveNoisy(startVec(), (i / Math.max(1, n)) * t, { T1: settings.T1, T2: effT2(), detune: settings.detune }));
  }
  bloch.draw(th);
  drawRho(th, v);
  const len = Math.hypot(...v);
  $('facts').innerHTML = `
    <dt>Arrow length</dt><dd><b>${len.toFixed(3)}</b> (1 = pure, 0 = completely mixed)</dd>
    <dt>Purity Tr ρ²</dt><dd>${purity(v).toFixed(3)}</dd>
    <dt>Entropy</dt><dd>${entropy(v).toFixed(3)} bits</dd>`;
  $('env-card').hidden = settings.mode !== 'env';
  $('chart-card').hidden = settings.mode === 'mix';
  if (settings.mode === 'env') {
    const ops = [{ gate: 'H', target: 0 }];
    for (let e = 1; e <= settings.envs; e++) ops.push({ gate: 'RY', target: e, angle: (settings.angle * Math.PI) / 180, controls: [0] });
    drawCircuit($('circuit'), {
      n: settings.envs + 1,
      ops,
      applied: ops.length,
      labels: ['qubit', ...Array.from({ length: settings.envs }, (_, e) => `env ${e + 1}`)],
    });
    $('chart-title').textContent = 'Coherence against the size of the environment';
    $('chart-legend').textContent = 'cos(θ/2)ᴺ: exact partial trace of the circuit';
  } else if (settings.mode === 'time') {
    $('chart-title').textContent = 'Over time';
    $('chart-legend').textContent = 'cyan: x component (Ramsey fringe); dashed: its envelope; amber: chance of 1';
  }
  if (settings.mode !== 'mix') drawChart(th);
  const ctx = { ...settings };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

const lesson = mountLesson({ slug: 'decoherence', onNavigate: (i) => enterStep(i) });
const player = new Player($('player'), { duration: DURATION, speed: 3, onTime: (time) => ((t = time), render()) });

const fmt = { lambda: (v) => `${Math.round(v * 100)}%`, envs: String, angle: (v) => `${v}°`, T1: String, T2: (v) => (v > 2 * settings.T1 ? `${v} (capped at 2T₁)` : String(v)), detune: (v) => v.toFixed(1) };

function syncControls() {
  $('mode').value = settings.mode;
  $('start').value = settings.start;
  for (const k of Object.keys(fmt)) {
    $(k).value = String(settings[k]);
    $(`${k}-out`).textContent = fmt[k](settings[k]);
  }
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== settings.mode));
  $('player').hidden = settings.mode !== 'time';
}

for (const k of Object.keys(fmt)) {
  $(k).addEventListener('input', () => {
    settings[k] = Number($(k).value);
    syncControls();
    render();
  });
}
for (const k of ['mode', 'start']) {
  $(k).addEventListener('change', () => {
    settings[k] = $(k).value;
    syncControls();
    player.seek(0);
  });
}

function enterStep(i) {
  index = i;
  Object.assign(settings, STEPS[i].preset);
  syncControls();
  player.pause();
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
