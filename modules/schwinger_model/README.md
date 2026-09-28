# Pair Production from the Vacuum: The Schwinger Model

**Status:** simulator done, hardware run pending · **Qubits:** 4 (default, tunable) · **Difficulty:** ★★★★

## The physics, in plain language

"Empty" space isn't actually empty. Quantum field theory says that even a vacuum has fields
fluctuating in it, and if you apply a strong enough electric field, it can rip
electron-positron pairs directly out of that vacuum — matter created from nothing but field
energy. This is a real, predicted effect of quantum electrodynamics (QED); it's just
extraordinarily hard to see in real QED because the fields required are enormous.

The Schwinger model is QED simplified to one dimension of space (plus time). In 1D, the
same pair-production effect happens at accessible field strengths, and the whole theory is
simple enough to put on a lattice and simulate on a handful of qubits — while still being a
real, non-perturbative quantum field theory, not a toy spin model wearing a QFT costume.

What this module simulates is the protocol of the first quantum-computer experiment
(Martinez et al., 2016): start from the *bare* vacuum, which is not the true ground state of the
interacting theory, with no applied field, and watch pairs appear and disappear as it evolves.
Pair creation by a strong applied field (the Schwinger mechanism proper) needs a nonzero
`background_field`, which the Hamiltonian supports but the default runs don't use.

## The setup

Space is discretized into a line of `N` sites. Using the **Kogut-Susskind staggered fermion**
trick, even sites host "electrons" and odd sites host "positrons." The **Jordan-Wigner
transformation** turns the fermionic creation/annihilation operators at each site into qubit
raising/lowering operators — so each lattice site becomes one qubit, and in this 1D
open-chain setup the usual Jordan-Wigner "strings" of Z gates cancel out of every physical
term, so the Hamiltonian below has no hidden long strings.

The photon field isn't given its own qubits. Gauss's law (∇·E = charge density) lets you
solve for the electric field on each link directly from the fermion occupations to its
left, eliminating the gauge field entirely — at the cost of turning the electric energy into
a genuinely long-range interaction between qubits.

## The Hamiltonian

Implemented in [`hamiltonian.py`](hamiltonian.py):

```
H = x * Σ_{n=0}^{N-2} (X_n X_{n+1} + Y_n Y_{n+1}) / 2      <- hopping (kinetic energy)
  + (mass/2) * Σ_{n=0}^{N-1} (-1)^n Z_n                     <- staggered mass
  + coupling * Σ_{n=0}^{N-2} L_n^2                          <- electric field energy

  where L_n = Σ_{k=0}^{n} (Z_k + (-1)^k) / 2   (background field = 0)
```

- **Hopping** is what creates, moves and annihilates particle-antiparticle pairs (a fermion
  hopping from an odd to an even site turns the bare vacuum into a pair). It doesn't commute
  with the rest, which is why the evolution needs Trotterizing.
- **Mass** is the energy cost of an electron or positron existing at all.
- **Electric field energy** is the cost of the field stretched between separated charges. With
  zero background field it *suppresses* pair creation; a nonzero `background_field` (a strong
  applied field) is what would make pairs energetically favourable, the Schwinger mechanism.

This follows the construction from [Muschik et al., *New J. Phys.* 19, 103020 (2017)](https://doi.org/10.1088/1367-2630/aa89ab),
the theory behind the first experimental realization on a 4-qubit trapped-ion computer in
[Martinez et al., *Nature* 534, 516 (2016)](https://doi.org/10.1038/nature18318).

## Real-time animation (PennyLane)

[`animate.py`](animate.py) is a standalone, download-and-run visualization built on
PennyLane instead of Qiskit: a live matplotlib window showing the particle-number density
at each site rising and falling as pairs are created and reabsorbed, plus the running
total. It also saves a GIF.

```bash
pip install -r ../../requirements.txt
python animate.py                                          # defaults, live window + GIF
python animate.py --sites 6 --mass 0.3 --coupling 1.0 --time 8 --frames 80
python animate.py --no-show                                 # save the GIF only, no window
```

This is a second, independent implementation of the same physics — built directly in
PennyLane's operator language rather than converting the Qiskit version — so its agreement
with the Qiskit Hamiltonian (checked in `tests/test_schwinger_model_pennylane.py`) is a real
cross-validation, not just a restatement of the same code.

## Correctness check

[`tests/test_schwinger_model.py`](../../tests/test_schwinger_model.py):
- Hermiticity of the Hamiltonian for several system sizes
- The N=2 case expanded by hand term-by-term and compared exactly against the code's output
- The particle-number operator has eigenvalues exactly {0, 1}, and the bare vacuum has zero
  particles everywhere

[`tests/test_schwinger_model_pennylane.py`](../../tests/test_schwinger_model_pennylane.py):
the PennyLane Hamiltonian and the Qiskit Hamiltonian agree exactly (up to the constant
identity term PennyLane drops, since it only contributes an unobservable global phase).

[`run.py`](run.py) additionally compares the Trotterized-circuit evolution against exact
matrix-exponential evolution (`engine.exact_evolve`) and plots both.

**A note on framework conventions:** Qiskit's `SparsePauliOp.to_matrix()` and PennyLane's
`qml.matrix(..., wire_order=...)` disagree on which qubit is "most significant" in the
matrix representation — this bit us once (see `test_schwinger_model_pennylane.py`) before
reversing the wire order fixed it. Worth knowing if you ever compare the two frameworks
directly elsewhere in this repo.

## What to expect

The bare vacuum is not an eigenstate of H, so after the quench pairs appear. How many depends
on hopping `x` against the energy costs `mass` and `coupling`: for 6 sites the peak total
particle number over t ≤ 8 is about 3.5 at `x = 1, mass = 0.5, coupling = 0.6`, drops to 0.5
at `mass = 4`, drops to 0.9 at `coupling = 6`, and falls to 0.8 when the hopping is weakened
to `x = 0.1`. The number oscillates rather than climbing
steadily: this is a closed, finite system, so particles get created and reabsorbed rather than
escaping.

## Hardware run

Not yet run on real IBM hardware. Plan: reduce to `num_sites=4`, run for the first 2-3
Trotter steps only (deeper circuits will be dominated by noise — see the tunneling module's
notes on the same issue with QFT-heavy circuits), apply zero-noise extrapolation
(`engine.zne_fold`) and readout-error mitigation, and compare the recovered particle-number
curve against the ideal simulator. Results will land in `hardware/`.

## Limitations

- Only open boundary conditions; periodic boundaries would add a term connecting site N-1
  back to site 0 and aren't implemented.
- The electric term's long-range ZZ interactions mean this Hamiltonian has more terms than a
  nearest-neighbor spin chain at the same qubit count — Trotter circuits get deep faster, so
  real-hardware results will only be trustworthy for very few steps.
- No confinement/string-breaking analysis yet (see idea list item #4's "advanced" variant) —
  would need two separated static charges, not implemented here.
- Units are left abstract (`x`, `mass`, `coupling` are free parameters, not tied to a lattice
  spacing `a` or physical coupling `g`), so this demonstrates the *mechanism*, not a
  calibrated prediction for real QED.
