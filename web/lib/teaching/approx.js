// Teaching notes for "Many particles and approximations".

export const TEACHING = {
  bands: {
    goals: [
      'Explain how N coupled wells split each level into N levels, which become a band.',
      'Relate band width to tunnelling between wells.',
      'Use band filling to tell a metal from an insulator.',
    ],
    prereqs: ['Finite well', 'Tunnelling'],
    misconceptions: [
      { wrong: 'Electrons in a band are stuck to one atom.', right: 'Band states are spread over the whole crystal (Bloch waves).' },
      { wrong: 'A material is a conductor if it has electrons.', right: 'A full band carries no current; conduction needs a partly filled band.' },
    ],
    questions: [
      {
        q: 'Twelve identical wells are coupled. How many states does the lowest band hold (ignoring spin)?',
        options: ['1', '6', '12', '24'],
        answer: 2,
        why: 'Each single-well level splits into N levels, one per well.',
      },
      {
        q: 'The barriers between wells get thicker. The bands…',
        options: ['get wider', 'get narrower', 'move to zero energy', 'are unchanged'],
        answer: 1,
        why: 'Band width comes from tunnelling between wells, which falls exponentially with barrier thickness.',
      },
      {
        q: 'Each atom gives two electrons and the bands don’t overlap. In 1D this crystal is…',
        options: ['a metal', 'an insulator', 'a superconductor', 'impossible'],
        answer: 1,
        why: 'Two electrons per atom (with spin) exactly fill a band, leaving a gap to the next.',
      },
    ],
  },
  'identical-particles': {
    goals: [
      'Build symmetric (boson) and antisymmetric (fermion) two-particle states.',
      'Explain the exchange hole and why fermions keep apart.',
      'Derive the Pauli principle from antisymmetry.',
    ],
    prereqs: ['Particle in a box', 'Joint probability'],
    misconceptions: [
      { wrong: 'Fermions avoid each other because of a repulsive force.', right: 'The effect comes from the symmetry of the wavefunction, even with no interaction at all.' },
      { wrong: 'Two electrons can never be close together.', right: 'Electrons with the same spin are kept apart; with opposite spins the spatial part can be symmetric.' },
    ],
    questions: [
      {
        q: 'For two identical fermions in the same spin state, the probability of finding both at the same place is…',
        options: ['maximal', 'zero', 'the same as for distinguishable particles', 'one half'],
        answer: 1,
        why: 'An antisymmetric ψ(x₁, x₂) = −ψ(x₂, x₁) vanishes when x₁ = x₂.',
      },
      {
        q: 'Compared with distinguishable particles, bosons in different levels are found…',
        options: ['closer together on average', 'further apart', 'at the same separation', 'only at the walls'],
        answer: 0,
        why: 'The symmetric combination adds an exchange term that enhances the probability near x₁ = x₂.',
      },
      {
        q: 'Why can’t two electrons share all quantum numbers?',
        options: ['They repel', 'The antisymmetric state would be zero', 'They would have zero energy', 'It is an experimental accident'],
        answer: 1,
        why: 'Antisymmetrising two identical one-particle states gives ψ = 0: the Pauli exclusion principle.',
      },
    ],
  },
  perturbation: {
    goals: [
      'Compute a first-order energy shift as the average of the perturbation.',
      'Explain level repulsion in second order.',
      'Recognise when perturbation theory fails.',
    ],
    prereqs: ['Stationary states', 'Expectation values'],
    misconceptions: [
      { wrong: 'If the first-order shift is zero, the energy doesn’t change.', right: 'The second-order term can still shift it, as for the Stark effect in a symmetric well.' },
      { wrong: 'Perturbation theory works for any small-looking term.', right: 'It needs the coupling to be small compared with the level spacing.' },
    ],
    questions: [
      {
        q: 'The first-order energy shift of level n is…',
        options: ['⟨n|W|n⟩', 'Σ |⟨m|W|n⟩|²', 'zero', '⟨n|H₀|n⟩'],
        answer: 0,
        why: 'E⁽¹⁾ = ⟨n|W|n⟩, the perturbation averaged over the unperturbed state.',
      },
      {
        q: 'In second order, the ground state energy always…',
        options: ['goes up', 'goes down (or stays)', 'is unchanged', 'can go either way'],
        answer: 1,
        why: 'Every term |⟨m|W|0⟩|²/(E₀ − Eₘ) is ≤ 0 because E₀ is the lowest.',
      },
      {
        q: 'An oscillator in a uniform field F has first-order shift zero. The exact shift is −F²/2 (ħ = m = ω = 1). Second order gives…',
        options: ['0', '−F²/2 exactly', '+F²/2', 'only an approximation'],
        answer: 1,
        why: 'Only one matrix element is nonzero, and second order reproduces the exact completed-square result.',
      },
    ],
  },
  variational: {
    goals: [
      'State the variational principle: ⟨H⟩ ≥ E₀ for any trial state.',
      'Optimise a trial width to approach the ground state.',
      'Explain why a richer family of guesses can only lower (improve) the best energy, never below E₀.',
    ],
    prereqs: ['Expectation values', 'Ground states'],
    misconceptions: [
      { wrong: 'A good-looking wavefunction always gives a good energy.', right: 'The energy is forgiving (errors are second order), but the wavefunction can still be noticeably off.' },
      { wrong: 'A clever guess can go below the true ground state.', right: 'No trial state ever gives an energy below E₀.' },
    ],
    questions: [
      {
        q: 'A trial state gives ⟨H⟩ = −0.48 and the true ground energy is −0.5. Another trial gives −0.52. What do you conclude?',
        options: ['The second is better', 'The second contains a mistake', 'Both are fine', 'The true energy is wrong'],
        answer: 1,
        why: 'No trial state can go below E₀, so −0.52 signals an error.',
      },
      {
        q: 'For the harmonic oscillator with a Gaussian trial, the best ⟨H⟩ is…',
        options: ['above ½ħω', 'exactly ½ħω', 'below ½ħω', 'zero'],
        answer: 1,
        why: 'The exact ground state is a Gaussian, so the family contains it.',
      },
      {
        q: 'Why is the variational method used by quantum computers (VQE)?',
        options: ['It needs no Hamiltonian', 'A circuit can prepare trial states whose energy is measured and minimised', 'It is exact', 'It avoids measurement'],
        answer: 1,
        why: 'VQE is the variational method with a parameterised circuit as the trial family.',
      },
    ],
  },
  wkb: {
    goals: [
      'Use the quantisation rule ∮p dx = (n + ½)h for smooth potentials.',
      'Explain why WKB fails near turning points.',
      'Estimate tunnelling as e^(−2∫κ dx).',
    ],
    prereqs: ['Tunnelling', 'Classical turning points'],
    misconceptions: [
      { wrong: 'WKB is only good at high energies.', right: 'It is exact for the harmonic oscillator at every n, and good whenever the wavelength changes slowly.' },
      { wrong: 'The ½ in n + ½ is a fudge.', right: 'It comes from the phase loss at each smooth turning point (¼ wavelength each).' },
    ],
    questions: [
      {
        q: 'For two hard walls instead of smooth turning points, the rule becomes…',
        options: ['(n + ½)h', '(n + 1)h, i.e. counting from n = 0', '(n + ¾)h', 'nh with n = 0 allowed'],
        answer: 1,
        why: 'Each hard wall contributes a half-wavelength phase, giving the exact box levels.',
      },
      {
        q: 'Where does the WKB wavefunction blow up?',
        options: ['At the centre', 'At the turning points', 'Far away', 'Nowhere'],
        answer: 1,
        why: 'Its amplitude ∝ 1/√p diverges where p → 0.',
      },
      {
        q: 'The WKB tunnelling estimate is most accurate for…',
        options: ['thin, low barriers', 'thick, high barriers', 'wells', 'any barrier equally'],
        answer: 1,
        why: 'When the exponent is large the prefactor errors matter less.',
      },
    ],
  },
};
