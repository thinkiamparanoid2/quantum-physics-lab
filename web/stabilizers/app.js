import { runOps } from '../lib/circuit.js';
import { formatState } from '../lib/format.js';
import { Tableau } from '../lib/stabilizer.js';
import { drawCircuit } from '../ui/circuit-view.js';
import { runLesson } from '../ui/lesson-kit.js';
import { stabilizerTableHtml } from '../ui/stabilizer-table.js';

// Stabilizer states described by the Pauli operators that leave them unchanged, updated gate by
// gate with the tableau simulator of lib/stabilizer.js (checked against the statevector engine).

const H = (q) => ({ gate: 'H', target: q });
const CX = (c, t) => ({ gate: 'X', target: t, controls: [c] });
const CZ = (c, t) => ({ gate: 'Z', target: t, controls: [c] });

const EXAMPLES = {
  one: { label: 'One qubit', n: 1, ops: [H(0), { gate: 'S', target: 0 }] },
  bell: { label: 'Bell pair', n: 2, ops: [H(0), CX(0, 1)] },
  ghz: { label: 'GHZ, 4 qubits', n: 4, ops: [H(0), CX(0, 1), CX(1, 2), CX(2, 3)] },
  code: { label: 'Repetition code', n: 3, ops: [H(0), CX(0, 1), CX(0, 2)] },
  cluster: { label: 'Ring graph state', n: 5, ops: [0, 1, 2, 3, 4].map(H).concat([0, 1, 2, 3, 4].map((q) => CZ(q, (q + 1) % 5))) },
};

function compute(s) {
  const ex = EXAMPLES[s.example];
  const upto = Math.min(s.upto, ex.ops.length);
  const tab = new Tableau(ex.n);
  for (const op of ex.ops.slice(0, upto)) tab.apply(op);
  const clean = tab.canonicalStabilizers();
  let gens = clean;
  const flipped = new Set();
  if (s.err !== 'none') {
    const q = Math.min(s.errQubit, ex.n - 1);
    const hit = tab.clone();
    hit.apply({ gate: s.err, target: q });
    // same generators, measured on the damaged state: their expectation flips where they anticommute
    gens = clean.map((g, i) => {
      const x = [];
      const z = [];
      [...g.slice(1)].forEach((p, k) => {
        if (p === 'X' || p === 'Y') x.push(k);
        if (p === 'Z' || p === 'Y') z.push(k);
      });
      const before = g[0] === '−' ? -1 : 1;
      const after = hit.expectation({ x, z });
      if (after !== before) flipped.add(i);
      return (after < 0 ? '−' : '+') + g.slice(1);
    });
  }
  const { state } = runOps(ex.n, [...ex.ops.slice(0, upto), ...(s.err !== 'none' ? [{ gate: s.err, target: Math.min(s.errQubit, ex.n - 1) }] : [])]);
  return { ex, upto, gens, flipped, state };
}

function draw(api) {
  const m = api.model;
  const box = api.el('circ');
  if (!box.querySelector('.circuit-scroll')) box.innerHTML = '<div class="circuit-scroll"></div>';
  const ops = [...m.ex.ops];
  if (api.settings.err !== 'none') ops.push({ gate: api.settings.err, target: Math.min(api.settings.errQubit, m.ex.n - 1), label: `${api.settings.err}!` });
  drawCircuit(box.querySelector('.circuit-scroll'), {
    n: m.ex.n,
    ops,
    applied: m.upto + (api.settings.err !== 'none' ? 1 : 0),
    current: m.upto > 0 ? [m.upto - 1] : [],
    onSelect: (i) => api.set({ upto: Math.min(i + 1, m.ex.ops.length) }),
  });
  const names = api.settings.example === 'code' ? ['logical X̄', 'check 1', 'check 2'] : null;
  api.el('table').innerHTML = `${stabilizerTableHtml(m.gens, { flipped: m.flipped, names })}
    <p class="hint">${m.flipped.size ? `The error flipped the sign of ${m.flipped.size} generator${m.flipped.size > 1 ? 's' : ''} (highlighted): that pattern is the <b>syndrome</b>.` : `${m.ex.n} generators describe the state completely.`}</p>`;
  api.el('amps').innerHTML = `<p class="state-formula"><span class="label">State</span>${formatState(m.state.re, m.state.im, m.ex.n)}</p>
    <p class="hint">${2 ** m.ex.n} complex amplitudes, against ${m.ex.n} stabilizer generators of ${m.ex.n} Paulis each. At 300 qubits that's 2³⁰⁰ amplitudes against 300 short rows.</p>`;
}

const STEPS = [
  {
    title: 'Describe a state by what leaves it alone',
    preset: { example: 'one', upto: 0, err: 'none' },
    html: `<p>|0⟩ is the state Z leaves unchanged: Z|0⟩ = +|0⟩. We say Z <b>stabilizes</b> |0⟩, and that one fact pins the state down.</p>
      <p>After H the stabilizer becomes X (|+⟩ is unchanged by X); after S, Y. Step through the circuit, or click a gate.</p>`,
  },
  {
    title: 'Two qubits need two',
    preset: { example: 'bell', upto: 2, err: 'none' },
    html: `<p>The Bell state (|00⟩ + |11⟩)/√2 is fixed by <b>XX</b> and by <b>ZZ</b>, and by nothing else independent. Two qubits, two generators.</p>
      <p>Step back through the circuit: |00⟩ starts with ZI and IZ; H turns ZI into XI; the CNOT spreads XI into XX and IZ into ZZ.</p>`,
    math: `Gates act on stabilizers by conjugation: if S|ψ⟩ = |ψ⟩ then (USU†) U|ψ⟩ = U|ψ⟩. Clifford gates (H, S, CNOT) map Pauli strings to Pauli strings, for example
      <span class="eq">H X H = Z,  S X S† = Y,  CNOT (X⊗I) CNOT = X⊗X,  CNOT (I⊗Z) CNOT = Z⊗Z</span>`,
    predict: {
      q: 'Which of these does NOT stabilize the Bell state (|00⟩ + |11⟩)/√2?',
      options: ['XX', 'ZZ', '−YY', 'ZI'],
      answer: 3,
      why: 'XX·ZZ = −YY is in the group; ZI alone is random on a Bell pair (its expectation is 0).',
    },
  },
  {
    title: 'GHZ',
    preset: { example: 'ghz', upto: 4, err: 'none' },
    html: `<p>Four qubits in (|0000⟩ + |1111⟩)/√2: one X-type generator, <b>XXXX</b>, and three Z-type ones saying every pair of qubits agrees. The table lists a convenient generating set; any product of generators also stabilizes the state.</p>`,
  },
  {
    title: 'A code: checks plus a logical qubit',
    preset: { example: 'code', upto: 3, err: 'none' },
    html: `<p>The three-qubit repetition code is just two stabilizers, the parity <b>checks</b> Z₀Z₁ and Z₀Z₂ (the table shows them in a combined form). Fixing two generators on three qubits leaves one qubit's worth of freedom: the <b>logical</b> qubit.</p>
      <p>Here the code holds |+⟩ₗ, so the third generator is the logical operator X̄ = XXX.</p>`,
  },
  {
    title: 'Errors flip signs',
    preset: { example: 'code', upto: 3, err: 'X', errQubit: 1 },
    html: `<p>Now an X error hits qubit 1. Every generator that <b>anticommutes</b> with it flips sign: a Z check touching qubit 1 now gives −1. Measuring the checks reveals that sign pattern, the <b>syndrome</b>, without disturbing the logical state.</p>
      <p>Try Z and Y errors, and other qubits, in <b>Try it</b>. A Z error flips the logical X̄ instead: the repetition code can't see it.</p>`,
    predict: {
      q: 'Which errors leave every check’s sign unchanged in this code?',
      options: ['X on any one qubit', 'Z on any one qubit', 'Y on qubit 0', 'No error does'],
      answer: 1,
      why: 'Z commutes with the Z-type checks, so it is invisible to them. It flips the logical X̄ instead: an undetectable logical error.',
    },
  },
  {
    title: 'Graph states',
    preset: { example: 'cluster', upto: 10, err: 'none' },
    html: `<p>Put five qubits in |+⟩ and apply CZ around a ring. Each generator is X on one qubit and Z on its two neighbours: a picture of the graph. Graph states like this are the resource for measurement-based quantum computing, and this five-qubit ring is equivalent to the smallest code that corrects any single-qubit error.</p>`,
  },
  {
    title: 'Why this matters',
    preset: { example: 'ghz', upto: 4, err: 'Z', errQubit: 2 },
    html: `<p>Stabilizers are the language of quantum error correction: a code is chosen by its stabilizers, errors are found by measuring them, and logical operators are what commute with all of them.</p>
      <p>They also give the <b>Gottesman–Knill theorem</b>: circuits of H, S, CNOT and measurement can be simulated efficiently on a classical computer, by tracking n generators instead of 2ⁿ amplitudes. The simulator behind this page handles hundreds of qubits. Quantum advantage needs something more, such as T gates: see the magic-states lesson.</p>`,
  },
  {
    title: 'Your turn',
    preset: { example: 'cluster', upto: 10, err: 'X', errQubit: 0 },
    html: `<p>Pick an example, step through its circuit and inject errors.</p>`,
  },
];

runLesson({
  slug: 'stabilizers',
  settings: { example: 'one', upto: 0, err: 'none', errQubit: 0 },
  controls: [
    { id: 'example', label: 'Example', type: 'select', options: Object.entries(EXAMPLES).map(([k, v]) => [k, v.label]) },
    { id: 'upto', label: 'Gates applied', type: 'range', min: 0, max: 10, step: 1 },
    { id: 'err', label: 'Error', type: 'choice', options: [['none', 'None'], ['X', 'X'], ['Y', 'Y'], ['Z', 'Z']] },
    { id: 'errQubit', label: 'On qubit', type: 'range', min: 0, max: 4, step: 1, show: (s) => s.err !== 'none' },
  ],
  cards: [
    { id: 'circ', title: 'Circuit', legend: 'click a gate to stop after it', kind: 'html' },
    { id: 'table', title: 'Stabilizer generators', legend: 'X pink · Z blue · Y amber · I dot', kind: 'html' },
    { id: 'amps', title: 'The same state as amplitudes', kind: 'html', folded: true },
  ],
  steps: STEPS,
  compute,
  draw,
});
