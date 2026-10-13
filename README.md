<div align="center">

# Quantum Physics Lab

**Quantum physics, made visible.**<br>
Interactive, step-by-step lessons where you watch wave packets tunnel through walls, electron clouds take shape, qubits rotate,
surface codes catch errors, circuits learn and electron–positron pairs appear out of the vacuum:
built for students learning quantum mechanics and computing, and for teachers explaining them.

### [**Open the live site → quantum-physics-lab.vercel.app**](https://quantum-physics-lab.vercel.app)

[![Tests](https://github.com/thinkiamparanoid2/quantum-physics-lab/actions/workflows/tests.yml/badge.svg)](https://github.com/thinkiamparanoid2/quantum-physics-lab/actions/workflows/tests.yml)
![No build step](https://img.shields.io/badge/build_step-none-8b7bff)
![Runs in the browser](https://img.shields.io/badge/runs-in_your_browser-2ee6f5)
[![Live site](https://img.shields.io/badge/live-quantum--physics--lab.vercel.app-2ee6f5)](https://quantum-physics-lab.vercel.app)
[![MIT license](https://img.shields.io/badge/license-MIT-8b7bff)](LICENSE)
![Topics](https://img.shields.io/badge/interactive_topics-84-8b7bff)
![Physics checks](https://img.shields.io/badge/physics_checks-214-2ee6f5)
![Real hardware](https://img.shields.io/badge/run_on-IBM_Quantum-8b7bff)

<img src="docs/screenshots/home.png" alt="Landing page: 'Quantum physics, made visible.' beside a Bloch sphere rotating under a Hadamard gate" width="900">

</div>

## Why

Quantum mechanics lives in complex numbers and high-dimensional spaces, so it is usually taught with
equations and hand-drawn sketches. This project makes the invisible parts visible: wavefunctions are
coloured by their phase as they move, amplitudes become dials, every single-qubit gate becomes a
rotation you can watch, and every algorithm runs one gate at a time with the explanation beside it. Open a topic, press
**Present**, and it's ready for a projector.

## What's inside

84 interactive lessons in five tracks: quantum mechanics, quantum computing, noise and error
correction, quantum machine learning, and quantum fields on a lattice. Every lesson has teacher
notes (goals, prerequisites, common misconceptions) and a short self-check quiz.

| Section | Topics |
|---|---|
| **The experiments that started it** | [The photoelectric effect](web/photoelectric/) · [Compton scattering](web/compton/) · [The double slit, one particle at a time](web/double-slit/) · [The Mach–Zehnder interferometer](web/mach-zehnder/) · [The quantum bomb tester](web/bomb-tester/) |
| **Waves and the Schrödinger equation** | [Wave packets and uncertainty](web/wave-packets/) · [Particle in a box](web/particle-in-a-box/) · [A particle on a ring](web/particle-on-ring/) · [The harmonic oscillator](web/harmonic-oscillator/) · [Tunnelling and scattering](web/tunnelling/) · [Probability current](web/probability-current/) · [The delta potential](web/delta-potential/) · [Finding energy levels: the shooting method](web/shooting-method/) |
| **Spin, angular momentum and atoms** | [Stern–Gerlach: measuring spin](web/stern-gerlach/) · [Angular momentum and ladder operators](web/angular-momentum/) · [Adding angular momenta](web/adding-angular-momenta/) · [Spin precession and magnetic resonance](web/magnetic-resonance/) · [The hydrogen atom](web/hydrogen/) · [Atomic spectra](web/atomic-spectra/) |
| **Many particles and approximations** | [Crystals and energy bands](web/bands/) · [Identical particles](web/identical-particles/) · [Quantum statistics at finite temperature](web/quantum-statistics/) · [Perturbation theory](web/perturbation/) · [Time-dependent perturbation theory and Fermi’s golden rule](web/golden-rule/) · [The adiabatic theorem and Landau–Zener](web/adiabatic/) · [The variational method](web/variational/) · [The WKB approximation](web/wkb/) |
| **Qubits** | [The qubit](web/qubit/) · [Measurement](web/measurement/) · [Interference and phase](web/interference/) · [Entanglement](web/entanglement/) |
| **Quantum information** | [Entanglement, measured](web/entanglement-measures/) · [Density matrices and quantum channels](web/channels/) · [Measurements beyond yes and no](web/state-discrimination/) · [No-cloning and monogamy](web/no-cloning/) · [Quantum walks](web/quantum-walk/) |
| **Protocols** | [Quantum teleportation](web/teleportation/) · [Superdense coding](web/superdense-coding/) · [BB84 key distribution](web/bb84/) |
| **Algorithms** | [Deutsch–Jozsa](web/deutsch-jozsa/) · [Bernstein–Vazirani](web/bernstein-vazirani/) · [Simon’s algorithm](web/simon/) · [Grover's search](web/grover/) · [Quantum Fourier transform](web/qft/) · [Phase estimation](web/phase-estimation/) · [Amplitude estimation](web/amplitude-estimation/) · [Hamiltonian simulation: Trotter and qDRIFT](web/hamiltonian-simulation/) · [Adiabatic quantum computing](web/adiabatic-qc/) · [HHL and its caveats](web/hhl/) · [Shor's algorithm](web/shor/) |
| **Nonlocality and noise** | [Bell’s theorem: the CHSH game](web/bell-test/) · [Decoherence and mixed states](web/decoherence/) |
| **Quantum error correction** | [Quantum error correction](web/error-correction/) · [Shor’s nine-qubit code](web/shor-code/) · [Stabilizers](web/stabilizers/) · [Steane’s seven-qubit code](web/steane-code/) · [The surface code](web/surface-code/) · [Decoding](web/decoding/) · [The threshold](web/threshold/) · [Fault tolerance: noisy measurements](web/fault-tolerance/) · [Magic states](web/magic-states/) · [Toric code and anyons](web/toric-code/) |
| **Real quantum hardware** | [Building a qubit: the transmon](web/transmon/) · [Pulses, leakage and DRAG](web/drag/) · [Randomized benchmarking](web/randomized-benchmarking/) · [Error mitigation: readout and zero-noise extrapolation](web/error-mitigation/) |
| **Quantum machine learning** | [Encoding data](web/encoding/) · [A classifier that trains while you watch](web/qml-classifier/) · [Quantum models are Fourier series](web/fourier-models/) · [Quantum kernels](web/quantum-kernels/) · [Barren plateaus, measured](web/barren-plateaus/) · [VQE and QAOA](web/vqe-qaoa/) · [Is there an advantage?](web/qml-advantage/) |
| **Quantum fields on a lattice** | [From oscillators to particles](web/phonons/) · [Fock space, bosons and fermions](web/fock-space/) · [Jordan–Wigner: fermions as qubits](web/jordan-wigner/) · [The Schwinger model: pair creation](web/schwinger/) · [Confinement and string breaking](web/string-breaking/) · [The transverse-field Ising model](web/ising-transition/) · [Entanglement area law and MPS](web/area-law/) · [Simulating fields on quantum hardware](web/fields-hardware/) |
| **Tools** | [Circuit sandbox](web/sandbox/) · [Schrödinger playground](web/schrodinger/) · [Hamiltonian Playground](web/playground/) |

## A quick tour

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/decoding.png" alt="Surface-code decoding: union-find clusters grown around lit checks on a distance-5 patch"><br>
      <b>Decoding the surface code.</b> Click errors onto a distance-5 patch; matching and union-find find the correction live.</td>
    <td width="50%"><img src="docs/screenshots/threshold.png" alt="Threshold plot: logical against physical error rate for distances 3, 5 and 7"><br>
      <b>The threshold.</b> Thousands of simulated memory experiments in a background worker; below threshold bigger codes win.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/magic.png" alt="15-to-1 distillation: output error against input error with the 35p³ law"><br>
      <b>Magic states.</b> 15-to-1 distillation: every undetected error pattern, and the 35p³ law it adds up to.</td>
    <td width="50%"><img src="docs/screenshots/toric.png" alt="Toric code with an e anyon carried around an m anyon"><br>
      <b>Toric code.</b> Carry an e anyon around an m and the state picks up −1, read off a stabilizer tableau.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/schwinger.png" alt="Schwinger model: electron and positron densities and electric field after a quench"><br>
      <b>The Schwinger model.</b> Quench the bare vacuum of 1+1D QED and watch pairs and electric flux appear.</td>
    <td width="50%"><img src="docs/screenshots/string.png" alt="String breaking: flux string between two static charges and the potential flattening"><br>
      <b>String breaking.</b> Exact ground states with two static charges: the flux string snaps into a pair.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/ising.png" alt="Transverse-field Ising model: gap, order and entanglement against field"><br>
      <b>A quantum phase transition.</b> The gap closes and entanglement grows only at h = J; Kibble–Zurek kinks after a ramp.</td>
    <td width="50%"><img src="docs/screenshots/arealaw.png" alt="TEBD entanglement growth at several bond dimensions against the exact curve"><br>
      <b>Tensor networks.</b> Area law, matrix product states, and TEBD running out of bond dimension.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/classifier.png" alt="Variational classifier decision boundary on circle data after training"><br>
      <b>A classifier that trains while you watch.</b> Exact parameter-shift gradients, checked against PennyLane.</td>
    <td width="50%"><img src="docs/screenshots/vqe.png" alt="VQE landscape and the H₂ dissociation curve against Hartree–Fock and exact energies"><br>
      <b>VQE.</b> The H₂ dissociation curve on PennyLane's Hamiltonians, where Hartree–Fock fails and VQE doesn't.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/barren.png" alt="Gradient variance against qubits for global and local costs"><br>
      <b>Barren plateaus, measured.</b> Gradients of a global cost vanish exponentially; a local cost's don't.</td>
    <td width="50%"><img src="docs/screenshots/drag.png" alt="DRAG scan: gate error and leakage against the DRAG coefficient"><br>
      <b>Pulses and DRAG.</b> A three-level transmon: leakage, phase errors and the correction that fixes them.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/bands.png" alt="Energy bands: levels of chains of 1 to 12 wells falling inside the shaded Kronig-Penney bands, with E(k)"><br>
      <b>Energy bands.</b> Add wells one at a time and watch single levels spread into bands; fill them to get a metal or an insulator.</td>
    <td width="50%"><img src="docs/screenshots/variational.png" alt="Variational method: a two-Gaussian trial state nearly matching the exact double-well ground state"><br>
      <b>Variational method.</b> Tune a trial wavefunction; its energy can approach the true ground state but never go below it.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/bell-test.png" alt="CHSH game: 4000 rounds won at 85%, above the classical 75% limit, with the measurement directions and correlation table"><br>
      <b>Bell's theorem.</b> Play the CHSH game: fixed rules stop at 75%, a shared Bell pair wins 85%.</td>
    <td width="50%"><img src="docs/screenshots/decoherence.png" alt="Decoherence: a Bloch arrow spiralling inward with its density matrix and a decaying Ramsey fringe"><br>
      <b>Decoherence.</b> Arrows shrink inside the sphere as the qubit leaks information to its surroundings.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/double-slit.png" alt="Double slit: 3000 photon hits forming fringes, with the histogram matching the predicted pattern"><br>
      <b>Double slit.</b> Photons or electrons land one dot at a time and build the fringes; a which-path detector fades them out.</td>
    <td width="50%"><img src="docs/screenshots/mach-zehnder.png" alt="Mach-Zehnder interferometer with amplitude dials showing the cancellation at the dark detector"><br>
      <b>Mach–Zehnder.</b> Amplitude dials on every path show why one detector never clicks, until you block or mark a path.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/tunnelling.png" alt="Tunnelling lesson: a wave packet has split at a thin barrier, 58% reflected and 42% transmitted"><br>
      <b>Tunnelling.</b> A packet splits at a wall it can't climb; the share that gets through matches the exact T(E) curve.</td>
    <td width="50%"><img src="docs/screenshots/schrodinger.png" alt="Schrödinger playground with a periodic potential whose energy levels bunch into bands"><br>
      <b>Schrödinger playground.</b> Type or draw any potential. Here a crystal lattice's levels bunch into bands.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/hydrogen.png" alt="Hydrogen 3d z-squared orbital as a 3D electron cloud, a slice through it and its radial probability"><br>
      <b>Hydrogen.</b> 5000 sampled electron positions, a slice showing the nodes, and the energy checked by solving the radial equation.</td>
    <td width="50%"><img src="docs/screenshots/resonance.png" alt="Magnetic resonance: a spin spiralling down the Bloch sphere next to its Rabi oscillation"><br>
      <b>Magnetic resonance.</b> A spin driven at its Larmor frequency spirals down and back: the exact solution against Rabi's formula.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/interference.png" alt="Interference lesson: the two arrows arriving at |1⟩ point in opposite directions and cancel"><br>
      <b>Interference.</b> Each outcome's incoming amplitudes are drawn head to tail, so you can see them add up or cancel.</td>
    <td width="50%"><img src="docs/screenshots/grover.png" alt="Grover's search: amplitude bars with the average line and the marked answer growing"><br>
      <b>Grover's search.</b> The oracle flips a sign; diffusion reflects every amplitude about the average.</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/teleportation.png" alt="Teleportation lesson with the circuit, the state and Bloch spheres for all three qubits"><br>
      <b>Teleportation.</b> Mid-circuit measurements, classically controlled fixes, and a fidelity check against the original.</td>
    <td><img src="docs/screenshots/entanglement.png" alt="Entanglement lesson: both qubits' Bloch arrows have shrunk to nothing"><br>
      <b>Entanglement.</b> After the CNOT neither qubit has a direction of its own; only the pair has a state.</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/shor.png" alt="Shor's algorithm factoring 15"><br>
      <b>Shor's algorithm.</b> Factor 15 end to end, including the continued-fraction arithmetic.</td>
    <td><img src="docs/screenshots/sandbox.png" alt="Circuit sandbox building a GHZ state"><br>
      <b>Circuit sandbox.</b> Drag gates onto wires; every lesson circuit opens here, ready to edit.</td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/bb84.png" alt="BB84 photon table with Eve intercepting"><br>
      <b>BB84.</b> Every photon, basis and error in a key exchange, with and without an eavesdropper.</td>
  </tr>
</table>

## Made for classrooms

- **Present mode:** one click hides everything except the visual and a large caption. Step with the arrow keys or a presentation clicker.
- **Links to an exact moment:** every lesson step has its own link (circuit lessons and the tools also keep their settings), so you can prepare it before class.
- **Dark or light:** the dark theme for screens, a light theme that reads well on projectors.
- **Nothing to install:** no accounts, no server, no build step. Everything runs in the browser.

## How the visuals read

| Visual | What it shows |
|---|---|
| **Amplitude dials** | One disc per basis state. Its area is the probability; its colour and hand are the phase. |
| **Bloch spheres** | Each qubit's state as an arrow. A shorter arrow means the qubit is entangled with others. |
| **Circuit diagrams** | The gates applied so far, the current step highlighted, clickable to jump to any point. |
| **Measurement sampler** | Draw real random outcomes and compare the counts with the predicted probabilities. |

## Is it right?

Every simulation is either exact (statevectors, density matrices, exact diagonalisation) or checked
against an independent method, and **204 web tests and 10 Python tests** say how. The
[checks page](https://quantum-physics-lab.vercel.app/checks/) lists every one. Some highlights:

- **Against other frameworks.** Surface-code matching weights and logical error rates equal **PyMatching**'s, with perfect and with noisy measurements. Classifier outputs and parameter-shift gradients, Fourier coefficients, the ZZ feature-map kernel, the H₂ Hamiltonians and QAOA values equal **PennyLane**'s. The Hamiltonian engine equals **Qiskit** and numpy.
- **Against closed forms.** Amplitude estimation's outcome distribution equals the Brassard–Høyer–Mosca–Tapp formula; 15-to-1 distillation's weight enumerator equals the MacWilliams transform; transverse-field Ising energies equal free fermions, and the Kibble–Zurek ramp follows Dziarmaga's τ^(−1/2) law; randomized benchmarking recovers the exact twirled decay; the transmon approaches Koch et al.'s asymptotics.
- **Two independent solvers.** Lanczos against dense diagonalisation and an independent numpy build (string breaking); charge basis against a phase grid (transmon); exact qDRIFT channels against 4000 sampled circuits; the stabilizer tableau against statevectors (toric-code braiding).
- **Exhaustive cases.** Steane's code against all 21 single-qubit errors; Simon's circuit for every hidden string; both surface-code decoders against every error of weight ≤ (d − 1)/2; HHL's output against A⁻¹b.
- **The foundations.** Box and oscillator levels, wave-packet spreading, exact barrier transmission, hydrogen against NIST, Rabi oscillations, CHSH's 75% and cos²(π/8), the QFT against the DFT, Grover's sin²((2k+1)θ), teleportation for every outcome.

The review also caught a real bug: the original Schwinger-model Hamiltonian (Python lab and
playground) had the signs of its mass and charge terms flipped, so its "vacuum" was the most excited
bare state. It is fixed, and a test now checks that the bare vacuum is the flux-free ground state.

At these sizes a laptop is exact and instant. The point is to see what the mathematics does; no
lesson claims a quantum advantage, and the QML and HHL lessons spell out the evidence on both sides.

## Run it locally

```bash
git clone https://github.com/thinkiamparanoid2/quantum-physics-lab.git
cd quantum-physics-lab
python -m http.server 8765 --directory web
```

Then open <http://localhost:8765>. (ES modules don't load from `file://`, hence the tiny server.)

```bash
cd web && npm test                          # 204 web tests, Node 20+, no dependencies
pip install -r requirements.txt && pytest   # 10 Python tests
```

## Deploy it

The site is live at **<https://quantum-physics-lab.vercel.app>**, deployed by Vercel from `main`;
every merge redeploys it and every pull request gets a preview link.

To host your own copy: the site is static, so any static host works. On [Vercel](https://vercel.com)
(free Hobby plan), **Add New → Project**, import the repository, set **Root Directory** to `web` and
the preset to "Other", leave the build command empty, and deploy.

## The Python lab

Alongside the website, `engine/` and `modules/` hold Qiskit and PennyLane simulations validated against
exact diagonalization. The first module simulates **pair production from the vacuum** in the lattice
[Schwinger model](modules/schwinger_model/README.md) (1+1D quantum electrodynamics), with a real-time
PennyLane animation.

**On real quantum hardware.** [`hardware_runs/`](hardware_runs/README.md) holds three experiments run
on IBM's 156-qubit **ibm_kingston**: a Bell test (S = 2.754 ± 0.023, classical limit 2),
randomized benchmarking (error per Clifford 1.7 × 10⁻⁴), and Schwinger-model pair production with
readout mitigation and zero-noise extrapolation, matching the exact curve within errors up to
t = 1. Raw counts, job ids and analysis code are included, and the results appear on the
[Bell test](web/bell-test/), [Schwinger](web/schwinger/) and
[randomized benchmarking](web/randomized-benchmarking/) lessons.

## Project layout

```
quantum-physics-lab/
├── web/                  the website (static HTML/CSS/JS, deployable as-is)
│   ├── lib/              physics engines: statevectors, stabilizer tableaux, surface-code decoders,
│   │                     Lanczos, free fermions, MPS/TEBD, variational circuits, pulses, 1D waves, …
│   ├── ui/               shared components: lesson frame, circuit diagrams, dials, Bloch spheres
│   ├── <topic>/          one folder per lesson (84)
│   ├── tools/            page generator and catalog status script
│   └── tests/            Node tests + Python reference generator
├── engine/, modules/     Python lab (Qiskit, PennyLane)
├── hardware_runs/        experiments on IBM Quantum hardware: code, raw counts, analysis, plots
├── tests/                Python tests
├── docs/                 roadmap, progress tracker, curriculum research, screenshots
└── PROJECT.md            full handoff: architecture, conventions, how everything is checked
```

See [`web/README.md`](web/README.md) for the web code's structure and how to add a lesson, and
[`PROJECT.md`](PROJECT.md) for the complete project briefing.

## Roadmap

The [roadmap](docs/roadmap.md) was built from a survey of existing tools and courses; the
[progress tracker](docs/progress.md) records every lesson and how it was checked. All phases are
done: a polish and teaching layer, quantum information, the rest of the quantum-mechanics core,
error correction, quantum machine learning, quantum fields on a lattice, and algorithms and
hardware. Still open:

- More hardware experiments: two-qubit benchmarking, longer Schwinger chains with better error mitigation
- Two-qubit gates and crosstalk in the hardware track; lattice gauge theories in two dimensions

## Contributing

`main` is what gets deployed. Work happens on one branch per unit of work (`topic/…`, `feature/…`,
`lab/…`, `fix/…`, `docs/…`) and lands through a pull request with the tests passing. See
[`CLAUDE.md`](CLAUDE.md) for the rules and [`PROJECT.md`](PROJECT.md) for the conventions that have
bitten us (qubit ordering between Qiskit and this site, reserved lesson-frame ids, and more).

## License

[MIT](LICENSE): free to use, adapt and share, in classrooms or anywhere else.

Inspired by [PhET](https://phet.colorado.edu), [QuVis](https://www.st-andrews.ac.uk/physics/quvis/) and [Quirk](https://algassert.com/quirk).
