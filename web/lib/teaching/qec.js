// Teaching notes for "Quantum error correction".

export const TEACHING = {
  'toric-code': {
    goals: [
      'Describe the toric code: qubits on edges, star and plaquette checks, two logical qubits.',
      'Explain e and m anyons as violated checks at the ends of strings.',
      'Compute the braiding phase of an e around an m from the loop operator.',
      'Explain topological protection: logical operators are loops around the torus.',
    ],
    prereqs: ['Stabilizers', 'The surface code'],
    misconceptions: [
      { wrong: 'An anyon is a real particle sitting in the hardware.', right: 'It is a pattern of violated checks, an excitation of the code; on a chip it is just a syndrome.' },
      { wrong: 'The braiding sign depends on the exact path taken.', right: 'Only on how the paths wind: Z on any loop equals the product of the plaquettes inside it.' },
      { wrong: 'With no anyons present, the encoded qubits are untouched.', right: 'A string wrapping the torus leaves no anyons but flips a logical qubit.' },
    ],
    questions: [
      {
        q: 'How many independent checks does an L × L toric code have?',
        options: ['2L²', '2L² − 1', '2L² − 2', 'L²'],
        answer: 2,
        why: 'All stars multiply to the identity, and so do all plaquettes, so two checks are redundant, leaving two logical qubits.',
      },
      {
        q: 'An e is carried around a loop enclosing three m anyons. What phase does the state pick up?',
        options: ['+1', '−1', 'i', 'e^(3iπ/4)'],
        answer: 1,
        why: '(−1)³ = −1: each enclosed m contributes a factor −1.',
      },
      {
        q: 'Why is the toric code’s logical information protected from local noise?',
        options: ['The qubits are shielded', 'Logical operators must wrap around the torus, so local errors cannot reach them undetected', 'Anyons cannot move', 'The checks are measured very fast'],
        answer: 1,
        why: 'Any operator acting on a small region either creates detectable anyons or is a product of checks.',
      },
    ],
  },
  'magic-states': {
    goals: [
      'Explain why Clifford gates alone cannot give a quantum advantage and why T is needed.',
      'Follow T-gate injection: a magic state, a CNOT, a measurement and a conditional S.',
      'Explain how 15-to-1 distillation detects errors with four checks and when it fails.',
      'Derive the 35p³ output error and estimate the cost of several rounds.',
    ],
    prereqs: ['Stabilizers', 'Steane’s code'],
    misconceptions: [
      { wrong: 'An error-corrected computer can do every gate the same way.', right: 'No code has a universal transversal gate set (Eastin–Knill); the surface code needs magic states for T.' },
      { wrong: 'Distillation corrects errors in the magic states.', right: 'It only detects them and throws suspicious batches away; outputs are better because failures need three or more aligned errors.' },
      { wrong: 'Outcome 1 in gate injection means the gate failed.', right: 'It applied T† instead; a Clifford S turns it into T, so both outcomes succeed.' },
    ],
    questions: [
      {
        q: 'Raw magic states have error 10⁻³. Roughly what error comes out of one round of 15-to-1?',
        options: ['10⁻⁶', '3.5 × 10⁻⁸', '1.5 × 10⁻⁴', '10⁻¹²'],
        answer: 1,
        why: '35p³ = 35 × 10⁻⁹ = 3.5 × 10⁻⁸.',
      },
      {
        q: 'Errors hit inputs 3, 5 and 6. What happens?',
        options: ['Rejected', 'Accepted and the output is flipped', 'Accepted and fine', 'Rejected only by check 8'],
        answer: 1,
        why: '3 ⊕ 5 ⊕ 6 = 0, so no check fires, and three errors is an odd pattern: a logical error.',
      },
      {
        q: 'Why does a single error never get through?',
        options: ['Single errors are impossible', 'Its label is nonzero, so at least one check fires', 'The code corrects it', 'T gates cancel it'],
        answer: 1,
        why: 'The checks read the XOR of the error labels; one label alone is never zero.',
      },
    ],
  },
  'fault-tolerance': {
    goals: [
      'Explain why syndrome measurements must be repeated when the measurements themselves are noisy.',
      'Define detection events as changes in a check between consecutive rounds.',
      'Describe data faults and measurement faults as edges of a space-time graph.',
      'Explain what makes a circuit fault-tolerant and why measurement errors lower the threshold.',
    ],
    prereqs: ['The surface code', 'Decoding'],
    misconceptions: [
      { wrong: 'A lit check always means a data qubit is wrong.', right: 'The check may have been misread; only a change that persists in later rounds points to a data error.' },
      { wrong: 'Measuring the checks more often just adds more chances for error.', right: 'Repetition is what lets the decoder separate misreads (one-round blips) from real flips (lasting changes).' },
      { wrong: 'Fault tolerance means no component ever fails.', right: 'It means any single fault leads to at most a correctable error, so failures need many faults at once.' },
    ],
    questions: [
      {
        q: 'Check c is misread in one round only. Which detection events appear?',
        options: ['None', 'One, at that round', 'Two: at that round and the next', 'One per later round'],
        answer: 2,
        why: 'The reading changes when the misread starts and changes back one round later: two events stacked in time.',
      },
      {
        q: 'In a decoder’s answer, what does a time-like edge (between rounds) tell you to do to the data?',
        options: ['Flip the qubit under that check', 'Nothing: it marks a measurement that was wrong', 'Repeat the round', 'Flip every qubit'],
        answer: 1,
        why: 'Time-like edges explain events as misreads; only space-like edges act on data qubits.',
      },
      {
        q: 'Roughly how much does adding measurement errors lower the surface-code threshold?',
        options: ['Not at all', 'From about 10% to about 3% (phenomenological), and to about 1% with full circuit noise', 'To zero', 'It raises it'],
        answer: 1,
        why: 'The decoding problem gains a time dimension with more ways to fail, so the threshold drops.',
      },
    ],
  },
  threshold: {
    goals: [
      'Read a threshold plot: logical against physical error rate for several distances.',
      'Explain why curves for different distances cross at the threshold.',
      'Define the suppression factor Λ and relate it to p/p_th.',
      'Estimate the code size needed for a target logical error rate from Λ.',
    ],
    prereqs: ['The surface code', 'Decoding'],
    misconceptions: [
      { wrong: 'Adding more qubits to a code always helps.', right: 'Only below threshold; above it, larger codes fail more often.' },
      { wrong: 'The threshold is a fixed property of the code.', right: 'It depends on the noise model and the decoder: about 10% for bit flips with perfect checks, about 3% with noisy checks, about 1% with circuit-level noise.' },
      { wrong: 'Being just below threshold is enough for useful computing.', right: 'Near threshold Λ is close to 1 and codes must be huge; useful machines need Λ well above 2.' },
    ],
    questions: [
      {
        q: 'Below threshold, each step d → d + 2 divides the logical error rate by Λ. With Λ = 2 and P_L(7) = 10⁻³, what is P_L(13)?',
        options: ['10⁻⁴', '1.25 × 10⁻⁴', '5 × 10⁻⁴', '10⁻⁶'],
        answer: 1,
        why: 'Three steps (7 → 9 → 11 → 13) divide by 2³ = 8: 10⁻³ / 8 = 1.25 × 10⁻⁴.',
      },
      {
        q: 'Why do measurement errors lower the threshold?',
        options: ['They flip the logical qubit directly', 'The syndrome itself can be wrong, so the decoder must also work out which measurements to trust', 'They make the code smaller', 'They do not change it'],
        answer: 1,
        why: 'Faulty checks add a time dimension to decoding: errors in space and time both have to be explained.',
      },
      {
        q: 'Roughly how does P_L scale with p well below threshold for distance d?',
        options: ['Linearly in p', 'As p^((d+1)/2)', 'As e^(−p)', 'Independent of p'],
        answer: 1,
        why: 'A failure needs about half the distance worth of errors to line up, each with probability p.',
      },
    ],
  },
  decoding: {
    goals: [
      'Explain why a decoder sees only the syndrome and must infer a likely error.',
      'Describe minimum-weight perfect matching and why fewest errors is most likely.',
      'Explain why a correction only needs to be right up to stabilizers.',
      'Describe the union-find decoder and why decoding speed matters.',
    ],
    prereqs: ['The surface code'],
    misconceptions: [
      { wrong: 'A good decoder always undoes exactly the errors that happened.', right: 'It only needs error × correction to be a stabilizer; many corrections are equally good.' },
      { wrong: 'Decoding can wait until the computation ends.', right: 'Syndromes arrive every microsecond; decoders must keep up in real time or a backlog grows.' },
    ],
    questions: [
      {
        q: 'Why does matching prefer the explanation with the fewest errors?',
        options: ['It is fastest to compute', 'For small p, a pattern of w errors has probability about pʷ', 'Errors always come alone', 'The checks force it'],
        answer: 1,
        why: 'Each extra error multiplies the probability by about p, so fewer errors are exponentially more likely.',
      },
      {
        q: 'Error and correction together form a chain from the top edge to the bottom edge. The result is…',
        options: ['success', 'a logical X error', 'a new syndrome', 'a Z error'],
        answer: 1,
        why: 'A top-to-bottom X chain is the logical X̄: it lights no checks and flips the encoded bit.',
      },
      {
        q: 'What is the main advantage of union-find over exact matching?',
        options: ['It always finds a lighter correction', 'It runs in almost linear time', 'It needs no syndrome', 'It corrects more errors'],
        answer: 1,
        why: 'Union-find is a little less accurate but much faster, which matters for real-time decoding.',
      },
    ],
  },
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
