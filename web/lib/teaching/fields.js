// Teaching notes for the fields section.

export const TEACHING = {
  'fock-space': {
    goals: [
      'Describe many-particle states by occupation numbers in Fock space.',
      'Apply bosonic creation and annihilation operators with their √n factors.',
      'Apply fermionic operators with Pauli exclusion and the ordering sign.',
      'State the commutation and anticommutation relations that define bosons and fermions.',
    ],
    prereqs: ['Identical particles', 'The harmonic oscillator'],
    misconceptions: [
      { wrong: 'In a two-fermion state one can say which fermion is in which mode.', right: 'Only occupations are physical; the state is antisymmetric under exchange.' },
      { wrong: 'The fermion sign convention changes the physics.', right: 'Any fixed ordering of modes works; all observables come out the same.' },
      { wrong: 'a† a and a a† are the same operator.', right: 'They differ by 1 for bosons: a a† = a† a + 1.' },
    ],
    questions: [
      {
        q: 'What is a†₁ a†₁ |0,0⟩ for bosons?',
        options: ['|2,0⟩', '√2 |2,0⟩', '0', '2 |2,0⟩'],
        answer: 1,
        why: 'First √1, then √2: the result is √2 |2,0⟩.',
      },
      {
        q: 'What is c†₁ c†₁ |0,0⟩ for fermions?',
        options: ['|2,0⟩', '−|1,0⟩', '0', '√2 |2,0⟩'],
        answer: 2,
        why: 'A fermion mode holds at most one particle: (c†)² = 0.',
      },
      {
        q: 'Which relation defines fermions?',
        options: ['[c_i, c†_j] = δ_ij', '{c_i, c†_j} = δ_ij', 'c_i c†_j = 0', 'c†_j c_i = δ_ij'],
        answer: 1,
        why: 'Fermions obey anticommutation relations; bosons obey commutation relations.',
      },
    ],
  },
  'jordan-wigner': {
    goals: [
      'Write fermion operators as Pauli strings with the Jordan–Wigner transformation.',
      'Explain why nearest-neighbour hopping is local but long-range hopping carries a Z string.',
      'Simulate a fermion chain on qubits and compare with free-fermion theory.',
      'Describe the ground state of free fermions as a filled Fermi sea.',
    ],
    prereqs: ['Fock space, bosons and fermions'],
    misconceptions: [
      { wrong: 'Each qubit can simply be treated as a fermion mode.', right: 'Qubit operators commute on different sites; the Z string supplies the missing fermion signs.' },
      { wrong: 'Jordan–Wigner is always efficient.', right: 'In 1D with neighbour hopping it is; in 2D or for molecules the strings grow with system size.' },
      { wrong: 'Pauli exclusion must be added to the qubit Hamiltonian.', right: 'A qubit can hold only one excitation, so exclusion is automatic.' },
    ],
    questions: [
      {
        q: 'What is c†₂ c₃ + c†₃ c₂ under Jordan–Wigner?',
        options: ['X₂ X₃', '½ (X₂X₃ + Y₂Y₃)', 'Z₀ Z₁ X₂ X₃', '½ (Z₂ + Z₃)'],
        answer: 1,
        why: 'The Z strings cancel for neighbours, leaving ½(XX + YY).',
      },
      {
        q: 'Why does the Jordan–Wigner string contain Z’s rather than X’s?',
        options: ['Z is cheaper', 'Z_k = (−1)^{n_k} counts the parity of occupied sites', 'X would change the particle number', 'Both B and C'],
        answer: 3,
        why: 'Z measures occupation without changing it, so the string supplies the sign and conserves particles.',
      },
      {
        q: 'How fast can a fermion spread on the chain −Σ (c†_j c_{j+1} + h.c.)?',
        options: ['Instantly', 'At most 2 sites per unit time', '1 site per unit time', 'It does not spread'],
        answer: 1,
        why: 'The group velocity dε/dq = 2 sin q is at most 2.',
      },
    ],
  },
  phonons: {
    goals: [
      'Find the normal modes of a chain of coupled masses and explain why they decouple.',
      'Quantise each mode as a harmonic oscillator and describe states by occupation numbers.',
      'Interpret phonons as identical bosonic particles with energy ħω and wave number q.',
      'Explain how pinning gives a gapped, relativistic dispersion: a massive particle.',
    ],
    prereqs: ['The harmonic oscillator'],
    misconceptions: [
      { wrong: 'A phonon is one of the masses moving.', right: 'It is one quantum of a collective normal mode spread over the whole chain.' },
      { wrong: 'The quantum vacuum of a field is empty and motionless.', right: 'Every mode keeps its zero-point energy ħω/2 and the field fluctuates.' },
      { wrong: 'Particles and fields are different things.', right: 'In quantum field theory particles are the quanta of field modes.' },
    ],
    questions: [
      {
        q: 'A chain of N masses with fixed ends has how many normal modes?',
        options: ['1', 'N', '2N', 'Infinitely many'],
        answer: 1,
        why: 'One per degree of freedom: N masses moving along one direction give N modes.',
      },
      {
        q: 'With pinning frequency w₀, what is the smallest energy a single phonon can have (ħ = 1)?',
        options: ['0', 'About w₀', '2', 'w₀/2'],
        answer: 1,
        why: 'ω² = w₀² + 4 sin²(q/2) ≥ w₀² (slightly more on a finite chain, whose smallest q is π/(N+1)): the gap is the particle’s mass.',
      },
      {
        q: 'Why are phonons bosons?',
        options: ['They carry spin 1', 'Each mode is an oscillator whose level n can be any whole number, and only the count matters', 'They obey the Pauli principle', 'They are made of atoms'],
        answer: 1,
        why: 'Occupation numbers of an oscillator are unlimited and the quanta are indistinguishable: Bose statistics.',
      },
    ],
  },
};
