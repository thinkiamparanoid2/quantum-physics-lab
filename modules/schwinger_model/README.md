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

- **Hopping** lets a particle-antiparticle pair move/annihilate — same role as the hopping
  term in the spin-chain module, and it's what needs Trotterizing.
- **Mass** is the energy cost of an electron or positron existing at all.
- **Electric field energy** is what does the actual pair creation: it's minimized when
  charges rearrange to screen the field, and that rearrangement *is* a created pair.

This follows the construction from [Muschik et al., *New J. Phys.* 19, 103020 (2017)](https://doi.org/10.1088/1367-2630/aa89ab),
the theory behind the first experimental realization on a 4-qubit trapped-ion computer in
[Martinez et al., *Nature* 534, 516 (2016)](https://doi.org/10.1038/nature18318).

## Correctness check

[`tests/test_schwinger_model.py`](../../tests/test_schwinger_model.py):
- Hermiticity of the Hamiltonian for several system sizes
- The N=2 case expanded by hand term-by-term and compared exactly against the code's output
- The particle-number operator has eigenvalues exactly {0, 1}, and the bare vacuum has zero
  particles everywhere

[`run.py`](run.py) additionally compares the Trotterized-circuit evolution against exact
matrix-exponential evolution (`engine.exact_evolve`) and plots both.

## What to expect

Starting in the bare vacuum, the total particle number should stay at 0 only if `mass` is
very large relative to `coupling` (pair creation too expensive). As `coupling` grows relative
to `mass`, pairs get created and the total particle number oscillates upward from zero —
that oscillation, not a monotonic climb, is expected: this is a closed, finite system, so
particles get created and reabsorbed rather than escaping.

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
