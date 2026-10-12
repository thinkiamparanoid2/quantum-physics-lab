import { applyProduct, terms } from '../lib/fock.js';
import { withAlpha } from '../ui/bloch.js';
import { FONT, MONO, prep } from '../ui/charts.js';
import { runLesson } from '../ui/lesson-kit.js';

// Fock space: creation and annihilation operators acting on occupation numbers, for bosons and
// fermions (lib/fock.js; the tests check the commutation and anticommutation relations on every
// basis state, and the Jordan–Wigner form of the fermion operators).

const M = 4;
const SUB = '₀₁₂₃₄₅₆₇₈₉';
// operators as text, written left to right: "+2" = creation on mode 2, "-1" = annihilation on mode 1
const parseOps = (text, kind) =>
  String(text ?? '')
    .split(',')
    .map((t) => /^([+-])([1-4])$/.exec(t.trim()))
    .filter(Boolean)
    .map((m) => ({ dag: m[1] === '+', mode: Number(m[2]) - 1, kind }));
const opName = (op) => `${op.kind === 'boson' ? 'a' : 'c'}${op.dag ? '†' : ''}${SUB[op.mode + 1]}`;
const startOcc = (text, kind) => {
  const parts = String(text ?? '').split(',');
  return Array.from({ length: M }, (_, i) => Math.max(0, Math.min(kind === 'fermion' ? 1 : 5, Math.round(Number(parts[i]) || 0))));
};
const ketText = (occ) => `|${occ.join(',')}⟩`;
const ampText = (a) => {
  const sq = a * a;
  const r = Math.round(sq);
  const mag = Math.abs(sq - r) < 1e-9 ? (r === 1 ? '' : Number.isInteger(Math.sqrt(r)) ? String(Math.sqrt(r)) : `√${r}`) : Math.abs(a).toFixed(3);
  return `${a < 0 ? '−' : ''}${mag}`;
};
const stateText = (st) => {
  const list = terms(st);
  if (!list.length) return '0';
  return list.map(({ occ, amp }, i) => `${i && amp > 0 ? '+ ' : ''}${ampText(amp)}${ketText(occ)}`).join(' ');
};

function compute(s) {
  const ops = parseOps(s.ops, s.kind);
  const occ0 = startOcc(s.start, s.kind);
  const start = new Map([[occ0.join(','), 1]]);
  const result = applyProduct(ops, start);
  const reversed = applyProduct([...ops].reverse(), start);
  return { ops, occ0, start, result, reversed };
}

function exprHtml(api) {
  const s = api.settings;
  const md = api.model;
  const box = api.el('expr');
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-op]');
      if (!b) return;
      const cur = api.settings.ops ? api.settings.ops.split(',') : [];
      if (b.dataset.op === 'undo') api.set({ ops: cur.slice(1).join(',') });
      else if (b.dataset.op === 'clear') api.set({ ops: '' });
      else api.set({ ops: [b.dataset.op, ...cur].join(',') }); // a new operator acts last: written on the left
    });
  }
  const L = s.kind === 'boson' ? 'a' : 'c';
  const buttons = [1, 2, 3, 4].map((k) => `<button type="button" class="btn" data-op="+${k}">${L}†${SUB[k]}</button>`).join('') + [1, 2, 3, 4].map((k) => `<button type="button" class="btn" data-op="-${k}">${L}${SUB[k]}</button>`).join('');
  box.innerHTML = `<div class="fock-buttons">${buttons}<button type="button" class="btn" data-op="undo">Undo</button><button type="button" class="btn" data-op="clear">Clear</button></div>
    <p class="fock-eq"><span class="mono">${md.ops.map(opName).join(' ')} ${ketText(md.occ0)}</span> = <b class="mono">${stateText(md.result)}</b></p>
    <p class="hint">Each new operator acts on the result so far, so it is written on the left. ${s.kind === 'boson' ? 'Bosons: a†|n⟩ = √(n+1)|n+1⟩, a|n⟩ = √n|n−1⟩.' : 'Fermions: c† fills an empty mode and c empties a full one, each with a sign (−1) for every occupied mode to its left.'}</p>`;
}

function drawOccupation(api) {
  const { ctx, w, h } = prep(api.canvas('occupation'));
  const th = api.theme;
  const s = api.settings;
  const md = api.model;
  const rows = [
    { title: 'start', list: terms(md.start) },
    { title: 'result', list: terms(md.result) },
  ];
  const boxW = Math.min(90, (w - 220) / M);
  const x0 = 110;
  let y = 18;
  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  for (const row of rows) {
    ctx.fillStyle = th.muted;
    ctx.textAlign = 'left';
    ctx.fillText(row.title, 10, y + 30);
    if (!row.list.length) {
      ctx.fillStyle = th.ampNeg;
      ctx.fillText('0 (the operators destroyed the state)', x0, y + 30);
      y += 80;
      continue;
    }
    for (const { occ, amp } of row.list) {
      for (let m = 0; m < M; m++) {
        const bx = x0 + m * (boxW + 10);
        ctx.strokeStyle = withAlpha(th.axis, 0.9);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, y, boxW, 60);
        ctx.fillStyle = th.muted;
        ctx.font = MONO;
        ctx.textAlign = 'center';
        ctx.fillText(`mode ${m + 1}`, bx + boxW / 2, y + 70);
        // particles as balls
        const n = occ[m];
        for (let k = 0; k < n; k++) {
          const cx = bx + boxW / 2 + (k - (n - 1) / 2) * Math.min(18, (boxW - 12) / Math.max(1, n));
          ctx.beginPath();
          ctx.arc(cx, y + 30, 8, 0, 2 * Math.PI);
          ctx.fillStyle = s.kind === 'boson' ? th.accent2 : th.ampNeg;
          ctx.fill();
        }
      }
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = amp < 0 ? th.ampNeg : th.text;
      ctx.fillText(`amplitude ${Math.abs(Math.abs(amp) - 1) < 1e-12 ? (amp < 0 ? '−1' : '1') : ampText(amp)}`, x0 + M * (boxW + 10) + 6, y + 30);
      ctx.font = FONT;
      y += 90;
    }
  }
}

function orderHtml(api) {
  const md = api.model;
  const s = api.settings;
  let relation = '';
  const a = md.result;
  const b = md.reversed;
  const keys = new Set([...a.keys(), ...b.keys()]);
  const same = [...keys].every((k) => Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)) < 1e-12);
  const opposite = [...keys].every((k) => Math.abs((a.get(k) ?? 0) + (b.get(k) ?? 0)) < 1e-12);
  if (md.ops.length < 2) relation = 'Add at least two operators to compare orders.';
  else if (!a.size && !b.size) relation = 'Both orders give 0.';
  else if (same) relation = 'The same state: these operators commute here.';
  else if (opposite) relation = '<b>Exactly minus the other order</b>: these operators anticommute here.';
  else relation = 'A different state: the order matters by more than a sign (for example a a† and a† a differ by 1).';
  api.el('order').innerHTML = `<p class="fock-eq"><span class="mono">${[...md.ops].reverse().map(opName).join(' ')} ${ketText(md.occ0)}</span> = <b class="mono">${stateText(md.reversed)}</b></p>
    <p class="hint">${relation}${s.kind === 'fermion' ? ' Fermion operators on different modes always anticommute.' : ' Boson operators on different modes always commute.'}</p>`;
}

const STEPS = [
  {
    title: 'Counting, not labelling',
    preset: { kind: 'boson', start: '1,0,2,0', ops: '' },
    html: `<p>For identical particles, "particle 1 is in mode A" means nothing: only <b>how many</b> particles occupy each mode can be measured. A state is a list of occupation numbers, |n<sub>1</sub>, n<sub>2</sub>, n<sub>3</sub>, n<sub>4</sub>⟩, and the space of all such lists, for any total number of particles, is <b>Fock space</b>.</p>
      <p>Here: one boson in mode 1 and two in mode 3. The modes could be orbitals of an atom, sites of a lattice, or the phonon modes of the previous lesson.</p>`,
  },
  {
    title: 'Creating and destroying',
    preset: { kind: 'boson', start: '1,0,2,0', ops: '+3' },
    html: `<p>The <b>creation operator</b> a†<sub>3</sub> adds a boson to mode 3: |1,0,2,0⟩ → √3 |1,0,3,0⟩. The factor √(n+1) is the same as for raising a harmonic oscillator, because a bosonic mode <i>is</i> an oscillator. The annihilation operator a removes one, with factor √n, and gives 0 on an empty mode.</p>
      <p>Press the buttons to build products.</p>`,
    math: `<span class="eq">a†_k |…, n_k, …⟩ = √(n_k + 1) |…, n_k + 1, …⟩,  a_k |…, n_k, …⟩ = √n_k |…, n_k − 1, …⟩</span>
      a†_k a_k = n_k counts the particles in mode k.`,
  },
  {
    title: 'Bosons pile up',
    preset: { kind: 'boson', start: '0,0,0,0', ops: '+1,+1,+1' },
    html: `<p>Three creation operators on the same mode: (a†<sub>1</sub>)³|0⟩ = √6 |3,0,0,0⟩. Bosons happily share a mode; the √(n!) is just normalisation. Lasers (photons) and Bose–Einstein condensates (atoms) are many bosons in one mode.</p>`,
  },
  {
    title: 'Fermions: one per mode',
    preset: { kind: 'fermion', start: '0,0,0,0', ops: '+1,+1' },
    html: `<p>Switch to fermions. c†<sub>1</sub> c†<sub>1</sub> |0⟩ = <b>0</b>: a second fermion cannot enter an occupied mode. This is the <b>Pauli exclusion principle</b>, built into the operators: (c†)² = 0.</p>`,
  },
  {
    title: 'Fermions: order matters',
    preset: { kind: 'fermion', start: '0,0,0,0', ops: '+1,+3' },
    focus: ['Operators and the state', 'The same operators in reverse order', 'Occupations'],
    html: `<p>c†<sub>1</sub> c†<sub>3</sub>|0⟩ = |1,0,1,0⟩, but in the other order c†<sub>3</sub> c†<sub>1</sub>|0⟩ = <b>−</b>|1,0,1,0⟩. Swapping two fermions flips the sign of the state: the operators <b>anticommute</b>.</p>`,
    predict: {
      q: 'c†₂ acts on |1,0,1,0⟩. What sign does the result carry?',
      options: ['+', '−', '0, the result vanishes', 'It depends on the energy'],
      answer: 1,
      why: 'One occupied mode (mode 1) lies to the left of mode 2, so the sign is (−1)¹ = −1.',
    },
  },
  {
    title: 'Where the sign comes from',
    preset: { kind: 'fermion', start: '1,0,1,0', ops: '+2' },
    focus: ['Operators and the state', 'Occupations'],
    html: `<p>A fermion operator on mode k picks up (−1) for every occupied mode before k in a fixed order. The order is a convention, but once chosen it must be used everywhere, and every physical prediction comes out the same.</p>
      <p>These signs are the second-quantised form of antisymmetric wavefunctions, ψ(x₂, x₁) = −ψ(x₁, x₂) (see the identical-particles lesson). The next lesson shows how a quantum computer, whose qubits are not fermions, carries the signs along.</p>`,
  },
  {
    title: 'Commutators and anticommutators',
    preset: { kind: 'boson', start: '2,0,0,0', ops: '-1,+1' },
    focus: ['Operators and the state', 'The same operators in reverse order'],
    html: `<p>On |2,0,0,0⟩: a<sub>1</sub>a†<sub>1</sub> gives 3|2,…⟩ but a†<sub>1</sub>a<sub>1</sub> gives 2|2,…⟩. The difference is always exactly 1: [a, a†] = 1. For fermions the <i>sum</i> c c† + c† c is 1 instead. These two rules, and nothing else, define bosons and fermions.</p>`,
    math: `<span class="eq">[a_i, a†_j] = δ_ij,  [a_i, a_j] = 0     {c_i, c†_j} = δ_ij,  {c_i, c_j} = 0</span>
      The tests check both relations on every basis state with up to three bosons per mode, and on all sixteen fermion states of four modes.`,
  },
  {
    title: 'Your turn',
    preset: { kind: 'fermion', start: '0,0,0,0', ops: '' },
    html: `<p>Build a state with three fermions in different orders and compare the signs. With bosons, check that a†a counts particles. What does c<sub>2</sub> c†<sub>2</sub> do to an empty mode, and to a full one?</p>`,
  },
];

runLesson({
  slug: 'fock-space',
  settings: { kind: 'boson', start: '1,0,2,0', ops: '' },
  controls: [
    { id: 'kind', label: 'Particles', type: 'choice', options: [['boson', 'Bosons'], ['fermion', 'Fermions']] },
    { id: 'start', label: 'Start from', type: 'select', options: [['0,0,0,0', 'The vacuum |0,0,0,0⟩'], ['1,0,1,0', '|1,0,1,0⟩'], ['1,0,2,0', '|1,0,2,0⟩ (bosons)'], ['2,0,0,0', '|2,0,0,0⟩ (bosons)'], ['1,1,1,1', '|1,1,1,1⟩']] },
  ],
  cards: [
    { id: 'expr', title: 'Operators and the state', kind: 'html' },
    { id: 'occupation', title: 'Occupations', legend: 'balls = particles in each mode', height: 230 },
    { id: 'order', title: 'The same operators in reverse order', kind: 'html' },
  ],
  steps: STEPS,
  compute,
  draw(api) {
    exprHtml(api);
    drawOccupation(api);
    orderHtml(api);
  },
});
