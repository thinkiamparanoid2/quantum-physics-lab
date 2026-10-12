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
    # phenomenological noise: X errors (prob p) on every data qubit before every round, every check
    # misread with prob p except in the last round (the data readout), decoded in space-time.
    # Same model as trialPhenomenological; PyMatching handles the time direction with `repetitions`.
    phenomenological = []
    cases = [("repetition", d, p) for d in (3, 5, 7) for p in (0.03, 0.06)] + [("surface", 3, 0.02), ("surface", 3, 0.04), ("surface", 5, 0.02)]
    for kind, d, p in cases:
        if kind == "repetition":
            H = np.zeros((d - 1, d), dtype=np.uint8)
            for i in range(d - 1):
                H[i, i] = H[i, i + 1] = 1
            logical = [0]
        else:
            checks = rotated_surface_code_z_checks(d)
            H = np.zeros((len(checks), d * d), dtype=np.uint8)
            for r, qs in enumerate(checks):
                H[r, qs] = 1
            logical = list(range(d))
        layers = d + 1
        matching = pymatching.Matching(H, repetitions=layers, timelike_weights=1, weights=1)
        shots = 20000
        fails = 0
        for _ in range(shots):
            err = np.zeros(H.shape[1], dtype=np.uint8)
            raw = np.zeros((H.shape[0], layers), dtype=np.uint8)
            for t in range(layers):
                err ^= (rng.random(H.shape[1]) < p).astype(np.uint8)
                raw[:, t] = H @ err % 2
                if t < layers - 1:
                    raw[:, t] ^= (rng.random(H.shape[0]) < p).astype(np.uint8)
            diff = raw.copy()
            diff[:, 1:] = (raw[:, 1:] - raw[:, :-1]) % 2
            corr = matching.decode(diff)
            residual = (err + corr) % 2
            fails += int(residual[logical].sum() % 2)
        phenomenological.append({"code": kind, "d": d, "rounds": d, "p": p, "shots": shots, "fails": fails})
        print(kind, d, p, fails / shots)
    return {"samples": samples, "rates": rates, "phenomenological": phenomenological}


# ----- Schwinger model ground states with static charges (web/lib/schwinger.js) -----


def schwinger_sector_ground(N, x, mass, g, charges, background=0.0):
    """Ground state in the neutral sector (N/2 qubits set), built straight from bit strings rather
    than from Pauli algebra: diagonal = staggered mass + g * sum of squared link fields from Gauss's
    law, off-diagonal = hopping x between |..01..> and |..10..> on neighbouring sites."""
    from itertools import combinations

    states = [sum(1 << k for k in ones) for ones in combinations(range(N), N // 2)]
    index = {b: i for i, b in enumerate(states)}
    d = len(states)
    H = np.zeros((d, d))
    for i, b in enumerate(states):
        z = [1 - 2 * ((b >> k) & 1) for k in range(N)]
        diag = -(mass / 2) * sum(((-1) ** k) * z[k] for k in range(N))
        L = background
        for n in range(N - 1):
            L += -(z[n] - (-1) ** n) / 2 + charges[n]
            diag += g * L * L
        H[i, i] = diag
        for k in range(N - 1):
            if ((b >> k) & 1) != ((b >> (k + 1)) & 1):
                H[index[b ^ (0b11 << k)], i] += x
    vals, vecs = np.linalg.eigh(H)
    psi = vecs[:, 0]
    zexp = [float(sum(psi[i] ** 2 * (1 - 2 * ((b >> k) & 1)) for i, b in enumerate(states))) for k in range(N)]
    particles = sum((1 + zexp[k]) / 2 if k % 2 else (1 - zexp[k]) / 2 for k in range(N))
    return float(vals[0]), float(particles)


def schwinger_reference():
    cases = []
    N, x, mass, g = 10, 0.5, 0.8, 0.5
    for length in (0, 1, 3, 5, 7):
        charges = [0.0] * N
        if length:
            a = (N - 1 - length) // 2
            if a % 2:
                a -= 1
            a = max(0, a)
            charges[a] += 1
            charges[a + length] -= 1
        energy, particles = schwinger_sector_ground(N, x, mass, g, charges)
        cases.append({"N": N, "x": x, "mass": mass, "g": g, "length": length, "charges": charges, "energy": energy, "particles": particles})
    # a case with a background field and no charges
    energy, particles = schwinger_sector_ground(8, 1.0, 0.5, 0.6, [0.0] * 8, background=0.7)
    cases.append({"N": 8, "x": 1.0, "mass": 0.5, "g": 0.6, "background": 0.7, "length": 0, "charges": [0.0] * 8, "energy": energy, "particles": particles})
    return {"ground": cases}


# ----- quantum machine learning (web/lib/vqc.js) -----
# Every circuit below is written out gate by gate; lib/vqc.js builds the same circuits. PennyLane
# orders wire 0 first; the expectation values and gradients don't depend on that convention.


def classifier_circuit(params, x, layers):
    """2-qubit data re-uploading classifier: per layer RY(x0) RY(x1), then RZ, RY on each qubit,
    then CNOT(0, 1). params[l] = [rz0, ry0, rz1, ry1]. Output <Z0>."""
    for l in range(layers):
        qml.RY(x[0], wires=0)
        qml.RY(x[1], wires=1)
        qml.RZ(params[l][0], wires=0)
        qml.RY(params[l][1], wires=0)
        qml.RZ(params[l][2], wires=1)
        qml.RY(params[l][3], wires=1)
        qml.CNOT(wires=[0, 1])
    return qml.expval(qml.PauliZ(0))


def fourier_circuit(params, x, layers):
    """1 qubit: per layer RY(a) RZ(b), then RX(x); a final RY(a) RZ(b). params[l] = [a, b]. <Z>."""
    for l in range(layers):
        qml.RY(params[l][0], wires=0)
        qml.RZ(params[l][1], wires=0)
        qml.RX(x, wires=0)
    qml.RY(params[layers][0], wires=0)
    qml.RZ(params[layers][1], wires=0)
    return qml.expval(qml.PauliZ(0))


def zz_map(x):
    """Havlicek et al. ZZ feature map on 2 qubits, two repetitions."""
    for _ in range(2):
        qml.Hadamard(wires=0)
        qml.Hadamard(wires=1)
        qml.RZ(2 * x[0], wires=0)
        qml.RZ(2 * x[1], wires=1)
        qml.CNOT(wires=[0, 1])
        qml.RZ(2 * (np.pi - x[0]) * (np.pi - x[1]), wires=1)
        qml.CNOT(wires=[0, 1])


def qml_reference():
    import pennylane as qml_mod
    global qml
    qml = qml_mod
    from pennylane import numpy as pnp

    rng = np.random.default_rng(5)
    out = {}
    # classifier values and gradients
    dev2 = qml.device("default.qubit", wires=2)
    cases = []
    for layers in (1, 3):
        node = qml.QNode(lambda p, x: classifier_circuit(p, x, layers), dev2)
        for _ in range(3):
            params = pnp.array(rng.uniform(-np.pi, np.pi, (layers, 4)), requires_grad=True)
            x = rng.uniform(-1.5, 1.5, 2)
            value = float(node(params, x))
            grad = qml.grad(node, argnums=0)(params, pnp.array(x, requires_grad=False))
            cases.append({"layers": layers, "params": params.tolist(), "x": x.tolist(), "value": value, "grad": np.asarray(grad).tolist()})
    out["classifier"] = cases
    # Fourier coefficients of the 1-qubit re-uploading model
    dev1 = qml.device("default.qubit", wires=1)
    four = []
    for layers in (1, 2, 3):
        params = rng.uniform(-np.pi, np.pi, (layers + 1, 2))
        node = qml.QNode(lambda x: fourier_circuit(params, x, layers), dev1)
        coeffs = qml.fourier.coefficients(node, 1, layers + 2)
        four.append({"layers": layers, "params": params.tolist(), "re": np.real(coeffs).tolist(), "im": np.imag(coeffs).tolist()})
    out["fourier"] = four
    # ZZ-feature-map kernel matrix
    pts = rng.uniform(0, 2 * np.pi, (5, 2))

    @qml.qnode(dev2)
    def overlap(a, b):
        zz_map(a)
        qml.adjoint(zz_map)(b)
        return qml.probs(wires=[0, 1])

    K = [[float(overlap(a, b)[0]) for b in pts] for a in pts]
    out["kernel"] = {"points": pts.tolist(), "K": K}
    # H2 in STO-3G across the dissociation curve
    h2 = []
    for d in (0.3, 0.45, 0.6, 0.74, 0.9, 1.1, 1.3, 1.6, 2.0, 2.5):
        coords = pnp.array([0.0, 0.0, 0.0, 0.0, 0.0, d / 0.529177210903], requires_grad=False)
        H, n = qml.qchem.molecular_hamiltonian(["H", "H"], coords, method="dhf")
        coeffs, ops = H.terms()
        terms = []
        for c, op in zip(coeffs, ops):
            word = op.pauli_rep
            for pw, cw in word.items():
                terms.append({"coeff": float(np.real(c * cw)), "ops": [[int(w), str(p)] for w, p in pw.items()]})
        M = qml.matrix(H, wire_order=range(4))
        fci = float(np.linalg.eigvalsh(M)[0])
        hf_state = np.zeros(16)
        hf_state[int("1100", 2)] = 1  # wire 0 most significant in qml.matrix
        hf = float(np.real(hf_state @ M @ hf_state))
        h2.append({"bond": d, "terms": terms, "fci": fci, "hf": hf})
    out["h2"] = h2
    # QAOA p = 1 MaxCut on a 5-node graph: <C> at a few (gamma, beta)
    edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 0), (0, 2)]
    dev5 = qml.device("default.qubit", wires=5)

    @qml.qnode(dev5)
    def qaoa(gamma, beta):
        for w in range(5):
            qml.Hadamard(wires=w)
        for a, b in edges:
            qml.IsingZZ(2 * gamma, wires=[a, b])  # exp(-i gamma Z_a Z_b)
        for w in range(5):
            qml.RX(2 * beta, wires=w)
        return [qml.expval(qml.PauliZ(a) @ qml.PauliZ(b)) for a, b in edges]

    grid = []
    for gamma, beta in ((0.3, 0.2), (0.6, 0.4), (1.1, 0.9), (2.0, 0.35)):
        zz = qaoa(gamma, beta)
        cut = float(sum((1 - z) / 2 for z in zz))
        grid.append({"gamma": gamma, "beta": beta, "cut": cut})
    out["qaoa"] = {"edges": edges, "grid": grid}
    return out


TOPICS = {
    "dynamics": ("reference.json", dynamics_reference),
    "entanglement": ("reference-entanglement.json", entanglement_reference),
    "qec": ("reference-qec.json", qec_reference),
    "schwinger": ("reference-schwinger.json", schwinger_reference),
    "qml": ("reference-qml.json", qml_reference),
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
