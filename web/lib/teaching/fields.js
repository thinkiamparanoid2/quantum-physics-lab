// Teaching notes for the fields section.

export const TEACHING = {
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
