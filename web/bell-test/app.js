import { seededRandom } from '../lib/circuit.js';
import { percent } from '../lib/format.js';
import { chshS, classicalStrategies, correlation, gameWin, quantumRound } from '../lib/noise.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, theme, xAxis, yAxis } from '../ui/charts.js';
import { mountLesson } from '../ui/lesson.js';

// The CHSH game. A referee sends random bits x to Alice and y to Bob; they answer a and b without
// talking, and win when a XOR b = x AND y. Classical players (fixed rules, possibly chosen by shared
// randomness) win at most 75%. Players sharing a Bell pair measure at angles that depend on their
// question; each round is simulated on the statevector engine (lib/noise.js, quantumRound).

const DEG = Math.PI / 180;
const CLASSICAL_MAX = 0.75;
const QUANTUM_MAX = Math.cos(Math.PI / 8) ** 2;
const BEST = { a0: 0, a1: 90, b0: 45, b1: -45 };

const STEPS = [
  {
    title: 'A game for two',
    preset: { mode: 'classical', rule: [0, 0, 0, 0], play: 0 },
    html: `<p>Alice and Bob are separated so they can't communicate. A referee sends Alice a random bit x and Bob a random bit y. Each answers with a bit, a and b.</p>
      <p>They <b>win</b> if their answers are the same, except when both got a 1: then the answers must differ. (In symbols: a ⊕ b = x·y.) They may agree on a strategy beforehand. Press <b>Play a round</b>.</p>`,
  },
  {
    title: 'The best classical strategy',
    preset: { mode: 'classical', rule: [0, 0, 0, 0], play: 1000 },
    html: `<p>"Always answer 0" wins whenever the answers should match: 3 of the 4 question pairs, so <b>75%</b>. Change the rules in <b>Try it</b>: no choice of answers beats 75%, because the four win conditions contradict each other.</p>
      <p>Using shared random numbers only mixes such rules, so it can't do better either. Any theory in which particles carry hidden instructions is stuck at 75%.</p>`,
  },
  {
    title: 'Share an entangled pair',
    preset: { mode: 'quantum', angles: BEST, play: 1000 },
    html: `<p>Now give Alice and Bob one qubit each of a Bell pair, (|00⟩ + |11⟩)/√2. Each measures along a direction that depends on their question (the arrows at right) and answers with the result.</p>
      <p>They win <b>85%</b> of the time: cos²(π/8) = ${percent(QUANTUM_MAX)}. No strategy with hidden instructions can do that.</p>`,
  },
  {
    title: 'Why it works',
    preset: { mode: 'quantum', angles: BEST, play: 4000 },
    html: ({ S }) => `<p>Measuring a Bell pair along directions at an angle θ apart gives equal results with probability cos²(θ/2), a <b>correlation</b> E = cos θ. The chosen directions put three question pairs 45° apart (strong agreement) and the (1, 1) pair 135° apart (strong disagreement).</p>
      <p>Bell's quantity S = E₀₀ + E₀₁ + E₁₀ − E₁₁ is at most 2 for hidden instructions. Here it is <b>${S.toFixed(3)}</b>, and 2√2 = 2.828 is the most quantum mechanics allows.</p>`,
  },
  {
    title: 'But no signalling',
    preset: { mode: 'quantum', angles: BEST, play: 4000 },
    html: ({ marginal }) => `<p>Could Bob use this to send Alice a message faster than light? No. Alice's own answers are 0 half the time whatever Bob is asked or does (${percent(marginal)} zeros so far). The correlation only shows up when they compare notes, which needs ordinary communication.</p>`,
  },
  {
    title: 'Done for real',
    preset: { mode: 'quantum', angles: BEST, play: 4000 },
    html: `<p>Clauser (1972) and Aspect (1982) ran this test with entangled photons and found S &gt; 2. In 2015 three groups closed the remaining loopholes (Delft, Vienna and NIST), and the 2022 Nobel Prize went to Aspect, Clauser and Zeilinger.</p>
      <p>The conclusion: nature cannot be described by particles carrying local hidden instructions.</p>`,
  },
  {
    title: 'Your turn',
    preset: { mode: 'quantum', angles: { a0: 0, a1: 60, b0: 30, b1: -30 }, play: 0 },
    html: `<p>Adjust the four measurement angles. Can you find settings that beat 75%? Can you beat 85.4%? (You can't: that limit, 2√2 for S, is Tsirelson's bound.)</p>`,
  },
];

const stage = document.getElementById('stage');
stage.insertAdjacentHTML(
  'beforeend',
  `<figure class="panel card">
    <figcaption class="card-head"><h2>The last round</h2><span class="legend" id="round-legend"></span></figcaption>
    <div id="round" class="chsh-round"></div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px">
      <button id="play1" class="btn btn-primary" type="button">Play a round</button>
      <button id="play100" class="btn" type="button">100 rounds</button>
      <button id="play1000" class="btn" type="button">1000 rounds</button>
      <button id="reset" class="btn" type="button">Reset</button>
    </div>
  </figure>
  <div class="grid2">
    <figure class="panel card">
      <figcaption class="card-head"><h2>Win rate</h2><span class="legend">dashed: classical limit 75%, quantum limit 85.4%</span></figcaption>
      <canvas id="rate" class="chart" style="height: 260px" role="img" aria-label="Win rate as rounds are played"></canvas>
    </figure>
    <figure class="panel card">
      <figcaption class="card-head"><h2 id="side-title">Measurement directions</h2><span class="legend" id="side-legend"></span></figcaption>
      <canvas id="angles" class="chart" style="height: 260px" role="img" aria-label="Measurement directions of Alice and Bob"></canvas>
    </figure>
  </div>
  <figure class="panel card">
    <figcaption class="card-head"><h2>Correlations</h2><span class="legend">E = P(same) − P(different), for each question pair</span></figcaption>
    <div id="table"></div>
  </figure>`,
);

document.getElementById('try-slot').innerHTML = `
  <div class="panel try-card">
    <h2>Try it</h2>
    <label class="field"><span class="label">Alice and Bob use</span>
      <select id="mode"><option value="classical">A fixed rule (classical)</option><option value="quantum">A shared Bell pair</option></select></label>
    <div data-for="classical" style="margin-top: 14px">
      <div class="field"><span class="label">Alice answers when x = 0 / x = 1</span><div class="bit-toggles" id="rule-a"></div></div>
      <div class="field"><span class="label">Bob answers when y = 0 / y = 1</span><div class="bit-toggles" id="rule-b"></div></div>
    </div>
    <div data-for="quantum" style="margin-top: 14px">
      ${['a0', 'a1', 'b0', 'b1']
        .map(
          (k) => `<label class="field"><span class="label">${k[0] === 'a' ? 'Alice' : 'Bob'}'s angle when ${k[0] === 'a' ? 'x' : 'y'} = ${k[1]} <output id="${k}-out"></output></span>
        <input id="${k}" type="range" min="-180" max="180" step="5"></label>`,
        )
        .join('')}
    </div>
  </div>`;

const $ = (id) => document.getElementById(id);
const settings = { mode: 'classical', rule: [0, 0, 0, 0], angles: { ...BEST } };
let index = 0;
let rng = seededRandom(1964);
let history = []; // win (0/1) per round
let tallies = null; // per question pair: { same, diff }
let aliceZeros = 0;
let last = null;

const radians = () => Object.fromEntries(Object.entries(settings.angles).map(([k, v]) => [k, v * DEG]));

function reset() {
  history = [];
  tallies = Array.from({ length: 4 }, () => ({ same: 0, diff: 0 }));
  aliceZeros = 0;
  last = null;
}

function round() {
  const x = rng() < 0.5 ? 0 : 1;
  const y = rng() < 0.5 ? 0 : 1;
  let a;
  let b;
  if (settings.mode === 'classical') {
    a = settings.rule[x];
    b = settings.rule[2 + y];
  } else {
    ({ a, b } = quantumRound(radians(), x, y, rng));
  }
  const win = (a ^ b) === (x & y) ? 1 : 0;
  history.push(win);
  tallies[2 * x + y][a === b ? 'same' : 'diff']++;
  if (a === 0) aliceZeros++;
  last = { x, y, a, b, win };
}

function play(n) {
  for (let i = 0; i < n; i++) round();
  render();
}

// ----- drawing -----

function drawRound() {
  if (!last) {
    $('round').innerHTML = '<p class="hint">No rounds yet.</p>';
    $('round-legend').textContent = '';
    return;
  }
  const { x, y, a, b, win } = last;
  const chip = (label, v, cls = '') => `<div class="chsh-chip ${cls}"><span>${label}</span><b>${v}</b></div>`;
  $('round').innerHTML = `
    <div class="chsh-player"><h3>Alice</h3>${chip('question x', x)}${chip('answer a', a, 'answer')}</div>
    <div class="chsh-mid"><div class="chsh-rule">needs a ⊕ b = ${x & y}</div><div class="chsh-verdict ${win ? 'win' : 'lose'}">${win ? 'win' : 'lose'}</div>
      <div class="hint">${a} ⊕ ${b} = ${a ^ b}</div></div>
    <div class="chsh-player"><h3>Bob</h3>${chip('question y', y)}${chip('answer b', b, 'answer')}</div>`;
  $('round-legend').textContent = `${history.length} rounds, ${history.reduce((s, v) => s + v, 0)} won`;
}

function drawRate(th) {
  const { ctx, w, h } = prep($('rate'));
  const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
  const N = Math.max(10, history.length);
  const Y = yAxis(ctx, box, [0.5, 1], th);
  const X = xAxis(ctx, box, [0, N], th, { integer: true });
  for (const [v, label] of [
    [CLASSICAL_MAX, 'classical 75%'],
    [QUANTUM_MAX, 'quantum 85.4%'],
  ]) {
    ctx.strokeStyle = withAlpha(th.muted, 0.8);
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(box.x0, Math.round(Y(v)) + 0.5);
    ctx.lineTo(box.x1, Math.round(Y(v)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(label, box.x1 - 4, Y(v) + 3);
  }
  if (history.length) {
    ctx.strokeStyle = settings.mode === 'quantum' ? th.ampPos : th.marked;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let wins = 0;
    const stepN = Math.max(1, Math.floor(history.length / 600));
    history.forEach((v, i) => {
      wins += v;
      if (i % stepN && i !== history.length - 1) return;
      const r = Math.max(0.5, wins / (i + 1));
      if (i === 0) ctx.moveTo(X(i + 1), Y(r));
      else ctx.lineTo(X(i + 1), Y(r));
    });
    ctx.stroke();
  }
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('rounds played', (box.x0 + box.x1) / 2, h);
}

function drawAngles(th) {
  const { ctx, w, h } = prep($('angles'));
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 36;
  if (settings.mode === 'classical') {
    $('side-title').textContent = 'All 16 fixed rules';
    $('side-legend').textContent = 'win rate of each; yours highlighted';
    const all = classicalStrategies();
    const box = { x0: 48, y0: 14, x1: w - 14, y1: h - 30 };
    const Y = yAxis(ctx, box, [0, 1], th);
    const bw = (box.x1 - box.x0) / all.length;
    all.forEach((s, i) => {
      const mine = s.alice[0] === settings.rule[0] && s.alice[1] === settings.rule[1] && s.bob[0] === settings.rule[2] && s.bob[1] === settings.rule[3];
      ctx.fillStyle = mine ? th.marked : withAlpha(th.exact, 0.6);
      ctx.fillRect(box.x0 + i * bw + 2, Y(s.win), bw - 4, box.y1 - Y(s.win));
    });
    ctx.strokeStyle = withAlpha(th.muted, 0.8);
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(box.x0, Math.round(Y(0.75)) + 0.5);
    ctx.lineTo(box.x1, Math.round(Y(0.75)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('none above 75%', (box.x0 + box.x1) / 2, h);
    return;
  }
  $('side-title').textContent = 'Measurement directions';
  $('side-legend').textContent = 'angles on the Bloch circle (x–z plane)';
  ctx.strokeStyle = withAlpha(th.muted, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.stroke();
  const arrow = (deg, color, label) => {
    const t = deg * DEG;
    const x = cx + R * Math.sin(t);
    const y = cy - R * Math.cos(t);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + (R + 20) * Math.sin(t), cy - (R + 20) * Math.cos(t));
  };
  const A = settings.angles;
  arrow(A.a0, th.ampPos, 'A₀');
  arrow(A.a1, th.ampPos, 'A₁');
  arrow(A.b0, th.marked, 'B₀');
  arrow(A.b1, th.marked, 'B₁');
}

function drawTable() {
  const r = radians();
  const rows = [
    [0, 0, r.a0, r.b0],
    [0, 1, r.a0, r.b1],
    [1, 0, r.a1, r.b0],
    [1, 1, r.a1, r.b1],
  ]
    .map(([x, y, a, b], k) => {
      const t = tallies[k];
      const n = t.same + t.diff;
      const measured = n ? (t.same - t.diff) / n : null;
      const predicted = settings.mode === 'quantum' ? correlation(a, b) : settings.rule[x] === settings.rule[2 + y] ? 1 : -1;
      return `<tr><td>x = ${x}, y = ${y}${x & y ? ' (must differ)' : ' (must agree)'}</td><td>${predicted.toFixed(3)}</td><td>${measured === null ? '—' : measured.toFixed(3)}</td><td>${n}</td></tr>`;
    })
    .join('');
  const S = settings.mode === 'quantum' ? chshS(radians()) : sClassical();
  $('table').innerHTML = `<div class="table-scroll"><table class="data-table"><thead><tr><th>questions</th><th>predicted E</th><th>measured E</th><th>rounds</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p style="margin-top: 10px">S = E₀₀ + E₀₁ + E₁₀ − E₁₁ = <b>${S.toFixed(3)}</b>
    (hidden instructions: at most 2; quantum: at most 2√2 = 2.828). Predicted win rate 1/2 + S/8 = <b>${((0.5 + S / 8) * 100).toFixed(1)}%</b>.</p>`;
}

function sClassical() {
  const [a0, a1, b0, b1] = settings.rule;
  const E = (a, b) => (a === b ? 1 : -1);
  return E(a0, b0) + E(a0, b1) + E(a1, b0) - E(a1, b1);
}

function render() {
  const th = theme();
  drawRound();
  drawRate(th);
  drawAngles(th);
  drawTable();
  const S = settings.mode === 'quantum' ? chshS(radians()) : sClassical();
  const ctx = { ...settings, S, marginal: history.length ? aliceZeros / history.length : 0.5, win: settings.mode === 'quantum' ? gameWin(radians()) : 0.75 };
  lesson.render(
    STEPS.map((st, i) => ({ title: st.title, html: i === index ? (typeof st.html === 'function' ? st.html(ctx) : st.html) : '' })),
    index,
  );
}

// ----- controls -----

function syncControls() {
  $('mode').value = settings.mode;
  document.querySelectorAll('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== settings.mode));
  const toggles = (id, offset) =>
    ($(id).innerHTML = [0, 1]
      .map((k) => `<button type="button" data-k="${offset + k}" aria-pressed="${settings.rule[offset + k] === 1}">${settings.rule[offset + k]}</button>`)
      .join(''));
  toggles('rule-a', 0);
  toggles('rule-b', 2);
  for (const k of ['a0', 'a1', 'b0', 'b1']) {
    $(k).value = String(settings.angles[k]);
    $(`${k}-out`).textContent = `${settings.angles[k]}°`;
  }
}

function changed() {
  reset();
  syncControls();
  render();
}

$('mode').addEventListener('change', () => {
  settings.mode = $('mode').value;
  changed();
});
for (const id of ['rule-a', 'rule-b']) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = Number(b.dataset.k);
    settings.rule[k] ^= 1;
    changed();
  });
}
for (const k of ['a0', 'a1', 'b0', 'b1']) {
  $(k).addEventListener('input', () => {
    settings.angles[k] = Number($(k).value);
    changed();
  });
}
$('play1').addEventListener('click', () => play(1));
$('play100').addEventListener('click', () => play(100));
$('play1000').addEventListener('click', () => play(1000));
$('reset').addEventListener('click', changed);

const lesson = mountLesson({ slug: 'bell-test', onNavigate: (i) => enterStep(i) });

function enterStep(i) {
  index = i;
  const pre = STEPS[i].preset;
  settings.mode = pre.mode;
  if (pre.rule) settings.rule = [...pre.rule];
  if (pre.angles) settings.angles = { ...pre.angles };
  rng = seededRandom(1964 + i);
  reset();
  syncControls();
  for (let k = 0; k < (pre.play ?? 0); k++) round();
  const p = new URLSearchParams();
  if (i > 0) p.set('step', i + 1);
  window.history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  render();
}

window.addEventListener('themechange', render);
new ResizeObserver(() => render()).observe(stage);

enterStep(Math.max(0, Math.min(STEPS.length - 1, (Number(new URLSearchParams(location.hash.slice(1)).get('step')) || 1) - 1)));
