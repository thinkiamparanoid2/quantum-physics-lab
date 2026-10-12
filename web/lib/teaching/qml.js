// Teaching notes for the quantum machine learning section.

export const TEACHING = {
  'vqe-qaoa': {
    goals: [
      'Describe the variational quantum eigensolver loop and the variational principle.',
      'Explain correlation energy and why Hartree–Fock fails as H₂ dissociates.',
      'Describe QAOA for MaxCut and read its approximation ratio.',
      'Weigh these algorithms against strong classical methods honestly.',
    ],
    prereqs: ['A classifier that trains while you watch'],
    misconceptions: [
      { wrong: 'VQE can report an energy below the true ground state if it is lucky.', right: 'Without noise ⟨H⟩ ≥ E₀ for every state; only noise or bugs can go below.' },
      { wrong: 'Simulating H₂ on a quantum computer shows a quantum advantage for chemistry.', right: 'H₂ in a minimal basis is a 2 × 2 problem; useful chemistry needs far larger, error-corrected machines.' },
      { wrong: 'QAOA always finds the best cut.', right: 'At small depth it gives an approximation; only as p → ∞ does it become exact.' },
    ],
    questions: [
      {
        q: 'At equilibrium the H₂ correlation energy is about 21 mHa. Is Hartree–Fock within chemical accuracy (1.6 mHa)?',
        options: ['Yes', 'No, it is off by more than ten times that', 'Only at large bond lengths', 'Chemical accuracy does not apply'],
        answer: 1,
        why: '21 mHa is about 13 times 1.6 mHa.',
      },
      {
        q: 'What does the QAOA approximation ratio measure?',
        options: ['Circuit depth', 'Expected cut divided by the maximum cut', 'Probability of any cut', 'Number of edges'],
        answer: 1,
        why: '⟨C⟩ / C_max: 1 means the maximum cut is always found.',
      },
      {
        q: 'Why does one parameter suffice for H₂ in STO-3G?',
        options: ['H₂ has only one electron', 'Symmetry limits the ground state to two configurations', 'The basis has one orbital', 'VQE always needs one parameter'],
        answer: 1,
        why: 'Particle number and spatial symmetry leave only |1100⟩ and |0011⟩ to mix.',
      },
    ],
  },
  'barren-plateaus': {
    goals: [
      'Define a barren plateau through the variance of gradients over random initialisations.',
      'Show that global costs plateau even in shallow circuits while local costs need not.',
      'Explain why deep random circuits and hardware noise flatten landscapes.',
      'Explain the tension between trainability and classical simulability.',
    ],
    prereqs: ['A classifier that trains while you watch'],
    misconceptions: [
      { wrong: 'A better optimiser fixes a barren plateau.', right: 'The gradients are exponentially small everywhere; estimating them needs exponentially many shots, whatever the optimiser.' },
      { wrong: 'Barren plateaus depend only on the circuit.', right: 'They also depend on the cost: global observables plateau where local ones stay trainable.' },
      { wrong: 'Avoiding barren plateaus guarantees a useful quantum model.', right: 'The structure that avoids them often makes the model classically simulable.' },
    ],
    questions: [
      {
        q: 'Gradient variance falls by about half per added qubit. Going from 10 to 30 qubits divides it by about…',
        options: ['3', '20', '1000', 'a million'],
        answer: 3,
        why: '2²⁰ ≈ 10⁶.',
      },
      {
        q: 'Which cost keeps gradients large for shallow circuits?',
        options: ['⟨Z⊗Z⊗…⊗Z⟩ on all qubits', '⟨Z₀⟩ on one qubit', 'Both', 'Neither'],
        answer: 1,
        why: 'Local costs avoid the plateau at shallow depth (Cerezo et al. 2021).',
      },
      {
        q: 'Roughly how many shots does it take to resolve a gradient of size 0.01?',
        options: ['10', '100', '10 000', '10⁸'],
        answer: 2,
        why: 'Shot noise scales as 1/√shots, so about 1/ε² = 10⁴.',
      },
    ],
  },
  'quantum-kernels': {
    goals: [
      'Define a quantum kernel as the overlap of encoded states and say how hardware estimates it.',
      'Train a kernel classifier by solving a linear system (kernel ridge regression).',
      'Explain the role of bandwidth and the problem of kernel concentration.',
      'Compare quantum kernels with classical baselines honestly.',
    ],
    prereqs: ['Encoding data'],
    misconceptions: [
      { wrong: 'Any kernel computed on a quantum computer is hard to compute classically.', right: 'Product-state encodings give classical product formulas; hardness needs more, and is not guaranteed.' },
      { wrong: 'Quantum kernels beat classical ones on typical data.', right: 'Benchmarks find classical kernels usually match or beat them; proven advantages use special structured problems.' },
      { wrong: 'Training a kernel model suffers from barren plateaus.', right: 'The training step is a convex linear-algebra problem; the difficulty moves to estimating the kernel values.' },
    ],
    questions: [
      {
        q: 'How is k(x, x′) estimated on a quantum computer?',
        options: ['By measuring ⟨Z⟩ once', 'Run U(x), then U(x′)†, and estimate the probability of returning to |0…0⟩', 'By tomography of both states', 'It cannot be'],
        answer: 1,
        why: 'That probability is |⟨0|U(x′)†U(x)|0⟩|² = |⟨φ(x′)|φ(x)⟩|².',
      },
      {
        q: 'What happens to a kernel matrix when overlaps concentrate near zero?',
        options: ['It becomes all ones', 'It approaches the identity and the model cannot generalise', 'Training becomes faster', 'Nothing important'],
        answer: 1,
        why: 'Every point looks unrelated to every other, so the model just memorises the training labels.',
      },
      {
        q: 'Why does angle encoding not give a hard-to-compute kernel?',
        options: ['It uses too few qubits', 'Its states are products, so the overlap is a product of single-qubit overlaps', 'It is not normalised', 'It uses RY gates'],
        answer: 1,
        why: 'k = Π cos²((xᵢ − x′ᵢ)/2) up to scaling, which is a classical formula.',
      },
    ],
  },
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
