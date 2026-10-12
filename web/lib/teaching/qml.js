// Teaching notes for the quantum machine learning section.

export const TEACHING = {
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
