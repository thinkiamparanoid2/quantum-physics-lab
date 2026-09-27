import { percent } from '../lib/format.js';
import { runCircuitLesson } from '../ui/circuit-lesson.js';

const H0 = { gate: 'H', target: 0 };
const H1 = { gate: 'H', target: 1 };
const CX = { gate: 'X', target: 1, controls: [0] };
const BELL = [H0, CX];
const XBASIS = [H0, CX, H0, H1];

const BELL_STATES = {
  'phi+': { label: 'Φ+ = (|00⟩ + |11⟩)/√2', extra: [] },
  'phi-': { label: 'Φ− = (|00⟩ − |11⟩)/√2', extra: [{ gate: 'Z', target: 0 }] },
  'psi+': { label: 'Ψ+ = (|01⟩ + |10⟩)/√2', extra: [{ gate: 'X', target: 1 }] },
  'psi-': { label: 'Ψ− = (|01⟩ − |10⟩)/√2', extra: [{ gate: 'X', target: 1 }, { gate: 'Z', target: 0 }] },
};

const agreement = (probs) => probs[0b00] + probs[0b11];

runCircuitLesson({
  slug: 'entanglement',
  n: 2,
  bloch: true,
  sampler: true,
  params: [
    {
      id: 'bell',
      label: 'Bell state',
      type: 'select',
      value: 'phi+',
      options: Object.entries(BELL_STATES).map(([value, s]) => ({ value, label: s.label })),
      hint: 'Used in step 6.',
    },
  ],
  build: (params) => {
    const chosen = [H0, CX, ...BELL_STATES[params.bell].extra];
    return [
      {
        title: 'Two separate qubits',
        ops: BELL,
        until: 0,
        html: `<p>Both qubits start in |0⟩, so the pair is in |00⟩. Two qubits have four possible outcomes (00, 01, 10, 11), but only 00 has any amplitude.</p>
          <p>Each qubit's own Bloch arrow points straight up: each has a definite state of its own.</p>`,
      },
      {
        title: 'Superposition on the first qubit',
        ops: BELL,
        until: 1,
        html: `<p>A Hadamard on q0 gives (|00⟩ + |10⟩)/√2. q0's arrow now lies on the equator and q1 is untouched.</p>
          <p>This is still two independent qubits: you could describe each one completely on its own.</p>`,
      },
      {
        title: 'CNOT ties them together',
        ops: BELL,
        until: 2,
        html: `<p>The CNOT flips q1 only when q0 is 1. The result is the <b>Bell state</b> (|00⟩ + |11⟩)/√2.</p>
          <p>Look at the Bloch spheres: both arrows have <b>shrunk to nothing</b>. Neither qubit has a state of its own any more. Only the pair has a state.</p>`,
      },
      {
        title: 'Measure both',
        ops: BELL,
        until: 2,
        html: ({ probs }) => `<p>Press <b>×100</b> in <b>Measure every qubit</b>. You get 00 or 11, never 01 or 10: the qubits agree ${percent(agreement(probs))} of the time.</p>
          <p>Yet each qubit on its own is a fair coin: q0 alone gives 0 or 1 with equal odds, and so does q1. The randomness is shared.</p>`,
      },
      {
        title: 'Correlated in every direction',
        ops: XBASIS,
        until: 4,
        html: ({ probs }) => `<p>Now apply H to both qubits before measuring. That is the same as measuring along x instead of z.</p>
          <p>Two coins with a secret agreed in advance would give unrelated results here. The Bell pair still agrees <b>${percent(agreement(probs))}</b> of the time.
          Correlations that survive a change of direction are what separate entanglement from shared classical randomness.</p>`,
      },
      {
        title: 'The four Bell states',
        ops: chosen,
        until: chosen.length,
        html: ({ probs }) => `<p>Choose a Bell state in <b>Try it</b>. Now the qubits agree ${percent(agreement(probs))} of the time.</p>
          <p>Φ states always agree when measured along z; Ψ states always disagree. The minus signs appear only as phase (the dial colours): invisible along z, but they change what happens along x.</p>`,
      },
      {
        title: 'Faster than light? No.',
        ops: BELL,
        until: 2,
        html: `<p>Measuring q0 tells you q1's result at once, however far apart they are. But q0's own result is a fair coin nobody controls, so no message is sent. Relativity is safe.</p>
          <p>What entanglement gives you is a <b>resource</b>. Next lessons use one Bell pair to teleport a qubit, and to send two bits by moving one qubit.</p>`,
      },
    ];
  },
});
