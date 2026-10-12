// Teaching notes for "Qubits".

export const TEACHING = {
  qubit: {
    goals: [
      'Describe a qubit state by two amplitudes and as a point on the Bloch sphere.',
      'Interpret X, H, Z, S and T as rotations of the Bloch arrow.',
      'Distinguish global phase (invisible) from relative phase (physical).',
    ],
    prereqs: ['Complex numbers', 'Vectors and rotations'],
    misconceptions: [
      { wrong: 'A qubit in superposition is secretly 0 or 1.', right: 'α|0⟩ + β|1⟩ is a definite state with its own direction; it just isn’t |0⟩ or |1⟩.' },
      { wrong: 'The Z gate does nothing because the probabilities don’t change.', right: 'Z flips the relative phase, which changes what later gates (like H) produce.' },
    ],
    questions: [
      {
        q: 'Where on the Bloch sphere is (|0⟩ + i|1⟩)/√2?',
        options: ['North pole', 'On the equator, along +y', 'On the equator, along +x', 'South pole'],
        answer: 1,
        why: 'Equal magnitudes put it on the equator; the relative phase π/2 points it along +y.',
      },
      {
        q: 'Which gate takes |0⟩ to |+⟩?',
        options: ['X', 'Z', 'H', 'S'],
        answer: 2,
        why: 'H rotates by 180° about the x+z axis, swapping the z and x poles.',
      },
      {
        q: 'Applying S twice is the same as…',
        options: ['X', 'Z', 'H', 'the identity'],
        answer: 1,
        why: 'S is a 90° turn about z; two make 180°, which is Z.',
      },
    ],
  },
  measurement: {
    goals: [
      'Apply the Born rule P(0) = |α|².',
      'Explain collapse: repeating a measurement gives the same answer.',
      'Measure in other bases by rotating first.',
    ],
    prereqs: ['The qubit'],
    misconceptions: [
      { wrong: 'One measurement tells you the amplitudes.', right: 'It gives a single 0 or 1; estimating |α|² takes many copies.' },
      { wrong: 'Measuring in the x basis needs a different kind of detector.', right: 'Rotate with H and measure in z: that is an x measurement.' },
    ],
    questions: [
      {
        q: 'A qubit is cos(30°)|0⟩ + sin(30°)|1⟩. P(1) is…',
        options: ['1/2', '1/4', '3/4', '√3/2'],
        answer: 1,
        why: 'P(1) = sin²(30°) = 1/4.',
      },
      {
        q: 'You measure |+⟩ in z and get 1. Measuring z again gives…',
        options: ['1 with certainty', '0 or 1, 50/50', '0 with certainty', 'it depends on the phase'],
        answer: 0,
        why: 'The first measurement collapsed the state to |1⟩.',
      },
      {
        q: 'Which state gives 0 with certainty when measured in the x basis (H then measure)?',
        options: ['|0⟩', '|1⟩', '|+⟩', '|−⟩'],
        answer: 2,
        why: 'H|+⟩ = |0⟩.',
      },
    ],
  },
  interference: {
    goals: [
      'Add amplitudes along different paths and see them cancel.',
      'Explain why H·H = I using amplitudes, not probabilities.',
      'Show how a phase between two H gates steers the outcome.',
    ],
    prereqs: ['The qubit', 'Measurement'],
    misconceptions: [
      { wrong: 'After the first H the qubit is randomly 0 or 1, so the second H gives random output.', right: 'The two paths to |1⟩ carry opposite amplitudes and cancel, giving |0⟩ with certainty.' },
      { wrong: 'Interference needs two particles.', right: 'A single qubit interferes with itself.' },
    ],
    questions: [
      {
        q: 'H, then Z, then H applied to |0⟩ gives…',
        options: ['|0⟩', '|1⟩', '|+⟩', 'a random bit'],
        answer: 1,
        why: 'Z flips the sign of one path, so the paths to |0⟩ cancel and those to |1⟩ add.',
      },
      {
        q: 'H, then P(φ), then H on |0⟩: the probability of 1 is…',
        options: ['cos²(φ/2)', 'sin²(φ/2)', '1/2', 'φ/π'],
        answer: 1,
        why: 'The fringe is P(1) = sin²(φ/2), zero at φ = 0 and one at φ = π.',
      },
      {
        q: 'Why is interference the key to quantum algorithms?',
        options: ['It speeds up gates', 'It cancels the amplitudes of wrong answers', 'It copies data', 'It avoids measurement'],
        answer: 1,
        why: 'Algorithms arrange phases so that wrong answers cancel and the right one is reinforced.',
      },
    ],
  },
  entanglement: {
    goals: [
      'Build a Bell state with H and CNOT.',
      'Explain why an entangled qubit has no Bloch arrow of its own.',
      'Explain why entanglement can’t send messages.',
    ],
    prereqs: ['Measurement', 'Two-qubit states'],
    misconceptions: [
      { wrong: 'Correlation alone proves entanglement.', right: 'Classical mixtures can be correlated too; entanglement shows up as correlation in more than one basis (and in Bell tests).' },
      { wrong: 'Measuring one qubit of a Bell pair sends a signal to the other.', right: 'Each side alone sees random 50/50 outcomes whatever the other does.' },
    ],
    questions: [
      {
        q: 'After H on qubit 0 and CNOT(0→1) from |00⟩, the state is…',
        options: ['|00⟩', '(|00⟩ + |11⟩)/√2', '(|01⟩ + |10⟩)/√2', '|+⟩|+⟩'],
        answer: 1,
        why: 'H makes (|0⟩ + |1⟩)/√2 on qubit 0, and CNOT copies its value into qubit 1.',
      },
      {
        q: 'The Bloch arrow of one qubit of a Bell pair has length…',
        options: ['1', '½', '0', '√2'],
        answer: 2,
        why: 'Its reduced state is maximally mixed, I/2, at the centre of the sphere.',
      },
      {
        q: 'For |Φ⁺⟩, measuring both qubits in the x basis gives…',
        options: ['always equal results', 'always opposite results', 'uncorrelated results', 'only 0s'],
        answer: 0,
        why: '⟨XX⟩ = +1 for |Φ⁺⟩ (while ⟨YY⟩ = −1).',
      },
    ],
  },
};
