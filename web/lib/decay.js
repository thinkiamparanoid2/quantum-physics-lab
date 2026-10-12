// One discrete level |0> (energy 0) coupled with strength V to a band of N levels E_k = c + (k - (N-1)/2) delta,
// the textbook route to Fermi's golden rule. hbar = 1. The Hamiltonian is an "arrowhead" matrix:
//   H_00 = 0, H_kk = E_k, H_0k = H_k0 = V,
// and the state is evolved exactly in its eigenbasis.

import { symmetricEigen } from './linalg.js';

export const bandEnergies = (N, delta, centre = 0) => Float64Array.from({ length: N }, (_, k) => centre + (k - (N - 1) / 2) * delta);

// Golden-rule rate: Gamma = 2 pi |V|² rho with density of states rho = 1 / delta (inside the band).
export const goldenRate = (V, delta) => (2 * Math.PI * V * V) / delta;

// First-order perturbation theory for the probability of being in level k at time t:
// P_k(t) = 4 V² sin²(w t / 2) / w², w = E_k (the level starts at energy 0).
export const firstOrder = (V, w, t) => (Math.abs(w) < 1e-12 ? V * V * t * t : (4 * V * V * Math.sin((w * t) / 2) ** 2) / (w * w));

// Exact evolution from |0>: returns a function of t giving the amplitudes { re, im } on (|0>, band).
export function exactDecay(V, energies) {
  const N = energies.length;
  const n = N + 1;
  const H = new Float64Array(n * n);
  for (let k = 0; k < N; k++) {
    H[(k + 1) * n + (k + 1)] = energies[k];
    H[k + 1] = V;
    H[(k + 1) * n] = V;
  }
  const { values, vectors } = symmetricEigen(H, n);
  // psi(t) = sum_a v_a <v_a|0> e^{-i E_a t}
  const overlap0 = vectors.map((v) => v[0]);
  return (t) => {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    values.forEach((E, a) => {
      const w = overlap0[a];
      const c = Math.cos(E * t) * w;
      const s = -Math.sin(E * t) * w;
      const v = vectors[a];
      for (let i = 0; i < n; i++) {
        re[i] += c * v[i];
        im[i] += s * v[i];
      }
    });
    return { re, im };
  };
}

// Survival probability |<0|psi(t)>|² for many times, cheaply: only <0|v_a> is needed.
export function survival(V, energies, times) {
  const N = energies.length;
  const n = N + 1;
  const H = new Float64Array(n * n);
  for (let k = 0; k < N; k++) {
    H[(k + 1) * n + (k + 1)] = energies[k];
    H[k + 1] = V;
    H[(k + 1) * n] = V;
  }
  const { values, vectors } = symmetricEigen(H, n);
  const w = vectors.map((v) => v[0] * v[0]);
  return times.map((t) => {
    let re = 0;
    let im = 0;
    values.forEach((E, a) => {
      re += w[a] * Math.cos(E * t);
      im -= w[a] * Math.sin(E * t);
    });
    return re * re + im * im;
  });
}

// Long-time distribution over the band (Weisskopf-Wigner): a Lorentzian of full width Gamma,
// P_k(t >> 1/Gamma) = V² / (E_k² + Gamma²/4). Summed over a dense band it gives 1.
export const lorentzian = (V, E, G) => (V * V) / (E * E + (G * G) / 4);

// Real part of the self-energy for a flat band of half-width W and density rho: the level's
// energy-dependent shift, Re Sigma(E) = V² rho ln((W + E)/(W - E)). With it the long-time
// distribution is V² / ((E - Re Sigma(E))² + Gamma²/4).
export const selfEnergyShift = (V, rho, W, E) => V * V * rho * Math.log((W + E) / (W - E));
