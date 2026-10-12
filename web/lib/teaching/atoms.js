// Teaching notes for "Spin, angular momentum and atoms".

export const TEACHING = {
  'stern-gerlach': {
    goals: [
      'Explain why a beam of silver atoms splits into two spots, never a smear.',
      'Predict the outcomes of sequential measurements along different axes.',
      'Use cos²(θ/2) for the probability of "up" along a tilted axis.',
    ],
    prereqs: ['Magnetic moment in a field gradient', 'Probability'],
    misconceptions: [
      { wrong: 'After measuring "up along z", the atom has definite x and z spin.', right: 'Measuring x afterwards gives 50/50, and erases the z result: the components can’t be known together.' },
      { wrong: 'The atoms come out of the oven already pointing up or down along z.', right: 'They come out unpolarised; any axis gives 50/50, and the axis you choose defines the two outcomes.' },
    ],
    questions: [
      {
        q: 'Atoms pass z (keep up), then x (keep up), then z. Of the atoms that got through the first magnet as "up", what fraction end up "down along z" at the end?',
        options: ['0', '1/8', '1/4', '1/2'],
        answer: 2,
        why: '½ pass the x magnet, and the x measurement erases the z result, so half of those come out down: 1/4.',
      },
      {
        q: 'An atom is up along z. A magnet tilted 60° from z measures it. The chance of "up" is…',
        options: ['cos²(30°) = 3/4', 'cos²(60°) = 1/4', '1/2', 'cos(60°) = 1/2'],
        answer: 0,
        why: 'P(up) = cos²(θ/2) with θ = 60°.',
      },
      {
        q: 'Why is a spin-½ measurement like a qubit measurement?',
        options: ['Both have two outcomes and a Bloch sphere of states', 'Both are classical', 'Both need lasers', 'They are unrelated'],
        answer: 0,
        why: 'Spin-½ is a two-level system; the magnet axis is the measurement basis on the Bloch sphere.',
      },
    ],
  },
  'magnetic-resonance': {
    goals: [
      'Describe Larmor precession as a rotating relative phase.',
      'Explain resonance: a field rotating at the Larmor frequency flips the spin.',
      'Explain how a spin echo undoes dephasing.',
    ],
    prereqs: ['Bloch sphere', 'Stern–Gerlach'],
    misconceptions: [
      { wrong: 'A strong enough static field flips the spin.', right: 'A static field only makes it precess; flipping needs a field that rotates in step with the precession.' },
      { wrong: 'A spin echo reverses every kind of decay.', right: 'It refocuses static frequency spreads (T₂*), not random fluctuations (true T₂) or relaxation (T₁).' },
    ],
    questions: [
      {
        q: 'A spin is driven exactly on resonance with Rabi frequency Ω. After what time is it fully flipped?',
        options: ['π/Ω (a π pulse)', '2π/Ω', 'π/(2Ω)', 'Never fully'],
        answer: 0,
        why: 'On resonance P(flip) = sin²(Ωt/2), which reaches 1 at t = π/Ω.',
      },
      {
        q: 'Off resonance by Δ, the largest flip probability is…',
        options: ['1', 'Ω²/(Ω² + Δ²)', 'Δ/Ω', '0'],
        answer: 1,
        why: 'Rabi’s formula gives an amplitude Ω²/(Ω² + Δ²).',
      },
      {
        q: 'In a spin echo, the π pulse at time τ makes the spins refocus at…',
        options: ['τ/2', 'τ', '2τ', 'never'],
        answer: 2,
        why: 'The pulse reverses each spin’s accumulated phase, which then unwinds over another τ.',
      },
    ],
  },
  hydrogen: {
    goals: [
      'Interpret an orbital as a probability cloud with radial and angular nodes.',
      'State Eₙ = −13.6 eV/n² and that it depends only on n.',
      'Count nodes: n − 1 in total, l of them angular.',
    ],
    prereqs: ['Particle in a box', 'Spherical coordinates'],
    misconceptions: [
      { wrong: 'Electrons orbit the nucleus on fixed circular paths.', right: 'An orbital is a probability distribution; there is no trajectory.' },
      { wrong: 'The most likely radius for 1s is zero because |ψ|² is largest there.', right: 'The radial probability r²|R|² peaks at the Bohr radius: there is more volume further out.' },
    ],
    questions: [
      {
        q: 'How many radial nodes does the 3s orbital have?',
        options: ['0', '1', '2', '3'],
        answer: 2,
        why: 'Radial nodes number n − l − 1 = 3 − 0 − 1 = 2.',
      },
      {
        q: 'Which have the same energy in hydrogen (ignoring fine structure)?',
        options: ['2s and 2p', '2s and 3s', '1s and 2p', '2p and 3p'],
        answer: 0,
        why: 'Energy depends only on n, so all n = 2 orbitals are degenerate.',
      },
      {
        q: 'What is the ionisation energy from n = 2?',
        options: ['13.6 eV', '6.8 eV', '3.4 eV', '1.5 eV'],
        answer: 2,
        why: 'E₂ = −13.6/4 eV = −3.4 eV.',
      },
    ],
  },
  'atomic-spectra': {
    goals: [
      'Connect each spectral line to a jump between two energy levels.',
      'Use the Rydberg formula to predict Balmer wavelengths.',
      'Explain emission and absorption lines.',
    ],
    prereqs: ['Hydrogen energy levels', 'Photon energy E = hc/λ'],
    misconceptions: [
      { wrong: 'All hydrogen lines are visible.', right: 'Only the Balmer series (jumps to n = 2) is mostly visible; Lyman is ultraviolet, Paschen infrared.' },
      { wrong: 'Absorption lines appear at different wavelengths from emission lines.', right: 'They are the same jumps in reverse, so the wavelengths match.' },
    ],
    questions: [
      {
        q: 'Which jump gives the red Balmer line (Hα, 656 nm)?',
        options: ['2 → 1', '3 → 2', '4 → 2', '3 → 1'],
        answer: 1,
        why: 'Hα is the smallest Balmer jump, n = 3 to n = 2.',
      },
      {
        q: 'Which series lies in the ultraviolet?',
        options: ['Lyman', 'Balmer', 'Paschen', 'Brackett'],
        answer: 0,
        why: 'Lyman lines end on n = 1, the largest gaps, so the shortest wavelengths (below 122 nm).',
      },
      {
        q: 'As the upper level n → ∞, the Balmer lines…',
        options: ['spread out evenly', 'crowd towards a limit near 365 nm', 'become infrared', 'stop existing'],
        answer: 1,
        why: '1/λ = R(1/4 − 1/n²) approaches R/4, the series limit at about 364.6 nm.',
      },
    ],
  },
};
