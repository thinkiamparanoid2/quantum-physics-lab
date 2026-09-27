// Checks the browser engine against independently computed Python references
// (tests/make_reference.py). Run with: node --test tests/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parsePauliSum, parseState, qubitCount, toPauliTerms, ParseError } from '../lib/pauli.js';
import { schwinger } from '../playground/presets.js';
import { makeOperator, productState, simulate } from '../lib/dynamics.js';

const reference = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
const TOL = 1e-9;

function run({ hamiltonian, state, observable, totalTime, steps, order, frames }) {
  const parsed = parsePauliSum(hamiltonian);
  const n = qubitCount(parsed);
  const H = makeOperator(toPauliTerms(parsed, n), n);
  const O = observable === 'H' ? H : makeOperator(toPauliTerms(parsePauliSum(observable), n), n);
  const psi0 = productState(parseState(state, n));
  return simulate({ H, O, psi0, totalTime, steps, order, frames });
}

function close(actual, expected, what) {
  assert.ok(Math.abs(actual - expected) < TOL, `${what}: got ${actual}, expected ${expected}`);
}

for (const ref of reference.generic) {
  test(`exact and Trotter dynamics match numpy: ${ref.name}`, () => {
    const r = run(ref);
    const n = ref.exact[0].z.length;
    ref.exact.forEach((e, j) => {
      close(r.exact.times[j], e.t, `exact time ${j}`);
      close(r.exact.obs[j], e.obs, `exact <O> at t=${e.t}`);
      e.z.forEach((z, q) => close(r.exact.z[j * n + q], z, `exact <Z${q}> at t=${e.t}`));
    });
    ref.trotter.forEach((e, k) => {
      close(r.trotter.obs[k], e.obs, `Trotter <O> after ${k} steps`);
      close(r.trotter.infidelity[k], e.infidelity, `infidelity after ${k} steps`);
      e.z.forEach((z, q) => close(r.trotter.z[k * n + q], z, `Trotter <Z${q}> after ${k} steps`));
    });
  });
}

test('Schwinger preset matches the Qiskit Hamiltonian (particle number and energy)', () => {
  const ref = reference.schwinger;
  const preset = schwinger(ref.sites, ref.x, ref.mass, ref.coupling);
  const common = { hamiltonian: preset.hamiltonian, state: preset.state, totalTime: ref.totalTime, steps: 10, order: 2, frames: ref.frames };
  const particles = run({ ...common, observable: preset.observable });
  const energy = run({ ...common, observable: 'H' });
  ref.samples.forEach((s, j) => {
    close(particles.exact.obs[j], s.particles, `particle number at t=${s.t}`);
    close(energy.exact.obs[j], s.energy, `energy at t=${s.t}`);
  });
});

test('parser accepts the documented syntax', () => {
  const same = (a, b) => {
    const pa = parsePauliSum(a);
    const pb = parsePauliSum(b);
    assert.deepEqual(toPauliTerms(pa, qubitCount(pa)), toPauliTerms(pb, qubitCount(pb)));
  };
  same('0.5*Z0 Z1 + X2', '0.5 z0*z1 + x2');
  same('ZZI - 0.25*IXX', '1*Z0 Z1 - 0.25*X1 X2 + 0*Z2');
  same('# comment\nX0 + X0', '2*X0');
  same('1e-1*Z0', '0.1*Z0');
  same('Z0 − X0', 'Z0 - X0');
});

test('parser rejects malformed input with a readable message', () => {
  for (const bad of ['', 'Z0 Z0', 'Z0 +', 'ZZ + ZZZ', 'Z0 2', 'X0 * * X1', 'Q1', 'XX X3']) {
    assert.throws(() => parsePauliSum(bad), ParseError, `should reject ${JSON.stringify(bad)}`);
  }
  assert.throws(() => parseState('012', 3), ParseError);
  assert.throws(() => parseState('01', 3), ParseError);
  assert.equal(parseState(' |0+-1> ', 4), '0+-1');
});

test('commuting Hamiltonian has zero Trotter error', () => {
  const r = run({ hamiltonian: 'Z0 Z1 + 0.5*Z0 - Z1', state: '++', observable: 'X0', totalTime: 3, steps: 3, order: 1, frames: 30 });
  for (const v of r.trotter.infidelity) assert.ok(v < 1e-12);
});
