import { circuitCost } from '../lib/dynamics.js';
import { schwingerTerms, trotterStudy } from '../lib/schwinger.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// What it costs to simulate the Schwinger model on a quantum computer: CNOTs per Trotter step
// against chain length, the Trotter error against the number of steps (exact statevector), and a
// simple noise estimate that makes "more steps" stop helping. lib/schwinger.js and lib/dynamics.js;
// the tests check the gate count against a hand count and the error slopes of orders 1 and 2.

const STEPS = [2, 3, 5, 8, 12, 20, 30, 50, 80, 120];
const studies = new Map();

function study(s) {
  const key = `${s.N}|${s.T}`;
  if (!studies.has(key)) studies.set(key, trotterStudy({ N: s.N, T: s.T, stepsList: STEPS }));
  return studies.get(key);
}

function compute(s) {
  // the error study is a full statevector simulation: keep it to the sizes the control offers
  s = { ...s, N: [4, 6, 8].includes(s.N) ? s.N : 8 };
  const st = study(s);
  const cnots = circuitCost(schwingerTerms(s.N).terms, s.order).cnots;
  const eps = 10 ** s.logEps;
  // total error ≈ Trotter infidelity + probability that some CNOT failed
  const rows = st[s.order].map((r) => {
    const noise = 1 - (1 - eps) ** (cnots * r.steps);
    return { ...r, noise, total: Math.min(1, r.infidelity + noise) };
  });
  const best = rows.reduce((a, b) => (b.total < a.total ? b : a));
  return { st, cnots, rows, best, eps };
}

function logAxes(ctx, box, th, [xa, xb], [ya, yb], xlabel, xticks, ystep = 1) {
  const X = (v) => box.x0 + ((Math.log10(v) - xa) / (xb - xa)) * (box.x1 - box.x0);
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 10 ** ya)) - ya) / (yb - ya)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = ya; e <= yb; e += ystep) {
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10^${e}`, box.x0 - 6, Y(10 ** e));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of xticks) ctx.fillText(String(t), X(t), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText(xlabel, (box.x0 + box.x1) / 2, box.y1 + 18);
  return { X, Y };
}

function legend(ctx, x, y, th, items) {
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  items.forEach(([t, c, dash], i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(x, y + 18 * i);
    ctx.lineTo(x + 18, y + 18 * i);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.text;
    ctx.fillText(t, x + 24, y + 18 * i);
  });
}

function drawCost(api) {
  const { ctx, w, h } = prep(api.canvas('cost'));
  const th = api.theme;
  const s = api.settings;
  const box = { x0: 60, y0: 16, x1: w - 16, y1: h - 36 };
  const Ns = [4, 6, 8, 10, 12, 16, 20, 24, 32];
  const { X, Y } = logAxes(ctx, box, th, [Math.log10(3.5), Math.log10(36)], [1, 4], 'sites N (qubits)', Ns);
  const line = (f, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    Ns.forEach((N, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(N), Y(f(N))));
    ctx.stroke();
    ctx.setLineDash([]);
    Ns.forEach((N) => {
      ctx.beginPath();
      ctx.arc(X(N), Y(f(N)), 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });
  };
  line((N) => circuitCost(schwingerTerms(N).terms, 1).cnots, th.accent2);
  line((N) => 4 * (N - 1), withAlpha(th.muted, 0.9), [4, 4]);
  ctx.beginPath();
  ctx.arc(X(s.N), Y(circuitCost(schwingerTerms(s.N).terms, 1).cnots), 7, 0, 2 * Math.PI);
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2;
  ctx.stroke();
  legend(ctx, box.x0 + 12, box.y0 + 10, th, [
    ['CNOTs per first-order step: hopping + all-pairs ZZ from Gauss’s law', th.accent2],
    ['hopping alone, 4(N − 1)', withAlpha(th.muted, 0.9), [4, 4]],
  ]);
}

function drawTradeoff(api) {
  const { ctx, w, h } = prep(api.canvas('tradeoff'));
  const th = api.theme;
  const s = api.settings;
  const { rows, best, st } = api.model;
  const box = { x0: 60, y0: 16, x1: w - 16, y1: h - 36 };
  const { X, Y } = logAxes(ctx, box, th, [Math.log10(1.6), Math.log10(150)], [-6, 0], 'Trotter steps', [2, 5, 12, 30, 80], 1);
  const line = (get, color, width = 2, dash = [], list = rows) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    list.forEach((r, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.steps), Y(get(r))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  line((r) => r.infidelity, withAlpha(th.accent2, 0.35), 1.5, [3, 3], st[s.order === 1 ? 2 : 1]);
  line((r) => r.infidelity, th.accent2);
  line((r) => r.noise, th.ampNeg);
  line((r) => r.total, th.text, 2.5, [6, 3]);
  ctx.beginPath();
  ctx.arc(X(best.steps), Y(best.total), 7, 0, 2 * Math.PI);
  ctx.strokeStyle = th.marked;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  legend(ctx, box.x1 - 330, box.y1 - 80, th, [
    [`Trotter error, order ${s.order} (exact simulation)`, th.accent2],
    [`order ${s.order === 1 ? 2 : 1}, for comparison`, withAlpha(th.accent2, 0.35), [3, 3]],
    [`noise: some CNOT fails (ε = ${(10 ** s.logEps).toExponential(0)})`, th.ampNeg],
    ['total (estimate)', th.text, [6, 3]],
  ]);
}

function readout(api) {
  const s = api.settings;
  const { cnots, best, eps } = api.model;
  api.el('readout').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>CNOTs per step (N = ${s.N}, order ${s.order})</span><b>${cnots}</b></div>
      <div class="stat"><span>Best number of steps</span><b>${best.steps}</b></div>
      <div class="stat"><span>CNOTs in that circuit</span><b>${(cnots * best.steps).toLocaleString()}</b></div>
      <div class="stat"><span>Error there (estimate)</span><b>${best.total < 1e-3 ? best.total.toExponential(1) : fmt(best.total, 3)}</b></div></div>
    <p class="hint">Evolving the bare vacuum for time ${s.T} with hopping 1, mass 0.5, coupling 0.6. The noise model is deliberately simple: the run counts as failed if any of the CNOTs fails, each with probability ε = ${eps.toExponential(0)}; single-qubit gates and readout are taken as perfect.</p>`;
}

const LESSON_STEPS = [
  {
    title: 'From Hamiltonian to gates',
    preset: { N: 6, order: 1, T: 3, logEps: -3 },
    focus: ['Gates per Trotter step'],
    html: `<p>A quantum computer cannot apply e<sup>−iHt</sup> directly. Trotterisation splits time into steps and applies each Pauli term as its own rotation; a term on w qubits costs 2(w − 1) CNOTs. The Schwinger model's hopping terms are local, but Gauss's law made the electric energy couple <i>every</i> pair of sites, so the CNOT count per step grows like N².</p>`,
    math: `<span class="eq">CNOTs per first-order step = 4(N − 1) + (N − 1)(N − 2)</span>
      2(N − 1) hopping terms (XX and YY) at 2 CNOTs each, and one ZZ term for every pair j < k ≤ N − 2 at 2 CNOTs each. The tests check this hand count against the code.`,
  },
  {
    title: 'The trade-off: more qubits, or more gates',
    preset: { N: 8, order: 1, T: 3, logEps: -3 },
    focus: ['Gates per Trotter step'],
    html: `<p>Follow the blue curve out to 20 sites: the long-range terms already cost about 400 CNOTs per step, against 76 for hopping alone. The alternative is to keep the electric field on extra qubits on the links, which makes every term local again but needs more qubits and a truncated field. Which is cheaper depends on the hardware's connectivity; both are used in practice.</p>`,
  },
  {
    title: 'Trotter error',
    preset: { N: 6, order: 1, T: 3, logEps: -8 },
    focus: ['Errors against the number of steps'],
    html: `<p>With almost perfect gates, only the Trotter error remains. First order: the infidelity falls as 1/steps², four times smaller each time the steps double. Second order (symmetric splitting) falls as 1/steps⁴, sixteen times. The curves are exact statevector simulations of 6 qubits against exact evolution.</p>`,
    predict: {
      q: 'Second order needs about twice the gates per step. Is it worth it?',
      options: ['Never', 'Yes, once you need small errors: it needs far fewer steps', 'Only on trapped ions', 'Only with error correction'],
      answer: 1,
      why: 'Its error falls as dt⁴ instead of dt², so for any modest accuracy target it needs many fewer steps in total.',
    },
  },
  {
    title: 'Noise makes more steps hurt',
    preset: { N: 6, order: 1, T: 3, logEps: -3 },
    focus: ['Errors against the number of steps', 'The best you can do'],
    html: `<p>Real CNOTs fail, about once in a thousand on good current hardware. Each extra step adds gates, so the chance that something failed grows while the Trotter error shrinks. The total has a minimum (amber circle): beyond it, more accuracy in principle means less in practice.</p>`,
  },
  {
    title: 'Comparing the orders',
    preset: { N: 6, order: 2, T: 3, logEps: -3 },
    focus: ['Errors against the number of steps', 'The best you can do'],
    html: `<p>Here (6 sites, t = 3, ε = 10⁻³) the best second-order circuit uses 5 steps and ends with about 39% total error, against 8 steps and 46% for first order: its Trotter error falls fast enough to pay for the extra gates. That is not a law; for some lengths and times the order flips, so it has to be checked case by case.</p>
      <p>Notice how large the errors are even for 6 qubits. Lowering ε (Try it) moves the optimum to more steps and smaller errors; error mitigation and, eventually, error correction are what make longer simulations possible.</p>`,
  },
  {
    title: 'Where the field stands',
    preset: { N: 8, order: 2, T: 3, logEps: -3 },
    html: `<p>Martinez et al. (2016) ran this model on four trapped-ion qubits. Since then, Schwinger-model simulations have reached chains of around a hundred superconducting qubits, for example Farrell and collaborators' preparation of the Schwinger vacuum on 100+ qubits, with heavy error mitigation.</p>
      <p>Be clear about the scale: everything on this page runs faster on a laptop, and no quantum advantage is claimed for it. The point of these experiments is to build and validate the methods that larger, error-corrected machines will need for problems classical computers cannot do, such as real-time dynamics of gauge theories in 2 and 3 dimensions.</p>`,
  },
  {
    title: 'Your turn',
    preset: { N: 8, order: 1, T: 5, logEps: -3 },
    html: `<p>How does the best achievable error change with chain length, evolution time and gate quality? For a fixed ε, find the longest time you can simulate to 10% accuracy. (The Hamiltonian Playground lets you try the same circuits on other models.)</p>`,
  },
];

runLesson({
  slug: 'fields-hardware',
  settings: { N: 6, order: 1, T: 3, logEps: -3 },
  controls: [
    { id: 'N', label: 'Sites N', type: 'choice', options: [[4, '4'], [6, '6'], [8, '8']] },
    { id: 'order', label: 'Trotter order', type: 'choice', options: [[1, 'First'], [2, 'Second']] },
    { id: 'T', label: 'Evolution time', type: 'choice', options: [[1, '1'], [3, '3'], [5, '5']] },
    { id: 'logEps', label: 'CNOT error ε', type: 'range', min: -5, max: -1.5, step: 0.5, format: (v) => (10 ** v).toExponential(0) },
  ],
  cards: [
    { id: 'cost', title: 'Gates per Trotter step', legend: 'Schwinger model, first order', height: 260 },
    { id: 'tradeoff', title: 'Errors against the number of steps', height: 300 },
    { id: 'readout', title: 'The best you can do', kind: 'html' },
  ],
  steps: LESSON_STEPS,
  compute,
  draw(api) {
    drawCost(api);
    drawTradeoff(api);
    readout(api);
  },
});
