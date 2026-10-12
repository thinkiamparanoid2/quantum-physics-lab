import { seededRandom } from '../lib/circuit.js';
import { correctionOf, logicalFlip, matchingGraph, mwpm, repetitionCode, sampleFaults, spaceTimeGraph, spaceTimeRun, unionFind } from '../lib/qec.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { runLesson } from '../ui/lesson-kit.js';

// Measurement errors and decoding in space-time, on the bit-flip repetition code so the picture is
// flat: space across, rounds of measurement down. Every fault (a data flip or a misread check) is an
// edge of the space-time graph and lights the detection events at its two ends (lib/qec.js
// spaceTimeRun; the tests check this, and that the logical error rates match PyMatching's).

let hit = () => null;

// Faults as text for links: "D1.2" = data qubit 2 flips before round 1, "M4.1" = check 1 misread in round 4.
function parseFaults(text, d, rounds) {
  const out = [];
  for (const part of String(text ?? '').split(',')) {
    const m = /^([DM])(\d+)\.(\d+)$/.exec(part.trim());
    if (!m) continue;
    const [kind, t, i] = [m[1], Number(m[2]), Number(m[3])];
    if (kind === 'D' && t <= rounds && i < d) out.push({ kind, t, i });
    if (kind === 'M' && t < rounds && i < d - 1) out.push({ kind, t, i });
  }
  return out;
}

const faultText = (list) => list.map((f) => `${f.kind}${f.t}.${f.i}`).join(',');

function compute(s) {
  const d = s.d;
  const rounds = Math.max(1, s.rounds);
  const code = repetitionCode(d);
  const st = spaceTimeGraph(code, rounds);
  const m = st.perLayer;
  const edgeOf = (f) => st.edges.findIndex((e) => e.t === f.t && (f.kind === 'D' ? e.q === f.i : e.q < 0 && e.a === f.t * m + f.i));
  const list = parseFaults(s.faults, d, rounds);
  const faults = list.map(edgeOf);
  const run = spaceTimeRun(st, faults);
  let edges;
  let fellBack = false;
  if (s.decoder === 'mwpm') {
    const mm = mwpm(st, run.defects);
    if (mm) edges = mm.edges;
    else fellBack = true;
  }
  if (!edges) edges = unionFind(st, run.defects).edges;
  const corr = correctionOf(st, edges, code.n);
  const residual = run.err.map((v, q) => v ^ corr[q]);
  // a decoder that trusts only the last noisy round, as if its checks were perfect
  const last = rounds - 1;
  const base = matchingGraph(code, 'X');
  const naiveDefects = [];
  run.raw[last].forEach((v, c) => v && naiveDefects.push(c));
  const naiveCorr = correctionOf(base, mwpm(base, naiveDefects).edges, code.n);
  const errThen = new Uint8Array(code.n);
  for (const f of list) if (f.kind === 'D' && f.t <= last) errThen[f.i] ^= 1;
  const naiveWrong = [];
  errThen.forEach((v, q) => (v ^ naiveCorr[q]) && naiveWrong.push(q));
  return {
    code,
    st,
    rounds,
    list,
    faults,
    run,
    edges,
    fellBack,
    corr,
    fail: logicalFlip(code, residual, 'X'),
    naive: { round: last, flips: [...naiveCorr.keys()].filter((q) => naiveCorr[q]), wrong: naiveWrong, truth: [...errThen.keys()].filter((q) => errThen[q]) },
  };
}

function draw(api) {
  const { ctx, w, h } = prep(api.canvas('spacetime'));
  const th = api.theme;
  const s = api.settings;
  const md = api.model;
  const { code, st, rounds } = md;
  const d = code.d;
  const m = st.perLayer;
  const layers = st.layers;
  const show = s.show;
  // space: data qubit q at u = 2q + 1, check c at u = 2c + 2, boundaries at u = 0 and u = 2d
  const left = 118;
  const right = w - 24;
  const top = 58;
  const bottom = h - 30;
  const U = (u) => left + (u / (2 * d)) * (right - left);
  const T = (t) => top + (layers === 1 ? 0 : (t / (layers - 1)) * (bottom - top));
  const checkX = (c) => U(2 * c + 2);
  const dataX = (q) => U(2 * q + 1);
  const r = Math.max(5, Math.min(13, ((right - left) / (2 * d)) * 0.42, (bottom - top) / Math.max(1, layers - 1) / 2.6));

  // labels: data qubits on top, rounds down the left
  ctx.font = MONO;
  ctx.fillStyle = th.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let q = 0; q < d; q++) ctx.fillText(`q${q}`, dataX(q), top - 26);
  for (let c = 0; c < m; c++) ctx.fillText(`c${c}`, checkX(c), top - 12);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let t = 0; t < layers; t++) ctx.fillText(t === layers - 1 ? 'final readout' : `round ${t}`, left - 22, T(t));
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('space →', left, 4);
  ctx.save();
  ctx.translate(14, top);
  ctx.rotate(Math.PI / 2);
  ctx.fillText('time →', 0, 0);
  ctx.restore();

  // the space-time graph, faint
  const edgeEnds = (e) => {
    const a = [checkX(e.a % m), T(Math.floor(e.a / m))];
    let b;
    if (e.b === st.boundary) b = [e.q === 0 ? U(0) : U(2 * d), T(e.t)];
    else b = [checkX(e.b % m), T(Math.floor(e.b / m))];
    return [a, b];
  };
  ctx.strokeStyle = withAlpha(th.muted, 0.22);
  ctx.lineWidth = 1;
  for (const e of st.edges) {
    const [a, b] = edgeEnds(e);
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  }
  // boundaries
  ctx.strokeStyle = withAlpha(th.muted, 0.5);
  ctx.setLineDash([3, 4]);
  for (const u of [0, 2 * d]) {
    ctx.beginPath();
    ctx.moveTo(U(u), top - 8);
    ctx.lineTo(U(u), bottom + 8);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // the perfect final round
  ctx.fillStyle = withAlpha(th.muted, 0.08);
  ctx.fillRect(left - 8, T(layers - 1) - r - 5, right - left + 16, 2 * r + 10);

  // faults
  if (show === 'faults' || show === 'fix') {
    ctx.lineCap = 'round';
    for (const k of md.faults) {
      const e = st.edges[k];
      const [a, b] = edgeEnds(e);
      // faded under the correction, so the decoder's answer stands out
      const fade = show === 'fix' ? 0.35 : 0.85;
      ctx.strokeStyle = withAlpha(e.q >= 0 ? th.ampNeg : th.accent2, fade);
      ctx.lineWidth = show === 'fix' ? 10 : 6;
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
      // mark: an X on the data qubit, or an "M" on the misread
      const mx = e.q >= 0 ? dataX(e.q) : (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      ctx.fillStyle = withAlpha(e.q >= 0 ? th.ampNeg : th.accent2, show === 'fix' ? 0.6 : 1);
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = th.surfaceSolid;
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.q >= 0 ? 'X' : 'M', mx, my + 0.5);
    }
  }
  // the decoder's correction
  if (show === 'fix') {
    ctx.strokeStyle = th.text;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    for (const k of md.edges) {
      const [a, b] = edgeEnds(st.edges[k]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // checks: the raw measured bit (square) and the detection events (ring)
  const events = new Set(md.run.defects);
  for (let t = 0; t < layers; t++) {
    for (let c = 0; c < m; c++) {
      const x = checkX(c);
      const y = T(t);
      const bit = md.run.raw[t][c];
      const rawStrong = show === 'raw';
      ctx.fillStyle = bit ? withAlpha(th.marked, rawStrong ? 0.9 : 0.3) : th.surfaceSolid;
      ctx.strokeStyle = withAlpha(th.axis, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x - r * 0.8, y - r * 0.8, 1.6 * r, 1.6 * r);
      ctx.fill();
      ctx.stroke();
      if (show === 'raw') {
        ctx.fillStyle = bit ? th.surfaceSolid : th.muted;
        ctx.font = MONO;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(bit), x, y + 0.5);
      } else if (events.has(t * m + c)) {
        ctx.strokeStyle = th.marked;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = th.marked;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.55, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
  // the last noisy round, which a one-round decoder would trust
  if (show === 'raw' && rounds >= 1) {
    ctx.strokeStyle = withAlpha(th.accent, 0.8);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 3]);
    const y = T(md.naive.round);
    ctx.strokeRect(left - 10, y - r - 6, right - left + 20, 2 * r + 12);
    ctx.setLineDash([]);
  }

  hit = (px, py) => {
    let best = null;
    let bestDist = 14;
    for (let t = 0; t < layers; t++) {
      for (let q = 0; q < d; q++) {
        const dist = Math.hypot(px - dataX(q), py - T(t));
        if (dist < bestDist) [best, bestDist] = [{ kind: 'D', t, i: q }, dist];
      }
      if (t + 1 < layers)
        for (let c = 0; c < m; c++) {
          const dist = Math.hypot(px - checkX(c), py - (T(t) + T(t + 1)) / 2);
          if (dist < bestDist) [best, bestDist] = [{ kind: 'M', t, i: c }, dist];
        }
    }
    return best;
  };
  status(api);
}

function status(api) {
  const md = api.model;
  const s = api.settings;
  const nd = md.list.filter((f) => f.kind === 'D').length;
  const nm = md.list.length - nd;
  const flips = [...md.corr.keys()].filter((q) => md.corr[q]);
  const qs = (list) => (list.length ? list.map((q) => `q${q}`).join(', ') : 'nothing');
  const verdict =
    s.show === 'raw'
      ? `Trusting round ${md.naive.round} alone, a decoder would flip ${qs(md.naive.flips)}; the qubits actually flipped by then: ${qs(md.naive.truth)}. ${md.naive.wrong.length ? `<b>It would get ${md.naive.wrong.length === 1 ? 'one qubit' : `${md.naive.wrong.length} qubits`} wrong.</b>` : 'That happens to be right.'}`
      : s.show === 'fix'
        ? `${md.fail ? '<b>Logical error:</b> the correction and the faults together flip every qubit.' : '<b>Success:</b> the encoded bit survives.'} Net correction on the data: ${qs(flips)}.${md.fellBack ? ' (Too many events for exact matching here; union-find was used.)' : ''}`
        : 'Each fault lights the two detection events at its ends; data faults pair up across space, misreads pair up across time.';
  api.el('status').innerHTML = `<div class="readout-grid">
      <div class="stat"><span>Data faults (X)</span><b>${nd}</b></div>
      <div class="stat"><span>Measurement faults (M)</span><b>${nm}</b></div>
      <div class="stat"><span>Detection events</span><b>${md.run.defects.length}</b></div></div>
    <p class="hint">${verdict}</p>`;
}

const STEPS = [
  {
    title: 'Measuring, again and again',
    preset: { d: 5, rounds: 5, faults: 'D1.2', show: 'raw' },
    focus: ['Space-time', 'What the decoder sees'],
    html: `<p>A real code is not checked once: its checks are measured every cycle, about once a microsecond on Google's chips, for as long as the qubit is stored. Here a five-qubit <b>repetition code</b> (checks Z<sub>i</sub>Z<sub>i+1</sub> between neighbours) is measured for five rounds, then the data qubits are read out directly.</p>
      <p>Space runs across, time runs down. A bit flip hits q2 before round 1: from then on its two neighbouring checks read 1 in every round.</p>`,
  },
  {
    title: 'A measurement can lie',
    preset: { d: 5, rounds: 5, faults: 'M4.1', show: 'raw' },
    focus: ['Space-time', 'What the decoder sees'],
    html: `<p>Now no data qubit is hit, but check c1 is <b>misread</b> in round 4. The measurement circuit itself is noisy, so the syndrome can be wrong.</p>
      <p>A decoder that trusted that single round would "fix" qubits that were fine, and so create the very errors it meant to remove.</p>`,
    predict: {
      q: 'How can a decoder tell a misread check from a real bit flip?',
      options: ['It can’t', 'A real flip keeps the checks lit in later rounds; a misread does not', 'Misread checks read 2', 'By measuring the data qubits directly'],
      answer: 1,
      why: 'A flipped qubit stays flipped, so its checks keep firing; a misread is a one-round blip. Repeating the measurement exposes it.',
    },
  },
  {
    title: 'Watch for changes: detection events',
    preset: { d: 5, rounds: 5, faults: 'D1.2,M3.0', show: 'faults' },
    focus: ['Space-time', 'What the decoder sees'],
    html: `<p>The decoder does not look at the raw bits but at where they <b>change</b> from one round to the next. These detection events (rings) sit at the ends of each fault.</p>
      <p>A data flip (pink X) lights two events side by side in the same round. A misread (blue M) lights two events one above the other, in consecutive rounds. Every fault is an edge of a space-time graph.</p>`,
    math: `<span class="eq">event(c, t) = s_c(t) ⊕ s_c(t − 1),  s_c(−1) = 0</span>
      A data fault is a space-like edge, a misread a time-like edge; a qubit at the end of the chain touches one check, so its edge runs to the boundary. The last round reads the data qubits themselves, so it has no misreads.`,
  },
  {
    title: 'Chains only show their ends',
    preset: { d: 5, rounds: 5, faults: 'M1.2,M2.2,M3.2,D2.0,D2.1', show: 'faults' },
    focus: ['Space-time', 'What the decoder sees'],
    html: `<p>Three misreads in a row on c2 light only the first and last change, like the surface code's error chains in space. Two neighbouring flips light one event and the boundary.</p>
      <p>So decoding with measurement errors is the same problem as before, one dimension up: pair the events using the fewest faults, now in space <i>and</i> time.</p>`,
  },
  {
    title: 'Matching in space-time',
    preset: { d: 7, rounds: 7, faults: 'D1.2,D1.3,M2.4,D4.5,M4.0,M5.0,D6.1', show: 'fix', decoder: 'mwpm' },
    focus: ['Space-time', 'What the decoder sees'],
    html: `<p>Matching pairs the events through the space-time graph (dashed). Only the space-like edges of its answer act on data qubits; time-like edges just mean "that measurement was wrong, ignore it".</p>
      <p>Here every edge has the same weight, which is optimal when data and measurement faults are equally likely. Real decoders weight each edge by log((1 − p)/p) for its own error rate.</p>`,
  },
  {
    title: 'Repeat about d times',
    preset: { d: 7, rounds: 7, faults: 'D0.3,M2.1,D3.5,M4.4,M5.4,D7.2', show: 'fix', p: 0.04, q: 0.04 },
    focus: ['Space-time', 'What the decoder sees'],
    html: `<p>Misreads chain in time just as flips chain in space. To make faking a result as hard as flipping the logical qubit, a result that matters is measured over about <b>d rounds</b>, so a fake needs about d/2 misreads in a row. The code then has distance d in both directions.</p>
      <p>Press <b>Random faults</b> a few times and watch the decoder cope.</p>`,
  },
  {
    title: 'The surface code: three dimensions',
    preset: { d: 7, rounds: 7, faults: 'D0.3,M2.1,D3.5,M4.4,M5.4,D7.2', show: 'fix' },
    html: `<p>For the surface code the same picture is three-dimensional: its 2D grid of checks, stacked in time. Measurement errors lower the threshold from about 10% to about 3% (see the threshold lesson's "noisy checks"), and to about 1% once every gate of the measurement circuit can fail.</p>
      <p>A circuit is <b>fault-tolerant</b> when one fault anywhere causes at most a correctable error. One subtlety: a fault on a measurement qubit midway through its four CNOTs spreads to two data qubits (a "hook" error). Ordering the CNOTs so hooks run across the logical operator keeps the full distance.</p>
      <p>Google's Willow decoded a distance-5 code in real time for up to a million cycles, with an average latency of 63 µs at a 1.1 µs cycle.</p>`,
  },
  {
    title: 'Your turn',
    preset: { d: 5, rounds: 5, faults: '', show: 'fix' },
    html: `<p>Click a data position (between checks) to flip that qubit in that round, or a gap between rounds under a check to misread it. Try to cause a logical error with as few faults as you can. Then try random faults with different data and measurement error rates.</p>`,
  },
];

const api = runLesson({
  slug: 'fault-tolerance',
  settings: { d: 5, rounds: 5, faults: 'D1.2', show: 'raw', decoder: 'mwpm', p: 0.04, q: 0.04, seed: 1 },
  controls: [
    { id: 'show', label: 'Show', type: 'choice', options: [['raw', 'Raw bits'], ['faults', 'Faults and events'], ['fix', 'The correction']] },
    { id: 'decoder', label: 'Decoder', type: 'choice', options: [['mwpm', 'Matching'], ['uf', 'Union-find']], show: (s) => s.show === 'fix' },
    { id: 'd', label: 'Qubits (distance)', type: 'choice', options: [[3, '3'], [5, '5'], [7, '7'], [9, '9']] },
    { id: 'rounds', label: 'Noisy rounds', type: 'range', min: 1, max: 10, step: 1 },
    { id: 'p', label: 'Data error rate', type: 'range', min: 0, max: 0.15, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
    { id: 'q', label: 'Measurement error rate', type: 'range', min: 0, max: 0.15, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
    {
      type: 'button',
      label: 'Random faults',
      primary: true,
      onClick: (a) => {
        const s = a.settings;
        const seed = s.seed + 1;
        const st = spaceTimeGraph(repetitionCode(s.d), s.rounds);
        const picked = sampleFaults(st, s.p, s.q, seededRandom(seed * 7919));
        const m = st.perLayer;
        const list = picked.map((k) => {
          const e = st.edges[k];
          return e.q >= 0 ? { kind: 'D', t: e.t, i: e.q } : { kind: 'M', t: e.t, i: e.a - e.t * m };
        });
        a.set({ seed, faults: faultText(list) });
      },
    },
    { type: 'button', label: 'Clear', onClick: (a) => a.set({ faults: '' }) },
  ],
  cards: [
    { id: 'spacetime', title: 'Space-time', legend: 'squares = checks each round · rings = detection events · pink X = bit flip · blue M = misread · dashed = correction', height: 470 },
    { id: 'status', title: 'What the decoder sees', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw,
});

api.canvas('spacetime').style.cursor = 'pointer';
api.canvas('spacetime').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const f = hit(e.clientX - rect.left, e.clientY - rect.top);
  if (!f) return;
  const list = api.model.list.slice();
  const k = list.findIndex((g) => g.kind === f.kind && g.t === f.t && g.i === f.i);
  if (k >= 0) list.splice(k, 1);
  else list.push(f);
  list.sort((a, b) => a.t - b.t || a.kind.localeCompare(b.kind) || a.i - b.i);
  api.set({ faults: faultText(list) });
});
