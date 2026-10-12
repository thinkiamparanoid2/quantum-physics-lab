// Teaching notes for the fields section.

export const TEACHING = {
  'ising-transition': {
    goals: [
      'Describe the competition between Ising coupling and transverse field and the resulting quantum phase transition.',
      'Distinguish the ordered and paramagnetic phases by their correlations.',
      'Explain the closing gap at the critical point and why entanglement grows with system size only there.',
      'Explain the Kibble–Zurek mechanism and its τ^(−1/2) kink scaling for this model.',
    ],
    prereqs: ['Jordan–Wigner: fermions as qubits'],
    misconceptions: [
      { wrong: 'A quantum phase transition is driven by temperature.', right: 'It happens at zero temperature, tuned by a parameter (here h/J) that changes the ground state.' },
      { wrong: 'In the ordered phase ⟨Z⟩ ≠ 0 on a finite chain.', right: 'The finite-chain ground state is a symmetric cat state with ⟨Z⟩ = 0; order shows up in ⟨Z₀ Z_r⟩.' },
      { wrong: 'A slow enough ramp always avoids defects.', right: 'In an infinite system the gap closes at the transition, so any finite-speed ramp leaves kinks.' },
    ],
    questions: [
      {
        q: 'Where is the critical point of H = −J Σ ZZ − h Σ X?',
        options: ['h = 0', 'h = J', 'h = 2J', 'There is none'],
        answer: 1,
        why: 'Kramers–Wannier duality maps h/J to J/h; the self-dual point h = J is critical.',
      },
      {
        q: 'Doubling the ramp time τ multiplies the kink density by about…',
        options: ['1/2', '1/√2', '1/4', '2'],
        answer: 1,
        why: 'Kink density scales as τ^(−1/2) for the transverse-field Ising chain.',
      },
      {
        q: 'How does the half-chain entanglement of the ground state behave at h = J?',
        options: ['Zero', 'Constant in N', 'Grows like log N', 'Grows like N'],
        answer: 2,
        why: 'At criticality S ≈ (c/6) log N with c = ½; away from it the area law holds and S saturates.',
      },
    ],
  },
  schwinger: {
    goals: [
      'Describe the lattice Schwinger model: staggered fermions, Gauss’s law and the qubit Hamiltonian.',
      'Explain why a quench from the bare vacuum creates particle–antiparticle pairs.',
      'Relate pair creation to the mass gap and to a background electric field (the Schwinger effect).',
      'Interpret the vacuum persistence probability measured by Martinez et al. (2016).',
    ],
    prereqs: ['Jordan–Wigner: fermions as qubits'],
    misconceptions: [
      { wrong: 'The electric field needs its own qubits.', right: 'In one dimension Gauss’s law fixes it from the charges, leaving a long-range interaction between fermion qubits.' },
      { wrong: 'The bare vacuum is the ground state of the interacting theory.', right: 'Hopping mixes in pairs; the bare vacuum is a high-energy superposition of eigenstates, so it evolves.' },
      { wrong: 'Pair creation from the vacuum violates energy conservation.', right: 'The quench state already has extra energy; pairs only redistribute it (or draw it from a background field).' },
    ],
    questions: [
      {
        q: 'In the staggered formulation, where do electrons and positrons live?',
        options: ['Both on every site', 'Electrons on even sites, positrons on odd sites', 'Electrons on links', 'Positrons only at the ends'],
        answer: 1,
        why: 'Kogut–Susskind staggering splits the two components of the Dirac field between alternate sites.',
      },
      {
        q: 'Why does a larger mass suppress pair creation after the quench?',
        options: ['Particles move slower', 'Each pair costs more energy relative to the hopping that creates it', 'Gauss’s law forbids it', 'The field becomes zero'],
        answer: 1,
        why: 'Creating a pair costs about 2m; with a larger gap the hopping can lend that energy only briefly.',
      },
      {
        q: 'Martinez et al. first simulated this model on…',
        options: ['A classical supercomputer', 'Four trapped-ion qubits', 'A superconducting chip with 1000 qubits', 'A photonic chip'],
        answer: 1,
        why: 'Nature 534, 516 (2016): four trapped ions, the first digital quantum simulation of a lattice gauge theory.',
      },
    ],
  },
  'string-breaking': {
    goals: [
      'Explain how static charges create a flux string whose energy grows linearly with length.',
      'Explain string breaking: pair creation that screens the charges once the string is long enough.',
      'Read a potential V(ℓ) and identify the confining and broken regimes.',
      'Connect the picture to quark confinement and meson formation in QCD.',
    ],
    prereqs: ['The Schwinger model: pair creation'],
    misconceptions: [
      { wrong: 'A linear potential in 1D proves QCD-style confinement.', right: 'In 1D even classical electrostatics is linear; the quantum effect here is the breaking by pair creation.' },
      { wrong: 'String breaking happens when g ℓ equals exactly 2m.', right: 'The broken state also pays field and hopping energy, so the break comes later than that estimate.' },
      { wrong: 'After breaking the charges are free.', right: 'Each is bound to a screening partner from the vacuum, like a meson.' },
    ],
    questions: [
      {
        q: 'Below the breaking distance, how does the energy of two static charges grow with separation ℓ?',
        options: ['As 1/ℓ', 'About linearly, with slope near g', 'Exponentially', 'Not at all'],
        answer: 1,
        why: 'Each link of the flux string carries field energy g L² with L ≈ 1.',
      },
      {
        q: 'What signals string breaking in the ground state?',
        options: ['The energy jumps up', 'About two extra particles appear and the energy stops rising', 'The field doubles', 'The charges move'],
        answer: 1,
        why: 'A pair from the vacuum screens the charges, so the field between them nearly vanishes.',
      },
      {
        q: 'Making the dynamical particles heavier moves the breaking point…',
        options: ['Closer', 'Farther', 'Nowhere', 'To ℓ = 0'],
        answer: 1,
        why: 'The pair costs more, so the string must store more energy before breaking pays off.',
      },
    ],
  },
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
