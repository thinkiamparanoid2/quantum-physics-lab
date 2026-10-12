# Progress tracker

The working log for [`roadmap.md`](roadmap.md). Each item is ticked only when its physics has an
independent test, its lesson page renders, and the test suites pass. The branch column says where
the work lives until it is merged.

Legend: ✅ done · 🔨 in progress · ⬜ not started · ⏭ deferred (with the reason)

## Phase 0: polish and foundations (branch `feature/ui-refresh`)

| Item | Status | Notes |
|---|---|---|
| Fix teleportation "Not the message yet" at 100% fidelity | ⬜ | |
| Fix Shor-code threshold chart label overlap | ⬜ | |
| Fix sandbox Bloch note overlapping the axis label | ⬜ | |
| Sticky step text beside the visual; collapsible cards; per-step focus | ⬜ | |
| Compact Bloch row for multi-qubit lessons | ⬜ | |
| Lesson kit (`ui/lesson-kit.js`) for new custom lessons | ⬜ | |
| Learning layer: predict-first, show-the-maths, concept checks | ⬜ | |
| Home restructure: tracks, section tiles, Topics page with search and filters | ⬜ | |
| Teacher page (goals, misconceptions, questions, printable) | ⬜ | |
| Web Worker helper for heavy simulations | ⬜ | |
| "Is it right?" checks page on the site | ⬜ | |
| `CITATION.cff` | ⬜ | |

## Phase 1: quantum information (branch `topic/quantum-information`)

| Lesson | Status | Independent check |
|---|---|---|
| Entanglement, measured (+ entanglement view in circuit lessons) | ⬜ | |
| Density matrices and quantum channels | ⬜ | |
| Generalized measurement and state discrimination | ⬜ | |
| No-cloning and monogamy | ⬜ | |
| Quantum walks | ⬜ | |

## Phase F: finish the QM core (branch `topic/qm-core`)

| Lesson | Status | Independent check |
|---|---|---|
| Probability current | ⬜ | |
| The delta potential | ⬜ | |
| A particle on a ring | ⬜ | |
| Angular momentum and ladder operators | ⬜ | |
| Adding angular momenta | ⬜ | |
| Time-dependent perturbation theory and Fermi's golden rule | ⬜ | |
| The adiabatic theorem and Landau–Zener | ⬜ | |
| Quantum statistics at finite temperature | ⬜ | |

## Phase 2: error-correction track (branch `topic/error-correction-track`)

| Lesson | Status | Independent check |
|---|---|---|
| Stabilizer simulator engine (tableau) | ⬜ | |
| Stabilizers | ⬜ | |
| Steane code and CSS codes | ⬜ | |
| The surface code | ⬜ | |
| Decoding (matching, union-find) | ⬜ | |
| Threshold in the browser | ⬜ | |
| Fault tolerance: measurement errors | ⬜ | |
| Magic states and distillation | ⬜ | |
| Toric code and anyons | ⬜ | |

## Phase 4: quantum fields on a lattice (branch `topic/quantum-fields`)

| Lesson | Status | Independent check |
|---|---|---|
| From oscillators to particles | ⬜ | |
| Fock space, bosons and fermions | ⬜ | |
| Jordan–Wigner | ⬜ | |
| The Schwinger model: pair creation | ⬜ | |
| Confinement and string breaking | ⬜ | |
| The transverse-field Ising model | ⬜ | |
| Entanglement area law and MPS | ⬜ | |
| Simulating fields on quantum hardware | ⬜ | |

## Phase 3: quantum machine learning (branch `topic/qml`)

| Lesson | Status | Independent check |
|---|---|---|
| Encoding data | ⬜ | |
| A classifier that trains while you watch | ⬜ | |
| Quantum models are Fourier series | ⬜ | |
| Quantum kernels | ⬜ | |
| Barren plateaus, measured | ⬜ | |
| VQE and QAOA | ⬜ | |
| Is there an advantage? | ⬜ | |

## Phase 5: algorithms and hardware (branch `topic/algorithms-hardware`)

| Lesson | Status | Independent check |
|---|---|---|
| Amplitude estimation | ⬜ | |
| Simon's algorithm | ⬜ | |
| Hamiltonian simulation: Trotter and qDRIFT | ⬜ | |
| Adiabatic quantum computing | ⬜ | |
| HHL and its caveats | ⬜ | |
| Building a qubit: the transmon | ⬜ | |
| Pulses, leakage and DRAG | ⬜ | |
| Randomized benchmarking | ⬜ | |
| Error mitigation: readout and zero-noise extrapolation | ⬜ | |
| Real IBM hardware runs | ⏭ | Needs the owner's IBM Quantum account and credentials |

## Final passes

| Item | Status | Notes |
|---|---|---|
| Professor-level physics review of every lesson | ⬜ | |
| README, PROJECT.md, curriculum.md updated | ⬜ | |
| Repository cleanup | ⬜ | |
| Branches pushed, pull requests opened | ⬜ | |

## Log

- 2026-10-12: roadmap written (`docs/roadmap.md`), tracker created.
