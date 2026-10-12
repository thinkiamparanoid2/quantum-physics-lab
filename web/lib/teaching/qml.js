// Teaching notes for the quantum machine learning section.

export const TEACHING = {
  'fourier-models': {
    goals: [
      'Show that a re-uploading quantum model is a Fourier series in its input.',
      'Relate the number of data uploads to the frequencies the model can contain.',
      'Explain why having the right frequencies does not guarantee the right coefficients.',
      'Compare a quantum model with the classical least-squares Fourier series of the same degree.',
    ],
    prereqs: ['A classifier that trains while you watch'],
    misconceptions: [
      { wrong: 'More trainable gates let the model represent any function.', right: 'The data encoding fixes the available frequencies; trainable gates only set coefficients.' },
      { wrong: 'A quantum model with the right frequencies can fit any target with them.', right: 'Its coefficients are constrained by the circuit; a small model may not reach every combination.' },
      { wrong: 'Quantum models must outperform classical ones on these tasks.', right: 'On its training data a degree-L quantum model cannot beat the least-squares Fourier series of degree L.' },
    ],
    questions: [
      {
        q: 'A one-qubit model uploads x four times with RX(x). Which frequencies can its output contain?',
        options: ['Only 4', '0 to 4', '0 to 8', 'Any'],
        answer: 1,
        why: 'Each upload contributes ±1/2 to the phase, so |k| ≤ 4.',
      },
      {
        q: 'Uploading RX(2x) instead of RX(x) once gives frequencies…',
        options: ['0 and 1', '0 and 2', '0, 1 and 2', 'Only 2'],
        answer: 1,
        why: 'The eigenvalue phases are ±x, so the differences are 0 and ±2.',
      },
      {
        q: 'Why can the classical degree-L least-squares fit never lose to the quantum model on the training points?',
        options: ['It uses more data', 'It is the optimum over all degree-L trigonometric polynomials, which include the quantum model', 'It is quantum-inspired', 'It isn’t; the quantum model can win'],
        answer: 1,
        why: 'The quantum model is one particular degree-L trigonometric polynomial; least squares finds the best one.',
      },
    ],
  },
  'qml-classifier': {
    goals: [
      'Describe a variational classifier built from a data re-uploading circuit.',
      'Apply the parameter-shift rule to get exact gradients from circuit runs.',
      'Follow gradient-based training and read loss and accuracy curves.',
      'Distinguish training accuracy from test accuracy and explain why depth matters.',
    ],
    prereqs: ['Encoding data'],
    misconceptions: [
      { wrong: 'Parameter-shift is a finite-difference approximation.', right: 'For rotation gates it is exact: shifts of ±π/2 give the true derivative.' },
      { wrong: 'More parameters always means a more expressive model.', right: 'For re-uploading models the number of data re-uploads limits which functions are possible.' },
      { wrong: 'High training accuracy means the model has learned the pattern.', right: 'Only accuracy on unseen test data shows generalisation.' },
    ],
    questions: [
      {
        q: 'How many circuit evaluations does the parameter-shift rule need for the gradient of one output with 12 parameters?',
        options: ['1', '12', '24', '144'],
        answer: 2,
        why: 'Two shifted runs per parameter.',
      },
      {
        q: 'Why does the one-layer model fail on the circle dataset?',
        options: ['Too few training points', 'It can only represent low-frequency functions of each feature', 'The optimizer is broken', 'Circles cannot be learned'],
        answer: 1,
        why: 'Each feature enters once, so the output contains only frequency 1 in it; a closed boundary needs more.',
      },
      {
        q: 'A model scores 95% on training data and 70% on test data. This suggests…',
        options: ['Underfitting', 'Overfitting', 'A perfect model', 'A bug in the test set'],
        answer: 1,
        why: 'It fits the training sample better than the underlying pattern.',
      },
    ],
  },
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
