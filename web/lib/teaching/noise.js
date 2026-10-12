// Teaching notes for "Nonlocality and noise".

export const TEACHING = {
  'bell-test': {
    goals: [
      'State the CHSH game and show that no local strategy wins more than 75%.',
      'Compute the quantum winning probability cos²(π/8) ≈ 85%.',
      'Explain why the correlations still can’t be used to signal.',
    ],
    prereqs: ['Entanglement', 'Measurement along tilted axes'],
    misconceptions: [
      { wrong: 'Bell’s theorem shows that quantum mechanics is incomplete.', right: 'It shows that no local hidden-variable theory can reproduce quantum predictions, and experiments side with quantum mechanics.' },
      { wrong: 'Shared randomness could beat 75%.', right: 'Shared randomness only mixes deterministic strategies, and none of the 16 beats 75%.' },
    ],
    questions: [
      {
        q: 'What is the largest value of the CHSH quantity S for local hidden variables?',
        options: ['1', '2', '2√2', '4'],
        answer: 1,
        why: '|S| ≤ 2 for any local model; quantum mechanics reaches 2√2 (Tsirelson’s bound).',
      },
      {
        q: 'With the best quantum strategy, the CHSH game is won with probability…',
        options: ['75%', 'about 85%', '100%', '50%'],
        answer: 1,
        why: 'Win = ½ + S/8 = ½ + √2/4 = cos²(π/8) ≈ 0.854.',
      },
      {
        q: 'Alice changes her measurement direction. What does Bob see on his own?',
        options: ['His statistics change instantly', 'Still 50/50, unchanged', 'Always 0', 'A pattern encoding her choice'],
        answer: 1,
        why: 'Bob’s reduced state is maximally mixed whatever Alice does: no signalling.',
      },
    ],
  },
  decoherence: {
    goals: [
      'Distinguish a superposition from a 50/50 mixture with the Bloch vector and purity.',
      'Explain decoherence as entanglement with the environment.',
      'Interpret T₁ (relaxation) and T₂ (dephasing), with T₂ ≤ 2T₁.',
    ],
    prereqs: ['Bloch sphere', 'Entanglement'],
    misconceptions: [
      { wrong: 'Decoherence destroys the superposition by collapsing it.', right: 'The superposition spreads into correlations with the environment; locally the qubit looks mixed.' },
      { wrong: '|+⟩ and a 50/50 mixture of |0⟩ and |1⟩ are the same.', right: 'They give the same z statistics but differ in x: |+⟩ always gives +, the mixture gives 50/50.' },
    ],
    questions: [
      {
        q: 'Where is a maximally mixed qubit on the Bloch sphere?',
        options: ['North pole', 'On the equator', 'At the centre', 'Outside the sphere'],
        answer: 2,
        why: 'ρ = I/2 has Bloch vector 0, purity ½ and entropy 1 bit.',
      },
      {
        q: 'A qubit in |+⟩ touches N environment qubits, each turned by θ only if it is |1⟩. Its coherence becomes…',
        options: ['cos(θ/2)ᴺ', 'cos(θ)·N', 'e^(−θN)', 'unchanged'],
        answer: 0,
        why: 'Each environment qubit’s two branches overlap by cos(θ/2), and the overlaps multiply.',
      },
      {
        q: 'Which process returns an excited qubit to |0⟩?',
        options: ['T₂ dephasing', 'T₁ relaxation', 'A spin echo', 'Measurement in x'],
        answer: 1,
        why: 'T₁ is energy relaxation; T₂ alone only shrinks the equatorial part of the Bloch vector.',
      },
    ],
  },
};
