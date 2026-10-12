// Teaching notes for "Quantum information".

export const TEACHING = {
  'quantum-walk': {
    goals: [
      'Describe one step of a discrete quantum walk: a coin operation, then a conditional shift.',
      'Contrast ballistic (∝ t) quantum spreading with diffusive (∝ √t) classical spreading.',
      'Explain how decoherence of the coin turns the quantum walk into a classical one.',
    ],
    prereqs: ['Interference', 'Hadamard gate', 'Decoherence'],
    misconceptions: [
      { wrong: 'A quantum walker randomly picks left or right each step.', right: 'It moves both ways in superposition; only a measurement at the end gives a position.' },
      { wrong: 'The quantum walk is just a faster random walk with the same shape.', right: 'The distribution is completely different: peaks near ±t/√2 and interference in between.' },
    ],
    questions: [
      {
        q: 'After 100 steps, the classical walker’s spread (standard deviation) is…',
        options: ['100', '50', '10', '1'],
        answer: 2,
        why: 'For an unbiased random walk ⟨x²⟩ = t, so σ = √100 = 10.',
      },
      {
        q: 'If the coin is measured after every step, the quantum walk becomes…',
        options: ['faster', 'the classical random walk', 'frozen in place', 'perfectly symmetric but still ballistic'],
        answer: 1,
        why: 'Measuring the coin destroys the superposition each step, so each step is a fair coin flip.',
      },
      {
        q: 'Why does the walk started in |0⟩ drift to one side?',
        options: ['The shift is biased', 'The Hadamard coin gives |1⟩ a minus sign, so the two directions interfere differently', 'Noise', 'Rounding errors'],
        answer: 1,
        why: 'H is not symmetric between |0⟩ and |1⟩; a coin like (|0⟩ + i|1⟩)/√2 removes the bias.',
      },
    ],
  },
  'no-cloning': {
    goals: [
      'Prove the no-cloning theorem from linearity (or from inner products).',
      'Explain what the CNOT "copier" really does to a superposition.',
      'State the optimal universal cloning fidelity, 5/6.',
      'State the CKW monogamy inequality and contrast GHZ and W states.',
    ],
    prereqs: ['Entanglement', 'Entanglement, measured'],
    misconceptions: [
      { wrong: 'A CNOT copies a qubit onto a blank one.', right: 'It copies only basis states; a superposition becomes entangled with the target instead.' },
      { wrong: 'No-cloning forbids copying anything quantum.', right: 'Known states, or states from a known orthogonal set, can be prepared again; only unknown states can’t be copied.' },
      { wrong: 'Teleportation is a way to clone.', right: 'Teleportation destroys the original, so there is only ever one copy.' },
    ],
    questions: [
      {
        q: 'The CNOT copier acts on |+⟩|0⟩. Each output qubit, on its own, has fidelity with |+⟩ of…',
        options: ['100%', '83%', '50%', '0%'],
        answer: 2,
        why: 'The output is a Bell pair; each half is maximally mixed, and F = (1 + 0)/2 = 1/2.',
      },
      {
        q: 'The best possible universal cloner produces copies with fidelity…',
        options: ['1', '5/6', '2/3', '1/2'],
        answer: 1,
        why: 'Each copy has Bloch vector (2/3)r, so F = (1 + 2/3)/2 = 5/6 (Bužek–Hillery).',
      },
      {
        q: 'In the W state, C²(A,B) + C²(A,C) equals 8/9. What is A’s three-tangle?',
        options: ['1', '8/9', '1/9', '0'],
        answer: 3,
        why: 'C²(A,BC) = 4 det ρ_A = 8/9 as well, so nothing is left for the three-tangle.',
      },
    ],
  },
  'state-discrimination': {
    goals: [
      'Explain why non-orthogonal states cannot be distinguished with certainty.',
      'Apply the Helstrom bound for minimum-error discrimination, with equal or unequal priors.',
      'Describe unambiguous discrimination: never wrong, conclusive with probability 1 − |⟨ψ₀|ψ₁⟩|.',
      'Define a POVM and realise it as a projective measurement on a larger system (Neumark).',
    ],
    prereqs: ['Measurement and the Born rule', 'Bloch sphere'],
    misconceptions: [
      { wrong: 'With a clever enough measurement any two states can be told apart.', right: 'Only orthogonal states can; otherwise one shot always leaves some chance of error or of no answer.' },
      { wrong: 'A qubit measurement can only have two outcomes.', right: 'Projective ones can; POVMs can have more, using an ancilla.' },
    ],
    questions: [
      {
        q: 'Two equally likely states have overlap |⟨ψ₀|ψ₁⟩| = 0.6. The best chance of naming the right one is…',
        options: ['60%', '80%', '90%', '100%'],
        answer: 2,
        why: '½(1 + √(1 − 0.36)) = ½(1 + 0.8) = 90%.',
      },
      {
        q: 'With the same overlap 0.6, the never-wrong strategy gives a definite answer…',
        options: ['40% of the time', '60% of the time', '90% of the time', 'never'],
        answer: 0,
        why: 'Optimal unambiguous discrimination is conclusive with probability 1 − 0.6 = 0.4.',
      },
      {
        q: 'Why would perfect discrimination of non-orthogonal states break quantum mechanics?',
        options: ['It would allow cloning them', 'It would violate energy conservation', 'It would need infinite time', 'It wouldn’t'],
        answer: 0,
        why: 'Identify the state, then prepare as many copies as you like: that contradicts no-cloning.',
      },
    ],
  },
  channels: {
    goals: [
      'Represent mixed states as points inside the Bloch ball and compute their purity.',
      'Describe depolarizing, bit-flip, dephasing and amplitude-damping noise as maps of the ball.',
      'Write a channel with Kraus operators and check Σ K†K = I.',
      'Explain a channel as a unitary on qubit plus environment (Stinespring).',
    ],
    prereqs: ['Bloch sphere', 'Decoherence and mixed states'],
    misconceptions: [
      { wrong: 'Noise rotates the state randomly but keeps it pure.', right: 'Averaged over what we don’t know, noise turns pure states into mixed ones, which lie inside the ball.' },
      { wrong: 'Dephasing and relaxation are the same thing.', right: 'Dephasing (T₂) shrinks x and y only; relaxation (T₁) also pulls the state towards |0⟩.' },
      { wrong: 'Noise destroys information.', right: 'The information moves into correlations with the environment; the joint evolution is unitary.' },
    ],
    questions: [
      {
        q: 'A qubit has Bloch vector (0, 0.6, 0). Its purity tr ρ² is…',
        options: ['0.6', '0.68', '0.36', '1'],
        answer: 1,
        why: 'tr ρ² = (1 + |r|²)/2 = (1 + 0.36)/2 = 0.68.',
      },
      {
        q: 'Which channel leaves states on the z axis untouched but shrinks the equator?',
        options: ['Bit flip', 'Phase damping (dephasing)', 'Amplitude damping', 'Depolarizing'],
        answer: 1,
        why: 'Dephasing multiplies x and y by √(1 − λ) and keeps z.',
      },
      {
        q: 'Where does amplitude damping send the maximally mixed state after many applications?',
        options: ['It stays at the centre', 'To |0⟩', 'To |1⟩', 'To |+⟩'],
        answer: 1,
        why: 'z → γ + (1 − γ)z, so z → 1: energy loss drives every state to the ground state.',
      },
      {
        q: 'A bit-flip channel acts with p = 1/2. The ball becomes…',
        options: ['a point', 'a line segment along x', 'a disc in the xy plane', 'unchanged'],
        answer: 1,
        why: 'y and z are multiplied by 1 − 2p = 0, leaving only the x component.',
      },
    ],
  },
  'entanglement-measures': {
    goals: [
      'Write a two-qubit pure state in Schmidt form and read off its Schmidt weights.',
      'Compute entanglement entropy and concurrence, and relate them to the reduced Bloch vector.',
      'Explain why local operations cannot change entanglement, and why correlation is not entanglement.',
      'Contrast GHZ (genuinely three-party) with W (pairwise) entanglement.',
    ],
    prereqs: ['Entanglement (Bell states)', 'Density matrices and the Bloch ball'],
    misconceptions: [
      { wrong: 'A maximally entangled qubit is "in both states at once" like |+⟩.', right: 'On its own it is maximally mixed (Bloch vector zero), not in any pure superposition.' },
      { wrong: 'Any correlated state is entangled.', right: 'Mixtures of product states can be correlated; the Werner state is separable for p ≤ 1/3.' },
      { wrong: 'Entropy measures entanglement for every state.', right: 'Only for pure states; for mixed states noise also creates entropy, so use concurrence or negativity.' },
    ],
    questions: [
      {
        q: 'A pure two-qubit state has Schmidt weights 0.5 and 0.5. Its entanglement entropy is…',
        options: ['0 bits', '0.5 bits', '1 bit', '2 bits'],
        answer: 2,
        why: 'S = −2 × 0.5 log₂ 0.5 = 1 bit: a maximally entangled pair.',
      },
      {
        q: 'For the pure state cos(θ/2)|00⟩ + sin(θ/2)|11⟩, the concurrence is…',
        options: ['cos θ', 'sin θ', 'sin²(θ/2)', '1 for every θ'],
        answer: 1,
        why: 'C = 2|ad − bc| = 2 cos(θ/2) sin(θ/2) = sin θ.',
      },
      {
        q: 'In the GHZ state, the pair of qubits 0 and 1 on its own has concurrence…',
        options: ['1', '2/3', '1/2', '0'],
        answer: 3,
        why: 'Tracing out qubit 2 leaves ½(|00⟩⟨00| + |11⟩⟨11|), a classical mixture with no entanglement.',
      },
      {
        q: 'A two-qubit pure state has concurrence 0.6. How long is each qubit’s Bloch arrow?',
        options: ['0.4', '0.6', '0.8', '1'],
        answer: 2,
        why: '|r| = √(1 − C²) = √(1 − 0.36) = 0.8.',
      },
    ],
  },
};
