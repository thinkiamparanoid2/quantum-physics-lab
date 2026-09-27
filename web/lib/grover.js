// Grover's search, built from real gates (lib/circuit.js) so the page shows exactly what a
// circuit computes, plus the closed-form results it's tested against.

import { GATES, applyToAll, flipPhase, probabilities, zeroState } from './circuit.js';

// sin(theta) = sqrt(M / N): each Grover round rotates the state by 2 * theta.
export function groverAngle(N, M) {
  return Math.asin(Math.sqrt(M / N));
}

export function optimalRounds(N, M) {
  if (M <= 0 || M >= N) return 0;
  return Math.max(0, Math.round(Math.PI / (4 * groverAngle(N, M)) - 0.5));
}

export function analyticSuccess(N, M, rounds) {
  return Math.sin((2 * rounds + 1) * groverAngle(N, M)) ** 2;
}

// Expected number of items a classical search checks, in random order, to hit one of M marked out of N.
export function classicalExpectedQueries(N, M) {
  return (N + 1) / (M + 1);
}

export function oracle(s, marked) {
  return flipPhase(s, (b) => marked.has(b));
}

// H on every qubit, flip the sign of every state except |0...0>, H on every qubit:
// H (2|0><0| - I) H = 2|s><s| - I, a reflection of each amplitude about the average.
export function diffuser(s) {
  applyToAll(s, GATES.H);
  flipPhase(s, (b) => b !== 0);
  applyToAll(s, GATES.H);
  return s;
}

function successProbability(probs, marked) {
  let p = 0;
  for (const b of marked) p += probs[b];
  return p;
}

// Every intermediate state of the algorithm, in the order the circuit applies them:
// start, superposition, (oracle, diffusion) x rounds, measure.
export function groverSteps(n, marked, rounds) {
  const s = zeroState(n);
  const steps = [];
  const record = (kind, round) => {
    const probs = probabilities(s);
    steps.push({ kind, round, amps: Float64Array.from(s.re), probs, success: successProbability(probs, marked) });
  };
  record('start', 0);
  applyToAll(s, GATES.H);
  record('superpose', 0);
  for (let k = 1; k <= rounds; k++) {
    oracle(s, marked);
    record('oracle', k);
    diffuser(s);
    record('diffuse', k);
  }
  record('measure', rounds);
  return steps;
}

// Grover keeps the state in the plane spanned by |w> (uniform over marked items) and |s'>
// (uniform over unmarked items). Returns the state's coordinates in that plane:
// x along |s'>, y along |w>.
export function planeCoordinates(amps, marked) {
  const N = amps.length;
  const M = marked.size;
  let w = 0;
  let u = 0;
  for (let b = 0; b < N; b++) {
    if (marked.has(b)) w += amps[b];
    else u += amps[b];
  }
  return { x: u / Math.sqrt(N - M), y: w / Math.sqrt(M) };
}
