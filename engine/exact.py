"""Exact classical reference: diagonalize the Hamiltonian and evolve state vectors directly.

Every module compares its quantum-circuit result against this. At the qubit counts used
here (a laptop can diagonalize up to ~15-18 qubits without much trouble), this is the
ground truth that proves the circuit is actually doing the right physics.
"""

from __future__ import annotations

import numpy as np
from qiskit.quantum_info import SparsePauliOp, Statevector
from scipy.linalg import expm


def exact_evolve(hamiltonian: SparsePauliOp, time: float, initial_state: Statevector) -> Statevector:
    """Evolve initial_state under exp(-i * hamiltonian * time) by direct matrix exponentiation.

    Only tractable for small qubit counts (roughly <= 15-18 qubits on a laptop) — that's
    the point: it's the trusted reference, not a scalable method.
    """
    h_matrix = hamiltonian.to_matrix()
    u = expm(-1j * h_matrix * time)
    return Statevector(u @ initial_state.data)


def exact_eigensystem(hamiltonian: SparsePauliOp) -> tuple[np.ndarray, np.ndarray]:
    """Full diagonalization: returns (eigenvalues, eigenvectors) sorted ascending by energy.

    eigenvectors[:, i] is the eigenvector for eigenvalues[i].
    """
    h_matrix = hamiltonian.to_matrix()
    eigenvalues, eigenvectors = np.linalg.eigh(h_matrix)
    return eigenvalues, eigenvectors


def ground_state_energy(hamiltonian: SparsePauliOp) -> float:
    """Lowest eigenvalue — the reference value for VQE-style modules to converge toward."""
    eigenvalues, _ = exact_eigensystem(hamiltonian)
    return float(eigenvalues[0])
