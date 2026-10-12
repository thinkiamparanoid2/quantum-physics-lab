import { registerProbs } from '../lib/algorithms.js';
import { probabilities, runOps, seededRandom } from '../lib/circuit.js';
import { classicalQueries, dot, simonCircuit, solveSimon } from '../lib/simon.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { runLesson } from '../ui/lesson-kit.js';

// Simon's algorithm on the statevector engine (lib/simon.js): every run returns a string y with
// y·s = 0, and n − 1 independent ones pin down s. The tests check the distribution for every s and
// the GF(2) solver.

const bits = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1).join('');
const reverseBits = (v, n) => Array.from({ length: n }, (_, i) => ((v >> i) & 1) << (n - 1 - i)).reduce((a, b) => a | b, 0);
let race = null;

function compute(s) {
  const n = s.n;
  const secret = Math.min(s.s, (1 << n) - 1) || 1;
  const { ops, input } = simonCircuit(n, secret);
  const P = registerProbs(probabilities(runOps(2 * n, ops).state), input); // index = qubit 0 most significant
  const dist = Array.from({ length: 1 << n }, (_, y) => P[reverseBits(y, n)]); // index = y with bit i = qubit i
  // sampled runs (deterministic per secret)
  const rng = seededRandom(1000 + secret * 17 + n);
  const ys = [];
  for (let k = 0; k < s.runs; k++) {
    let u = rng();
    let y = 0;
    while (y < dist.length - 1 && u >= dist[y]) u -= dist[y++];
    ys.push(y);
  }
  return { n, secret, ops, dist, ys, solved: solveSimon(n, ys) };
}

function raceData() {
  if (race) return race;
  const rng = seededRandom(5);
  race = [];
  for (let n = 2; n <= 14; n++) {
    let cq = 0;
    let qq = 0;
    const trials = 60;
    for (let t = 0; t < trials; t++) {
      const s = 1 + Math.floor(rng() * ((1 << n) - 1));
      cq += classicalQueries(n, s, rng);
      const good = [];
      for (let y = 0; y < 1 << n; y++) if (dot(y, s) === 0) good.push(y);
      const ys = [];
      do ys.push(good[Math.floor(rng() * good.length)]);
      while (!solveSimon(n, ys).s);
      qq += ys.length;
    }
    race.push({ n, classical: cq / trials, quantum: qq / trials });
  }
  return race;
}

function circuitHtml(api) {
  const box = api.el('circuit');
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div><p class="hint"></p>';
  const { n, ops, secret } = api.model;
  const labels = [...Array.from({ length: n }, (_, i) => `x${i}`), ...Array.from({ length: n }, (_, i) => `f${i}`)];
  drawCircuit(box.querySelector('.circuit-scroll'), { n: 2 * n, ops, applied: ops.length, labels });
  box.querySelector('.hint').textContent = `Hadamards, one query to the oracle (between the barriers: copy x, then add s whenever bit ${31 - Math.clz32(secret & -secret)} of x is 1), Hadamards, measure the x register. The hidden string here is s = ${bits(secret, n)} (bit 0 written last).`;
}

function drawOutcomes(api) {
  const { ctx, w, h } = prep(api.canvas('outcomes'));
  const th = api.theme;
  const { n, dist, ys, secret } = api.model;
  const M = 1 << n;
  const box = { x0: 40, y0: 24, x1: w * 0.55, y1: h - 40 };
  const bw = (box.x1 - box.x0) / M;
  const pmax = Math.max(...dist);
  dist.forEach((p, y) => {
    const hgt = (p / pmax) * (box.y1 - box.y0) * 0.9;
    ctx.fillStyle = withAlpha(dot(y, secret) === 0 ? th.accent2 : th.muted, 0.85);
    ctx.fillRect(box.x0 + y * bw + 2, box.y1 - hgt, bw - 4, hgt);
    ctx.save();
    ctx.translate(box.x0 + (y + 0.5) * bw, box.y1 + 4);
    if (M > 8) ctx.rotate(-Math.PI / 4);
    ctx.font = MONO;
    ctx.fillStyle = th.muted;
    ctx.textAlign = M > 8 ? 'right' : 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(bits(y, n), 0, 0);
    ctx.restore();
  });
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`outcome probabilities: only y with y·s = 0 (blue), each 1/${M / 2}`, box.x0, 2);
  // the runs so far
  const x0 = w * 0.6;
  ctx.fillText('runs so far: equations y · s = 0 (mod 2)', x0, 2);
  ctx.font = MONO;
  ys.forEach((y, i) => {
    ctx.fillStyle = th.text;
    ctx.fillText(`${i + 1}.  y = ${bits(y, n)}`, x0, 26 + 18 * i);
  });
  const { solved } = api.model;
  ctx.font = FONT;
  ctx.fillStyle = solved.s ? th.accent2 : th.muted;
  ctx.fillText(
    ys.length === 0 ? 'Press "Run the circuit" to collect outcomes.' : solved.s ? `${solved.rank} independent equations: s = ${bits(solved.s, n)} ✓` : `${solved.rank} independent equation${solved.rank === 1 ? '' : 's'} of the ${n - 1} needed`,
    x0,
    26 + 18 * Math.max(ys.length, 1) + 8,
  );
}

function drawRace(api) {
  const { ctx, w, h } = prep(api.canvas('race'));
  const th = api.theme;
  const data = raceData();
  const box = { x0: 56, y0: 16, x1: w - 16, y1: h - 36 };
  const X = (n) => box.x0 + ((n - 2) / 12) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - (Math.log2(v) / 9) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = 0; e <= 9; e += 3) ctx.fillText(String(2 ** e), box.x0 - 6, Y(2 ** e));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let n = 2; n <= 14; n += 2) ctx.fillText(String(n), X(n), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('bits n', (box.x0 + box.x1) / 2, box.y1 + 18);
  const line = (key, color) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((d, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(d.n), Y(d[key])));
    ctx.stroke();
  };
  line('classical', th.ampNeg);
  line('quantum', th.accent2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [
    ['classical: query until two inputs collide (≈ √(π 2ⁿ / 2), the birthday bound)', th.ampNeg],
    ['quantum: runs until n − 1 independent equations (≈ n)', th.accent2],
  ].forEach(([t, c], i) => {
    const y = box.y0 + 8 + 18 * i;
    ctx.fillStyle = c;
    ctx.fillRect(box.x0 + 10, y - 1.5, 18, 3);
    ctx.fillStyle = th.text;
    ctx.fillText(t, box.x0 + 34, y);
  });
}

const STEPS = [
  {
    title: 'A hidden pattern',
    preset: { n: 3, s: 5, runs: 0 },
    focus: ['The circuit'],
    html: `<p>A black box computes a function f on n-bit strings with a promise: f(x) = f(x′) exactly when x′ = x or x′ = x ⊕ s, for some hidden string s. Find s.</p>
      <p>Classically you must find two inputs with the same output. Querying at random, that takes about √(2ⁿ) queries (the birthday paradox), and any classical method needs exponentially many.</p>`,
  },
  {
    title: 'One query in superposition',
    preset: { n: 3, s: 5, runs: 0 },
    focus: ['The circuit'],
    html: `<p>Simon's circuit queries f once, on a superposition of all inputs. Measuring the output register (or simply ignoring it) leaves the input in (|x⟩ + |x ⊕ s⟩)/√2 for a random x. The final Hadamards turn this into interference: only strings y orthogonal to s survive.</p>`,
    math: `<span class="eq">H^⊗n (|x⟩ + |x⊕s⟩)/√2 = 2^{−(n+1)/2} Σ_y (−1)^{x·y} (1 + (−1)^{s·y}) |y⟩</span>
      The amplitude vanishes unless s·y = 0 (mod 2), and every allowed y has probability 2^{−(n−1)}.`,
  },
  {
    title: 'Each run gives an equation',
    preset: { n: 3, s: 5, runs: 1 },
    focus: ['Outcomes and equations'],
    html: `<p>Every measured y obeys y · s = 0 (mod 2): one linear equation for the bits of s. The bars show the exact distribution: only the blue strings ever appear, all equally likely.</p>`,
    predict: {
      q: 'How many independent equations pin down an n-bit s ≠ 0?',
      options: ['1', 'n − 1', 'n', '2ⁿ'],
      answer: 1,
      why: 'n − 1 independent equations leave a one-dimensional solution space {0, s}, and s ≠ 0.',
    },
  },
  {
    title: 'Solve',
    preset: { n: 3, s: 5, runs: 4 },
    focus: ['Outcomes and equations'],
    html: `<p>After a few runs the equations have rank n − 1 = 2 and Gaussian elimination over GF(2) gives s. Some runs repeat an equation or give y = 0, so a few more than n − 1 runs are needed on average, never exponentially many.</p>`,
  },
  {
    title: 'An exponential separation',
    preset: { n: 4, s: 11, runs: 6 },
    focus: ['Quantum against classical queries'],
    html: `<p>Averaged over random hidden strings, the classical collision search grows like 2<sup>n/2</sup> and Simon's algorithm like n. Simon (1994) proved this exponential gap in the number of queries. It directly inspired Shor's factoring algorithm, which finds a hidden period instead of a hidden XOR mask.</p>
      <p>The separation is relative to a black box. It says nothing by itself about functions given as explicit circuits, where classical algorithms can look inside.</p>`,
  },
  {
    title: 'Your turn',
    preset: { n: 4, s: 6, runs: 0 },
    html: `<p>Pick a hidden string and run the circuit until it is found. How many runs did it take? Try a few strings and sizes.</p>`,
  },
];

runLesson({
  slug: 'simon',
  settings: { n: 3, s: 5, runs: 0 },
  controls: [
    { id: 'n', label: 'Bits n', type: 'choice', options: [[3, '3'], [4, '4']] },
    { id: 's', label: 'Hidden string s', type: 'range', min: 1, max: 15, step: 1, format: (v) => String(v) },
    { type: 'button', label: 'Run the circuit', primary: true, onClick: (a) => a.set({ runs: Math.min(10, a.settings.runs + 1) }) },
    { type: 'button', label: 'Start over', onClick: (a) => a.set({ runs: 0 }) },
  ],
  cards: [
    { id: 'circuit', title: 'The circuit', kind: 'html' },
    { id: 'outcomes', title: 'Outcomes and equations', height: 260 },
    { id: 'race', title: 'Quantum against classical queries', legend: 'average over 60 random hidden strings', height: 260, folded: true },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    circuitHtml(api);
    drawOutcomes(api);
    drawRace(api);
  },
});
