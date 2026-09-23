"""Shared engine: Hamiltonian time evolution, exact diagonalization, measurement, and noise utilities used by every module."""

from .evolution import trotter_circuit, trotter_steps_circuit
from .exact import exact_evolve, exact_eigensystem
from .measurement import expectation_from_counts, expectation_from_statevector
from .noise import depolarizing_noise_model, zne_fold

__all__ = [
    "trotter_circuit",
    "trotter_steps_circuit",
    "exact_evolve",
    "exact_eigensystem",
    "expectation_from_counts",
    "expectation_from_statevector",
    "depolarizing_noise_model",
    "zne_fold",
]
