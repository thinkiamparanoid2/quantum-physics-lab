// Quantum statistics of N non-interacting particles in a set of levels at temperature T (k_B = 1),
// in the grand-canonical ensemble with the chemical potential mu fixed by the particle number.
// A system is a list of levels [{ E, g }] (energy and degeneracy).

export const occupation = (kind, x) => {
  // x = (E - mu) / T
  if (kind === 'fermi') return 1 / (Math.exp(x) + 1);
  if (kind === 'bose') return 1 / Math.expm1(x);
  return Math.exp(-x);
};

// Levels of a 1D ladder (spacing 1, non-degenerate) or a 3D isotropic harmonic trap
// (E = n, degeneracy (n+1)(n+2)/2), with energies measured from the ground state.
export function levels(system, count) {
  return Array.from({ length: count }, (_, n) => ({ E: n, g: system === 'trap' ? ((n + 1) * (n + 2)) / 2 : 1 }));
}

export const totalN = (kind, lv, mu, T) => lv.reduce((s, { E, g }) => s + g * occupation(kind, (E - mu) / T), 0);

// mu such that the mean particle number is N. For bosons mu stays below the lowest level.
export function chemicalPotential(kind, lv, N, T) {
  let lo = -1e4 - 50 * T;
  let hi = kind === 'bose' ? lv[0].E - 1e-15 : lv[lv.length - 1].E + 50 * T;
  if (kind === 'bose') {
    // occupation of the ground state alone can hold any N as mu -> E0, so a root always exists
    hi = lv[0].E - Math.max(1e-15, T * 1e-14);
  }
  // 100 halvings shrink any starting bracket below double-precision resolution
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (totalN(kind, lv, m, T) < N) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// T = 0 Fermi energy: the highest filled level when N fermions fill the levels one per state.
export function fermiEnergy(lv, N) {
  let filled = 0;
  for (const { E, g } of lv) {
    filled += g;
    if (filled >= N) return E;
  }
  return lv[lv.length - 1].E;
}

// Ideal-gas Bose-Einstein condensation in a 3D trap (hbar omega = 1): T_c = (N / zeta(3))^(1/3) and,
// for large N, N0/N = 1 - (T/T_c)^3.
export const ZETA3 = 1.2020569031595942;
export const trapTc = (N) => Math.cbrt(N / ZETA3);
