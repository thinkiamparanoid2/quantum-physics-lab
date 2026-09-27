# Quantum Physics Lab: the website

39 interactive lessons and tools, from the photoelectric effect to Shor's nine-qubit code. Every
lesson steps through an idea with a live visual, a Try-it panel, a Present mode for projectors and
a shareable link.

Everything runs in the visitor's browser (plain HTML/CSS/JavaScript ES modules, no build step, no
framework, no server), so it can be hosted anywhere static files can. For the full project
briefing see [`../PROJECT.md`](../PROJECT.md).

## Run locally

Browsers won't load JavaScript modules from `file://`, so serve the folder:

```bash
python -m http.server 8765 --directory web
```

Then open http://localhost:8765.

## Tests

72 tests in `tests/*.test.js` (`node --test`, no dependencies) check the physics against
independent results: exact formulas, a second numerical method, or Python references (dense
numpy/scipy matrices and the repo's validated Qiskit Schwinger Hamiltonian, stored in
`tests/reference.json`). `tests/pages.test.js` also guards against id clashes with the lesson frame.

```bash
python web/tests/make_reference.py   # regenerate tests/reference.json (needs the repo's .venv)
cd web && npm test                   # Node 20+; no dependencies
```

## Deploy on Vercel (free Hobby plan)

1. Push this repository to GitHub.
2. On vercel.com: **Add New → Project**, import the repository.
3. Set **Root Directory** to `web`, leave **Framework Preset** as "Other" and the build command empty.
4. Deploy. Every later push to the main branch redeploys automatically.

Or from this folder with the CLI: `npx vercel` (first time) and `npx vercel --prod`.

## Layout

```
web/
├── index.html, home.js   landing page (hero Bloch sphere, primer, learning path, teachers)
├── styles/site.css       design system: dark "quantum" theme + light theme, all components
├── lib/                  pure logic, no DOM, tested in Node
│   ├── catalog.js          every topic: title, section, status (live/soon), icon
│   ├── circuit.js          statevector engine: gates, rotations, measurement, classical control
│   ├── bloch.js            Bloch vectors, gate -> rotation axis/angle, partial rotations
│   ├── format.js           textbook formatting: (|00⟩ + |11⟩)/√2, 1/√2, π/4
│   ├── grover.js           Grover's search from real gates + closed-form results
│   ├── protocols.js        teleportation, superdense coding, BB84 (every photon a real qubit)
│   ├── algorithms.js       Deutsch-Jozsa, Bernstein-Vazirani, QFT, phase estimation, Shor
│   ├── sandbox.js          sandbox grid model, URL format (n=2&c=H0/C0_X1), lesson import
│   ├── pauli.js            parses Pauli sums like 0.5*Z0 Z1 + X2
│   ├── dynamics.js         Hamiltonian dynamics: exact evolution and Trotter circuits
│   ├── wave.js             1D wave mechanics (ħ = m = 1): eigenstates, split-operator evolution,
│   │                       shooting (Numerov), transmission through any potential
│   ├── fft.js              radix-2 FFT
│   ├── spin.js             spin-1/2: measurement on any axis, Stern-Gerlach chains, exact
│   │                       magnetic resonance (rotating frame), spin-echo ensembles
│   ├── approx.js           Kronig-Penney bands, identical particles, perturbation theory,
│   │                       variational method, WKB levels and tunnelling
│   ├── noise.js            CHSH game, density matrices and partial traces, decoherence,
│   │                       T1/T2 noise, repetition codes, Shor's nine-qubit code
│   ├── optics.js           photoelectric effect, double-slit patterns and sampling,
│   │                       Mach-Zehnder amplitudes, bomb tester, quantum Zeno
│   ├── hydrogen.js         hydrogen orbitals (R_nl, real Y_lm), energies, Rydberg lines,
│   │                       wavelength colours, electron-cloud sampling
│   └── expr.js             safe formula parser for V(x), no eval
├── ui/                   browser components
│   ├── shell.js            nav with topics menu, Dark/Light switch, footer, Present mode
│   ├── lesson.js           lesson frame: steps, progress, keyboard/clicker navigation
│   ├── circuit-lesson.js   engine for circuit lessons (circuit, dials, Bloch, sampler, views)
│   ├── circuit-view.js     gate-level circuit diagram (SVG)
│   ├── dials.js            amplitude dials: size = probability, colour/hand = phase
│   ├── bloch.js            draggable 3D Bloch sphere
│   ├── sampler.js          repeated measurement vs predicted probabilities
│   ├── wave-plot.js        phase-coloured |ψ|², level diagrams, momentum, quantum carpets
│   ├── player.js           play/pause/scrub bar for the wave lessons
│   ├── interferometer.js   Mach-Zehnder optical table with amplitude dials
│   └── charts.js, amplitude-bars.js, circuit-strip.js
├── <topic>/              one folder per lesson: app.js (+ index.html)
├── sandbox/              circuit sandbox: drag gates, live state, presets, shareable links
├── schrodinger/          Schrödinger playground: type or draw V(x), levels, packets
├── playground/           Hamiltonian Playground: Pauli-sum Hamiltonians, exact vs Trotter
├── tools/make-pages.mjs  writes each lesson's index.html from the catalog
├── tools/set-status.mjs  marks catalog topics live or soon
└── tests/                Node tests + Python reference generator
```

### Adding a lesson

1. Add its entry in `lib/catalog.js` with `status: 'soon'`.
2. Put the physics in `lib/` and test it in `tests/` against something independent.
3. Write `web/<slug>/app.js`. Circuit-based lessons call `runCircuitLesson({...})` from
   `ui/circuit-lesson.js` with their steps; custom lessons use `mountLesson` directly. Never reuse
   the frame's ids (`count`, `steps`, `back`, `next`, `caption`, `stage`, `try-slot`, ...).
4. Run `node web/tools/set-status.mjs live <slug>` and `node web/tools/make-pages.mjs`.
5. Check a few steps visually, in both themes, and at phone width (recipes in `PROJECT.md`).

## Conventions and limits

- Qubit 0 is written first in Pauli strings and kets (`ZXI` is Z on qubit 0, |01⟩ has qubit 1 set). Qiskit uses the opposite order.
- Wave, spin and approximation code uses ħ = m = 1; hydrogen uses atomic units; spectral wavelengths are vacuum values.
- Up to 10 qubits, which is small enough that a laptop computes everything exactly. This is a learning tool, not a demonstration of quantum advantage.
- In the Hamiltonian Playground the Trotter circuit is noiseless, and the CNOT count is a rough compile estimate (a CNOT ladder per Pauli rotation).
