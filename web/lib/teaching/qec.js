// Teaching notes for "Quantum error correction".

export const TEACHING = {
  'surface-code': {
    goals: [
      'Describe the rotated surface code: data qubits, local X and Z checks, one logical qubit.',
      'Predict which checks light up for X, Z and Y errors, and for chains of errors.',
      'Identify stabilizer loops (harmless) and logical chains (undetectable failures).',
      'Relate the distance d to the number of errors the code corrects.',
    ],
    prereqs: ['Stabilizers', 'Steane’s seven-qubit code'],
    misconceptions: [
      { wrong: 'The syndrome shows exactly which qubits failed.', right: 'It shows only the ends of error chains; the decoder must infer the path.' },
      { wrong: 'If no check lights up, there is no error.', right: 'A chain spanning the patch lights nothing but flips the logical qubit.' },
    ],
    questions: [
      {
        q: 'How many checks does a distance-5 rotated surface code have?',
        options: ['20', '24', '25', '50'],
        answer: 1,
        why: 'd² − 1 = 24 checks on 25 data qubits leave one logical qubit.',
      },
      {
        q: 'Three X errors in a vertical line in the bulk light how many checks?',
        options: ['6', '3', '2', '0'],
        answer: 2,
        why: 'Interior checks see two flips and cancel; only the two ends of the chain stay lit.',
      },
      {
        q: 'How many errors can a distance-7 surface code always correct?',
        options: ['1', '3', '6', '7'],
        answer: 1,
        why: '⌊(d − 1)/2⌋ = 3.',
      },
    ],
  },
  'steane-code': {
    goals: [
      'Build the Steane code from the classical [7,4] Hamming code (a CSS code).',
      'Extract X and Z syndromes with ancillas and read them as the error’s position in binary.',
      'Explain why distance 3 corrects one error and fails for two.',
      'Name the transversal logical gates of the Steane code.',
    ],
    prereqs: ['Stabilizers', 'Shor’s nine-qubit code'],
    misconceptions: [
      { wrong: 'Measuring the ancillas collapses the encoded message.', right: 'They only measure parities of checks, which are the same for both logical states.' },
      { wrong: 'A Y error needs its own checks.', right: 'Y = iXZ is caught by both the Z checks (as an X) and the X checks (as a Z).' },
    ],
    questions: [
      {
        q: 'A single X error on data qubit d5 gives Z-check bits (4 2 1) of…',
        options: ['101', '110', '011', '000'],
        answer: 1,
        why: 'Qubit i lights up the binary of i + 1 = 6 = 110.',
      },
      {
        q: 'How many physical qubits does the Steane code use per logical qubit (not counting ancillas)?',
        options: ['3', '5', '7', '9'],
        answer: 2,
        why: 'It is a [[7,1,3]] code: 7 physical, 1 logical, distance 3.',
      },
      {
        q: 'Which logical gate is NOT transversal on the Steane code?',
        options: ['H', 'CNOT', 'S', 'T'],
        answer: 3,
        why: 'No code has a transversal universal gate set (Eastin–Knill); for Steane, T needs magic-state injection.',
      },
    ],
  },
  stabilizers: {
    goals: [
      'Describe a stabilizer state by n independent commuting Pauli generators.',
      'Update stabilizers under H, S and CNOT by conjugation.',
      'Explain a stabilizer code: n − k checks, k logical qubits, logical operators.',
      'Read a syndrome as the set of generators that anticommute with an error; state Gottesman–Knill.',
    ],
    prereqs: ['Quantum error correction (three-qubit code)', 'Pauli matrices'],
    misconceptions: [
      { wrong: 'Measuring a stabilizer disturbs the encoded state.', right: 'The code space is a +1 eigenspace of every stabilizer, so measuring them reveals only the error, not the logical state.' },
      { wrong: 'Any circuit can be simulated efficiently with stabilizers.', right: 'Only Clifford circuits (H, S, CNOT, Pauli measurements); a T gate breaks the formalism.' },
    ],
    questions: [
      {
        q: 'How many independent stabilizer generators does a state of 6 qubits have?',
        options: ['3', '6', '12', '64'],
        answer: 1,
        why: 'A stabilizer state of n qubits has exactly n independent generators.',
      },
      {
        q: 'H is applied to qubit 0 of a state stabilized by Z₀Z₁. The new stabilizer is…',
        options: ['Z₀Z₁', 'X₀Z₁', 'X₀X₁', 'Y₀Z₁'],
        answer: 1,
        why: 'H Z H = X, so Z₀Z₁ becomes X₀Z₁.',
      },
      {
        q: 'A code on 9 qubits has 8 independent stabilizers. How many logical qubits does it encode?',
        options: ['0', '1', '8', '9'],
        answer: 1,
        why: 'k = n − (number of independent stabilizers) = 9 − 8 = 1 (Shor’s code).',
      },
    ],
  },
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
