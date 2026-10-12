// Teaching notes for "Algorithms".

export const TEACHING = {
  'adiabatic-qc': {
    goals: [
      'Encode an optimisation problem as the ground state of an Ising Hamiltonian.',
      'Describe the adiabatic algorithm: interpolate from an easy Hamiltonian to the problem Hamiltonian.',
      'Relate the required run time to the minimum spectral gap.',
      'Explain why small gaps make some instances hard, and what is known about quantum annealing.',
    ],
    prereqs: ['The adiabatic theorem and Berry phase'],
    misconceptions: [
      { wrong: 'Running slowly always guarantees the answer quickly.', right: 'The needed time scales like 1/Δ², which can grow exponentially with problem size.' },
      { wrong: 'Quantum annealers have shown an exponential speed-up for optimisation.', right: 'No scaling advantage over the best classical heuristics has been established for useful problems.' },
      { wrong: 'The adiabatic model is weaker than circuits.', right: 'With general Hamiltonians it is polynomially equivalent to the circuit model.' },
    ],
    questions: [
      {
        q: 'What does a very fast (sudden) anneal on n spins return?',
        options: ['The answer', 'A uniformly random configuration', 'The highest-energy state', 'Nothing'],
        answer: 1,
        why: 'The state is still |+…+⟩, so every configuration has probability 1/2ⁿ.',
      },
      {
        q: 'The minimum gap of an instance is 0.05. Roughly what run time does the rule of thumb suggest?',
        options: ['20', '400', '0.05', '1'],
        answer: 1,
        why: '1/Δ² = 400 (and in practice somewhat more for high success).',
      },
      {
        q: 'Why start from H_B = −ΣX?',
        options: ['It is diagonal', 'Its ground state |+…+⟩ is easy to prepare and it does not commute with H_P', 'It has no gap', 'It equals H_P'],
        answer: 1,
        why: 'A simple known ground state, plus non-commutation so the interpolation can move the state.',
      },
    ],
  },
  'hamiltonian-simulation': {
    goals: [
      'Explain why e^{−iHt} for a sum of non-commuting Pauli terms needs approximation on a gate-based computer.',
      'Compare first- and second-order Trotter formulas and their cost per step.',
      'Describe qDRIFT and why its cost does not depend on the number of terms.',
      'Choose between methods given the Hamiltonian and the accuracy needed.',
    ],
    prereqs: ['Simulating fields on quantum hardware'],
    misconceptions: [
      { wrong: 'qDRIFT is always better because it is randomised.', right: 'It is only first order; for few comparable terms or high accuracy, Trotter wins.' },
      { wrong: 'The Trotter error is given by its commutator bound.', right: 'The bound is often loose; actual errors are frequently much smaller.' },
      { wrong: 'A single qDRIFT run reproduces e^{−iHt}.', right: 'Only the average over runs (a channel) approximates it; each run is one random circuit.' },
    ],
    questions: [
      {
        q: 'Doubling the number of qDRIFT samples changes its error bound by…',
        options: ['×1/4', '×1/2', '×2', 'nothing'],
        answer: 1,
        why: 'The bound is 2λ²t²/N.',
      },
      {
        q: 'What does qDRIFT’s cost depend on instead of the number of terms?',
        options: ['The largest coefficient', 'λ = Σ|h_j|', 'The number of qubits only', 'The commutators'],
        answer: 1,
        why: 'The number of samples scales with λ²t²/ε.',
      },
      {
        q: 'Second-order Trotter infidelity falls how fast with the number of steps N?',
        options: ['1/N', '1/N²', '1/N⁴', 'exponentially'],
        answer: 2,
        why: 'The state error is O(t³/N²), so the infidelity is O(1/N⁴).',
      },
    ],
  },
  simon: {
    goals: [
      'State Simon’s problem and its classical query cost.',
      'Explain how one superposition query plus interference yields a linear equation for s.',
      'Recover s from n − 1 independent equations by Gaussian elimination over GF(2).',
      'Explain the exponential query separation and its link to Shor’s algorithm.',
    ],
    prereqs: ['Bernstein–Vazirani', 'Deutsch–Jozsa'],
    misconceptions: [
      { wrong: 'One run of Simon’s circuit reveals s.', right: 'Each run gives one random equation y · s = 0; about n runs are needed.' },
      { wrong: 'The separation shows quantum computers beat classical ones for every such function.', right: 'It is a black-box (query) separation; explicit circuits can be inspected classically.' },
      { wrong: 'The output register must be measured.', right: 'It can be ignored; it only needs to stay entangled with the input.' },
    ],
    questions: [
      {
        q: 'With n = 3 and s = 101, which outcome can Simon’s circuit produce?',
        options: ['100', '010', '001', '111'],
        answer: 1,
        why: '010 · 101 = 0 (mod 2); the others give 1.',
      },
      {
        q: 'Roughly how many classical queries does random collision search need for n = 40?',
        options: ['40', 'about a million', 'about 2⁴⁰', '2'],
        answer: 1,
        why: 'About √(2⁴⁰) ≈ 10⁶ by the birthday bound.',
      },
      {
        q: 'Which famous algorithm did Simon’s inspire?',
        options: ['Grover', 'Shor', 'HHL', 'VQE'],
        answer: 1,
        why: 'Shor generalised the hidden-subgroup idea from XOR periods to modular periods.',
      },
    ],
  },
  'amplitude-estimation': {
    goals: [
      'State the amplitude estimation problem and the cost of estimating by sampling.',
      'Explain how the Grover operator turns an amplitude into a phase.',
      'Read the outcome distribution and the Brassard–Høyer–Mosca–Tapp error bound.',
      'Explain why the speed-up is quadratic and what limits it in practice.',
    ],
    prereqs: ['Phase estimation', 'Grover search'],
    misconceptions: [
      { wrong: 'Amplitude estimation gives an exponential speed-up for Monte Carlo.', right: 'It is quadratic: 1/ε calls instead of 1/ε².' },
      { wrong: 'Its root-mean-square error falls as 1/calls.', right: 'The guarantee is a high-probability bound; the canonical estimator has heavy tails.' },
      { wrong: 'Any number of counting qubits is cheap.', right: 'Controlled powers of Q make the circuit deep, which noise punishes.' },
    ],
    questions: [
      {
        q: 'To reach error 10⁻³ by sampling takes about 10⁶ runs. Amplitude estimation needs about…',
        options: ['10⁶ calls', '10³ calls', '30 calls', '1 call'],
        answer: 1,
        why: 'Error ∝ 1/calls instead of 1/√runs: about 10³.',
      },
      {
        q: 'What are the eigenvalues of the Grover operator Q when a = sin²θ?',
        options: ['±1', 'e^{±iθ}', 'e^{±2iθ}', 'sin θ and cos θ'],
        answer: 2,
        why: 'Q rotates by 2θ in the plane of good and bad states.',
      },
      {
        q: 'With what probability does canonical amplitude estimation meet its error bound?',
        options: ['Always', 'At least 8/π² ≈ 81%', 'About 50%', 'It depends on a only'],
        answer: 1,
        why: 'Brassard et al. guarantee success probability ≥ 8/π²; repeating and taking the median boosts it.',
      },
    ],
  },
  'deutsch-jozsa': {
    goals: [
      'Use phase kickback to turn an oracle’s output into a phase.',
      'Decide constant against balanced with one query.',
      'Be honest about the speedup: a randomised classical algorithm does almost as well.',
    ],
    prereqs: ['Interference', 'Hadamard on many qubits'],
    misconceptions: [
      { wrong: 'The algorithm evaluates f on every input at once and reads them all out.', right: 'Only one n-bit answer comes out; interference arranges for it to reveal one global property.' },
    ],
    questions: [
      {
        q: 'If f is constant, measuring the input register gives…',
        options: ['all zeros, always', 'a random string', 'all ones', 'the value f(0)'],
        answer: 0,
        why: 'For constant f all phases are equal, and the final Hadamards return everything to |0…0⟩.',
      },
      {
        q: 'Why is the answer qubit prepared in |−⟩?',
        options: ['To store f(x)', 'So that the oracle’s bit flip becomes a phase (−1)^f(x)', 'To entangle the inputs', 'It isn’t necessary'],
        answer: 1,
        why: 'X|−⟩ = −|−⟩, so the flip kicks back as a sign: phase kickback.',
      },
      {
        q: 'A classical randomised algorithm can tell constant from balanced with error below 1% using about…',
        options: ['2 queries', '8 queries', '2ⁿ⁻¹ + 1 queries', 'n queries'],
        answer: 1,
        why: 'Each random query halves the chance of being fooled; 8 queries give an error below 2⁻⁷.',
      },
    ],
  },
  'bernstein-vazirani': {
    goals: [
      'Recover a hidden bit string s from f(x) = s·x with one query.',
      'Explain the result as a Hadamard transform of a phase pattern.',
    ],
    prereqs: ['Deutsch–Jozsa'],
    misconceptions: [
      { wrong: 'The quantum algorithm is exponentially faster here.', right: 'Classically n queries suffice (one per bit), so the gap is n versus 1, not exponential.' },
    ],
    questions: [
      {
        q: 'How many classical queries determine a 5-bit secret s?',
        options: ['1', '5', '16', '32'],
        answer: 1,
        why: 'Query x = 10000, 01000, …: each reveals one bit of s.',
      },
      {
        q: 'After the oracle, the input register holds Σ (−1)^(s·x) |x⟩. The final Hadamards give…',
        options: ['|0…0⟩', '|s⟩', 'a uniform superposition', '|1…1⟩'],
        answer: 1,
        why: 'This phase pattern is exactly the Hadamard transform of |s⟩, and H is its own inverse.',
      },
    ],
  },
  grover: {
    goals: [
      'Explain the oracle (sign flip) and diffusion (reflection about the average).',
      'Use the geometric picture: each round rotates by 2θ with sin θ = √(M/N).',
      'Choose the optimal number of rounds ≈ (π/4)√(N/M) and explain overshooting.',
    ],
    prereqs: ['Interference', 'Amplitudes as signed bars'],
    misconceptions: [
      { wrong: 'More rounds always help.', right: 'The state rotates past the answer; after the optimum the success probability falls.' },
      { wrong: 'Grover gives an exponential speedup.', right: 'It is quadratic: about √N queries instead of N.' },
    ],
    questions: [
      {
        q: 'Searching N = 64 items for one marked item, the best number of rounds is about…',
        options: ['1', '6', '8', '32'],
        answer: 1,
        why: '(π/4)√64 ≈ 6.3, rounded to 6.',
      },
      {
        q: 'Right after the oracle, the chance of measuring the marked item is…',
        options: ['higher than before', 'unchanged', 'zero', 'one'],
        answer: 1,
        why: 'The oracle only flips a sign; probabilities change only after diffusion.',
      },
      {
        q: 'With N = 4 and one marked item, one round gives success probability…',
        options: ['1/4', '1/2', '3/4', '1'],
        answer: 3,
        why: 'θ = 30°, and after one round the angle is 3θ = 90°: certainty.',
      },
    ],
  },
  qft: {
    goals: [
      'Describe the QFT as a basis change to "clock" states with phases e^(2πixy/N).',
      'Build it from Hadamards, controlled phases and swaps.',
      'Explain why periodic inputs give peaked outputs.',
    ],
    prereqs: ['Phase gates', 'Binary fractions'],
    misconceptions: [
      { wrong: 'The QFT computes the Fourier transform of classical data quickly and lets you read it all.', right: 'The amplitudes are transformed, but measurement gives one sample; useful only inside algorithms like phase estimation.' },
    ],
    questions: [
      {
        q: 'The QFT of |0…0⟩ is…',
        options: ['|0…0⟩', 'the uniform superposition', '|1…1⟩', 'zero'],
        answer: 1,
        why: 'All phases e^(2πi·0·y/N) are 1.',
      },
      {
        q: 'A periodic state with period r on N = 2ⁿ points transforms into peaks spaced by…',
        options: ['r', 'N/r', '1/r', 'N·r'],
        answer: 1,
        why: 'Periodicity r in the input gives support on multiples of N/r.',
      },
      {
        q: 'How many gates does the n-qubit QFT use?',
        options: ['about n', 'about n²/2', 'about 2ⁿ', 'about n·2ⁿ'],
        answer: 1,
        why: 'Qubit k needs one H and n − k controlled phases, about n²/2 in total (plus swaps).',
      },
    ],
  },
  'phase-estimation': {
    goals: [
      'Use controlled powers of U to write an eigenphase into a register.',
      'Read the phase with the inverse QFT.',
      'Explain the spread when the phase is not a t-bit fraction.',
    ],
    prereqs: ['QFT', 'Phase kickback'],
    misconceptions: [
      { wrong: 'Phase estimation measures the phase of any state.', right: 'It needs an eigenstate of U (or gives a mixture over eigenphases).' },
    ],
    questions: [
      {
        q: 'With t = 3 counting qubits and φ = 0.375, the measurement gives…',
        options: ['3 (011) with certainty', '3 with probability ≈ 0.4', 'a uniform result', '6'],
        answer: 0,
        why: '0.375 = 3/8 is exactly a 3-bit binary fraction, so the outcome is certain.',
      },
      {
        q: 'If φ lies between two t-bit values, the nearest one is measured with probability at least…',
        options: ['1/2', '4/π² ≈ 0.405', '1', '1/2ᵗ'],
        answer: 1,
        why: 'The worst case (exactly halfway) gives 4/π² for the nearest value.',
      },
      {
        q: 'Counting qubit j controls U raised to…',
        options: ['j', '2ʲ (a power of two)', 't', '1'],
        answer: 1,
        why: 'Powers U, U², U⁴, … write the binary digits of φ into the register.',
      },
    ],
  },
  shor: {
    goals: [
      'Reduce factoring to finding the period r of aˣ mod N.',
      'Explain how the QFT reveals r and continued fractions recover it.',
      'Compute the factors from gcd(a^(r/2) ± 1, N).',
    ],
    prereqs: ['Phase estimation', 'Modular arithmetic'],
    misconceptions: [
      { wrong: 'The quantum computer outputs the factors directly.', right: 'It outputs a sample y ≈ kQ/r; classical continued fractions and gcds do the rest.' },
      { wrong: 'Shor breaks RSA today.', right: 'It needs a large fault-tolerant computer; recent estimates are around a million noisy physical qubits for RSA-2048.' },
    ],
    questions: [
      {
        q: 'For a = 7 and N = 15, the period of 7ˣ mod 15 is…',
        options: ['2', '3', '4', '6'],
        answer: 2,
        why: '7, 4, 13, 1: the sequence repeats after 4 steps.',
      },
      {
        q: 'With r = 4 and a = 7, gcd(7² − 1, 15) and gcd(7² + 1, 15) give…',
        options: ['1 and 15', '3 and 5', '5 and 3', '3 and 3'],
        answer: 1,
        why: '7² = 49; gcd(48, 15) = 3 and gcd(50, 15) = 5.',
      },
      {
        q: 'Which part of Shor’s algorithm needs a quantum computer?',
        options: ['The gcd', 'Choosing a', 'Finding the period', 'Continued fractions'],
        answer: 2,
        why: 'Period finding is the step with an exponential quantum speedup; everything else is classical.',
      },
    ],
  },
};
