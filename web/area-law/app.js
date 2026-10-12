import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep, xAxis } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';
import { runTask } from '../ui/worker.js';

// The entanglement area law and matrix product states: entanglement across every cut for a gapped
// ground state, a critical one and a random state; how well an MPS of bond dimension χ compresses
// each; and a TEBD quench at several χ against the exact statevector (lib/mps.js; the tests check
// the SVD, the MPS round trip and TEBD's second-order convergence).

const N = 12;
const CHIS = [1, 2, 4, 8, 16, 32, 64];
const QUENCH = { N: 10, J: 1, h: 1.5, T: 6, steps: 50, chis: [2, 4, 8, 16] };
let states = null;
let quench = { status: 'idle', progress: 0, result: null };
let lessonApi = null;

function buildStates() {
  if (states?.status !== 'done') {
    if (!states) {
      states = { status: 'running', progress: 0, list: null };
      runTask(new URL('../lib/mps.js', import.meta.url), 'areaLawStates', { N, chis: CHIS }, {
        onProgress: (p) => {
          states.progress = p;
          lessonApi?.redraw();
        },
      }).promise.then((list) => {
        states = { status: 'done', progress: 1, list };
        lessonApi?.redraw();
      });
    }
    return null;
  }
  return states.list;
}

function pending(ctx, w, h, th) {
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Analysing three 12-qubit states… ${Math.round((states?.progress ?? 0) * 100)}%`, w / 2, h / 2);
}

function startQuench() {
  if (quench.status !== 'idle') return;
  quench.status = 'running';
  runTask(new URL('../lib/mps.js', import.meta.url), 'quenchRun', QUENCH, {
    onProgress: (p) => {
      quench.progress = p;
      lessonApi?.redraw();
    },
  }).promise.then((result) => {
    quench = { status: 'done', progress: 1, result };
    lessonApi?.redraw();
  });
}

const COLORS = (th) => ({ gapped: th.accent2, critical: th.marked, random: th.ampNeg });

function drawCuts(api) {
  const { ctx, w, h } = prep(api.canvas('cuts'));
  const th = api.theme;
  const list = buildStates();
  if (!list) return pending(ctx, w, h, th);
  const box = { x0: 50, y0: 16, x1: w - 16, y1: h - 36 };
  const X = (a) => box.x0 + ((a - 1) / (N - 2)) * (box.x1 - box.x0);
  const smax = 6.2;
  const Y = (v) => box.y1 - (v / smax) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= 6; v++) {
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(v));
    ctx.lineTo(box.x1, Y(v));
    ctx.stroke();
    ctx.fillText(String(v), box.x0 - 6, Y(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let a = 1; a < N; a++) ctx.fillText(String(a), X(a), box.y1 + 4);
  ctx.font = FONT;
  ctx.fillText('cut after this many qubits (of 12)', (box.x0 + box.x1) / 2, box.y1 + 18);
  // the maximum possible: min(a, N − a) bits
  ctx.strokeStyle = withAlpha(th.text, 0.4);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let a = 1; a < N; a++) (a > 1 ? ctx.lineTo : ctx.moveTo).call(ctx, X(a), Y(Math.min(a, N - a)));
  ctx.stroke();
  ctx.setLineDash([]);
  const col = COLORS(th);
  for (const st of list) {
    const sel = st.id === api.settings.state;
    ctx.strokeStyle = col[st.id];
    ctx.fillStyle = col[st.id];
    ctx.lineWidth = sel ? 3 : 1.5;
    ctx.globalAlpha = sel ? 1 : 0.55;
    ctx.beginPath();
    st.cuts.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i + 1), Y(v)));
    ctx.stroke();
    st.cuts.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(X(i + 1), Y(v), sel ? 4 : 3, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  [...list.map((st) => [st.name, col[st.id], []]), ['largest possible, min(a, 12 − a)', withAlpha(th.text, 0.4), [4, 4]]].forEach(([t, c, d], i) => {
    const y = box.y0 + 8 + 18 * i;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.setLineDash(d);
    ctx.beginPath();
    ctx.moveTo(box.x0 + 10, y);
    ctx.lineTo(box.x0 + 28, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.text;
    ctx.fillText(t, box.x0 + 34, y);
  });
}

function drawCompress(api) {
  const { ctx, w, h } = prep(api.canvas('compress'));
  const th = api.theme;
  const list = buildStates();
  if (!list) return pending(ctx, w, h, th);
  const box = { x0: 60, y0: 16, x1: w - 16, y1: h - 36 };
  const X = (i) => box.x0 + (i / (CHIS.length - 1)) * (box.x1 - box.x0);
  const [ya, yb] = [-16, 0];
  const Y = (v) => box.y1 - ((Math.log10(Math.max(v, 1e-16)) - ya) / (yb - ya)) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = ya; e <= yb; e += 4) {
    ctx.strokeStyle = withAlpha(th.muted, 0.12);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(10 ** e));
    ctx.lineTo(box.x1, Y(10 ** e));
    ctx.stroke();
    ctx.fillText(e === 0 ? '1' : `10^${e}`, box.x0 - 6, Y(10 ** e));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  CHIS.forEach((c, i) => ctx.fillText(String(c), X(i), box.y1 + 4));
  ctx.font = FONT;
  ctx.fillText('bond dimension χ', (box.x0 + box.x1) / 2, box.y1 + 18);
  const col = COLORS(th);
  for (const st of list) {
    const sel = st.id === api.settings.state;
    ctx.strokeStyle = col[st.id];
    ctx.fillStyle = col[st.id];
    ctx.lineWidth = sel ? 3 : 1.5;
    ctx.globalAlpha = sel ? 1 : 0.55;
    ctx.beginPath();
    st.compress.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), Y(c.infidelity)));
    ctx.stroke();
    st.compress.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(X(i), Y(c.infidelity), 3.5, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('infidelity 1 − |⟨ψ|ψ_χ⟩|² of the best MPS (successive SVDs)', box.x0 + 10, box.y1 - 30);
}

function compressHtml(api) {
  const list = buildStates();
  if (!list) {
    api.el('numbers').innerHTML = '<p class="hint">Computing…</p>';
    return;
  }
  const st = list.find((s) => s.id === api.settings.state);
  const need = (tol) => st.compress.find((c) => c.infidelity < tol)?.chi ?? '> 64';
  const at = st.compress.find((c) => c.chi === api.settings.chi);
  api.el('numbers').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>χ for infidelity < 10⁻⁶</span><b>${need(1e-6)}</b></div>
      <div class="stat"><span>Numbers stored at χ = ${api.settings.chi}</span><b>${at.params.toLocaleString()}</b></div>
      <div class="stat"><span>Infidelity at χ = ${api.settings.chi}</span><b>${at.infidelity < 1e-15 ? '< 10⁻¹⁵' : at.infidelity.toExponential(1)}</b></div>
      <div class="stat"><span>Full statevector</span><b>${(2 * 2 ** N).toLocaleString()}</b></div></div>
    <p class="hint">${st.name}: half-chain entanglement ${fmt(st.cuts[N / 2 - 1], 3)} bits. An MPS with bond dimension χ can hold at most log₂ χ bits across any cut.</p>`;
}

function drawQuench(api) {
  const { ctx, w, h } = prep(api.canvas('quench'));
  const th = api.theme;
  startQuench();
  if (!quench.result) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Running TEBD at χ = 2, 4, 8, 16 and the exact evolution… ${Math.round(quench.progress * 100)}%`, w / 2, h / 2);
    return;
  }
  const r = quench.result;
  const half = w * 0.58;
  const box = { x0: 46, y0: 16, x1: half - 10, y1: h - 36 };
  const X = xAxis(ctx, box, [0, QUENCH.T], th);
  const Y = (v) => box.y1 - (v / 5) * (box.y1 - box.y0);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= 5; v++) ctx.fillText(String(v), box.x0 - 6, Y(v));
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('time', (box.x0 + box.x1) / 2, box.y1 + 20);
  const line = (vals, color, width, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.times[i]), Y(v)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  QUENCH.chis.forEach((chi, i) => {
    const c = withAlpha(th.accent2, 0.35 + 0.2 * i);
    line(r.tebd[chi].S, c, 1.5 + 0.4 * i);
    ctx.strokeStyle = withAlpha(c, 0.6);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(box.x0, Y(Math.log2(chi)));
    ctx.lineTo(box.x1, Y(Math.log2(chi)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.muted;
    ctx.font = MONO;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`χ=${chi}`, box.x1, Y(Math.log2(chi)) - 1);
  });
  line(r.exact, th.text, 2.5, [5, 3]);
  ctx.font = FONT;
  ctx.fillStyle = th.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('half-chain entanglement (bits): dashed = exact, blue = TEBD', box.x0 + 6, box.y0);
  // light cone: every bond's entanglement for χ = 16
  const b2 = { x0: half + 30, y0: 30, x1: w - 16, y1: h - 36 };
  const bonds = r.bonds;
  const nb = bonds[0].length;
  const cw = (b2.x1 - b2.x0) / nb;
  const rh = (b2.y1 - b2.y0) / bonds.length;
  const vmax = Math.max(...bonds.flat());
  bonds.forEach((row, t) => {
    const ya = Math.round(b2.y0 + t * rh);
    const yb = Math.round(b2.y0 + (t + 1) * rh);
    row.forEach((v, k) => {
      ctx.fillStyle = withAlpha(th.marked, 0.03 + 0.97 * (v / vmax) ** 2);
      ctx.fillRect(b2.x0 + k * cw, ya, cw - 1, Math.max(1, yb - ya));
    });
  });
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('bond →', (b2.x0 + b2.x1) / 2, b2.y1 + 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('t=0', b2.x0 - 4, b2.y0 + 4);
  ctx.fillText(`t=${QUENCH.T}`, b2.x0 - 4, b2.y1 - 4);
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('entanglement of every bond (χ = 16)', b2.x0, b2.y0 - 6);
}

const STEPS = [
  {
    title: 'Measuring entanglement across a cut',
    preset: { state: 'random', chi: 8 },
    focus: ['Entanglement across every cut'],
    html: `<p>Cut a chain of 12 qubits after the first a qubits and ask how entangled the two sides are: the entanglement entropy S, in bits. It can be at most min(a, 12 − a), one bit per qubit on the smaller side.</p>
      <p>A <b>random</b> state of 12 qubits comes close to that maximum at every cut: a <b>volume law</b>. At the middle cut it carries 5.28 bits, exactly Page's average for a random state of 6 + 6 qubits, 6 − 1/(2 ln 2) ≈ 5.28 (Page, 1993). Almost every state in Hilbert space looks like this.</p>`,
  },
  {
    title: 'Ground states obey an area law',
    preset: { state: 'gapped', chi: 8 },
    focus: ['Entanglement across every cut'],
    html: `<p>The ground state of a gapped local Hamiltonian (here the Ising chain deep in its paramagnet) has a small entanglement that hardly depends on where you cut: only the bonds near the cut matter. That is the <b>area law</b>; in 1D the "area" of the boundary is a single point, so S stays bounded (Hastings proved it for gapped 1D chains in 2007).</p>
      <p>At a critical point (amber) it grows only logarithmically. Physical ground states sit in a tiny, lightly entangled corner of Hilbert space.</p>`,
  },
  {
    title: 'Matrix product states',
    preset: { state: 'gapped', chi: 4 },
    focus: ['Compressing with matrix product states', 'The numbers'],
    html: `<p>That corner can be described cheaply. Write the state as a <b>matrix product state</b>: one small tensor per qubit, linked by bonds of dimension χ. An MPS can carry at most log₂ χ bits across any cut, so a lightly entangled state needs only a small χ.</p>
      <p>The gapped ground state reaches 10⁻⁶ accuracy at small χ; the random state needs the full χ = 64. For long chains the gap is astronomical: an MPS stores about 4Nχ² numbers instead of 2·2<sup>N</sup>. This is why DMRG (White, 1992) computes 1D ground states for hundreds of sites.</p>`,
    math: `<span class="eq">|ψ⟩ = Σ A¹[s₁] A²[s₂] ⋯ Aᴺ[s_N] |s₁ s₂ … s_N⟩</span>
      Each A[s] is a χ × χ matrix. The best MPS at a given χ comes from successive singular value decompositions, keeping the largest χ Schmidt values at each cut.`,
    predict: {
      q: 'What is the smallest χ that can represent a Bell pair between the two halves of the chain?',
      options: ['1', '2', '4', '64'],
      answer: 1,
      why: 'A Bell pair carries one bit across the cut, and log₂ 2 = 1.',
    },
  },
  {
    title: 'Dynamics: entanglement grows',
    preset: { state: 'critical', chi: 8 },
    focus: ['After a quench'],
    html: `<p>Start in |00…0⟩ (no entanglement) and switch on the Ising Hamiltonian. Quasiparticle pairs fly apart and carry entanglement across the cut, so S grows linearly in time, inside a light cone (right panel).</p>
      <p>The TEBD algorithm (Vidal, 2004) evolves an MPS gate by gate, truncating to χ after each one. Each blue curve follows the exact answer until the entanglement nears its ceiling log₂ χ, then falls away. Because S grows linearly, the χ needed grows exponentially with time: long-time dynamics is where tensor networks run out, and one of the places quantum simulators are being tested.</p>
      <p>The exact curve turns down after t ≈ 3.5 only because 10 sites are few: the quasiparticles reach the ends of the chain and come back.</p>`,
  },
  {
    title: 'How we know it is right',
    preset: { state: 'critical', chi: 16 },
    html: `<p>The tests check the complex SVD against reconstruction, an MPS built from a random state against the original (exact at full χ), and TEBD against exact evolution on 8 qubits: the error falls fourfold when the time step is halved, as a second-order method should, and the entanglement agrees.</p>`,
  },
  {
    title: 'Your turn',
    preset: { state: 'critical', chi: 8 },
    html: `<p>Pick a state and a bond dimension and compare the compression error. How many numbers does each state need for 10⁻⁶ accuracy?</p>`,
  },
];

lessonApi = runLesson({
  slug: 'area-law',
  settings: { state: 'random', chi: 8 },
  controls: [
    { id: 'state', label: 'State', type: 'choice', options: [['gapped', 'Gapped'], ['critical', 'Critical'], ['random', 'Random']] },
    { id: 'chi', label: 'Bond dimension χ', type: 'choice', options: CHIS.map((c) => [c, String(c)]) },
  ],
  cards: [
    { id: 'cuts', title: 'Entanglement across every cut', legend: '12 qubits, exact', height: 280 },
    { id: 'compress', title: 'Compressing with matrix product states', height: 260 },
    { id: 'numbers', title: 'The numbers', kind: 'html' },
    { id: 'quench', title: 'After a quench', legend: '10 qubits, Ising chain h = 1.5J, from |00…0⟩', height: 290, folded: true },
  ],
  steps: STEPS,
  draw(api) {
    drawCuts(api);
    drawCompress(api);
    compressHtml(api);
    drawQuench(api);
  },
});
