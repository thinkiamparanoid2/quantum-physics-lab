// Built-in examples. Each build() returns the values that go into the input fields.

function num(c) {
  return String(Number(c.toPrecision(6)));
}

// `lines` holds comment strings and arrays of [coefficient, operators] pairs, where the
// operators are e.g. "X0 X1", or "" for a constant.
export function formatSum(lines, { multiline = true } = {}) {
  const out = [];
  let first = true;
  for (const line of lines) {
    if (typeof line === 'string') {
      if (multiline) out.push(`# ${line}`);
      continue;
    }
    const parts = [];
    for (const [c, ops] of line) {
      if (Math.abs(c) < 1e-12) continue;
      const mag = num(Math.abs(c));
      const body = ops === '' ? mag : mag === '1' ? ops : `${mag}*${ops}`;
      parts.push(first ? (c < 0 ? `-${body}` : body) : `${c < 0 ? '-' : '+'} ${body}`);
      first = false;
    }
    if (parts.length) out.push(parts.join(' '));
  }
  return out.join(multiline ? '\n' : ' ');
}

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

function heisenberg(n) {
  const lines = ['exchange coupling J(XX + YY + ZZ) on every neighbouring pair'];
  for (let i = 0; i < n - 1; i++) {
    lines.push([[1, `X${i} X${i + 1}`], [1, `Y${i} Y${i + 1}`], [1, `Z${i} Z${i + 1}`]]);
  }
  const mid = Math.floor(n / 2);
  return {
    hamiltonian: formatSum(lines),
    state: '0'.repeat(mid) + '1' + '0'.repeat(n - mid - 1),
    observable: `Z${mid}`,
    time: 4,
    steps: 40,
    order: 2,
  };
}

function ising(n, field) {
  return {
    hamiltonian: formatSum([
      'ferromagnetic coupling between neighbours',
      range(n - 1, (i) => [-1, `Z${i} Z${i + 1}`]),
      `transverse field, switched on at t = 0`,
      range(n, (i) => [-field, `X${i}`]),
    ]),
    state: '0'.repeat(n),
    observable: formatSum([range(n, (i) => [1, `Z${i}`])], { multiline: false }),
    time: 5,
    steps: 25,
    order: 1,
  };
}

function rabi() {
  return {
    hamiltonian: formatSum(['drive (X) plus detuning (Z)', [[1, 'X0'], [0.5, 'Z0']]]),
    state: '0',
    observable: 'Z0',
    time: 10,
    steps: 10,
    order: 1,
  };
}

// Lattice Schwinger model with staggered fermions, gauge field eliminated via Gauss's law.
// Same Hamiltonian as modules/schwinger_model/hamiltonian.py.
export function schwinger(sites, x = 1, mass = 0.5, coupling = 0.6, background = 0) {
  const lines = ['hopping: pairs are created, move and annihilate'];
  for (let n = 0; n < sites - 1; n++) lines.push([[x / 2, `X${n} X${n + 1}`], [x / 2, `Y${n} Y${n + 1}`]]);

  lines.push('staggered mass: electrons live on even sites, positrons on odd sites');
  lines.push(range(sites, (n) => [(mass / 2) * (n % 2 ? -1 : 1), `Z${n}`]));

  // Electric energy: coupling * sum over links of L^2, L = background + sum_{k<=link} (Z_k + (-1)^k) / 2
  let constant = 0;
  const single = new Array(sites).fill(0);
  const pair = new Map();
  for (let link = 0; link < sites - 1; link++) {
    let c0 = background;
    for (let k = 0; k <= link; k++) c0 += (k % 2 ? -1 : 1) / 2;
    constant += coupling * (c0 * c0 + 0.25 * (link + 1));
    for (let k = 0; k <= link; k++) single[k] += coupling * c0;
    for (let j = 0; j <= link; j++) {
      for (let k = j + 1; k <= link; k++) pair.set(`${j},${k}`, (pair.get(`${j},${k}`) ?? 0) + coupling * 0.5);
    }
  }
  lines.push("electric field energy: long-range, because Gauss's law ties the field to all charges to its left");
  lines.push([[constant, '']]);
  lines.push(single.map((c, k) => [c, `Z${k}`]));
  for (let j = 0; j < sites - 1; j++) {
    lines.push(range(sites - 1 - j, (d) => [pair.get(`${j},${j + 1 + d}`) ?? 0, `Z${j} Z${j + 1 + d}`]));
  }

  return {
    hamiltonian: formatSum(lines),
    state: range(sites, (n) => n % 2).join(''),
    observable: formatSum([[[sites / 2, ''], ...range(sites, (n) => [n % 2 ? 0.5 : -0.5, `Z${n}`])]], {
      multiline: false,
    }),
    time: 6,
    steps: 60,
    order: 2,
  };
}

export const PRESETS = [
  {
    id: 'lightcone',
    name: 'Spin-wave light cone (9 qubits)',
    description:
      'One flipped spin in a Heisenberg chain. Information can only travel at a finite speed, so the excitation spreads inside a light cone. Watch it form in the qubit map.',
    observableName: 'magnetization of the middle qubit',
    build: () => heisenberg(9),
  },
  {
    id: 'schwinger',
    name: 'Schwinger pair production (6 qubits)',
    description:
      'Quantum electrodynamics in one dimension, on a lattice. The simulation starts from empty space, and the electric field pulls electron-positron pairs out of the vacuum. The observable is the total number of particles.',
    observableName: 'total particle number',
    build: () => schwinger(6),
  },
  {
    id: 'ising',
    name: 'Ising quench (6 qubits)',
    description:
      'All spins start aligned, then a transverse field is switched on suddenly. The magnetization collapses and oscillates. This is one of the standard benchmarks run on real quantum hardware.',
    observableName: 'total Z magnetization',
    build: () => ising(6, 1),
  },
  {
    id: 'rabi',
    name: 'Rabi oscillation (1 qubit)',
    description:
      'A single driven qubit. With only 10 Trotter steps the circuit drifts visibly from the exact answer. Drag the steps slider up and watch the error shrink.',
    observableName: 'Z of qubit 0',
    build: rabi,
  },
];
