"""Correctness checks for the Schwinger model Hamiltonian.

test_two_site_matches_hand_derivation is the important one: it expands the N=2 Hamiltonian
by hand (see the comment inside) and checks the code produces exactly that matrix. If the
Pauli-algebra bookkeeping in hamiltonian.py has a sign or indexing bug, this is what catches it.
"""

import sys
from pathlib import Path

import numpy as np
from qiskit.quantum_info import Operator, Pauli

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from modules.schwinger_model.hamiltonian import (
    particle_number_operator,
    schwinger_hamiltonian,
    vacuum_state,
)


def test_hamiltonian_is_hermitian_for_several_sizes():
    for num_sites in (2, 3, 4, 5):
        h = schwinger_hamiltonian(num_sites, x=1.0, mass=0.7, coupling=0.4, background_field=0.1)
        matrix = h.to_matrix()
        assert np.allclose(matrix, matrix.conj().T), f"H not Hermitian for num_sites={num_sites}"


def test_two_site_matches_hand_derivation():
    # For N=2 (one link, n=0):
    #   hopping   = x/2 (XX + YY)
    #   mass      = (mass/2) (Z0 - Z1)
    #   L_0       = l0 + 0.5 + 0.5 Z0
    #   L_0^2     = (l0+0.5)^2 + (l0+0.5) Z0 + 0.25 I
    #   electric  = coupling * [ ((l0+0.5)^2 + 0.25) I + (l0+0.5) Z0 ]
    x, mass, coupling, l0 = 1.3, 0.6, 0.9, 0.2

    # Qiskit Pauli-label convention: the leftmost character is the highest-indexed qubit,
    # so "IZ" is Z on qubit 0 and "ZI" is Z on qubit 1.
    expected = (
        (x / 2) * Operator(Pauli("XX")).data
        + (x / 2) * Operator(Pauli("YY")).data
        + (mass / 2) * (Operator(Pauli("IZ")).data - Operator(Pauli("ZI")).data)
        + coupling * ((l0 + 0.5) ** 2 + 0.25) * np.eye(4)
        + coupling * (l0 + 0.5) * Operator(Pauli("IZ")).data
    )

    h = schwinger_hamiltonian(2, x=x, mass=mass, coupling=coupling, background_field=l0)
    assert np.allclose(h.to_matrix(), expected), "N=2 Hamiltonian does not match hand derivation"


def test_vacuum_has_zero_particle_number():
    num_sites = 4
    state = vacuum_state(num_sites)
    for site in range(num_sites):
        op = particle_number_operator(num_sites, site)
        expectation = state.expectation_value(op).real
        assert abs(expectation) < 1e-9, f"site {site} not empty in bare vacuum"


def test_particle_number_operator_eigenvalues_are_zero_or_one():
    num_sites = 3
    for site in range(num_sites):
        op = particle_number_operator(num_sites, site)
        eigenvalues = np.linalg.eigvalsh(op.to_matrix())
        assert np.allclose(sorted(np.unique(np.round(eigenvalues, 9))), [0.0, 1.0])
