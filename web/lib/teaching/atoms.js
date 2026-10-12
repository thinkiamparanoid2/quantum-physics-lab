// Teaching notes for "Spin, angular momentum and atoms".

export const TEACHING = {
  'adding-angular-momenta': {
    goals: [
      'Decompose j₁ ⊗ j₂ into total J = |j₁ − j₂|, …, j₁ + j₂ and check the state count.',
      'Build the triplet and singlet of two spin-½ particles.',
      'Read and use a Clebsch–Gordan table.',
      'Apply L·S = [J² − L² − S²]/2 to fine-structure splitting.',
    ],
    prereqs: ['Angular momentum and ladder operators'],
    misconceptions: [
      { wrong: '↑↓ is a state of definite total spin.', right: 'It is an equal mix of the triplet M = 0 state and the singlet.' },
      { wrong: 'Coupling changes the number of states.', right: 'It only changes the basis: (2j₁+1)(2j₂+1) = Σ(2J+1).' },
    ],
    questions: [
      {
        q: 'Which J values appear in 3/2 ⊗ 1?',
        options: ['5/2, 3/2, 1/2', '5/2 and 1/2', '2, 1, 0', '3/2 only'],
        answer: 0,
        why: 'From |3/2 − 1| = 1/2 to 3/2 + 1 = 5/2 in whole steps.',
      },
      {
        q: 'The singlet of two spin-½ particles is…',
        options: ['(↑↓ + ↓↑)/√2', '(↑↓ − ↓↑)/√2', '↑↑', '(↑↑ − ↓↓)/√2'],
        answer: 1,
        why: 'J = 0 is the antisymmetric combination; the symmetric one is the triplet’s M = 0 state.',
      },
      {
        q: 'For a p electron (l = 1, s = ½), how many states end up with J = 3/2?',
        options: ['2', '3', '4', '6'],
        answer: 2,
        why: '2J + 1 = 4; the remaining 2 have J = ½.',
      },
    ],
  },
  'angular-momentum': {
    goals: [
      'State the commutation relations of angular momentum and what they imply for measurements.',
      'Use the ladder operators to derive m = −j, …, j and |J| = √(j(j+1))ħ.',
      'Explain integer (orbital) versus half-integer (spin) j.',
      'Compute Stern–Gerlach probabilities for spin j along a tilted axis.',
    ],
    prereqs: ['Stern–Gerlach', 'Matrices and eigenvalues'],
    misconceptions: [
      { wrong: 'In the state m = j the angular momentum points along z.', right: 'Its length √(j(j+1))ħ exceeds jħ; Jx and Jy remain uncertain.' },
      { wrong: 'The vector model’s precession is a real motion.', right: 'It only pictures the uncertainty of Jx and Jy in a stationary state.' },
    ],
    questions: [
      {
        q: 'How many values of m does j = 3/2 allow?',
        options: ['3', '4', '5', '2'],
        answer: 1,
        why: '2j + 1 = 4: m = 3/2, 1/2, −1/2, −3/2.',
      },
      {
        q: 'J₊|1, 0⟩ equals…',
        options: ['|1, 1⟩', '√2 |1, 1⟩', '0', '2|1, 1⟩'],
        answer: 1,
        why: '√(j(j+1) − m(m+1)) = √(2 − 0) = √2 (in units of ħ).',
      },
      {
        q: 'A spin-1 particle in |1, 1⟩ meets a magnet tilted by 90°. What is the chance of m′ = 0?',
        options: ['1/3', '1/4', '1/2', '0'],
        answer: 2,
        why: 'P = C(2,1) cos²(45°) sin²(45°) = 2 × ½ × ½ = ½.',
      },
    ],
  },
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
