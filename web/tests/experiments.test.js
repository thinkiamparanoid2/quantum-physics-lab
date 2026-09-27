import assert from 'node:assert/strict';
import test from 'node:test';

import { applyGate, phase, probabilities, rx, seededRandom, zeroState } from '../lib/circuit.js';
import {
  H_OVER_E,
  bombTest,
  collectorCurrent,
  electronWavelengthNm,
  fitLine,
  frequencyHz,
  machZehnder,
  maxKinetic,
  photonEnergy,
  slitIntensity,
  slitSampler,
  thresholdNm,
  zenoSuccess,
  compton,
  COMPTON_PM,
  ELECTRON_KEV,
} from '../lib/optics.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('photoelectric effect: E = hf, threshold, stopping voltage and Millikan\'s h/e', () => {
  close(photonEnergy(500), 2.4797, 1e-4, '500 nm photon');
  close(thresholdNm(2.36), 525.4, 0.1, 'sodium threshold');
  assert.equal(collectorCurrent({ nm: 600, phi: 2.36, intensity: 1, volts: 0 }), 0, 'red light ejects nothing from sodium');
  // current vanishes exactly at the stopping voltage
  const K = maxKinetic(400, 2.36);
  close(collectorCurrent({ nm: 400, phi: 2.36, intensity: 1, volts: -K + 1e-9 }), 0, 1e-8, 'stopped');
  close(collectorCurrent({ nm: 400, phi: 2.36, intensity: 3, volts: 2 }), 3, 0, 'saturation grows with intensity');
  // stopping voltage against frequency is a line of slope h/e
  const pts = [250, 300, 350, 400, 450].map((nm) => [frequencyHz(nm), maxKinetic(nm, 2.36)]);
  close(fitLine(pts).slope, H_OVER_E, 1e-20, 'slope = h/e');
  close(-fitLine(pts).intercept, 2.36, 1e-6, 'intercept = work function');
});

test('double slit: fringe spacing lambda L / d, marked paths add intensities', () => {
  const p = { lambda: 500e-9, d: 0.2e-3, a: 0.04e-3, L: 1 };
  // Dark fringes sit exactly where the path difference d sin(theta) is a half-odd number of
  // wavelengths, so they are lambda L / d apart for small angles. (Bright peaks are pulled
  // slightly inward by the single-slit envelope.)
  const darkAt = (m) => p.L * Math.tan(Math.asin(((m + 0.5) * p.lambda) / p.d));
  for (const m of [0, 1, 2]) close(slitIntensity(darkAt(m), p), 0, 1e-12, `dark fringe ${m}`);
  close(darkAt(1) - darkAt(0), (p.lambda * p.L) / p.d, 1e-7, 'fringe spacing lambda L / d');
  close(slitIntensity(0, p), 4, 1e-12, 'both slits: 4x one slit at the centre');
  for (const x of [0, 0.7e-3, 1.9e-3, 3.3e-3]) {
    close(slitIntensity(x, { ...p, marked: 1 }), 2 * slitIntensity(x, { ...p, open: 'left' }), 1e-12, `marked = sum at ${x}`);
  }
  // sampled hits follow the pattern: few land on the first dark fringe
  const sample = slitSampler(p, 6e-3);
  const rng = seededRandom(5);
  let nearDark = 0;
  let nearBright = 0;
  const dark = (p.lambda * p.L) / (2 * p.d);
  for (let i = 0; i < 20000; i++) {
    const x = Math.abs(sample(rng));
    if (Math.abs(x - dark) < 1e-4) nearDark++;
    if (x < 1e-4) nearBright++;
  }
  assert.ok(nearBright > 20 * nearDark, `bright ${nearBright} vs dark ${nearDark}`);
  close(electronWavelengthNm(50e3), 0.005355, 2e-6, '50 keV electron (relativistic)');
});

test('Mach-Zehnder matches the same circuit built from gates: Rx(-pi/2), phase, Rx(-pi/2)', () => {
  for (const phi of [0, 0.4, Math.PI / 2, 2, Math.PI]) {
    const mz = machZehnder({ phi });
    close(mz.pD1 + mz.pD2, 1, 1e-12, 'probabilities add to 1');
    close(mz.pD1, Math.cos(phi / 2) ** 2, 1e-12, `D1 = cos^2(phi/2) at ${phi}`);
    // Path qubit: |0> = path a, |1> = path b. A 50/50 splitter is Rx(-pi/2).
    const s = zeroState(1);
    applyGate(s, 0, rx(-Math.PI / 2));
    applyGate(s, 0, phase(phi));
    applyGate(s, 0, rx(-Math.PI / 2));
    const [pa, pb] = probabilities(s);
    close(pb, mz.pD1, 1e-12, 'D1 is output b');
    close(pa, mz.pD2, 1e-12, 'D2 is output a');
  }
  const blocked = machZehnder({ block: 'a', phi: 1 });
  close(blocked.pBlocked, 0.5, 1e-12, 'half absorbed');
  close(blocked.pD1, 0.25, 1e-12, 'then 50/50');
  const marked = machZehnder({ marked: 1, phi: 0 });
  close(marked.pD1, 0.5, 1e-12, 'which-path marking kills interference');
  close(machZehnder({ marked: 0.5, phi: 0 }).pD1, 0.75, 1e-12, 'half marking, half visibility');
  close(machZehnder({ secondSplitter: false, phi: 1 }).pD1, 0.5, 1e-12, 'no second splitter');
});

test('bomb tester: a live bomb is found without exploding a quarter of the time; Zeno pushes it to 1', () => {
  const live = bombTest(true);
  close(live.boom, 0.5, 1e-12, 'boom');
  close(live.dark, 0.25, 1e-12, 'dark detector: live bomb found without touching it');
  close(bombTest(false).dark, 0, 1e-12, 'a dud never lights the dark detector');
  assert.ok(zenoSuccess(1) < 1e-12, 'one big turn always hits the bomb');
  close(zenoSuccess(10), 0.78, 0.01, 'N = 10');
  assert.ok(zenoSuccess(1000) > 0.997, 'N = 1000');
});

test('Compton scattering: shift h/mc (1 - cos theta), with energy and momentum both conserved', () => {
  const r90 = compton(71.1, Math.PI / 2);
  close(r90.out - 71.1, COMPTON_PM, 1e-12, 'shift at 90 degrees is the Compton wavelength');
  close(compton(71.1, Math.PI).out - 71.1, 2 * COMPTON_PM, 1e-12, 'backscatter doubles it');
  for (const theta of [0.3, 1, 2, 3]) {
    const r = compton(71.1, theta);
    // the electron's relativistic energy from its momentum must match the energy lost by the photon
    const Ee = Math.sqrt(r.p * r.p + ELECTRON_KEV ** 2) - ELECTRON_KEV;
    close(Ee, r.kinetic, 1e-7 * r.kinetic, `energy balance at ${theta} (constants rounded to ~9 digits)`);
  }
  close(compton(71.1, 0).E0, 17.44, 0.01, 'molybdenum K-alpha photon energy (keV)');
});
