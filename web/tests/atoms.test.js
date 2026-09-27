import assert from 'node:assert/strict';
import test from 'node:test';

import { seededRandom } from '../lib/circuit.js';
import {
  energyEV,
  extent,
  orbital,
  radial,
  realY,
  sampleCloud,
  wavelengthNm,
} from '../lib/hydrogen.js';
import { blochOf, chainIntensities, ensembleAt, magnetAxis, measure, rabiProbability, resonance, sendAtom, upAlong } from '../lib/spin.js';
import { eigenstates, makeGrid } from '../lib/wave.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ----- spin -----

test('measuring spin along a tilted axis gives cos^2(theta/2)', () => {
  for (const deg of [0, 30, 60, 90, 135, 180]) {
    const th = (deg * Math.PI) / 180;
    close(measure(upAlong(0), th, 0).pUp, Math.cos(th / 2) ** 2, 1e-12, `${deg} deg`);
  }
  // Up along y measured along x: 50/50; along y: certain.
  close(measure(upAlong(Math.PI / 2, Math.PI / 2), Math.PI / 2, 0).pUp, 0.5, 1e-12, 'y along x');
  close(measure(upAlong(Math.PI / 2, Math.PI / 2), ...magnetAxis('y')).pUp, 1, 1e-12, 'y along y');
  const v = blochOf(upAlong(1.1, 0.7));
  close(v[0], Math.sin(1.1) * Math.cos(0.7), 1e-12, 'bloch x');
  close(v[1], Math.sin(1.1) * Math.sin(0.7), 1e-12, 'bloch y');
  close(v[2], Math.cos(1.1), 1e-12, 'bloch z');
});

test('Stern-Gerlach chains: z then z keeps everything, z x z brings spin down back', () => {
  const zz = chainIntensities([{ dir: 'z', pass: 'up' }, { dir: 'z' }]);
  close(zz[1].up, 0.5, 1e-12, 'zz up');
  close(zz[1].down, 0, 1e-12, 'zz down');
  const zxz = chainIntensities([{ dir: 'z', pass: 'up' }, { dir: 'x', pass: 'up' }, { dir: 'z' }]);
  close(zxz[2].up, 0.125, 1e-12, 'zxz up');
  close(zxz[2].down, 0.125, 1e-12, 'zxz down');
  // Sampling one atom at a time converges to the same fractions.
  const rng = seededRandom(7);
  const chain = [{ dir: 'z', pass: 'up' }, { dir: 'x', pass: 'up' }, { dir: 'z' }];
  let down = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const a = sendAtom(chain, rng);
    if (!a.blocked && a.out === 'down') down++;
  }
  close(down / N, 0.125, 0.006, 'sampled zxz down');
});

test('magnetic resonance: exact rotating-field solution matches direct integration and Rabi', () => {
  const params = { w0: 5, w: 4.6, W: 0.8 };
  const H = (t) => {
    // H = w0/2 sz + W/2 (cos wt sx + sin wt sy), as [re, im] 2x2 entries
    const c = (params.W / 2) * Math.cos(params.w * t);
    const s = (params.W / 2) * Math.sin(params.w * t);
    return [
      [params.w0 / 2, 0, c, -s],
      [c, s, -params.w0 / 2, 0],
    ];
  };
  // d psi/dt = -i H psi, RK4
  const deriv = (t, p) => {
    const h = H(t);
    const out = [];
    for (const row of h) {
      const re = row[0] * p[0] - row[1] * p[1] + row[2] * p[2] - row[3] * p[3];
      const im = row[0] * p[1] + row[1] * p[0] + row[2] * p[3] + row[3] * p[2];
      out.push(im, -re);
    }
    return out;
  };
  let p = [1, 0, 0, 0];
  const dt = 1e-3;
  for (let k = 0; k < 8000; k++) {
    const t = k * dt;
    const k1 = deriv(t, p);
    const k2 = deriv(t + dt / 2, p.map((v, i) => v + (dt / 2) * k1[i]));
    const k3 = deriv(t + dt / 2, p.map((v, i) => v + (dt / 2) * k2[i]));
    const k4 = deriv(t + dt, p.map((v, i) => v + dt * k3[i]));
    p = p.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  const exact = resonance([1, 0, 0, 0], params, 8);
  exact.forEach((v, i) => close(v, p[i], 1e-8, `component ${i}`));
  close(exact[2] ** 2 + exact[3] ** 2, rabiProbability(params, 8), 1e-12, 'Rabi formula');
});

test('spin echo: spread-out spins refocus at twice the pulse spacing', () => {
  const rng = seededRandom(3);
  const offsets = Array.from({ length: 200 }, () => (rng() - 0.5) * 2);
  const tau = 6;
  const pulses = [
    { t: 0, angle: Math.PI / 2 },
    { t: tau, angle: Math.PI },
  ];
  const mag = (vs) => Math.hypot(...[0, 1].map((k) => vs.reduce((s, v) => s + v[k], 0) / vs.length));
  close(mag(ensembleAt(offsets, pulses, 0)), 1, 1e-12, 'right after the pi/2 pulse');
  assert.ok(mag(ensembleAt(offsets, pulses, tau - 0.01)) < 0.2, 'dephased before the pi pulse');
  close(mag(ensembleAt(offsets, pulses, 2 * tau)), 1, 1e-12, 'echo');
});

// ----- hydrogen -----

function integrate(f, a, b, n = 20000) {
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h);
  return s * h;
}

test('hydrogen radial functions are normalised, orthogonal and give <r> = (3n^2 - l(l+1))/2', () => {
  for (const [n, l] of [
    [1, 0],
    [2, 0],
    [2, 1],
    [3, 0],
    [3, 2],
    [4, 1],
    [4, 3],
  ]) {
    const R = extent(n) * 2;
    close(integrate((r) => r * r * radial(n, l, r) ** 2, 0, R), 1, 1e-6, `norm ${n}${l}`);
    close(integrate((r) => r ** 3 * radial(n, l, r) ** 2, 0, R), (3 * n * n - l * (l + 1)) / 2, 1e-5, `<r> ${n}${l}`);
  }
  close(integrate((r) => r * r * radial(1, 0, r) * radial(2, 0, r), 0, 60), 0, 1e-8, '1s.2s');
  close(integrate((r) => r * r * radial(2, 1, r) * radial(3, 1, r), 0, 80), 0, 1e-8, '2p.3p');
  close(radial(1, 0, 0), 2, 1e-12, 'R_10(0) = 2');
});

test('real spherical harmonics are orthonormal on the sphere', () => {
  const ls = [
    [0, 0],
    [1, -1],
    [1, 0],
    [1, 1],
    [2, -2],
    [2, 0],
    [2, 1],
    [3, 2],
  ];
  const inner = ([l1, m1], [l2, m2]) => {
    const nt = 120;
    const np = 240;
    let s = 0;
    for (let i = 0; i < nt; i++) {
      const th = ((i + 0.5) / nt) * Math.PI;
      for (let j = 0; j < np; j++) {
        const ph = ((j + 0.5) / np) * 2 * Math.PI;
        s += realY(l1, m1, th, ph) * realY(l2, m2, th, ph) * Math.sin(th);
      }
    }
    return s * (Math.PI / nt) * ((2 * Math.PI) / np);
  };
  for (const a of ls) for (const b of ls) close(inner(a, b), a === b ? 1 : 0, 2e-4, `<${a}|${b}>`);
});

test('the radial Schrodinger equation, solved numerically, gives E = -1/(2 n^2)', () => {
  for (const l of [0, 1, 2]) {
    const g = makeGrid(6000, 0, 150);
    const V = Float64Array.from(g.x, (r) => -1 / r + (l * (l + 1)) / (2 * r * r));
    const levels = eigenstates(V, g.dx, 3).map((s) => s.E);
    levels.forEach((E, k) => close(E, -1 / (2 * (k + l + 1) ** 2), 2e-4, `l=${l}, n=${k + l + 1}`));
  }
});

test('hydrogen spectrum: energies and the Balmer lines (vacuum wavelengths)', () => {
  close(energyEV(1), -13.598, 1e-3, 'ground state');
  close(energyEV(2), -3.3996, 1e-3, 'n = 2');
  // NIST vacuum wavelengths of H-alpha to H-delta, and Lyman alpha.
  close(wavelengthNm(3, 2), 656.47, 0.02, 'H-alpha');
  close(wavelengthNm(4, 2), 486.27, 0.02, 'H-beta');
  close(wavelengthNm(5, 2), 434.17, 0.02, 'H-gamma');
  close(wavelengthNm(6, 2), 410.29, 0.02, 'H-delta');
  close(wavelengthNm(2, 1), 121.57, 0.02, 'Lyman alpha');
});

test('sampled electron clouds follow |psi|^2', () => {
  const rng = seededRandom(11);
  // 1s: mean radius 1.5; 2p_z: points above and below the xy plane have opposite signs.
  const s = sampleCloud(1, 0, 0, 20000, rng);
  close(s.reduce((a, [x, y, z]) => a + Math.hypot(x, y, z), 0) / s.length, 1.5, 0.03, '<r> of 1s');
  const p = sampleCloud(2, 1, 0, 4000, rng);
  assert.ok(p.every(([, , z, sign]) => Math.sign(z) === sign || Math.abs(z) < 1e-9), '2p_z sign follows z');
  close(p.reduce((a, [x, y, z]) => a + z * z, 0) / p.length, (3 / 5) * 30, 0.8, '<z^2> of 2p_z');
  // orbital() agrees with R Y at a point
  close(orbital(2, 1, 0, 0, 0, 2), radial(2, 1, 2) * Math.sqrt(3 / (4 * Math.PI)), 1e-12, 'psi_210 on the z axis');
});
