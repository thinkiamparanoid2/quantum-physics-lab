// Teaching notes for the hardware section.

export const TEACHING = {
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
