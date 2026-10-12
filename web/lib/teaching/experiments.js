// Teaching notes for "The experiments that started it".

export const TEACHING = {
  photoelectric: {
    goals: [
      'Explain why the stopping voltage depends on the light’s frequency but not its brightness.',
      'Use eV₀ = hf − φ to read Planck’s constant and the work function off a straight-line plot.',
      'State which observations the wave picture of light cannot explain.',
    ],
    prereqs: ['Photon energy E = hf', 'Kinetic energy and electric potential energy (eV)'],
    misconceptions: [
      { wrong: 'Brighter light makes the electrons come out faster.', right: 'Brightness sets how many photons arrive, so it changes the current, not the fastest electron’s energy.' },
      { wrong: 'Given enough time, dim red light will eventually free electrons.', right: 'Below the threshold frequency no single photon has enough energy, and energy is not saved up between photons.' },
    ],
    questions: [
      {
        q: 'Light on a metal frees electrons. You double the brightness and keep the colour. What happens to the stopping voltage?',
        options: ['It doubles', 'It stays the same', 'It halves', 'It rises a little'],
        answer: 1,
        why: 'The stopping voltage measures the fastest electron’s kinetic energy, hf − φ, which depends only on the photon energy.',
      },
      {
        q: 'In a plot of stopping voltage V₀ against frequency f, what is the slope?',
        options: ['h', 'h/e', 'φ/e', 'e/h'],
        answer: 1,
        why: 'eV₀ = hf − φ, so V₀ = (h/e) f − φ/e: the slope is h/e for every metal.',
      },
      {
        q: 'Cesium (φ = 2.14 eV) and platinum (φ = 5.65 eV) are both lit with 300 nm light (4.1 eV per photon). Which emits electrons?',
        options: ['Both', 'Only cesium', 'Only platinum', 'Neither'],
        answer: 1,
        why: 'Photons of 4.1 eV exceed cesium’s work function but not platinum’s.',
      },
    ],
  },
  compton: {
    goals: [
      'Derive the Compton shift Δλ = (h/mc)(1 − cos θ) from energy and momentum conservation.',
      'Explain why the shift is invisible for visible light but large for X-rays.',
      'Interpret the two peaks in a Compton spectrum.',
    ],
    prereqs: ['Photon momentum p = h/λ', 'Relativistic energy of an electron'],
    misconceptions: [
      { wrong: 'The wavelength shift depends on the incoming wavelength.', right: 'Δλ depends only on the angle; what changes with λ is how big the shift is compared with λ.' },
      { wrong: 'The unshifted peak means some photons missed the electrons.', right: 'It comes from photons scattering off tightly bound electrons, where the whole atom recoils and h/Mc is tiny.' },
    ],
    questions: [
      {
        q: 'At what scattering angle is the wavelength shift largest?',
        options: ['0°', '90°', '180°', 'It is the same at every angle'],
        answer: 2,
        why: '1 − cos θ is largest (2) for back-scattering, giving Δλ = 2h/mc ≈ 4.85 pm.',
      },
      {
        q: 'Why did nobody see the Compton effect with visible light?',
        options: ['Visible photons carry no momentum', 'The shift (picometres) is tiny next to 500 nm', 'Visible light doesn’t scatter', 'Electrons absorb all visible light'],
        answer: 1,
        why: 'The shift is at most 4.85 pm whatever the wavelength, about one part in 100,000 of visible light.',
      },
      {
        q: 'What does the Compton effect show about light?',
        options: ['It is only a wave', 'Photons carry momentum h/λ', 'Photons have rest mass', 'Electrons are waves'],
        answer: 1,
        why: 'Treating the photon as a particle with momentum h/λ in a billiard-ball collision predicts the measured shift exactly.',
      },
    ],
  },
  'double-slit': {
    goals: [
      'Describe how single, random hits build up an interference pattern.',
      'Predict the fringe spacing λL/d and how it changes for electrons.',
      'Explain why which-path information destroys the fringes.',
    ],
    prereqs: ['Waves and path difference', 'de Broglie wavelength λ = h/p'],
    misconceptions: [
      { wrong: 'Each particle goes through one slit; the pattern comes from particles interfering with each other.', right: 'The pattern appears even when particles arrive one at a time: each one interferes with itself.' },
      { wrong: 'Any detector near the slits destroys the pattern because it disturbs the particle.', right: 'What matters is whether path information is recorded; a weak marker reduces the visibility in proportion.' },
    ],
    questions: [
      {
        q: 'Particles are sent one at a time. What does the screen show after 10,000 have arrived?',
        options: ['Two bright bands behind the slits', 'An interference pattern', 'A uniform smear', 'Nothing until the particles interact'],
        answer: 1,
        why: 'Each hit lands at a random place, but the probability follows |ψ₁ + ψ₂|², which has fringes.',
      },
      {
        q: 'You double the slit separation d. The fringe spacing…',
        options: ['doubles', 'halves', 'stays the same', 'quadruples'],
        answer: 1,
        why: 'Bright fringes are spaced by λL/d.',
      },
      {
        q: 'A detector marks which slit each particle used, perfectly. The pattern becomes…',
        options: ['sharper fringes', 'the sum of two single-slit patterns', 'nothing at all', 'shifted by half a fringe'],
        answer: 1,
        why: 'With the paths distinguishable, probabilities add instead of amplitudes: |ψ₁|² + |ψ₂|².',
      },
    ],
  },
  'mach-zehnder': {
    goals: [
      'Track amplitudes through two beam splitters and show why one detector stays dark.',
      'Explain how a phase shift moves photons between the detectors.',
      'Connect the interferometer to a qubit circuit.',
    ],
    prereqs: ['Complex amplitudes as arrows', 'Probability = |amplitude|²'],
    misconceptions: [
      { wrong: 'The photon secretly takes one arm or the other.', right: 'If it did, both detectors would click half the time; the dark detector shows both paths contribute.' },
      { wrong: 'Blocking one arm can only reduce the counts at every detector.', right: 'Blocking an arm removes the cancellation, so the dark detector starts clicking.' },
    ],
    questions: [
      {
        q: 'With both arms open and no phase shift, how often does the dark detector D2 click?',
        options: ['Never', 'Half the time', 'A quarter of the time', 'Always'],
        answer: 0,
        why: 'The two amplitudes reaching D2 are equal and opposite, so they cancel.',
      },
      {
        q: 'You block arm b. What fraction of photons now reach D2?',
        options: ['0', '1/4', '1/2', '1'],
        answer: 1,
        why: 'Half are absorbed by the block; the half that took arm a splits evenly at the second splitter.',
      },
      {
        q: 'Which circuit has the same statistics as the interferometer with phase φ?',
        options: ['H only', 'Rx(−π/2) · P(φ) · Rx(−π/2)', 'X · Z', 'Measurement then H'],
        answer: 1,
        why: 'Each 50/50 splitter is an Rx(−π/2) rotation of the path qubit, and the phase shifter is P(φ).',
      },
    ],
  },
  'bomb-tester': {
    goals: [
      'Explain how a live bomb can be identified without a photon touching it.',
      'Compute the Elitzur–Vaidman probabilities: 1/2 explode, 1/4 identified, 1/4 inconclusive.',
      'Describe how the quantum Zeno effect pushes the success rate towards 100%.',
    ],
    prereqs: ['The Mach–Zehnder interferometer'],
    misconceptions: [
      { wrong: 'The photon must have gone through the bomb’s arm to learn about it.', right: 'When the dark detector clicks, the photon was not absorbed; the information comes from the missing interference.' },
      { wrong: 'The bomb tester always works.', right: 'In the simple version half the live bombs explode; only the Zeno version approaches certainty.' },
    ],
    questions: [
      {
        q: 'With a live bomb in arm b, what is the chance it explodes?',
        options: ['1/4', '1/2', '3/4', '1'],
        answer: 1,
        why: 'The photon reaches arm b with probability 1/2, and the bomb absorbs it there.',
      },
      {
        q: 'The dark detector D2 clicks. What do you conclude?',
        options: ['The bomb is a dud', 'The bomb is live', 'Nothing', 'The photon was absorbed'],
        answer: 1,
        why: 'With a dud, D2 never clicks. A click proves the interference was destroyed, so the bomb is live.',
      },
      {
        q: 'In the Zeno version with N cycles, the success chance cos(π/2N)^(2N)…',
        options: ['falls to 0', 'stays at 1/4', 'tends to 1', 'oscillates'],
        answer: 2,
        why: 'Each cycle turns the polarisation a little and the bomb keeps resetting it; the losses shrink like π²/4N.',
      },
    ],
  },
};
