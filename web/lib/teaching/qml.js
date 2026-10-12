// Teaching notes for the quantum machine learning section.

export const TEACHING = {
  encoding: {
    goals: [
      'Describe basis, angle and amplitude encoding of classical data.',
      'Compare their qubit and gate costs.',
      'Explain why amplitude encoding’s exponential compression is not free.',
      'Interpret the overlap between encoded states as a similarity measure (a kernel).',
    ],
    prereqs: ['The qubit'],
    misconceptions: [
      { wrong: 'Amplitude encoding gives an exponential speed-up by itself.', right: 'Preparing a general state costs about 2ⁿ gates, and reading amplitudes out needs many shots.' },
      { wrong: 'The encoding is a technical detail.', right: 'It fixes which functions the model can represent and how it measures similarity.' },
      { wrong: 'Angle encoding creates entanglement.', right: 'One rotation per qubit gives a product state; entanglement comes from later gates.' },
    ],
    questions: [
      {
        q: 'How many qubits does angle encoding need for 8 features?',
        options: ['3', '8', '16', '256'],
        answer: 1,
        why: 'One qubit per feature.',
      },
      {
        q: 'Under basis encoding, what overlap can two different data points have?',
        options: ['Any value between 0 and 1', 'Only 0 or 1', 'Always 1/2', 'Always 0'],
        answer: 1,
        why: 'They map to computational basis states, which are either equal or orthogonal.',
      },
      {
        q: 'Amplitude encoding of the vectors (1, 1, 0, 0) and (2, 2, 0, 0) gives…',
        options: ['Orthogonal states', 'The same state', 'Overlap 1/2', 'An error'],
        answer: 1,
        why: 'The vector is normalised, so only its direction matters.',
      },
    ],
  },
};
