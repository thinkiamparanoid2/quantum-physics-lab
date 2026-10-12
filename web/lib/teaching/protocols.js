// Teaching notes for "Protocols".

export const TEACHING = {
  teleportation: {
    goals: [
      'Walk through the teleportation circuit and the four measurement outcomes.',
      'Explain why two classical bits are needed and why nothing travels faster than light.',
      'Explain why teleportation does not violate no-cloning.',
    ],
    prereqs: ['Entanglement', 'Measurement', 'Classically controlled gates'],
    misconceptions: [
      { wrong: 'Teleportation moves the qubit’s matter or energy.', right: 'Only the quantum state moves, using a shared Bell pair and two classical bits.' },
      { wrong: 'Bob has the state as soon as Alice measures.', right: 'Until he gets her two bits his qubit is, on average, completely random.' },
    ],
    questions: [
      {
        q: 'How many classical bits must Alice send per teleported qubit?',
        options: ['0', '1', '2', 'Infinitely many'],
        answer: 2,
        why: 'Her two measurement results tell Bob which of four corrections (I, X, Z, XZ) to apply.',
      },
      {
        q: 'Alice measures m0 = 1, m1 = 0. Bob applies…',
        options: ['nothing', 'X', 'Z', 'X then Z'],
        answer: 2,
        why: 'm1 controls X and m0 controls Z, so only Z.',
      },
      {
        q: 'Why doesn’t teleportation copy the state?',
        options: ['Bob’s copy is noisy', 'Alice’s original is destroyed by her measurement', 'It does copy it', 'The Bell pair absorbs it'],
        answer: 1,
        why: 'Alice’s qubits collapse to a definite outcome, so only Bob ends up with the state.',
      },
    ],
  },
  'superdense-coding': {
    goals: [
      'Send two classical bits by transmitting one qubit of a Bell pair.',
      'Show the four encodings map to the four orthogonal Bell states.',
      'Explain why the total resource count doesn’t beat classical limits.',
    ],
    prereqs: ['Bell states', 'Teleportation (the mirror image)'],
    misconceptions: [
      { wrong: 'One qubit can carry unlimited classical information.', right: 'On its own a qubit carries at most one bit (Holevo); superdense coding needs a pre-shared entangled qubit.' },
    ],
    questions: [
      {
        q: 'To send the bits 11, Alice applies to her half…',
        options: ['X', 'Z', 'X then Z', 'nothing'],
        answer: 2,
        why: 'Bit b2 = 1 means X and bit b1 = 1 means Z; both are applied.',
      },
      {
        q: 'Why can Bob decode all four messages perfectly?',
        options: ['The four Bell states are orthogonal', 'He guesses well', 'Alice also sends bits', 'He measures twice'],
        answer: 0,
        why: 'Orthogonal states can be distinguished with certainty, here by CNOT and H then measurement.',
      },
      {
        q: 'How many qubits in total cross between Alice and Bob, counting the Bell pair’s distribution?',
        options: ['1', '2', '4', '0'],
        answer: 1,
        why: 'One qubit of the pair had to reach Bob earlier, plus the one Alice sends: two qubits for two bits.',
      },
    ],
  },
  bb84: {
    goals: [
      'Run BB84: random bits and bases, sifting, and error checking.',
      'Explain why an intercept-resend eavesdropper causes 25% errors.',
      'Compute the chance an eavesdropper stays hidden after k checks.',
    ],
    prereqs: ['Measurement in two bases'],
    misconceptions: [
      { wrong: 'BB84 encrypts the message with quantum states.', right: 'It only establishes a shared secret key; the message is then encrypted classically.' },
      { wrong: 'Any error means there is an eavesdropper.', right: 'Real channels are noisy; the protocol tolerates error rates up to about 11% with classical post-processing.' },
    ],
    questions: [
      {
        q: 'Roughly what fraction of photons survive sifting?',
        options: ['1/4', '1/2', '3/4', 'All'],
        answer: 1,
        why: 'Alice and Bob choose the same basis half the time.',
      },
      {
        q: 'An intercept-resend Eve causes what error rate in the sifted key?',
        options: ['0%', '12.5%', '25%', '50%'],
        answer: 2,
        why: 'She picks the wrong basis half the time, and then Bob’s bit is wrong half the time.',
      },
      {
        q: 'After comparing 20 key bits with no errors, the chance Eve was there and stayed hidden is about…',
        options: ['25%', '3%', '0.3%', '0%'],
        answer: 2,
        why: '(3/4)²⁰ ≈ 0.003.',
      },
    ],
  },
};
