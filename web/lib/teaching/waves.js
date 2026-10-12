// Teaching notes for "Waves and the Schrödinger equation".

export const TEACHING = {
  'particle-on-ring': {
    goals: [
      'Derive integer angular momentum from single-valuedness of ψ on a ring.',
      'Explain the ±n degeneracy and why standing waves on a ring carry no current.',
      'Predict the revival time 4πR² (ħ = m = 1) from the n² spectrum.',
      'Describe the Aharonov–Bohm shift Eₙ = (n − Φ/Φ₀)²/2R² and persistent currents.',
    ],
    prereqs: ['Particle in a box', 'Probability current'],
    misconceptions: [
      { wrong: 'Like a box, a ring has a zero-point energy.', right: 'With no walls, n = 0 (a constant ψ) is allowed and has zero energy.' },
      { wrong: 'A magnetic field must act on the particle to change its energy.', right: 'A flux through the hole changes the spectrum even where the field on the ring is zero (Aharonov–Bohm).' },
    ],
    questions: [
      {
        q: 'On a ring of radius 1 (ħ = m = 1), what is the energy of the n = 2 state?',
        options: ['1', '2', '4', '0.5'],
        answer: 1,
        why: 'Eₙ = n²/(2R²) = 4/2 = 2.',
      },
      {
        q: 'Why must n be an integer?',
        options: ['Energy conservation', 'ψ must return to itself after going once around', 'The ring has walls', 'Spin'],
        answer: 1,
        why: 'e^(in(φ + 2π)) = e^(inφ) requires e^(2πin) = 1.',
      },
      {
        q: 'At flux Φ = ½ flux quantum, which two levels are degenerate in the ground state?',
        options: ['n = 0 and n = −1', 'n = 0 and n = 1', 'n = 1 and n = −1', 'None'],
        answer: 1,
        why: '(0 − ½)² = (1 − ½)² = ¼, so n = 0 and n = 1 have the same lowest energy.',
      },
    ],
  },
  'delta-potential': {
    goals: [
      'Derive the derivative jump ψ′(0⁺) − ψ′(0⁻) = −2αψ(0) at a delta spike (ħ = m = 1).',
      'Find the single bound state E = −α²/2 and its size 1/α.',
      'Compute T = 1/(1 + α²/2E) and explain why it is the same for attractive and repulsive spikes.',
      'Describe bonding and antibonding states of the double delta.',
    ],
    prereqs: ['Particle in a box', 'Tunnelling and scattering'],
    misconceptions: [
      { wrong: 'A very weak attractive spike has no bound state.', right: 'In one dimension any attractive potential binds at least one state; only its size grows as α shrinks.' },
      { wrong: 'A well always lets waves through more easily than a barrier.', right: 'For a delta spike T depends only on α², so the two transmit identically.' },
    ],
    questions: [
      {
        q: 'Doubling α changes the bound-state energy by a factor of…',
        options: ['2', '4', '1/2', '√2'],
        answer: 1,
        why: 'E = −α²/2 scales as α².',
      },
      {
        q: 'At E = α²/2, the transmission through the spike is…',
        options: ['0', '25%', '50%', '100%'],
        answer: 2,
        why: 'T = 1/(1 + α²/2E) = 1/(1 + 1) = 1/2.',
      },
      {
        q: 'Two attractive spikes at ±a with αa = 0.4 have how many bound states?',
        options: ['0', '1', '2', 'Infinitely many'],
        answer: 1,
        why: 'The odd state needs αa > 1/2, so only the even (bonding) state survives.',
      },
    ],
  },
  'probability-current': {
    goals: [
      'Define the probability current j = (ħ/m) Im(ψ*∂ψ/∂x) and interpret it as density × velocity.',
      'Show that real wavefunctions (stationary states) carry no current.',
      'Use the continuity equation to account for probability crossing a point.',
      'Explain why transmission at a step is a ratio of currents, not of amplitudes.',
    ],
    prereqs: ['Wave packets', 'Tunnelling and scattering'],
    misconceptions: [
      { wrong: 'A stationary state in a box has the particle moving back and forth.', right: 'Its current is zero everywhere; nothing about |ψ|² changes in time.' },
      { wrong: 'The transmission probability is |t|², the squared amplitude of the transmitted wave.', right: 'Only when the speeds on both sides are equal; in general T = (v_out/v_in)|t|².' },
    ],
    questions: [
      {
        q: 'ψ = A e^(ikx) with ħ = m = 1 carries current…',
        options: ['0', '|A|² k', '|A|²', 'k/|A|²'],
        answer: 1,
        why: 'Im(ψ*ψ′) = |A|² k.',
      },
      {
        q: 'ψ = e^(ikx) + r e^(−ikx) on the left of a barrier carries current…',
        options: ['k', 'k(1 − |r|²)', 'k(1 + |r|²)', '0'],
        answer: 1,
        why: 'The incident and reflected waves contribute k and −k|r|²; the cross terms carry no net current.',
      },
      {
        q: 'Probability beyond a point grows at rate 0.02 per second. What is the current at that point?',
        options: ['0.02, flowing right', '0.02, flowing left', '0', 'It can’t be known'],
        answer: 0,
        why: 'Continuity: dP(x > x₀)/dt = j(x₀).',
      },
    ],
  },
  'wave-packets': {
    goals: [
      'Relate a packet’s wavelength to its momentum and its width to the spread of momenta.',
      'State and check the uncertainty relation Δx·Δp ≥ ħ/2.',
      'Explain why a narrow packet spreads faster.',
    ],
    prereqs: ['Complex numbers and phase', 'Fourier idea: a narrow shape needs many wavelengths'],
    misconceptions: [
      { wrong: 'Uncertainty comes from clumsy measurement disturbing the particle.', right: 'It is a property of the wavefunction itself: a narrow ψ(x) has a wide spread of momenta.' },
      { wrong: 'A free particle’s packet keeps its shape.', right: 'Different momenta travel at different speeds, so a free packet spreads, faster the narrower it starts.' },
    ],
    questions: [
      {
        q: 'You squeeze a Gaussian packet to half its width. Its momentum spread…',
        options: ['halves', 'stays the same', 'doubles', 'quadruples'],
        answer: 2,
        why: 'For a Gaussian Δx·Δp = ħ/2 exactly, so halving Δx doubles Δp.',
      },
      {
        q: 'Two free Gaussian packets start with widths 1 and 2. Which has the larger width at late times?',
        options: ['The width-1 packet', 'The width-2 packet', 'They end up equal', 'Neither spreads'],
        answer: 0,
        why: 'Late-time width grows like Δp·t/m, and the narrower packet has the larger Δp.',
      },
      {
        q: 'What sets a packet’s average velocity?',
        options: ['Its width', 'The wavelength of its ripples, through p = h/λ', 'The height of |ψ|²', 'Its phase at x = 0'],
        answer: 1,
        why: 'The mean momentum is ħk₀ = h/λ, so the group moves at ħk₀/m.',
      },
    ],
  },
  'particle-in-a-box': {
    goals: [
      'Derive Eₙ = n²π²ħ²/(2mL²) from fitting standing waves between walls.',
      'Explain why stationary states have time-independent |ψ|².',
      'Describe how superpositions slosh and revive.',
    ],
    prereqs: ['Standing waves', 'The time-dependent phase e^(−iEt/ħ)'],
    misconceptions: [
      { wrong: 'In a stationary state the particle bounces between the walls.', right: 'Its probability density does not change at all; only the overall phase rotates.' },
      { wrong: 'The lowest energy is zero.', right: 'n = 1 is the lowest state, with energy π²ħ²/(2mL²) > 0: the zero-point energy.' },
    ],
    questions: [
      {
        q: 'The box is made twice as wide. The ground-state energy…',
        options: ['doubles', 'halves', 'falls to a quarter', 'is unchanged'],
        answer: 2,
        why: 'Eₙ ∝ 1/L².',
      },
      {
        q: 'How many nodes (zeros inside the box) does the n = 4 state have?',
        options: ['2', '3', '4', '5'],
        answer: 1,
        why: 'The nth state has n − 1 interior nodes.',
      },
      {
        q: 'An equal mix of n = 1 and n = 2 sloshes back and forth. Its period is set by…',
        options: ['E₁ alone', 'E₂ − E₁', 'E₁ + E₂', 'the box width only'],
        answer: 1,
        why: 'The cross term oscillates as cos((E₂ − E₁)t/ħ).',
      },
    ],
  },
  'harmonic-oscillator': {
    goals: [
      'State the evenly spaced levels Eₙ = (n + ½)ħω and the zero-point energy.',
      'Compare quantum and classical probability distributions.',
      'Explain why a coherent state swings without spreading.',
    ],
    prereqs: ['Hooke’s law and simple harmonic motion', 'Stationary states'],
    misconceptions: [
      { wrong: 'The particle is most likely found at the centre for every state.', right: 'Only for low n; at high n it is most likely near the turning points, like the classical oscillator.' },
      { wrong: 'A quantum oscillator can be at rest at the bottom.', right: 'The ground state has energy ½ħω and a nonzero spread of position and momentum.' },
    ],
    questions: [
      {
        q: 'What is the energy gap between neighbouring levels?',
        options: ['ħω/2', 'ħω', 'It grows with n', 'It shrinks with n'],
        answer: 1,
        why: 'Eₙ = (n + ½)ħω, so every gap is ħω.',
      },
      {
        q: 'A coherent state is displaced and released. Its width over time…',
        options: ['grows steadily', 'stays constant', 'shrinks', 'oscillates between two values'],
        answer: 1,
        why: 'A coherent state keeps the ground-state Gaussian shape and its centre follows the classical trajectory.',
      },
      {
        q: 'The weights |cₙ|² of a coherent state over the levels follow which distribution?',
        options: ['Uniform', 'Poisson', 'Gaussian in n with mean 0', 'Only n = 0 and n = 1'],
        answer: 1,
        why: 'A coherent state |α⟩ has |cₙ|² = e^(−|α|²)|α|^(2n)/n!, a Poisson distribution with mean |α|².',
      },
    ],
  },
  tunnelling: {
    goals: [
      'Explain how a wave crosses a barrier higher than its energy.',
      'Estimate how transmission falls with barrier width (∝ e^(−2κb)).',
      'Recognise reflection above a barrier and resonant transmission.',
    ],
    prereqs: ['Wave packets', 'Exponential decay'],
    misconceptions: [
      { wrong: 'Tunnelling means the particle borrows energy for a short time.', right: 'The energy is the same on both sides; the wavefunction simply decays inside the barrier instead of vanishing.' },
      { wrong: 'If E is above the barrier, everything is transmitted.', right: 'Any sudden change of wavelength reflects part of the wave, so T < 1 except at resonances.' },
    ],
    questions: [
      {
        q: 'A barrier’s width doubles (well below its top). Transmission roughly…',
        options: ['halves', 'is squared (falls dramatically)', 'doubles', 'stays the same'],
        answer: 1,
        why: 'T ≈ e^(−2κb), so doubling b squares this small number.',
      },
      {
        q: 'Which tunnels more easily through the same barrier at the same energy deficit?',
        options: ['An electron', 'A proton', 'Both equally', 'Neither can'],
        answer: 0,
        why: 'κ = √(2m(V₀ − E))/ħ grows with mass, so the lighter electron decays more slowly inside.',
      },
      {
        q: 'Two thin barriers can transmit almost 100% at certain energies because…',
        options: ['the barriers cancel each other', 'reflections from the two barriers interfere destructively', 'the particle gains energy between them', 'the barriers melt'],
        answer: 1,
        why: 'At a resonance the wave rings between the barriers and the reflected waves cancel.',
      },
    ],
  },
  'shooting-method': {
    goals: [
      'Integrate the Schrödinger equation for a trial energy and read the boundary condition.',
      'Use bisection and node counting to find any chosen level.',
      'Explain why only discrete energies satisfy both walls.',
    ],
    prereqs: ['Particle in a box', 'Second-order differential equations'],
    misconceptions: [
      { wrong: 'The Schrödinger equation has solutions only at the allowed energies.', right: 'It has a solution for every energy; only the allowed ones also satisfy the boundary condition at the far wall.' },
      { wrong: 'The number of nodes is unrelated to the level.', right: 'The nth level (counting from 0) has exactly n nodes (the oscillation theorem).' },
    ],
    questions: [
      {
        q: 'Shooting at a trial energy, the solution ends far from zero at the right wall. What does that mean?',
        options: ['The energy is allowed', 'The energy is not an eigenvalue', 'The potential is wrong', 'The solver failed'],
        answer: 1,
        why: 'An eigenstate must vanish at the hard wall; a large tail means the trial energy misses.',
      },
      {
        q: 'A trial solution changes sign 3 times between the walls (counting the far wall). How many levels lie below this energy?',
        options: ['2', '3', '4', 'It depends on the potential'],
        answer: 1,
        why: 'By the oscillation theorem, the number of nodes counts the levels below E.',
      },
      {
        q: 'Why does bisection always converge here?',
        options: ['The tail’s sign flips as E crosses each level', 'Energies are integers', 'The solver is exact', 'Nodes never change'],
        answer: 0,
        why: 'The value at the wall changes sign as E crosses an eigenvalue, so halving the bracket closes in on it.',
      },
    ],
  },
};
