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


def dynamics_reference():
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
    return {"generic": cases, "schwinger": schwinger_case(4, 1.0, 0.5, 0.6, 6.0, 60)}


# ----- entanglement (web/lib/entanglement.js) -----


def reduced_density_np(psi, n, keep):
    """Partial trace with numpy tensors. Qubit q is bit q of the index, i.e. tensor axis n-1-q.
    The result's index has bit i = qubit keep[i], so its axes are ordered keep[-1], ..., keep[0]."""
    t = psi.reshape([2] * n)
    keep_axes = [n - 1 - q for q in reversed(keep)]
    rest = [a for a in range(n) if a not in keep_axes]
    t = np.transpose(t, keep_axes + rest).reshape(2 ** len(keep), -1)
    return t @ t.conj().T


def entropy_np(rho):
    w = np.linalg.eigvalsh(rho)
    w = w[w > 1e-15]
    return float(-np.sum(w * np.log2(w)))


def concurrence_np(rho):
    """Wootters' formula via the non-Hermitian route: sqrt of the eigenvalues of rho rho~."""
    yy = np.kron(PAULI["Y"], PAULI["Y"])
    tilde = yy @ rho.conj() @ yy
    w = np.sqrt(np.abs(np.linalg.eigvals(rho @ tilde)))
    w = np.sort(w)[::-1]
    return float(max(0.0, w[0] - w[1] - w[2] - w[3]))


def negativity_np(rho):
    # Partial transpose on qubit 1 (the more significant bit of the 4x4 index).
    t = rho.reshape(2, 2, 2, 2)  # (q1, q0, q1', q0')
    pt = np.transpose(t, (2, 1, 0, 3)).reshape(4, 4)
    w = np.linalg.eigvalsh(pt)
    return float(-np.sum(w[w < 0]))


def entanglement_reference():
    rng = np.random.default_rng(20261012)
    n = 4
    psi = rng.normal(size=2**n) + 1j * rng.normal(size=2**n)
    psi /= np.linalg.norm(psi)
    partitions = [[0], [1], [3], [0, 1], [0, 2], [1, 3], [0, 1, 2]]
    entropies = [entropy_np(reduced_density_np(psi, n, part)) for part in partitions]
    pairs = [[a, b] for a in range(n) for b in range(a + 1, n)]
    pair_c = [concurrence_np(reduced_density_np(psi, n, pair)) for pair in pairs]
    # a random two-qubit mixed state (Ginibre)
    g = rng.normal(size=(4, 4)) + 1j * rng.normal(size=(4, 4))
    mixed = g @ g.conj().T
    mixed /= np.trace(mixed)
    return {
        "state": {"n": n, "re": psi.real.tolist(), "im": psi.imag.tolist()},
        "partitions": partitions,
        "entropies": entropies,
        "pairs": pairs,
        "pairConcurrence": pair_c,
        "mixed": {
            "re": mixed.real.flatten().tolist(),
            "im": mixed.imag.flatten().tolist(),
            "concurrence": concurrence_np(mixed),
            "negativity": negativity_np(mixed),
            "entropy": entropy_np(mixed),
        },
    }


# ----- surface code decoding (web/lib/qec.js) -----


def rotated_surface_code_z_checks(d):
    """Z-type checks of the rotated surface code, built independently of the JavaScript with the
    same convention: faces (i, j), i, j = 0..d; (i + j) odd is Z-type; weight-2 Z faces only on the
    left and right edges. Returns a list of qubit lists (qubit = row * d + col)."""
    checks = []
    for i in range(d + 1):
        for j in range(d + 1):
            if (i + j) % 2 == 0:
                continue
            qs = [a * d + b for a, b in ((i - 1, j - 1), (i - 1, j), (i, j - 1), (i, j)) if 0 <= a < d and 0 <= b < d]
            if len(qs) == 4 or (len(qs) == 2 and j in (0, d) and i not in (0, d)):
                checks.append(qs)
    return checks


def qec_reference():
    import pymatching

    rng = np.random.default_rng(7)
    samples = []
    rates = []
    for d in (3, 5, 7):
        checks = rotated_surface_code_z_checks(d)
        H = np.zeros((len(checks), d * d), dtype=np.uint8)
        for r, qs in enumerate(checks):
            H[r, qs] = 1
        matching = pymatching.Matching(H)
        for p in (0.05, 0.1):
            for _ in range(40):
                err = (rng.random(d * d) < p).astype(np.uint8)
                syn = H @ err % 2
                _, weight = matching.decode(syn, return_weight=True)
                samples.append({"d": d, "error": err.tolist(), "weight": float(weight)})
        # logical error rates (logical Z = row 0, so an X residual with odd parity on row 0 fails)
        for p in (0.06, 0.12):
            shots = 40000
            errs = (rng.random((shots, d * d)) < p).astype(np.uint8)
            syns = errs @ H.T % 2
            corr = matching.decode_batch(syns)
            residual = (errs + corr) % 2
            fails = int(residual[:, :d].sum(axis=1).astype(int).__mod__(2).sum())
            rates.append({"d": d, "p": p, "shots": shots, "fails": fails})
    return {"samples": samples, "rates": rates}


TOPICS = {
    "dynamics": ("reference.json", dynamics_reference),
    "entanglement": ("reference-entanglement.json", entanglement_reference),
    "qec": ("reference-qec.json", qec_reference),
}


def main():
    """python web/tests/make_reference.py [topic ...]   (default: every topic)"""
    chosen = sys.argv[1:] or list(TOPICS)
    for topic in chosen:
        name, build = TOPICS[topic]
        out = Path(__file__).with_name(name)
        out.write_text(json.dumps(build(), indent=1))
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
