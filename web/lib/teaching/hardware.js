// Teaching notes for the hardware section.

export const TEACHING = {
  'randomized-benchmarking': {
    goals: [
      'Describe the randomized benchmarking protocol with Clifford sequences and an inverting gate.',
      'Explain why the average survival decays as A f^m + B and relate f to the error per gate.',
      'Explain why RB separates gate errors from state-preparation and measurement errors.',
      'Discuss what RB does not capture: coherent error build-up in specific circuits, leakage, gate dependence.',
    ],
    prereqs: ['Decoherence and the Bloch sphere'],
    misconceptions: [
      { wrong: 'RB measures the error of one particular gate.', right: 'It measures the average error per Clifford; interleaved RB isolates a specific gate.' },
      { wrong: 'Coherent errors break RB.', right: 'Twirling still gives an exponential decay; RB reports their average effect, which can understate their worst case.' },
      { wrong: 'Readout errors bias the RB error rate.', right: 'They affect A and B only; the decay rate f is unaffected.' },
    ],
    questions: [
      {
        q: 'A fit gives f = 0.998. What is the error per Clifford?',
        options: ['0.002', '0.001', '0.998', '0.004'],
        answer: 1,
        why: 'r = (1 − f)/2 = 0.001 for a single qubit.',
      },
      {
        q: 'Why are Clifford gates used for the random sequences?',
        options: ['They are fast', 'They form a unitary 2-design that twirls noise into a depolarizing channel, and the inverse is easy to compute', 'They have no errors', 'They are universal'],
        answer: 1,
        why: 'Twirling makes the decay a single exponential, and Clifford sequences can be inverted efficiently.',
      },
      {
        q: 'What survival probability does a long sequence approach with depolarizing noise?',
        options: ['0', '1/2', '1', 'f'],
        answer: 1,
        why: 'The state becomes maximally mixed: B = 1/2 for unital noise without SPAM errors.',
      },
    ],
  },
  drag: {
    goals: [
      'Describe single-qubit gates as shaped microwave pulses in the rotating frame.',
      'Explain leakage to the second excited state of a transmon and why short pulses cause it.',
      'Describe the DRAG correction and the different optima for leakage and phase error.',
      'Explain virtual Z gates and the speed–fidelity trade-off.',
    ],
    prereqs: ['Building a qubit: the transmon', 'Magnetic resonance and Rabi oscillations'],
    misconceptions: [
      { wrong: 'A shorter pulse is always better because of decoherence.', right: 'Short pulses have broad spectra that drive the nearby 1–2 transition and leak out of the qubit.' },
      { wrong: 'Removing leakage removes the gate error.', right: 'The remaining error is mostly a phase error, minimised at a different DRAG coefficient.' },
      { wrong: 'Z rotations need a physical pulse.', right: 'They can be applied virtually by shifting the phase of later pulses.' },
    ],
    questions: [
      {
        q: 'What does DRAG add to the pulse?',
        options: ['A second Gaussian on X', 'The time derivative of the envelope on the other quadrature', 'A DC offset', 'A pulse on level 2'],
        answer: 1,
        why: 'Ω_y = −β Ω̇_x / α cancels the drive’s effect on the 1–2 transition to first order.',
      },
      {
        q: 'In this simulation, which β minimises leakage for an 8 ns pulse?',
        options: ['0', 'about 0.5', 'about 1', 'about 2'],
        answer: 2,
        why: 'Leakage falls from 2 × 10⁻³ to 6 × 10⁻⁶ at β = 1.',
      },
      {
        q: 'Why does a Gaussian π pulse flip a two-level system exactly, regardless of its length?',
        options: ['It is a coincidence', 'On resonance only the pulse area matters (area theorem)', 'Because of DRAG', 'It does not'],
        answer: 1,
        why: 'For a resonant two-level system the rotation angle equals the integrated Rabi frequency.',
      },
    ],
  },
  transmon: {
    goals: [
      'Write the Hamiltonian of a capacitively shunted Josephson junction in terms of E_C and E_J.',
      'Explain charge dispersion and why the transmon regime suppresses it exponentially.',
      'Describe the transmon as an anharmonic oscillator and estimate its frequency and anharmonicity.',
      'Relate qubit frequencies to the need for millikelvin temperatures.',
    ],
    prereqs: ['The harmonic oscillator'],
    misconceptions: [
      { wrong: 'A transmon is a two-level system.', right: 'It is a weakly anharmonic oscillator; only the lowest two levels are used, and level 2 is close by.' },
      { wrong: 'Increasing E_J/E_C costs as much anharmonicity as it removes charge noise.', right: 'Charge dispersion falls exponentially while the anharmonicity falls only slowly towards −E_C.' },
      { wrong: 'Superconducting qubits need low temperature only for superconductivity.', right: 'Also so that k_B T ≪ h f₀₁ and the qubit starts and stays in its ground state.' },
    ],
    questions: [
      {
        q: 'Roughly what is the qubit frequency for E_C/h = 0.25 GHz and E_J/E_C = 50?',
        options: ['250 MHz', 'about 4.7 GHz', '50 GHz', '12.5 GHz'],
        answer: 1,
        why: '√(8E_JE_C) − E_C = √(8 × 12.5 × 0.25) − 0.25 ≈ 4.75 GHz.',
      },
      {
        q: 'How does the charge dispersion scale with E_J/E_C?',
        options: ['Linearly', 'As a power law', 'Exponentially, as e^{−√(8E_J/E_C)}', 'It does not change'],
        answer: 2,
        why: 'Tunnelling between neighbouring wells of the cosine potential is exponentially suppressed.',
      },
      {
        q: 'What is the transmon’s anharmonicity at large E_J/E_C?',
        options: ['Zero', 'About −E_C', 'About +E_J', 'About √(8E_JE_C)'],
        answer: 1,
        why: 'The first quartic correction to the cosine gives f₁₂ − f₀₁ ≈ −E_C/h.',
      },
    ],
  },
};
