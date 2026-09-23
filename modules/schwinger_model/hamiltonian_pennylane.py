"""PennyLane version of the lattice Schwinger model Hamiltonian, for the real-time
animation script (animate.py).

Reuses the same combinatorial term-building helpers as hamiltonian.py (the pure-Python
dict-of-Pauli-supports algebra has nothing Qiskit-specific about it) so both
implementations are built from one validated piece of logic, but assembled into two
independent quantum-computing frameworks -- if they disagree, something is wrong.

One simplification versus the Qiskit version: a pure identity term (coefficient * I)
only contributes a global phase to time evolution and doesn't affect any expectation
value, so it's dropped here entirely. It's kept in hamiltonian.py because that version is
also used for exact diagonalization, where the identity term shifts the absolute energy.
"""

from __future__ import annotations

import pennylane as qml

from .hamiltonian import _add_term, _multiply_diagonal, electric_field_terms


def schwinger_hamiltonian_pennylane(
    num_sites: int,
    x: float,
    mass: float,
    coupling: float,
    background_field: float = 0.0,
) -> qml.Hamiltonian:
    """Build the lattice Schwinger model Hamiltonian as a qml.Hamiltonian on num_sites wires.

    Wires are indexed the same way as lattice sites (wire i = site i) -- no endianness
    gymnastics needed here, unlike the Qiskit Pauli-string version.
    """
    if num_sites < 2:
        raise ValueError("num_sites must be >= 2")

    coeffs: list[float] = []
    ops: list[qml.operation.Operator] = []

    for n in range(num_sites - 1):
        coeffs.append(x / 2)
        ops.append(qml.PauliX(n) @ qml.PauliX(n + 1))
        coeffs.append(x / 2)
        ops.append(qml.PauliY(n) @ qml.PauliY(n + 1))

    diagonal_terms: dict[frozenset, complex] = {}
    for n in range(num_sites):
        _add_term(diagonal_terms, frozenset({n}), (mass / 2) * ((-1) ** n))

    for link in range(num_sites - 1):
        field_terms = electric_field_terms(num_sites, link, background_field)
        field_squared = _multiply_diagonal(field_terms, field_terms)
        for support, coeff in field_squared.items():
            _add_term(diagonal_terms, support, coupling * coeff)

    for support, coeff in diagonal_terms.items():
        if abs(coeff) < 1e-12 or len(support) == 0:
            continue  # dropping identity: global phase only, doesn't affect dynamics
        qubits = sorted(support)
        op = qml.PauliZ(qubits[0]) if len(qubits) == 1 else qml.PauliZ(qubits[0]) @ qml.PauliZ(qubits[1])
        coeffs.append(coeff.real)
        ops.append(op)

    return qml.Hamiltonian(coeffs, ops)


def vacuum_bits(num_sites: int) -> list[int]:
    """Bare vacuum as a bit array indexed directly by wire/site (no endian reversal)."""
    return [n % 2 for n in range(num_sites)]
