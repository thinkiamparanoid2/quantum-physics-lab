# Quantum Physics Lab: project handoff

This is the complete briefing for anyone (a person or an AI coding agent) picking this project up
without the conversation that built it. Read it once, top to bottom, before changing anything.
`CLAUDE.md` holds the short list of rules; this file explains the whole project and why it is the
way it is.

- Live site: <https://quantum-physics-lab.vercel.app> (Vercel Hobby, deploys from `main`)
- Repository: <https://github.com/thinkiamparanoid2/quantum-physics-lab> (public)
- Owner: GitHub `thinkiamparanoid2`, commits as "Ishmam Rashid Bhuiyan"
- Local checkout: `F:\Quantum` on Windows 10 (RTX 3070); Python venv at `.venv/` (Python 3.12)
- State at handoff (2026-09-27): `main` at the merge of PR #15. 39 live topics, 79 automated
  tests (72 web + 7 Python), CI green, nothing uncommitted, no open pull requests.

---

## 1. What this project is

**A free, browser-based, PhET-style website for teaching quantum physics**, built for two
audiences: students learning quantum mechanics, and teachers who want to put a live visual on a
projector instead of drawing it by hand. The owner started it because their own teacher hand-drew
quantum algorithms and students got lost. The measure of success is that a real teacher uses it
in class.

Every lesson:

- is a sequence of short **steps**, each with a paragraph of explanation and a live visual;
- has a **Try it** panel of controls, a **Present** mode (full screen, big caption, keyboard or
  clicker navigation) and a **Copy link** button (the step is in the URL);
- runs its physics **exactly or with an independently checked numerical method**, in the browser.

The repo also contains a smaller **Python lab** (`engine/`, `modules/`): Qiskit and PennyLane
simulations, the first being pair production in the lattice Schwinger model. That was the
project's starting point; the website is now the main product, live at
<https://quantum-physics-lab.vercel.app>.

### How it got here (history)

1. Started from `docs/project-ideas.md` (a portfolio guide of quantum-simulation ideas). The owner
   chose to build a "quantum lab" repo that could grow, starting with the **Schwinger model**
   (Qiskit, validated against exact diagonalization), then switched the animation to **PennyLane**.
2. The owner questioned who would use a downloadable animation and pivoted to a **browser tool**
   (the Hamiltonian Playground, `web/playground/`), then to a **multi-topic teaching website**:
   "heaven for teachers".
3. Built the site shell, a "quantum" dark theme with a light theme, the lesson frame, Present mode,
   and the Qubits, Protocols and Algorithms lessons plus a circuit sandbox (PRs #1 to #9; an
   earlier stacked-PR merge went wrong and was recovered in #9).
4. Researched university syllabi (MIT, Cambridge, Oxford and others, `docs/curriculum.md`) and, at
   the owner's request ("lets not only fixate into quantum computing"), broadened to quantum
   mechanics in five phases:
   - **Phase A** (#10): waves and the Schrödinger equation, and the Schrödinger playground
   - **Phase B** (#11): spin and atoms
   - **Phase C** (#13): the experiments that started it (plus #12, a BB84 bug fix found on the way)
   - **Phase D** (#14): nonlocality, noise and error correction
   - **Phase E** (#15): many particles and approximations, Compton scattering, and a polish pass

The owner's standing pattern was "merge it and start the next phase" after CI passed.

---

## 2. Everything on the site

Sections carry 4-bit "kets" as labels (a design touch). The order below is the learning path;
each section's lessons are numbered from 1.

| Ket | Section (`id`) | Lessons (`slug`) |
|---|---|---|
| \|0000⟩ | The experiments that started it (`experiments`) | `photoelectric`, `compton`, `double-slit`, `mach-zehnder`, `bomb-tester` |
| \|0001⟩ | Waves and the Schrödinger equation (`waves`) | `wave-packets`, `particle-in-a-box`, `harmonic-oscillator`, `tunnelling`, `shooting-method` |
| \|0010⟩ | Spin and atoms (`atoms`) | `stern-gerlach`, `magnetic-resonance`, `hydrogen`, `atomic-spectra` |
| \|0011⟩ | Many particles and approximations (`approx`) | `bands`, `identical-particles`, `perturbation`, `variational`, `wkb` |
| \|0100⟩ | Qubits (`foundations`) | `qubit`, `measurement`, `interference`, `entanglement` |
| \|0101⟩ | Protocols (`protocols`) | `teleportation`, `superdense-coding`, `bb84` |
| \|0110⟩ | Algorithms (`algorithms`) | `deutsch-jozsa`, `bernstein-vazirani`, `grover`, `qft`, `phase-estimation`, `shor` |
| \|0111⟩ | Nonlocality, noise and error correction (`noise`) | `bell-test`, `decoherence`, `error-correction`, `shor-code` |
| \|1000⟩ | Tools (`tools`) | `sandbox` (circuit sandbox), `schrodinger` (Schrödinger playground), `playground` (Hamiltonian Playground) |

Each lesson lives at `web/<slug>/` (`app.js` plus a generated `index.html`), and its URL is
`/<slug>/` with `#step=N` (1-based) selecting a step. A few lessons also accept `#t=` (a time, for
lessons with a player) or other parameters (circuit lessons put their Try-it settings in the hash;
the tools put everything there).

What each lesson shows, briefly:

- **photoelectric**: a vacuum tube with photons and electrons; 7 metals; wavelength, brightness,
  voltage; current–voltage curve; Millikan plot that fits Planck's constant from recorded points.
- **compton**: the collision drawn to scale with electron recoil; Δλ against θ; the two-peak
  spectrum; why visible light never shows it.
- **double-slit**: animated top view of the waves (schematic); hits land one by one on a screen;
  histogram against theory; light or electrons (relativistic de Broglie λ); one slit closed; a
  which-path detector of adjustable strength.
- **mach-zehnder**: single photons on an optical table with amplitude dials on every path; phase,
  shutters, polarisation tag, second splitter on or off.
- **bomb-tester**: Elitzur–Vaidman interaction-free measurement; a bomb-sorting game that hides
  the answer; the quantum Zeno upgrade.
- **wave-packets**: phase-coloured |ψ|², momentum distribution, uncertainty, spreading.
- **particle-in-a-box**: stationary states, sloshing superpositions, exact revivals, quantum carpet.
- **harmonic-oscillator**: levels, eigenstates with the classical probability, coherent and
  squeezed states, Poisson weights.
- **tunnelling**: packet scattering (split-operator) against the exact T(E); barrier, well
  (Ramsauer–Townsend) and double barrier (resonant tunnelling); packet length control.
- **shooting-method**: Numerov integration from a wall; the tail at the far wall; animated
  bisection; levels against the matrix method.
- **stern-gerlach**: up to three magnets at any angle; atoms fired one by one (or 1000 at once);
  counts against predictions; spin on the Bloch sphere.
- **magnetic-resonance**: Larmor precession, Rabi oscillations (lab and rotating frame), the
  resonance line, π and π/2 pulses, dephasing and spin echo with 48 spins.
- **hydrogen**: 3D electron clouds (5000 sampled points, drag to turn), a slice through the nodes,
  radial probability, orbitals to 4f, energy checked live by solving the radial equation.
- **atomic-spectra**: click two levels to emit or absorb; photon drawn to scale in true colour;
  Lyman, Balmer, Paschen and Brackett on a log wavelength axis; comparison with NIST.
- **bands**: chains of 1–12 wells solved exactly; levels against N inside Kronig–Penney bands;
  E(k); electron filling showing metal against insulator.
- **identical-particles**: joint density for distinguishable particles, bosons and fermions;
  separation distribution; Pauli; level filling and the Fermi level.
- **perturbation**: first and second order against exact energies and states; oscillator or box
  with a field, x⁴ or a bump.
- **variational**: one- or two-Gaussian trials; ⟨H⟩ against width above the exact line;
  optimiser; overlap.
- **wkb**: WKB against exact wavefunctions, including the blow-up at turning points; phase-space
  orbits of quantized area; error table; tunnelling estimate against exact.
- **qubit / measurement / interference / entanglement**: Bloch sphere, amplitude dials, sampling,
  head-to-tail amplitude arrows, reduced Bloch arrows.
- **teleportation / superdense-coding / bb84**: full protocols with mid-circuit measurement and
  classical control; BB84 simulates every photon with and without an eavesdropper.
- **deutsch-jozsa / bernstein-vazirani / grover / qft / phase-estimation / shor**: step-through
  circuits; Shor factors 15 end to end with continued fractions.
- **bell-test**: the CHSH game with a classical rule (all 16 shown) or a Bell pair; correlations
  and S; no-signalling.
- **decoherence**: coin-flip mixtures; entanglement with 0–10 environment qubits (drawn and
  simulated); T₁ and T₂ with a Ramsey fringe; density matrix, purity, entropy.
- **error-correction**: three-qubit code with ancillas, syndrome measurement, corrections
  conditioned on two bits; bit- and phase-flip versions; when the code is worth it.
- **shor-code**: nine-qubit code; any error on any qubit comes back; threshold chart.
- **sandbox**: drag gates onto wires, live state, presets, shareable links; lessons open here.
- **schrodinger**: type a formula (safe parser, no eval) or draw V(x); 110 eigenstates; packets
  or chosen levels evolve exactly; shareable links.
- **playground**: type a Pauli-sum Hamiltonian; exact evolution against a Trotter circuit.

---

## 3. Architecture

### Principles

- **Static site, no build step, no framework, no dependencies.** Plain ES modules, HTML and one
  CSS file. It must work from any static host (planned: Vercel with Root Directory `web`).
- **Physics in `web/lib/` (pure, no DOM, tested in Node); drawing and interaction in `web/ui/` and
  each lesson's `app.js`.**
- **Everything client-side and deterministic where it matters**: seeded random numbers
  (`seededRandom` in `lib/circuit.js`) so a step looks the same each time.

### Directory map

```
F:\Quantum
├── PROJECT.md              this file
├── CLAUDE.md               short rules for agents (read automatically by Claude Code)
├── README.md               the public face: tour, screenshots, how it is checked
├── docs/
│   ├── curriculum.md       university-syllabus research, coverage table, phases A–E
│   ├── project-ideas.md    the original portfolio ideas guide (history)
│   └── screenshots/        images used by README.md
├── .github/workflows/tests.yml   CI: web tests (Node 22) and Python tests (3.12)
├── engine/, modules/, tests/     Python lab (see section 7)
├── pytest.ini              pythonpath = . , testpaths = tests
├── requirements.txt        qiskit, qiskit-aer, qiskit-ibm-runtime, pennylane, numpy, scipy, ...
└── web/                    the website (deploy root)
    ├── index.html, home.js landing page: hero Bloch sphere, primer, learning path, teachers
    ├── styles/site.css     the whole design system, dark and light themes
    ├── lib/                physics and data, no DOM
    ├── ui/                 shared browser components
    ├── <slug>/             one folder per lesson or tool
    ├── tools/              make-pages.mjs, set-status.mjs
    ├── tests/              Node tests (node:test) + make_reference.py + reference.json
    └── package.json        "npm test" only; no dependencies
```

### `web/lib/` (physics; all tested)

| File | What it provides |
|---|---|
| `catalog.js` | `SECTIONS` and `TOPICS` (slug, section, title, summary, level, minutes, status `live`/`soon`, SVG icon path); `topic()`, `nextTopic()`, `lessonNumber()`. The single source for navigation, landing page and "next lesson". |
| `circuit.js` | Statevector engine. Qubit q is bit q of the basis index. `GATES`, `rx/ry/rz/phase`, `applyGate(state, q, gate, controls)`, `applyOp`, `runOps(n, ops, until, rng)`, `measureQubit`, `seededRandom`, `ket`, `ketOrder`, `conditionsOf`. Ops are objects: `{gate, target, controls?, angle?}`, `{gate:'MEASURE', target, bit}`, classical conditions `if: {bit, value}` or a list of them (all must match), `BLOCK` (custom apply) and `BARRIER`. |
| `bloch.js` | Bloch vectors, gate to rotation axis and angle, `rotateVector`, `rotationMatrix`. |
| `format.js` | Textbook formatting: `formatState` ((\|00⟩ + \|11⟩)/√2), `niceReal`, `percent`, `angleLabel`. |
| `grover.js`, `algorithms.js`, `protocols.js` | Algorithm and protocol circuits and closed-form checks. |
| `sandbox.js` | Sandbox grid model, URL encoding (`n=2&c=H0/C0_X1`), `fromOps` to import a lesson circuit. |
| `pauli.js`, `dynamics.js` | Pauli-sum parser; exact evolution and Trotter circuits for the Hamiltonian Playground. |
| `fft.js`, `wave.js` | 1D wave mechanics in ħ = m = 1. `makeGrid(n, xmin, xmax)` puts hard walls exactly at xmin and xmax. `eigenstates(V, dx, count)` (Sturm bisection + inverse iteration), `Propagator` (split-operator FFT, optional absorbing edges), `shoot`/`shootLevel` (Numerov, lands on the far wall), `transmission(V, dx, E)`, `barrierTransmission`, `gaussianPacket`, `superpose`, `project`, `positionStats`, `momentumDistribution`. |
| `expr.js` | Safe formula parser for V(x) (no eval; own-property lookups so names like `constructor` are rejected). |
| `spin.js` | Spinors, measurement along any axis, Stern–Gerlach chains (`chainIntensities`, `sendAtom`), exact magnetic resonance in the rotating frame (`resonance`, `rabiProbability`), spin-echo ensembles. |
| `hydrogen.js` | R_nl, real Y_lm, `orbital`, `orbitalName`, energies (reduced-mass Rydberg), `wavelengthNm` (vacuum), `wavelengthColor`, `sampleCloud`. |
| `optics.js` | Photoelectric (`collectorCurrent`, `fitLine`, `METALS`), double slit (`slitIntensity`, `slitSampler`, `electronWavelengthNm`), `machZehnder`, `bombTest`, `zenoSuccess`, `compton`. |
| `noise.js` | CHSH (`quantumRound` simulated on the engine, `classicalStrategies`), density matrices, `reducedQubit` (partial trace), `entangleWithEnvironment`, `evolveNoisy` (T₁/T₂), `repetitionFailure`, Shor-code encode/decode ops and `errorOp`. |
| `approx.js` | `kronigPenney`, `kpBands`, `boxPairDensity`, `meanSquaredSeparation`, `perturbed` (first and second order), `gaussianTrialEnergy`, `bestGaussian`, `action`, `wkbLevel`, `wkbTransmission`. |

### `web/ui/` (browser components)

| File | Role |
|---|---|
| `shell.js` | Nav bar with the Topics mega menu, Dark/Light switch, footer, `setupPresent`, `shareButton`, `href`. |
| `lesson.js` | `mountLesson({slug, onNavigate, sandbox})` returns `{render(steps, index)}`. It fills the lesson frame (title, numbered steps, back/next, progress, Present caption, next-lesson link) and owns keyboard/clicker navigation. |
| `circuit-lesson.js` | `runCircuitLesson(def)`: a whole lesson from circuit steps (circuit diagram, dials + state formula, per-qubit Bloch spheres, sampler, custom views, params in Try it and in the URL, Open in sandbox). Used by the qubit, protocol, algorithm and error-correction lessons. |
| `circuit-view.js` | SVG circuit diagram with clickable gates and condition labels. |
| `dials.js` | Amplitude dials and `phaseColor(φ)` (hue = 187° + φ), the site-wide phase colour wheel. |
| `bloch.js` | `BlochView` class: draggable 3D Bloch sphere with trail, axis, custom axis names, ensemble arrows (`others`). |
| `charts.js` | `theme()` reads CSS variables into canvas colours; `prep(canvas)` (DPR-aware, clears); `xAxis`, `yAxis`, `lineChart`, `barChart`, `heatmap`. |
| `wave-plot.js` | `drawDensity` (phase-coloured \|ψ\|²), `drawStates`, `drawMomentum`, `drawCarpet`. |
| `player.js` | `Player`: play/pause/scrub/speed bar (duration, `speed` property, `seek`, `setDuration`). |
| `interferometer.js` | Mach–Zehnder optical table used by `mach-zehnder` and `bomb-tester` (`hideAmps` mode for the game). |
| `sampler.js`, `register-chart.js`, `amplitude-bars.js`, `circuit-strip.js` | Measurement sampler and other circuit-lesson visuals. |

### How a lesson page is put together

- `web/tools/make-pages.mjs` writes `web/<slug>/index.html` for every catalog topic that has an
  `app.js`, from one shared template (the **lesson frame**). Custom pages it skips: `grover`,
  `playground`, `sandbox`, `schrodinger` (they have hand-written `index.html`).
- The frame provides fixed element ids: `lesson-head`, `steps`, `count`, `back`, `next`,
  `try-slot`, `stage`, `caption`, `next-lesson`. **A lesson must never reuse these ids**
  (`web/tests/pages.test.js` enforces this and also forbids duplicate ids within a lesson).
- A custom lesson's `app.js` typically: inserts its cards into `#stage`, its controls into
  `#try-slot`, defines `STEPS = [{title, preset, html, play?}]` (html may be a function of the
  current settings), calls `mountLesson`, and on `enterStep(i)` applies the preset, updates the
  URL hash (`history.replaceState`) and renders. `window` fires `themechange` when the theme
  flips; lessons redraw on it and on a `ResizeObserver`.
- Theme: `[data-theme]` on `<html>`, stored in `localStorage` under `theme`; the inline head
  script sets it before paint. Canvases read colours through `theme()` so both themes work.

---

## 4. How correctness is checked

Rule: **every physics result needs an independent check**, whether an exact formula, a second
method or a second framework. No claims of quantum advantage anywhere (at these sizes a laptop is
exact and instant).

`cd web && npm test` runs 72 tests in 15 files (`node --test`, Node 20+). Highlights:

- engine against numpy/scipy and the Qiskit Schwinger Hamiltonian (`reference.json`, regenerated
  by `web/tests/make_reference.py`)
- algorithm and protocol results (QFT = DFT, Grover's sin² law, teleportation fidelity, BB84 error
  rates, Shor factoring 15)
- sandbox round-trips of every lesson circuit
- wave engine:
  - box and oscillator spectra from two methods
  - Gaussian spreading, and a coherent state without spreading
  - transmission against the exact barrier formula
- spin:
  - resonance against RK4 integration of the time-dependent Schrödinger equation
  - Rabi's formula, and echo refocusing
- hydrogen:
  - normalisation, orthogonality and ⟨r⟩
  - the radial equation solved numerically gives −1/2n²
  - Balmer lines against NIST
- optics:
  - stopping-voltage slope h/e and dark-fringe positions
  - Mach–Zehnder equal to the gate circuit Rx(−π/2)·P(φ)·Rx(−π/2)
  - bomb and Zeno probabilities, and Compton energy and momentum conservation
- noise:
  - CHSH bounds, simulated rounds and partial traces
  - decoherence cos(θ/2)ᴺ and repetition codes
  - Shor's code corrects every single-qubit X/Y/Z/rotation
- approximations:
  - Kronig–Penney bands against a 12-well chain, and exchange terms against analytic values
  - Stark shift −F²/2, the variational bound, and WKB accuracy
- page structure (frame-id clashes, duplicate ids)

`.venv/Scripts/python.exe -m pytest tests/ -q` runs the 7 Python tests (engine and Schwinger model
in Qiskit and PennyLane). CI runs both on every push and pull request.

### Visual verification recipes (Windows)

- **Local server**: `python -m http.server 8765 --bind 127.0.0.1 --directory web` (in Claude Code
  the Browser pane config `.claude/launch.json` names it `playground`; that file is git-ignored).
- **Headless screenshots** with Edge:
  `"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1400,1100 --virtual-time-budget=4000 --screenshot='C:\absolute\path.png' "http://127.0.0.1:8765/<slug>/#step=3"`.
  Use an **absolute Windows path** for `--screenshot` (relative paths silently fail).
- **Console sweep**: the same command with `--enable-logging=stderr --v=0 --dump-dom` and a
  grep for `CONSOLE`/`Uncaught` (ignore the Edge extension line mentioning `chrome-extension://`).
  At handoff all 39 pages load without errors.
- **Light theme in headless Edge**: use a persistent `--user-data-dir`, first load a temporary page
  that runs `localStorage.setItem("theme","light")` (delete that page afterwards).
- **Caveats**: headless Edge barely advances `requestAnimationFrame` (animations look frozen), and it
  lays pages out wider than a narrow `--window-size`. The Claude Code Browser pane pauses
  `requestAnimationFrame` when hidden. To test animation logic there, fetch the lesson's `app.js`,
  replace `requestAnimationFrame(` with a timer-based shim, and import it from a Blob URL after
  clearing the stage. Check phone layout with the Browser pane's mobile viewport and by measuring
  `document.documentElement.scrollWidth` (all pages fit at 375 px).

---

## 5. Conventions and gotchas

- **Qubit ordering differs by layer.** Qiskit is little-endian (rightmost character = qubit 0).
  The website writes qubit 0 first in Pauli strings and kets; in the JS engine qubit q is bit q of
  the index; registers in `lib/algorithms.js` are MSB-first. PennyLane's
  `qml.matrix(wire_order=...)` treats the first wire as most significant.
- **`PauliEvolutionGate.to_matrix()` is exact**: `.decompose()` a Trotter circuit before simulating
  it (see `engine/evolution.py`).
- **Units**: ħ = m = 1 in all wave, spin and approximation code; hydrogen uses atomic units (a₀ = 1,
  hartree), converted to eV with the reduced-mass Rydberg 13.598 eV; wavelengths are vacuum values.
- **Grids**: `makeGrid` puts hard walls exactly at the ends. Sharp potential steps on a grid should
  be cell-averaged (see `tunnelling/app.js`: without it a barrier of width 1 had the wrong width and
  transmission was about 10% off).
- **Frame ids**: never use `count`, `steps`, `back`, `next`, `caption`, `stage`, `try-slot`,
  `lesson-head`, `next-lesson` inside a lesson; this broke BB84's photon-count menu and nearly two
  other lessons.
- **Line endings**: Git on this machine warns "LF will be replaced by CRLF", and regenerating pages
  can leave files that differ only in line endings. Check with `git diff --ignore-cr-at-eol` and
  discard them (`git checkout -- <files>`) rather than committing noise.
- **Python heredocs that write JavaScript**: `\n` and `\d` inside a non-raw Python string become
  real characters or warnings; prefer the Edit tool or raw strings for JS containing escapes.
- **Catalog strings** use single quotes: write ’ (typographic apostrophe) in titles and summaries,
  or escape it.
- **Honesty in copy**: schematic visuals are labelled "not to scale"; simplified models say so
  (for example the photoelectric energy distribution, normal vs anomalous Zeeman, T₂ not undone by
  echoes). Keep that standard.

---

## 6. Workflow

- `main` is what gets deployed; never commit to it directly except trivial fixes.
- One branch per unit of work, merged by pull request: `topic/<name>` (new lessons),
  `feature/<name>` (shared site features), `lab/<name>` (Python), `fix/<name>`, `docs/<name>`.
- Keep web and Python tests passing before opening a PR; CI must be green before merging.
- GitHub CLI: `"/c/Program Files/GitHub CLI/gh.exe"` (already authenticated as the owner).
- Commit messages: a short imperative subject, a body explaining what and why, ending with the
  `Co-Authored-By` line the agent environment specifies. PR bodies list lessons, engine changes and
  checks.
- Adding a lesson:
  1. Add the topic to `web/lib/catalog.js` (status `soon`).
  2. Put its physics in `web/lib/` with tests in `web/tests/` (an independent check).
  3. Write `web/<slug>/app.js` (custom with `mountLesson`, or `runCircuitLesson`).
  4. Run `node web/tools/set-status.mjs live <slug>` and `node web/tools/make-pages.mjs`.
  5. Check it: screenshots of a few steps, the console, the light theme and phone width.
  6. Update README.md (section table, test count, tour if useful) and `docs/curriculum.md`.

---

## 7. The Python lab

- `engine/`: shared pipeline "encode, evolve e^{−iHt}, measure": `evolution.py` (Trotter
  circuits), `exact.py` (exact diagonalization, the ground truth), `measurement.py`, `noise.py`
  (depolarizing model and zero-noise extrapolation).
- `modules/schwinger_model/`: lattice Schwinger model (1+1D QED) pair production in Qiskit and
  PennyLane, `run.py`, `animate.py` (PennyLane animation), plots in `plots/`.
- `modules/README.md` defines the module convention (README with physics, Hamiltonian, validation,
  hardware run, limitations).
- Real-hardware runs on IBM Quantum were planned under `hardware_runs/` (not created yet;
  credentials files are git-ignored). The website's Hamiltonian Playground grew out of this lab.

---

## 8. Open decisions and next steps

Decisions that belong to the owner (do not act without asking):

- **License**: none yet. MIT was suggested; the owner said to keep it in mind. Do not add one
  until they confirm.
- **Deployment**: done on 2026-09-28. Vercel project `quantum-physics-lab` under the owner's Hobby
  account ("Ishmam Rashid Bhuiyan"), Root Directory `web`, preset "Other", no build command.
  Every push to `main` redeploys; pull requests get preview URLs. A custom domain is optional
  (Vercel → Settings → Domains) and is the owner's call.

Content still open (from `docs/curriculum.md`):

- probability current; the delta potential; a particle on a ring
- angular-momentum operators, ladder algebra, addition of angular momenta
- time-dependent perturbation theory, Fermi's golden rule, the adiabatic theorem
- finite-temperature Fermi–Dirac and Bose–Einstein statistics
- real-hardware runs of the Python lab

Ideas that would help teachers further: printable worksheets per lesson, a teacher's page with
learning goals per lesson, translations, and accessibility review (keyboard use of canvases,
screen-reader text for visuals).

---

## 9. Working with the owner

- A student of quantum computing building a portfolio (LinkedIn, recruiters); values tools people
  actually use over one-off demos; asked for a "quantum feeling", an introduction, easy navigation,
  lessons plus a teacher mode, and dark and light themes.
- Likes everything tracked in git with branches and PRs; prefers PennyLane in the Python lab.
- Communicates briefly ("yes merge it and start phase B"); report results plainly, including
  mistakes found and fixed, and confirm before anything irreversible or public beyond the repo.
