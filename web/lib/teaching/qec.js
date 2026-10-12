// Teaching notes for "Quantum error correction".

export const TEACHING = {
  'error-correction': {
    goals: [
      'Encode one qubit into three without copying it (no-cloning).',
      'Measure parities (the syndrome) without learning the data.',
      'Compare the logical failure rate 3p² − 2p³ with p.',
    ],
    prereqs: ['CNOT', 'Measurement'],
    misconceptions: [
      { wrong: 'The code makes three copies of the qubit.', right: 'α|0⟩ + β|1⟩ becomes α|000⟩ + β|111⟩, which is entangled, not three copies.' },
      { wrong: 'Checking for errors means measuring the data qubits.', right: 'Only parities are measured; they reveal where the error is, but nothing about α and β.' },
    ],
    questions: [
      {
        q: 'The three-qubit bit-flip code fails when…',
        options: ['any qubit flips', 'two or more qubits flip', 'all three flip', 'a phase flip happens on one qubit'],
        answer: 1,
        why: 'Majority vote fixes one flip but turns two flips into the wrong logical value. (It also can’t see phase flips at all.)',
      },
      {
        q: 'For which p does the code help?',
        options: ['p < 1/2', 'p < 1/3', 'any p', 'p > 1/2'],
        answer: 0,
        why: '3p² − 2p³ < p exactly when p < 1/2.',
      },
      {
        q: 'Syndrome 11 (both parities odd) points to an error on…',
        options: ['qubit 0', 'qubit 1', 'qubit 2', 'no qubit'],
        answer: 1,
        why: 'With parities Z₀Z₁ and Z₁Z₂, only a flip on the middle qubit makes both odd.',
      },
    ],
  },
  'shor-code': {
    goals: [
      'Combine a phase-flip code and bit-flip codes into one nine-qubit code.',
      'Explain why correcting X and Z also corrects any error, including small rotations.',
      'Read a threshold plot.',
    ],
    prereqs: ['Three-qubit code', 'Hadamard basis'],
    misconceptions: [
      { wrong: 'Continuous errors need continuous corrections.', right: 'Measuring the syndrome projects any error onto I, X, Y or Z, which are then corrected.' },
      { wrong: 'Bigger codes are always better.', right: 'Only below the threshold; above it, more qubits mean more errors.' },
    ],
    questions: [
      {
        q: 'How many single-qubit errors can Shor’s code correct?',
        options: ['Only X errors', 'Any one error on any one qubit', 'Any two errors', 'Only Z errors'],
        answer: 1,
        why: 'It corrects any X, Z or Y (and so any error) on one of the nine qubits.',
      },
      {
        q: 'Why does correcting X, Y and Z suffice for an arbitrary small rotation?',
        options: ['Rotations are rare', 'The syndrome measurement collapses the error onto one Pauli', 'Rotations commute with everything', 'It doesn’t'],
        answer: 1,
        why: 'Any single-qubit error is a combination of I, X, Y, Z; the syndrome picks one, which is then undone.',
      },
      {
        q: 'Google’s 2024 surface-code experiment found that each step up in code distance (3 → 5 → 7) …',
        options: ['doubled the logical error rate', 'roughly halved the logical error rate', 'made no difference', 'removed all errors'],
        answer: 1,
        why: 'They measured an error suppression factor Λ ≈ 2.14 per distance step: below threshold.',
      },
    ],
  },
};
