import { seededRandom } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { blochOf, chainIntensities, downAlong, magnetAxis, sendAtom, upAlong } from '../lib/spin.js';
import { BlochView, withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// Silver atoms from an oven pass through up to three Stern-Gerlach magnets. Each magnet measures
// spin along its axis (tilted from z toward x; the beam itself runs along y). All but the last
// magnet block one of their two outputs. Atoms are sampled one at a time from the quantum
// probabilities in lib/spin.js; the predicted fractions are shown next to the counts.

const SPIN_NAMES = ['↑z', '↓z', '↑x', '↓x', '↑y', '↓y'];
const SPEED = 0.32; // px per ms
const STREAM_RATE = 30; // atoms per second

const STEPS = [
  {
    title: 'Tiny magnets meet a big one',
    preset: { magnets: [{ angle: 0 }], classical: true },
    html: `<p>An oven boils silver atoms into a beam. Each atom behaves like a tiny bar magnet (its single outer electron has <b>spin</b>). A magnet with a lopsided field pushes each one up or down depending on how it points.</p>
      <p>The atoms leave the oven pointing every which way, so classically they should smear out into a band (the shaded strip). Press <b>Fire 100 atoms</b>.</p>`,
  },
  {
    title: 'Two spots, never in between',
    preset: { magnets: [{ angle: 0 }], classical: true },
    stream: true,
    html: `<p>Every atom lands in one of <b>two spots</b>: spin up or spin down, about half each. Nothing lands in between. Stern and Gerlach saw exactly this in 1922, the first direct sign that a quantum property comes in steps.</p>
      <p>Measure spin along any direction and you only ever get one of two answers, called <b>up</b> and <b>down</b> along that direction.</p>`,
  },
  {
    title: 'Measure again: same answer',
    preset: { magnets: [{ angle: 0, pass: 'up' }, { angle: 0 }] },
    stream: true,
    html: `<p>Block the down beam and send the up atoms through a second z-magnet. They all come out up again: <b>100%</b>.</p>
      <p>So the first magnet didn't just report a random answer; it left each atom in a definite state, spin up along z. Measuring the same thing twice gives the same result.</p>`,
  },
  {
    title: 'Ask a different question',
    preset: { magnets: [{ angle: 0, pass: 'up' }, { angle: 90 }] },
    stream: true,
    html: `<p>Now turn the second magnet sideways, to measure along x. The z-up atoms split <b>50/50</b> into x-up and x-down.</p>
      <p>A state that is certain about z is completely uncertain about x.</p>`,
  },
  {
    title: 'The answer gets erased',
    preset: { magnets: [{ angle: 0, pass: 'up' }, { angle: 90, pass: 'up' }, { angle: 0 }] },
    stream: true,
    html: ({ stages }) => `<p>Keep only the x-up atoms and measure z once more. Every one of them was spin up along z two magnets ago, yet now half come out <b>down</b> (${percent(stages[2].down / stages[2].in)} predicted).</p>
      <p>Measuring x wiped out the z information. Spin along z and spin along x can't both be known at once: they are <b>incompatible</b> quantities, like position and momentum.</p>`,
  },
  {
    title: 'Angles in between',
    preset: { magnets: [{ angle: 0, pass: 'up' }, { angle: 60 }] },
    stream: true,
    html: ({ magnets }) => `<p>Tilt the second magnet by θ = ${magnets[1].angle}° from z. The chance of coming out up is <b>cos²(θ/2)</b> = ${percent(Math.cos((magnets[1].angle * Math.PI) / 360) ** 2)}.</p>
      <p>On the sphere, that's the angle between the atom's spin arrow and the magnet's axis (dashed). Drag the angle of magnet 2 in <b>Try it</b>: 0° gives all up, 180° all down, 90° half and half.</p>`,
  },
  {
    title: 'Spin is a qubit',
    preset: { magnets: [{ angle: 0, pass: 'up' }, { angle: 90 }] },
    html: `<p>Spin up along z is the state |0⟩, spin down is |1⟩, and spin up along x is (|0⟩ + |1⟩)/√2, the state |+⟩. The sphere on the right is exactly the <b>Bloch sphere</b> of the qubit lessons.</p>
      <p>An electron's spin is a real, physical qubit; some quantum computers store their qubits in just this way. Everything in the <a href="../qubit/">Qubits</a> section applies to spin.</p>`,
  },
  {
    title: 'Your turn',
    preset: { magnets: [{ angle: 0, pass: 'up' }, { angle: 45, pass: 'up' }, { angle: 90 }] },
    html: `<p>Build your own chain of up to three magnets. Can you get more atoms through z-up → z-down with a magnet in between than with nothing? (Try 90° in the middle, then find the best angle.)</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The beamline</h2><span class="legend">side view; each dot is one silver atom</span></figcaption>
    <canvas id="beam" class="chart tall" role="img" aria-label="Atoms from an oven passing through Stern-Gerlach magnets"></canvas>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px">
      <button id="fire1" class="btn" type="button">Fire 1 atom</button>
      <button id="fire100" class="btn btn-primary" type="button">Fire 100 atoms</button>
      <button id="fire1000" class="btn" type="button">1000 at once</button>
      <button id="stream" class="btn" type="button" aria-pressed="false">Stream</button>
      <button id="reset" class="btn" type="button">Clear</button>
    </div>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Spin after the last open gate</h2><span class="legend">dashed = axis of the last magnet</span></figcaption>
      <canvas id="bloch" class="chart" style="height: 300px" role="img" aria-label="Bloch sphere of the atoms' spin"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2>Counted vs predicted</h2><span class="legend">out of all atoms leaving the oven</span></figcaption>
      <div id="table"></div>
    </figure>
  </div>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Magnets</span>
      <select id="magnet-count"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
    <div id="magnet-controls"></div>
    <label class="field" style="display: flex; gap: 8px; align-items: center"><input id="classical" type="checkbox"> Show the classical guess</label>
  </div>`;

const $ = (id) => document.getElementById(id);
const bloch = new BlochView($('bloch'), { names: SPIN_NAMES });
const settings = { magnets: [{ angle: 0 }], classical: false };
let index = 0;
let stages = [];
let atoms = []; // in flight: { path, start, end }
let counts = null;
let hits = []; // recent landing positions on the screen: [y offset, out]
let streaming = false;
let lastSpawn = 0;
let rng = seededRandom(1922);
let frame = null;

const axisName = (deg) => (deg === 0 ? 'z' : deg === 90 ? 'x' : deg === 180 ? '−z' : `${deg}°`);

function magnetsForPhysics() {
  return settings.magnets.map((m, k) => ({ dir: String(m.angle), pass: k === settings.magnets.length - 1 ? undefined : m.pass ?? 'up' }));
}

function resetCounts() {
  counts = { up: 0, down: 0, blocked: settings.magnets.map(() => 0), total: 0 };
  hits = [];
  atoms = [];
}

function recompute() {
  stages = chainIntensities(magnetsForPhysics());
  resetCounts();
}

// ----- geometry -----

function layout(w, h) {
  const cy = h / 2 + 6;
  const n = settings.magnets.length;
  const x0 = 110;
  const x1 = w - 130;
  const xs = settings.magnets.map((_, k) => x0 + ((k + 0.5) / n) * (x1 - x0));
  return { cy, xs, half: 28, split: 10, branch: 34, screen: w - 54, spot: Math.min(70, h / 2 - 36) };
}

function pathFor(atom, L) {
  const pts = [[58, L.cy]];
  for (let k = 0; k <= atom.stage; k++) {
    const x = L.xs[k];
    const dir = atom.stage === k ? atom.out : settings.magnets[k].pass ?? 'up';
    const s = dir === 'up' ? -1 : 1;
    pts.push([x - L.half, L.cy], [x + L.half, L.cy + s * L.split]);
    if (k === atom.stage) {
      if (atom.blocked) pts.push([x + L.half + 40, L.cy + s * L.branch]);
      else pts.push([L.screen, L.cy + s * L.spot + atom.jitter]);
    } else {
      pts.push([x + L.half + 40, L.cy + s * L.branch], [L.xs[k + 1] - L.half - 6, L.cy]);
    }
  }
  let len = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push([pts[i - 1], pts[i], len, d]);
    len += d;
  }
  return { segs, len };
}

function pointAt(path, s) {
  for (const [a, b, start, d] of path.segs) {
    if (s <= start + d) {
      const u = d === 0 ? 0 : (s - start) / d;
      return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])];
    }
  }
  const last = path.segs[path.segs.length - 1][1];
  return last;
}

// ----- atoms -----

function spawn(now) {
  const result = sendAtom(magnetsForPhysics(), rng);
  const r = $('beam').getBoundingClientRect();
  const L = layout(r.width, r.height);
  const atom = { ...result, jitter: (rng() + rng() + rng() - 1.5) * 6 };
  const path = pathFor(atom, L);
  atoms.push({ ...atom, path, start: now, end: now + path.len / SPEED });
}

function land(a) {
  counts.total++;
  if (a.blocked) counts.blocked[a.stage]++;
  else {
    counts[a.out]++;
    hits.push([a.jitter, a.out]);
    if (hits.length > 600) hits.shift();
  }
}

function fire(nAtoms) {
  const now = performance.now();
  for (let i = 0; i < nAtoms; i++) spawnLater.push(now + i * (1000 / 45));
  loop();
}
let spawnLater = [];

function tick(now) {
  frame = null;
  while (spawnLater.length && spawnLater[0] <= now) {
    spawn(spawnLater.shift());
  }
  if (streaming && now - lastSpawn > 1000 / STREAM_RATE) {
    spawn(now);
    lastSpawn = now;
  }
  const still = [];
  for (const a of atoms) {
    if (now >= a.end) land(a);
    else still.push(a);
  }
  atoms = still;
  render(now);
  if (streaming || atoms.length || spawnLater.length) frame = requestAnimationFrame(tick);
}
function loop() {
  if (!frame) frame = requestAnimationFrame(tick);
}

// ----- drawing -----

function drawBeam(th, now) {
  const { ctx, w, h } = prep($('beam'));
  const L = layout(w, h);
  // oven
  ctx.fillStyle = withAlpha(th.marked, 0.18);
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(10, L.cy - 26, 48, 52, 8);
  ctx.fill();
  ctx.stroke();
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('oven', 34, L.cy + 32);

  // beams, thickness by intensity
  const beam = (x0, y0, x1, y1, intensity) => {
    if (intensity < 1e-9) return;
    ctx.strokeStyle = withAlpha(th.accent2, 0.12 + 0.4 * intensity);
    ctx.lineWidth = 1 + 9 * intensity;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  beam(58, L.cy, L.xs[0] - L.half, L.cy, 1);
  stages.forEach((st, k) => {
    const x = L.xs[k];
    const last = k === stages.length - 1;
    for (const [dir, s] of [
      ['up', -1],
      ['down', 1],
    ]) {
      const I = st[dir];
      const bx = x + L.half + 40;
      beam(x + L.half, L.cy + s * L.split, last ? L.screen : bx, L.cy + s * (last ? L.spot : L.branch), I);
      if (!last) {
        if (dir === st.pass) beam(bx, L.cy + s * L.branch, L.xs[k + 1] - L.half, L.cy, I);
        else {
          // a stop that blocks this beam
          ctx.fillStyle = th.ampNeg;
          ctx.fillRect(bx - 2, L.cy + s * L.branch - 9, 6, 18);
          ctx.font = MONO;
          ctx.fillStyle = th.muted;
          ctx.textAlign = 'center';
          ctx.textBaseline = s < 0 ? 'bottom' : 'top';
          ctx.fillText(`blocked ${counts.blocked[k]}`, bx, L.cy + s * (L.branch + 12));
        }
      }
    }
  });
  ctx.lineCap = 'butt';

  // magnets
  settings.magnets.forEach((m, k) => {
    const x = L.xs[k];
    const g = ctx.createLinearGradient(0, L.cy - 44, 0, L.cy + 44);
    g.addColorStop(0, withAlpha(th.ampNeg, 0.55));
    g.addColorStop(0.5, withAlpha(th.muted, 0.12));
    g.addColorStop(1, withAlpha(th.accent, 0.55));
    ctx.fillStyle = g;
    ctx.strokeStyle = th.axis;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(x - L.half, L.cy - 40, 2 * L.half, 80, 8);
    ctx.fill();
    ctx.stroke();
    // axis glyph: the magnet's axis as seen looking along the beam
    const gy = L.cy - 72;
    const a = (m.angle * Math.PI) / 180;
    ctx.strokeStyle = withAlpha(th.muted, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, gy, 14, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = th.marked;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 12 * Math.sin(a), gy + 12 * Math.cos(a));
    ctx.lineTo(x + 12 * Math.sin(a), gy - 12 * Math.cos(a));
    ctx.stroke();
    ctx.fillStyle = th.marked;
    ctx.beginPath();
    ctx.arc(x + 12 * Math.sin(a), gy - 12 * Math.cos(a), 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = FONT;
    ctx.fillStyle = th.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${k + 1}: along ${axisName(m.angle)}`, x, L.cy + 46);
  });

  // screen
  ctx.fillStyle = withAlpha(th.muted, 0.12);
  ctx.fillRect(L.screen, L.cy - L.spot - 34, 14, 2 * L.spot + 68);
  if (settings.classical) {
    ctx.fillStyle = withAlpha(th.marked, 0.22);
    ctx.fillRect(L.screen - 2, L.cy - L.spot - 6, 18, 2 * L.spot + 12);
    ctx.save();
    ctx.translate(L.screen + 34, L.cy);
    ctx.rotate(Math.PI / 2);
    ctx.font = MONO;
    ctx.fillStyle = th.marked;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('classical guess', 0, 0);
    ctx.restore();
  }
  for (const [j, out] of hits) {
    ctx.fillStyle = withAlpha(th.accent2, 0.5);
    ctx.fillRect(L.screen + 3 + ((j * 7919) % 8), L.cy + (out === 'up' ? -L.spot : L.spot) + j - 1, 3, 3);
  }
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const lastAxis = axisName(settings.magnets[settings.magnets.length - 1].angle);
  ctx.fillText(`↑${lastAxis}  ${counts.up}`, L.screen + 7, L.cy - L.spot - 16);
  ctx.textBaseline = 'top';
  ctx.fillText(`↓${lastAxis}  ${counts.down}`, L.screen + 7, L.cy + L.spot + 16);

  // atoms in flight
  ctx.fillStyle = th.text;
  for (const a of atoms) {
    const [px, py] = pointAt(a.path, (now - a.start) * SPEED);
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function drawBloch(th) {
  // The state after the last magnet whose output is passed on.
  let state = null;
  settings.magnets.slice(0, -1).forEach((m) => {
    const [t, p] = magnetAxis(String(m.angle));
    state = (m.pass ?? 'up') === 'up' ? upAlong(t, p) : downAlong(t, p);
  });
  const last = settings.magnets[settings.magnets.length - 1];
  const [t] = magnetAxis(String(last.angle));
  bloch.vector = state ? blochOf(state) : [0, 0, 0];
  bloch.axis = [Math.sin(t), 0, Math.cos(t)];
  bloch.note = state ? '' : 'straight from the oven: no definite direction';
  bloch.draw(th);
}

function drawTable() {
  const n = counts.total || 1;
  const pc = (p) => `${(p * 100).toFixed(1)}%`;
  const row = (label, predicted, counted) =>
    `<tr><td>${label}</td><td>${pc(predicted)}</td><td>${counts.total ? pc(counted / n) : '—'}</td><td>${counted}</td></tr>`;
  const lastStage = stages[stages.length - 1];
  const lastAxis = axisName(settings.magnets[settings.magnets.length - 1].angle);
  const rows = [
    ...stages.slice(0, -1).map((st, k) => row(`stopped after magnet ${k + 1}`, st.in - (st.pass === 'up' ? st.up : st.down), counts.blocked[k])),
    row(`screen, ↑${lastAxis}`, lastStage.up, counts.up),
    row(`screen, ↓${lastAxis}`, lastStage.down, counts.down),
  ].join('');
  $('table').innerHTML = `<div class="table-scroll"><table class="data-table"><thead><tr><th>where</th><th>predicted</th><th>counted</th><th>atoms</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint" style="margin-top: 10px">${counts.total} atoms fired. With more atoms the counted fractions settle on the predictions.</p>`;
}

function render(now = performance.now()) {
  const th = theme();
  drawBeam(th, now);
  drawBloch(th);
  drawTable();
}

function renderText() {
  const ctx = { ...settings, stages };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function buildControls() {
  const n = settings.magnets.length;
  $('magnet-count').value = String(n);
  $('classical').checked = settings.classical;
  $('magnet-controls').innerHTML = settings.magnets
    .map(
      (m, k) => `<div class="field"><span class="label">Magnet ${k + 1} axis <output id="angle-out-${k}">${axisName(m.angle)}</output></span>
        <input type="range" min="0" max="180" step="15" value="${m.angle}" data-angle="${k}" aria-label="Magnet ${k + 1} angle from z">
        ${
          k < n - 1
            ? `<label class="field" style="margin-top: 8px"><span class="label">Let through</span><select data-pass="${k}"><option value="up">the up beam</option><option value="down">the down beam</option></select></label>`
            : ''
        }</div>`,
    )
    .join('');
  settings.magnets.forEach((m, k) => {
    const sel = document.querySelector(`[data-pass="${k}"]`);
    if (sel) sel.value = m.pass ?? 'up';
  });
}

function changed() {
  recompute();
  renderText();
  render();
}

$('magnet-controls').addEventListener('input', (e) => {
  const k = e.target.dataset.angle;
  if (k === undefined) return;
  settings.magnets[k].angle = Number(e.target.value);
  $(`angle-out-${k}`).textContent = axisName(settings.magnets[k].angle);
  changed();
});
$('magnet-controls').addEventListener('change', (e) => {
  const k = e.target.dataset.pass;
  if (k === undefined) return;
  settings.magnets[k].pass = e.target.value;
  changed();
});
$('magnet-count').addEventListener('change', () => {
  const n = Number($('magnet-count').value);
  while (settings.magnets.length < n) settings.magnets.push({ angle: 0 });
  settings.magnets.length = n;
  settings.magnets.forEach((m, k) => k < n - 1 && !m.pass && (m.pass = 'up'));
  buildControls();
  changed();
});
$('classical').addEventListener('change', () => {
  settings.classical = $('classical').checked;
  render();
});
$('fire1').addEventListener('click', () => fire(1));
$('fire100').addEventListener('click', () => fire(100));
// No flight animation: for quick statistics.
$('fire1000').addEventListener('click', () => {
  for (let i = 0; i < 1000; i++) land({ ...sendAtom(magnetsForPhysics(), rng), jitter: (rng() + rng() + rng() - 1.5) * 6 });
  render();
});
$('stream').addEventListener('click', () => setStreaming(!streaming));
$('reset').addEventListener('click', () => {
  spawnLater = [];
  resetCounts();
  render();
});

function setStreaming(on) {
  streaming = on;
  $('stream').setAttribute('aria-pressed', String(on));
  $('stream').textContent = on ? 'Stop' : 'Stream';
  if (on) loop();
}

const lesson = mountLesson({ slug: 'stern-gerlach', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  const pre = STEPS[i].preset;
  settings.magnets = pre.magnets.map((m) => ({ ...m }));
  settings.classical = !!pre.classical;
  rng = seededRandom(1922 + i);
  spawnLater = [];
  buildControls();
  recompute();
  setStreaming(!!STEPS[i].stream);
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  renderText();
  render();
}

window.addEventListener('themechange', () => render());
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
