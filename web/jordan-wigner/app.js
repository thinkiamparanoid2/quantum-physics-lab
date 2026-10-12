import { applyOperator, evolveExact, makeOperator } from '../lib/dynamics.js';
import { chainOrbitals, freeDensity, hoppingChainTerms, hoppingPauli, jwLetters } from '../lib/fock.js';
import { symmetricEigen } from '../lib/linalg.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { fmt, runLesson } from '../ui/lesson-kit.js';

// Jordan–Wigner: fermions as qubits. The Z strings, a fermion chain simulated on qubits (statevector,
// lib/dynamics.js) against the exact free-fermion answer, and the qubit spectrum against filled
// single-particle levels (lib/fock.js; the tests check all three).

const SPAN = 8; // time shown in the carpet
const FRAMES = 80;
const runs = new Map();
let spectrumCache = null;

const siteList = (text, N) => [...new Set(String(text ?? '').split(',').filter((t) => t.trim() !== '').map(Number))].filter((s) => Number.isInteger(s) && s >= 0 && s < N).sort((a, b) => a - b);

function qubitRun(N, sites) {
  const key = `${N}|${sites}`;
  if (runs.has(key)) return runs.get(key);
  const op = makeOperator(hoppingChainTerms(N, 1), N);
  const dim = 1 << N;
  const re = new Float64Array(dim);
  const im = new Float64Array(dim);
  re[sites.reduce((m, s) => m | (1 << s), 0)] = 1;
  const frames = [];
  for (let f = 0; f <= FRAMES; f++) {
    if (f) evolveExact(op, re, im, SPAN / FRAMES);
    const n = new Float64Array(N);
    for (let b = 0; b < dim; b++) {
      const p = re[b] * re[b] + im[b] * im[b];
      if (p < 1e-16) continue;
      for (let j = 0; j < N; j++) if ((b >> j) & 1) n[j] += p;
    }
    frames.push(n);
  }
  runs.set(key, frames);
  return frames;
}

function spectrum() {
  if (spectrumCache) return spectrumCache;
  const N = 6;
  const op = makeOperator(hoppingChainTerms(N, 1), N);
  const eps = chainOrbitals(N).map((o) => o.energy);
  const sectors = [];
  for (let nf = 0; nf <= N; nf++) {
    const basis = [];
    for (let b = 0; b < 1 << N; b++) if (bits(b) === nf) basis.push(b);
    const d = basis.length;
    const H = new Float64Array(d * d);
    basis.forEach((b, col) => {
      const re = new Float64Array(1 << N);
      re[b] = 1;
      const [or, oi] = [new Float64Array(1 << N), new Float64Array(1 << N)];
      applyOperator(op, re, new Float64Array(1 << N), or, oi);
      basis.forEach((c, row) => (H[row * d + col] = or[c]));
    });
    const free = [];
    for (let m = 0; m < 1 << N; m++) if (bits(m) === nf) free.push(eps.reduce((s, e, k) => s + ((m >> k) & 1 ? e : 0), 0));
    sectors.push({ nf, qubit: symmetricEigen(H, d).values, free: free.sort((a, b) => a - b) });
  }
  spectrumCache = { N, eps, sectors };
  return spectrumCache;
}

function bits(x) {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
}

function compute(s) {
  const sites = siteList(s.sites, s.N);
  return { sites, frames: qubitRun(s.N, sites) };
}

function drawStrings(api) {
  const { ctx, w, h } = prep(api.canvas('strings'));
  const th = api.theme;
  const s = api.settings;
  const N = s.N;
  const j = Math.min(s.j, N - 1);
  const i = Math.min(s.i, N - 1);
  const rows = [];
  if (s.op === 'c') {
    rows.push({ label: `c${j}  =`, letters: jwLetters(N, j, false) });
    rows.push({ label: `c†${j}  =`, letters: jwLetters(N, j, true) });
  } else if (i !== j) {
    const terms = hoppingPauli(i, j);
    for (const t of terms) {
      const letters = new Array(N).fill('I');
      for (const [q, p] of t.ops) letters[q] = p;
      rows.push({ label: rows.length ? '+ ½' : `c†${Math.min(i, j)}c${Math.max(i, j)} + h.c.  =  ½`, letters });
    }
  }
  const left = 230;
  const cell = Math.min(56, (w - left - 20) / N);
  ctx.font = MONO;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = th.muted;
  for (let q = 0; q < N; q++) ctx.fillText(`site ${q}`, left + (q + 0.5) * cell, 18);
  rows.forEach((r, k) => {
    const y = 56 + k * 62;
    ctx.font = FONT;
    ctx.textAlign = 'right';
    ctx.fillStyle = th.text;
    ctx.fillText(r.label, left - 14, y);
    r.letters.forEach((L, q) => {
      const x = left + q * cell;
      const isZ = L === 'Z';
      const isI = L === 'I';
      ctx.fillStyle = isI ? withAlpha(th.muted, 0.08) : isZ ? withAlpha(th.ampNeg, 0.22) : withAlpha(th.accent2, 0.3);
      ctx.fillRect(x + 3, y - 22, cell - 6, 44);
      ctx.strokeStyle = isI ? withAlpha(th.muted, 0.3) : isZ ? th.ampNeg : th.accent2;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, y - 22, cell - 6, 44);
      ctx.fillStyle = isI ? th.muted : th.text;
      ctx.font = `${isI ? 400 : 700} 16px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(L, x + cell / 2, y + 1);
    });
  });
  if (!rows.length) {
    ctx.font = FONT;
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'left';
    ctx.fillText('Choose two different sites.', left, 60);
  }
  ctx.font = FONT;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'left';
  ctx.fillText(
    s.op === 'c' ? `The ${j} Z's count the occupied sites to the left: that parity is the fermion sign. σ⁻ = |0⟩⟨1| empties site ${j}, σ⁺ fills it.` : `The Z string covers the ${Math.max(0, Math.abs(i - j) - 1)} sites in between${Math.abs(i - j) === 1 ? ' (none: neighbour hopping is local)' : ''}.`,
    12,
    h - 14,
  );
}

function drawCarpet(api) {
  const { ctx, w, h } = prep(api.canvas('carpet'));
  const th = api.theme;
  const s = api.settings;
  const { frames, sites } = api.model;
  const N = s.N;
  const box = { x0: 50, y0: 24, x1: w * 0.48, y1: h - 30 };
  const cw = (box.x1 - box.x0) / N;
  const rh = (box.y1 - box.y0) / FRAMES;
  for (let f = 0; f <= FRAMES; f++) {
    for (let j = 0; j < N; j++) {
      const v = Math.min(1, frames[f][j]);
      // whole-pixel rows, so translucent rows never overlap into stripes
      const ya = Math.round(box.y0 + f * rh);
      const yb = Math.round(box.y0 + (f + 1) * rh);
      ctx.fillStyle = withAlpha(th.ampNeg, 0.06 + 0.9 * v);
      ctx.fillRect(box.x0 + j * cw, ya, cw - 1, Math.max(1, yb - ya));
    }
  }
  const frame = Math.min(FRAMES, Math.round((api.t / SPAN) * FRAMES));
  ctx.strokeStyle = th.text;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(box.x0, box.y0 + frame * rh, box.x1 - box.x0, rh);
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let j = 0; j < N; j++) ctx.fillText(String(j), box.x0 + (j + 0.5) * cw, box.y1 + 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('t = 0', box.x0 - 4, box.y0 + 4);
  ctx.fillText(`t = ${SPAN}`, box.x0 - 4, box.y1 - 4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = FONT;
  ctx.fillText('site →, time ↓ (qubit simulation)', box.x0, box.y0 - 4);

  // density now: qubit bars and free-fermion dots
  const b = { x0: w * 0.56, y0: 56, x1: w - 16, y1: h - 30 };
  const bw = (b.x1 - b.x0) / N;
  const Y = (v) => b.y1 - v * (b.y1 - b.y0);
  ctx.strokeStyle = th.axis;
  ctx.beginPath();
  ctx.moveTo(b.x0, b.y0);
  ctx.lineTo(b.x0, b.y1);
  ctx.lineTo(b.x1, b.y1);
  ctx.stroke();
  const tNow = (frame / FRAMES) * SPAN;
  const free = freeDensity(N, sites, tNow);
  frames[frame].forEach((v, j) => {
    ctx.fillStyle = withAlpha(th.ampNeg, 0.75);
    ctx.fillRect(b.x0 + j * bw + 3, Y(v), bw - 6, b.y1 - Y(v));
    ctx.beginPath();
    ctx.arc(b.x0 + (j + 0.5) * bw, Y(free[j]), 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = th.text;
    ctx.fill();
  });
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [0, 0.5, 1]) ctx.fillText(String(v), b.x0 - 4, Y(v));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = FONT;
  const err = Math.max(...frames[frame].map((v, j) => Math.abs(v - free[j])));
  ctx.fillText(`⟨n_j⟩ at t = ${fmt(tNow, 2)}: bars = qubits, dots = free fermions`, b.x0 - 30, b.y0 - 22);
  ctx.fillStyle = th.muted;
  ctx.fillText(`largest difference ${err.toExponential(1)}`, b.x0 - 30, b.y0 - 8);
}

function drawSpectrum(api) {
  const { ctx, w, h } = prep(api.canvas('spectrum'));
  const th = api.theme;
  const sp = spectrum();
  const box = { x0: 56, y0: 16, x1: w - 16, y1: h - 36 };
  const all = sp.sectors.flatMap((x) => x.qubit);
  const [lo, hi] = [Math.min(...all) - 0.3, Math.max(...all) + 0.3];
  const Y = (e) => box.y1 - ((e - lo) / (hi - lo)) * (box.y1 - box.y0);
  const colW = (box.x1 - box.x0) / sp.sectors.length;
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let e = Math.ceil(lo); e <= hi; e += 2) ctx.fillText(String(e), box.x0 - 6, Y(e));
  sp.sectors.forEach((sec, k) => {
    const x = box.x0 + k * colW;
    for (const e of sec.qubit) {
      ctx.strokeStyle = withAlpha(th.accent2, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + colW * 0.15, Y(e));
      ctx.lineTo(x + colW * 0.85, Y(e));
      ctx.stroke();
    }
    for (const e of sec.free) {
      ctx.beginPath();
      ctx.arc(x + colW / 2, Y(e), 3, 0, 2 * Math.PI);
      ctx.fillStyle = th.marked;
      ctx.fill();
    }
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`N_f = ${sec.nf}`, x + colW / 2, box.y1 + 6);
  });
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.muted;
  const ground = Math.min(...all);
  ctx.fillText(`6 sites · lines: qubit Hamiltonian, each sector · dots: filled levels −2cos(kπ/7) · ground ${fmt(ground, 4)}`, box.x0, box.y0 - 12);
}

const STEPS = [
  {
    title: 'Qubits are not fermions',
    preset: { N: 8, op: 'c', j: 4, i: 2, sites: '3' },
    focus: ['Fermion operators as Pauli strings'],
    html: `<p>A quantum computer has qubits: |0⟩ or |1⟩ on each site, a perfect match for an empty or occupied fermion mode. But operators on different qubits <i>commute</i>, while fermion operators on different modes <i>anticommute</i>. Simply calling σ⁺<sub>j</sub> "c†<sub>j</sub>" loses every fermion sign.</p>
      <p>Jordan and Wigner (1928) fixed this: attach to each σ<sup>±</sup><sub>j</sub> a string of Z's on all sites to its left.</p>`,
    math: `<span class="eq">c_j = Z_0 Z_1 ⋯ Z_{j−1} σ⁻_j,  σ⁻ = |0⟩⟨1| = (X + iY)/2</span>
      Z_k = (−1)^{n_k}, so the string is (−1)^{number of occupied sites before j}: exactly the sign rule of the previous lesson. The tests check every matrix element on four modes.`,
  },
  {
    title: 'Neighbour hopping stays local',
    preset: { N: 8, op: 'hop', i: 3, j: 4, sites: '3' },
    focus: ['Fermion operators as Pauli strings'],
    html: `<p>A fermion hopping from site 3 to 4 is c†<sub>3</sub>c<sub>4</sub> + h.c. The two Z strings overlap everywhere left of site 3 and cancel, leaving only ½(X<sub>3</sub>X<sub>4</sub> + Y<sub>3</sub>Y<sub>4</sub>): a two-qubit gate.</p>`,
  },
  {
    title: 'Long hops carry a string',
    preset: { N: 8, op: 'hop', i: 1, j: 6, sites: '3' },
    focus: ['Fermion operators as Pauli strings'],
    html: `<p>Hopping from site 1 to site 6 keeps Z's on the four sites in between: X Z Z Z Z X. On a quantum computer that is a gate touching six qubits. In 1D with nearest-neighbour hopping this never happens, but in 2D (or for molecules) the strings grow with system size, which is why other encodings (Bravyi–Kitaev, and local encodings with extra qubits) were invented.</p>`,
    predict: {
      q: 'How many Z’s does the hopping term between sites 0 and 7 carry?',
      options: ['0', '6', '7', '8'],
      answer: 1,
      why: 'One Z on every site strictly between them: sites 1 to 6.',
    },
  },
  {
    title: 'Fermions on a qubit chain',
    preset: { N: 8, op: 'hop', i: 3, j: 4, sites: '3,4' },
    focus: ['A fermion chain on qubits'],
    play: true,
    html: `<p>Now run the qubit Hamiltonian −½ Σ (X<sub>j</sub>X<sub>j+1</sub> + Y<sub>j</sub>Y<sub>j+1</sub>) on 8 qubits, starting with two fermions on sites 3 and 4, and watch where they go. The dots are an independent calculation: two free fermions, each spreading in its own orbital. They agree to machine precision.</p>
      <p>The density spreads in a light cone with speed 2 (the maximum group velocity of −2 cos q) and reflects from the ends.</p>`,
  },
  {
    title: 'Exclusion, for free',
    preset: { N: 8, op: 'hop', i: 3, j: 4, sites: '0,1,2,3' },
    focus: ['A fermion chain on qubits'],
    play: true,
    html: `<p>Four fermions packed at the left edge. The density can never exceed 1 per site, since a qubit holds at most one excitation, yet nothing in the qubit Hamiltonian mentions Pauli exclusion. The sea of fermions melts from its edge, like a dam breaking.</p>`,
  },
  {
    title: 'The Fermi sea',
    preset: { N: 8, op: 'hop', i: 3, j: 4, sites: '3' },
    focus: ['Spectrum: qubits against free fermions'],
    html: `<p>Diagonalise the 6-qubit Hamiltonian in each particle-number sector and every level is a sum of single-particle energies −2cos(kπ/7): free fermions filling orbitals. The ground state is the <b>Fermi sea</b>, with every negative-energy orbital filled, at half filling.</p>
      <p>This is how quantum computers simulate electrons in molecules and materials: map fermions to qubits, then run the dynamics.</p>`,
  },
  {
    title: 'Your turn',
    preset: { N: 8, op: 'c', j: 5, i: 2, sites: '2,5' },
    html: `<p>Look at different operators and hops, and start fermions on different sites (try one fermion alone: it is a quantum walk). Change the chain length.</p>`,
  },
];

runLesson({
  slug: 'jordan-wigner',
  settings: { N: 8, op: 'c', j: 4, i: 2, sites: '3' },
  controls: [
    { id: 'op', label: 'Operator', type: 'choice', options: [['c', 'c_j and c†_j'], ['hop', 'Hopping i ↔ j']] },
    { id: 'j', label: 'Site j', type: 'range', min: 0, max: 9, step: 1 },
    { id: 'i', label: 'Site i', type: 'range', min: 0, max: 9, step: 1, show: (s) => s.op === 'hop' },
    { id: 'N', label: 'Chain length', type: 'range', min: 4, max: 10, step: 1 },
    {
      id: 'sites',
      label: 'Fermions start on',
      type: 'select',
      options: [['3', 'site 3'], ['3,4', 'sites 3, 4'], ['2,5', 'sites 2, 5'], ['0,1,2,3', 'sites 0–3'], ['0,2,4,6', 'every other site']],
    },
  ],
  cards: [
    { id: 'strings', title: 'Fermion operators as Pauli strings', legend: 'pink = Z string · blue = the active site', height: 200 },
    { id: 'carpet', title: 'A fermion chain on qubits', legend: 'qubit statevector against exact free fermions', height: 300 },
    { id: 'spectrum', title: 'Spectrum: qubits against free fermions', height: 300, folded: true },
  ],
  steps: STEPS,
  compute,
  player: { duration: () => SPAN },
  draw(api) {
    drawStrings(api);
    drawCarpet(api);
    drawSpectrum(api);
  },
});
