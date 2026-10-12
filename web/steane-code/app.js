import { blochVector } from '../lib/bloch.js';
import { angleLabel, percent } from '../lib/format.js';
import { MESSAGE, ROWS, steaneCircuit } from '../lib/steane.js';
import { BlochView } from '../ui/bloch.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

// Steane's [[7,1,3]] code as a real 13-qubit circuit on the statevector engine: encode, error,
// syndrome extraction with six ancillas, correction conditioned on three bits, decode.
// lib/steane.js; the tests check every single-qubit X, Y and Z error on every position.

const LABELS = ['d0', 'd1', 'd2 (message)', 'd3', 'd4', 'd5', 'd6', 'z-check 1', 'z-check 2', 'z-check 4', 'x-check 1', 'x-check 2', 'x-check 4'];

function syndromeView(box) {
  box.innerHTML = '<div class="steane-syn"></div>';
  const el = box.querySelector('.steane-syn');
  return {
    draw({ bits }) {
      if (bits[7] === undefined) {
        el.innerHTML = '<p class="hint">The syndrome appears once the six ancillas are measured.</p>';
        return;
      }
      const z = (bits[7] ?? 0) | ((bits[8] ?? 0) << 1) | ((bits[9] ?? 0) << 2);
      const x = (bits[10] ?? 0) | ((bits[11] ?? 0) << 1) | ((bits[12] ?? 0) << 2);
      const line = (name, b, v, kind) =>
        `<tr><th>${name}</th><td class="mono">${b.map((k) => bits[k] ?? 0).reverse().join('')}</td><td>${v ? `${kind} error on d${v - 1}` : 'nothing'}</td></tr>`;
      el.innerHTML = `<table class="tally"><thead><tr><th>checks</th><th>bits (4 2 1)</th><th>read as</th></tr></thead><tbody>
        ${line('Z checks', [7, 8, 9], z, 'an X')}${line('X checks', [10, 11, 12], x, 'a Z')}</tbody></table>
        <p class="hint">Data qubit i sits in the checks given by the binary digits of i + 1, so a single error spells out its own position. A Y error shows up in both rows.</p>`;
    },
  };
}

function arrivalView(box) {
  box.innerHTML = `<div class="bloch-row"><canvas role="img" aria-label="The message"></canvas><canvas role="img" aria-label="Qubit d2 now"></canvas></div><p class="hint" aria-live="polite"></p>`;
  const [a, b] = box.querySelectorAll('canvas');
  const msg = new BlochView(a, { title: 'the message', labels: 'poles' });
  const now = new BlochView(b, { title: 'd2 now', labels: 'poles' });
  const note = box.querySelector('p');
  return {
    draw({ params, shownState, step, theme }) {
      const m = [Math.sin(params.theta) * Math.cos(params.phi), Math.sin(params.theta) * Math.sin(params.phi), Math.cos(params.theta)];
      const v = blochVector(shownState, MESSAGE);
      msg.vector = m;
      now.vector = v;
      msg.draw(theme);
      now.draw(theme);
      const f = (1 + m[0] * v[0] + m[1] * v[1] + m[2] * v[2]) / 2;
      const { at } = steaneCircuit(params);
      note.innerHTML =
        step.until >= at.decoded
          ? `Fidelity <b>${percent(f)}</b>: the message is back, error and all corrected.`
          : step.until >= at.encoded
            ? 'While encoded, d2 alone holds no trace of the message: it is spread over all seven qubits.'
            : 'The message waits on d2.';
    },
  };
}

runCircuitLesson({
  slug: 'steane-code',
  n: 13,
  labels: LABELS,
  dials: false,
  entanglement: false,
  bloch: false,
  params: [
    { id: 'theta', label: 'Message tilt θ', type: 'range', min: 0, max: Math.PI, step: Math.PI / 24, value: (2 * Math.PI) / 3, format: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    { id: 'phi', label: 'Message phase φ', type: 'range', min: 0, max: 2 * Math.PI, step: Math.PI / 12, value: Math.PI / 3, format: angleLabel },
    {
      id: 'error',
      label: 'Error',
      type: 'select',
      value: 'X',
      options: [
        { value: 'none', label: 'None' },
        { value: 'X', label: 'Bit flip (X)' },
        { value: 'Z', label: 'Phase flip (Z)' },
        { value: 'Y', label: 'Both (Y)' },
      ],
    },
    { id: 'qubit', label: 'On data qubit', type: 'range', min: 0, max: 6, step: 1, value: 4, format: (v) => `d${v}` },
  ],
  views: [
    { title: 'Did the message survive?', legend: 'the message against qubit d2', mount: arrivalView },
    { title: 'The syndrome', legend: 'six measured bits', mount: syndromeView },
  ],
  build: (p) => {
    const { ops, at } = steaneCircuit(p);
    return [
      {
        title: 'A message on one qubit',
        ops,
        until: at.prepared,
        html: `<p>The message, any qubit state α|0⟩ + β|1⟩, sits on data qubit d2. Six other data qubits and six ancillas start in |0⟩.</p>
          <p>Shor's code used nine qubits to protect one. Steane found a way with seven.</p>`,
      },
      {
        title: 'Encode into seven qubits',
        ops,
        until: at.encoded,
        html: `<p>Two CNOTs copy the message's |1⟩ part onto d4 and d5, then three Hadamards and nine CNOTs spread it over all seven qubits. The result is α|0̄⟩ + β|1̄⟩, where |0̄⟩ is an equal superposition of the 8 even-weight codewords of the classical Hamming code.</p>
          <p>Now d2 alone reveals nothing about the message.</p>`,
        math: `The three checks come from the Hamming parity-check matrix (columns = 1…7 in binary):
          <span class="eq">rows: d0 d2 d4 d6 · d1 d2 d5 d6 · d3 d4 d5 d6</span>
          Each row is used twice: as a Z⊗Z⊗Z⊗Z check and as an X⊗X⊗X⊗X check. A code whose checks split into all-X and all-Z ones is a <b>CSS code</b> (Calderbank, Shor, Steane).`,
      },
      {
        title: 'An error strikes',
        ops,
        until: at.error,
        html: `<p>${p.error === 'none' ? 'No error this time (choose one in <b>Try it</b>).' : `A ${p.error} error hits d${p.qubit}.`} Any single-qubit error, X, Z, Y or a small rotation, on any one of the seven qubits can be corrected.</p>`,
      },
      {
        title: 'Measure the Z checks',
        ops,
        until: at.zChecks,
        html: `<p>Three ancillas collect the parities of the three rows (CNOT from each data qubit in the row). These Z-type checks catch <b>bit flips</b>.</p>`,
      },
      {
        title: 'Measure the X checks',
        ops,
        until: at.syndrome,
        html: ({ bits }) => {
          const z = (bits[7] ?? 0) | ((bits[8] ?? 0) << 1) | ((bits[9] ?? 0) << 2);
          const x = (bits[10] ?? 0) | ((bits[11] ?? 0) << 1) | ((bits[12] ?? 0) << 2);
          return `<p>Three more ancillas, sandwiched in Hadamards, measure the same rows as X-type checks, which catch <b>phase flips</b>. All six ancillas are measured.</p>
          <p>Z checks read ${z} and X checks read ${x}: ${z || x ? `${z ? `an X error on d${z - 1}` : ''}${z && x ? ' and ' : ''}${x ? `a Z error on d${x - 1}` : ''}` : 'no error'}.</p>`;
        },
      },
      {
        title: 'Fix it',
        ops,
        until: at.fixed,
        html: `<p>Each correction gate fires only for its own three-bit pattern (the "if" labels). Exactly the faulty qubit is repaired; nothing about α or β was ever measured.</p>`,
      },
      {
        title: 'Decode: the message is back',
        ops,
        until: at.decoded,
        html: `<p>Running the encoder backwards returns the message to d2. Compare the two arrows: the fidelity is 100% for every message, every single-qubit error and every position (the tests try all 21).</p>`,
        predict: {
          q: 'What if errors hit two different data qubits?',
          options: ['Still corrected', 'Usually fails: distance 3 corrects only one error', 'Detected and corrected twice', 'The code ignores it'],
          answer: 1,
          why: 'Two errors give the syndrome of a third position, so the "fix" adds a third error and completes a logical operator.',
        },
      },
      {
        title: 'Why Steane’s code matters',
        ops,
        until: at.decoded,
        html: `<p>Applying H to all seven qubits performs a logical H. Applying S to all seven performs a logical S (up to taking its inverse, a matter of convention), and CNOTs between matching qubits of two code blocks perform a logical CNOT. These <b>transversal</b> gates never let one error spread inside a block, so the whole Clifford group can be done fault-tolerantly.</p>
          <p>The missing piece for universal computing is the T gate, which comes from magic states (a later lesson).</p>`,
      },
    ];
  },
});
