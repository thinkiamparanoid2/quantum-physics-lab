"""Lattice Schwinger model Hamiltonian (1+1D quantum electrodynamics with staggered fermions).

Physics summary
----------------
The Schwinger model is QED in one space + one time dimension: electrons, positrons, and a
photon field, but simple enough to put on a lattice and simulate exactly on a handful of
qubits. It has a famous, non-perturbative feature: even in "empty" space, a strong enough
electric field spontaneously creates electron-positron pairs out of the vacuum. That's the
effect this module simulates.

Discretize space into N sites (Kogut-Susskind staggered fermions): even sites represent
where an electron can exist, odd sites represent where a positron can exist. The
Jordan-Wigner transformation turns the fermionic creation/annihilation operators at each
site into qubit raising/lowering operators -- so N lattice sites become N qubits, one
fermionic mode each. In 1D with open boundaries, the Jordan-Wigner strings of Z operators
between sites exactly cancel in every physical term below, so no explicit long strings
appear in the Hamiltonian itself.

The gauge (photon) field is not simulated as its own qubits. Gauss's law lets you solve for
the electric field on each link in terms of the fermion occupation to its left, so it gets
eliminated entirely, leaving a Hamiltonian in terms of qubits only, at the cost of the
electric term becoming a long-range interaction between qubits.

This follows the construction used experimentally in Martinez et al., "Real-time dynamics
of lattice gauge theories with a few-qubit quantum computer," Nature 534, 516 (2016), and
worked out theoretically in Muschik et al., "U(1) Wilson lattice gauge theories in digital
quantum simulators," New J. Phys. 19, 103020 (2017).

Hamiltonian (open boundary chain of N sites/qubits, indexed 0..N-1):

    H = x * sum_{n=0}^{N-2} (X_n X_{n+1} + Y_n Y_{n+1}) / 2      <- hopping (kinetic energy)
      + (mass/2) * sum_{n=0}^{N-1} (-1)^n Z_n                     <- staggered mass
      + coupling * sum_{n=0}^{N-2} L_n^2                          <- electric field energy

    where L_n = background_field + sum_{k=0}^{n} (Z_k + (-1)^k) / 2

L_n is the electric field on the link between site n and n+1, after eliminating the gauge
field via Gauss's law in favor of the fermion occupations to its left. Squaring it produces
Z_k Z_j terms between every pair of sites up to n -- a genuinely long-range interaction,
which is what makes this Hamiltonian richer (and harder to simulate classically at scale)
than a simple nearest-neighbor spin chain.

Units: x, mass, coupling are all in whatever energy units you pick for the simulation --
this module doesn't fix a physical scale (e.g. lattice spacing a or bare coupling g). It
exposes the three couplings directly so you can explore the physics (e.g. mass/coupling
ratio controls how easily pairs are produced) rather than reproducing one specific
experimental point.
"""

from __future__ import annotations

from qiskit.quantum_info import SparsePauliOp, Statevector


def _pauli_string(num_qubits: int, chars_by_qubit: dict[int, str]) -> str:
    chars = ["I"] * num_qubits
    for qubit, pauli in chars_by_qubit.items():
        chars[num_qubits - 1 - qubit] = pauli
    return "".join(chars)


def _add_term(terms: dict[frozenset, complex], support: frozenset, coeff: complex) -> None:
    terms[support] = terms.get(support, 0.0) + coeff


def _multiply_diagonal(
    terms_a: dict[frozenset, complex], terms_b: dict[frozenset, complex]
) -> dict[frozenset, complex]:
    """Multiply two operators that are each sums of Z/I Pauli strings (diagonal in the
    computational basis). Z_k^2 = I, so the product of two Z-supports is their symmetric
    difference."""
    result: dict[frozenset, complex] = {}
    for support_a, coeff_a in terms_a.items():
        for support_b, coeff_b in terms_b.items():
            support = support_a.symmetric_difference(support_b)
            _add_term(result, support, coeff_a * coeff_b)
    return result


def electric_field_terms(num_sites: int, link: int, background_field: float) -> dict[frozenset, complex]:
    """L_n as a dict of {frozenset of qubits with Z : coefficient}, frozenset() being the
    identity/constant term. link is n in the sum above (0-indexed, 0 to num_sites-2)."""
    terms: dict[frozenset, complex] = {}
    const = float(background_field)
    for k in range(link + 1):
        const += ((-1) ** k) / 2
        _add_term(terms, frozenset({k}), 0.5)
    _add_term(terms, frozenset(), const)
    return terms


def schwinger_hamiltonian(
    num_sites: int,
    x: float,
    mass: float,
    coupling: float,
    background_field: float = 0.0,
) -> SparsePauliOp:
    """Build the lattice Schwinger model Hamiltonian as a SparsePauliOp on num_sites qubits.

    Args:
        num_sites: number of lattice sites = number of qubits (>= 2).
        x: hopping strength (kinetic energy scale).
        mass: staggered fermion mass.
        coupling: electric field energy scale (~ g^2 * a / 2 in Kogut-Susskind units).
        background_field: background electric field (theta-term); 0 unless you're
            specifically studying its effect.
    """
    if num_sites < 2:
        raise ValueError("num_sites must be >= 2")

    hopping_list: list[tuple[str, complex]] = []
    for n in range(num_sites - 1):
        hopping_list.append((_pauli_string(num_sites, {n: "X", n + 1: "X"}), x / 2))
        hopping_list.append((_pauli_string(num_sites, {n: "Y", n + 1: "Y"}), x / 2))

    diagonal_terms: dict[frozenset, complex] = {}
    for n in range(num_sites):
        _add_term(diagonal_terms, frozenset({n}), (mass / 2) * ((-1) ** n))

    for link in range(num_sites - 1):
        field_terms = electric_field_terms(num_sites, link, background_field)
        field_squared = _multiply_diagonal(field_terms, field_terms)
        for support, coeff in field_squared.items():
            _add_term(diagonal_terms, support, coupling * coeff)

    diagonal_list = [
        (_pauli_string(num_sites, {q: "Z" for q in support}), coeff)
        for support, coeff in diagonal_terms.items()
        if abs(coeff) > 1e-12
    ]

    pauli_list = hopping_list + diagonal_list
    if not pauli_list:
        pauli_list = [("I" * num_sites, 0.0)]

    return SparsePauliOp.from_list(pauli_list).simplify()


def particle_number_operator(num_sites: int, site: int) -> SparsePauliOp:
    """N_site = (I - (-1)^site Z_site) / 2 -- 0 in the bare vacuum, 1 when the site is excited
    (an electron on an even site, or a "hole" i.e. positron on an odd site)."""
    sign = (-1) ** site
    identity = SparsePauliOp.from_list([("I" * num_sites, 0.5)])
    z_term = SparsePauliOp.from_list([(_pauli_string(num_sites, {site: "Z"}), -0.5 * sign)])
    return (identity + z_term).simplify()


def vacuum_state(num_sites: int) -> Statevector:
    """The bare vacuum: no particles or antiparticles anywhere. Z_n = +1 on even sites
    (electron site unoccupied), Z_n = -1 on odd sites (positron site "unoccupied" means
    the Dirac sea level is filled, encoded as qubit state |1>)."""
    bits = "".join(str(n % 2) for n in reversed(range(num_sites)))
    return Statevector.from_label(bits)
