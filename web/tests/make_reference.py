"""Reference values for the browser engine's tests (web/tests/dynamics.test.js).

Everything here is computed independently of the JavaScript: dense numpy matrices and
scipy's expm for the generic cases, and the repo's validated Qiskit Hamiltonian for the
Schwinger model. Run from the repo root:

    .venv/Scripts/python.exe web/tests/make_reference.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.linalg import expm

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from engine import exact_evolve  # noqa: E402
from modules.schwinger_model.hamiltonian import (  # noqa: E402
    particle_number_operator,
    schwinger_hamiltonian,
    vacuum_state,
)

PAULI = {
    "I": np.eye(2, dtype=complex),
    "X": np.array([[0, 1], [1, 0]], dtype=complex),
    "Y": np.array([[0, -1j], [1j, 0]], dtype=complex),
    "Z": np.array([[1, 0], [0, -1]], dtype=complex),
}
SINGLE = {
    "0": np.array([1, 0], dtype=complex),
    "1": np.array([0, 1], dtype=complex),
    "+": np.array([1, 1], dtype=complex) / np.sqrt(2),
    "-": np.array([1, -1], dtype=complex) / np.sqrt(2),
}


def kron_all(factors_q0_first):
    # Qubit q is bit q of the basis index, so qubit 0 is the rightmost Kronecker factor.
    out = np.array([[1]], dtype=complex) if factors_q0_first[0].ndim == 2 else np.array([1], dtype=complex)
    for f in factors_q0_first:
        out = np.kron(f, out)
    return out


def pauli_matrix(ops: dict[int, str], n: int) -> np.ndarray:
    return kron_all([PAULI[ops.get(q, "I")] for q in range(n)])


def pauli_sum(terms, n):
    return sum(c * pauli_matrix(ops, n) for c, ops in terms)


def product_state(chars: str) -> np.ndarray:
    return kron_all([SINGLE[c] for c in chars])


def z_values(psi, n):
    probs = np.abs(psi) ** 2
    return [float(sum(p * (-1 if (b >> q) & 1 else 1) for b, p in enumerate(probs))) for q in range(n)]


def expect(op, psi):
    return float(np.real(np.vdot(psi, op @ psi)))


def generic_case(name, text, terms, n, state, obs_text, obs_terms, total_time, steps, order, frames):
    h = pauli_sum(terms, n)
    obs = pauli_sum(obs_terms, n)
    psi0 = product_state(state)

    exact = []
    for j in range(frames + 1):
        t = j * total_time / frames
        psi = expm(-1j * h * t) @ psi0
        exact.append({"t": t, "z": z_values(psi, n), "obs": expect(obs, psi)})

    dt = total_time / steps
    if order == 1:
        step = np.eye(2**n, dtype=complex)
        for c, ops in terms:
            step = expm(-1j * c * dt * pauli_matrix(ops, n)) @ step
    else:
        halves = [expm(-1j * c * dt / 2 * pauli_matrix(ops, n)) for c, ops in terms]
        step = np.eye(2**n, dtype=complex)
        for u in halves + halves[::-1]:
            step = u @ step

    trotter = []
    psi = psi0.copy()
    for k in range(steps + 1):
        if k > 0:
            psi = step @ psi
        exact_psi = expm(-1j * h * k * dt) @ psi0
        infidelity = 1 - abs(np.vdot(exact_psi, psi)) ** 2
        trotter.append({"t": k * dt, "z": z_values(psi, n), "obs": expect(obs, psi), "infidelity": float(infidelity)})

    return {
        "name": name,
        "hamiltonian": text,
        "state": state,
        "observable": obs_text,
        "totalTime": total_time,
        "steps": steps,
        "order": order,
        "frames": frames,
        "exact": exact,
        "trotter": trotter,
    }


def schwinger_case(sites, x, mass, coupling, total_time, frames):
    h = schwinger_hamiltonian(sites, x=x, mass=mass, coupling=coupling)
    psi0 = vacuum_state(sites)
    number = sum(particle_number_operator(sites, s) for s in range(sites))
    samples = []
    for j in range(frames + 1):
        t = j * total_time / frames
        psi = exact_evolve(h, t, psi0) if t > 0 else psi0
        samples.append(
            {
                "t": t,
                "particles": float(np.real(psi.expectation_value(number))),
                "energy": float(np.real(psi.expectation_value(h))),
            }
        )
    return {"sites": sites, "x": x, "mass": mass, "coupling": coupling, "totalTime": total_time, "frames": frames, "samples": samples}


def main():
    cases = [
        generic_case(
            "two qubits with Y terms",
            "Z0 Z1 + 0.5*X0 + 0.5*X1 + 0.3*Y0 Y1 - 0.2*Z0",
            [(1.0, {0: "Z", 1: "Z"}), (0.5, {0: "X"}), (0.5, {1: "X"}), (0.3, {0: "Y", 1: "Y"}), (-0.2, {0: "Z"})],
            2,
            "0+",
            "X0 Y1 + 0.5*Y0",
            [(1.0, {0: "X", 1: "Y"}), (0.5, {0: "Y"})],
            1.7,
            7,
            1,
            10,
        ),
        generic_case(
            "three qubits, full Pauli string, second order",
            "XYZ - 0.7*Z0 X2 + 0.4*Y1 + 1.1*X0 X1",
            [(1.0, {0: "X", 1: "Y", 2: "Z"}), (-0.7, {0: "Z", 2: "X"}), (0.4, {1: "Y"}), (1.1, {0: "X", 1: "X"})],
            3,
            "1-0",
            "Z0 Z2 + Y0 Y1",
            [(1.0, {0: "Z", 2: "Z"}), (1.0, {0: "Y", 1: "Y"})],
            2.3,
            5,
            2,
            8,
        ),
    ]
    reference = {"generic": cases, "schwinger": schwinger_case(4, 1.0, 0.5, 0.6, 6.0, 60)}
    out = Path(__file__).with_name("reference.json")
    out.write_text(json.dumps(reference, indent=1))
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
