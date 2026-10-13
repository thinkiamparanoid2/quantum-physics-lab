"""Turn raw counts (simulated or from hardware) into results: CHSH value S, the Schwinger particle
number with readout mitigation and zero-noise extrapolation, and the RB error per Clifford.

    python hardware_runs/analyze.py chsh|schwinger|rb [simulated|ibm_kingston]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import experiments as ex  # noqa: E402
from engine import exact_evolve, expectation_from_statevector, trotter_circuit  # noqa: E402
from modules.schwinger_model.hamiltonian import particle_number_operator, schwinger_hamiltonian, vacuum_state  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"


def load(name, source):
    return json.loads((RESULTS / f"{name}-{source}.json").read_text())


def chsh(data):
    runs = data["runs"]
    E = {(r["a"], r["b"]): ex.correlation(r["counts"]) for r in runs if r["kind"] == "chsh"}
    S = E[("a0", "b0")] + E[("a0", "b1")] + E[("a1", "b0")] - E[("a1", "b1")]
    shots = data["shots"]
    # each correlation has variance (1 − E²)/shots; S is a sum of four independent ones
    err = float(np.sqrt(sum((1 - e * e) / shots for e in E.values())))
    sweep = [{"angle_diff": r["angle_diff"], "E": ex.correlation(r["counts"])} for r in runs if r["kind"] == "sweep"]
    return {"S": S, "S_err": err, "correlations": {f"{a},{b}": v for (a, b), v in E.items()}, "sweep": sweep,
            "classical_bound": 2, "quantum_bound": 2 * np.sqrt(2)}


def schwinger_exact():
    p = ex.SCHWINGER
    h = schwinger_hamiltonian(p["num_sites"], x=p["x"], mass=p["mass"], coupling=p["coupling"])
    ops = [particle_number_operator(p["num_sites"], k) for k in range(p["num_sites"])]
    psi0 = vacuum_state(p["num_sites"])
    exact, trotter = [], []
    for t in ex.SCHWINGER_TIMES:
        s = exact_evolve(h, t, psi0) if t > 0 else psi0
        exact.append(sum(expectation_from_statevector(o, s) for o in ops))
        if t > 0:
            steps = max(1, round(t / ex.SCHWINGER_DT))
            s2 = psi0.evolve(trotter_circuit(h, t, steps=steps, order=2))
        else:
            s2 = psi0
        trotter.append(sum(expectation_from_statevector(o, s2) for o in ops))
    return exact, trotter


def mitigate_readout(counts, cal0, cal1, n=4):
    """Per-qubit readout errors from the all-0 and all-1 calibrations; invert them on the
    probability vector (tensor product of 2 × 2 confusion matrices)."""
    shots0, shots1 = sum(cal0.values()), sum(cal1.values())
    e0 = [sum(c for b, c in cal0.items() if b[::-1][k] == "1") / shots0 for k in range(n)]  # 0 read as 1
    e1 = [sum(c for b, c in cal1.items() if b[::-1][k] == "0") / shots1 for k in range(n)]  # 1 read as 0
    shots = sum(counts.values())
    p = np.zeros(2**n)
    for b, c in counts.items():
        p[int(b, 2)] += c / shots  # index bit k = qubit k
    for k in range(n):
        A = np.array([[1 - e0[k], e1[k]], [e0[k], 1 - e1[k]]])
        Ainv = np.linalg.inv(A)
        p = p.reshape([2] * n)  # axis order: most significant bit first, so qubit k is axis n−1−k
        p = np.moveaxis(np.tensordot(Ainv, p, axes=([1], [n - 1 - k])), 0, n - 1 - k).reshape(-1)
    return p, e0, e1


def number_from_probs(p, n=4):
    total = 0.0
    for idx, w in enumerate(p):
        for k in range(n):
            bit = (idx >> k) & 1
            total += w * (bit if k % 2 == 0 else 1 - bit)
    return float(total)


def richardson(scales, ys):
    return float(sum(y * np.prod([s2 / (s2 - s) for s2 in scales if s2 != s]) for s, y in zip(scales, ys)))


def resample(counts, rng):
    keys = list(counts)
    draws = rng.multinomial(sum(counts.values()), np.array([counts[k] for k in keys], float) / sum(counts.values()))
    return {k: int(v) for k, v in zip(keys, draws) if v}


def schwinger(data, bootstrap=200, seed=5):
    """Point estimates, plus standard errors from a bootstrap over the shots of every circuit
    (calibration circuits included), carried through readout mitigation and extrapolation."""
    est = schwinger_point(data)
    rng = np.random.default_rng(seed)
    samples = []
    for _ in range(bootstrap):
        fake = {**data, "runs": [{**r, "counts": resample(r["counts"], rng)} for r in data["runs"]]}
        samples.append(schwinger_point(fake)["rows"])
    for i, row in enumerate(est["rows"]):
        for key in ("readout_mitigated", "zne_linear"):
            vals = [s[i][key] for s in samples]
            row[key + "_err"] = float(np.std(vals, ddof=1))
    return est


def schwinger_point(data):
    runs = data["runs"]
    cal0 = next(r["counts"] for r in runs if r["kind"] == "readout" and r["prepared"] == 0)
    cal1 = next(r["counts"] for r in runs if r["kind"] == "readout" and r["prepared"] == 1)
    exact, trotter = schwinger_exact()
    rows = []
    for i, t in enumerate(ex.SCHWINGER_TIMES):
        by_scale = {}
        raw1 = None
        for r in runs:
            if r["kind"] == "schwinger" and r["t"] == t:
                p, e0, e1 = mitigate_readout(r["counts"], cal0, cal1)
                by_scale[r["scale"]] = number_from_probs(p)
                if r["scale"] == 1:
                    raw1 = ex.particle_number(r["counts"])[0]
        scales = sorted(by_scale)
        ys = [by_scale[s] for s in scales]
        lin = float(np.polyval(np.polyfit(scales, ys, 1), 0))
        # noise drives the state towards maximally mixed, where the particle number is n/2 = 2:
        # extrapolate the excess y − 2 exponentially (a straight line in log|y − 2|)
        dev = np.array(ys) - 2.0
        if np.all(dev < 0) or np.all(dev > 0):
            slope, icpt = np.polyfit(scales, np.log(np.abs(dev)), 1)
            expo = float(2.0 + np.sign(dev[0]) * np.exp(icpt))
            if slope >= 0 or not 0 <= expo <= 4:  # the excess must shrink with noise; otherwise no fit
                expo = None
        else:
            expo = None
        rows.append({"t": t, "exact": exact[i], "trotter_ideal": trotter[i], "raw": raw1, "readout_mitigated": by_scale[1],
                     "zne_linear": lin, "zne_richardson": richardson(scales, ys), "zne_exponential": expo, "by_scale": by_scale})
    return {"rows": rows, "readout_error_0to1": e0, "readout_error_1to0": e1}


def rb(datasets):
    """Combine RB runs on the same qubit and fit A f^m + B with physical bounds 0 ≤ A, B ≤ 1,
    weighting each length by its standard error. The error per Clifford is r = (1 − f)/2."""
    from scipy.optimize import curve_fit

    pts = {}
    for data in datasets:
        for r in data["runs"]:
            pts.setdefault(r["m"], []).append(ex.survival(r["counts"]))
    ms = np.array(sorted(pts), float)
    ys = np.array([np.mean(pts[m]) for m in sorted(pts)])
    sem = np.array([max(np.std(pts[m], ddof=1) / np.sqrt(len(pts[m])), 1e-4) for m in sorted(pts)])
    model = lambda m, A, f, B: A * f**m + B  # noqa: E731
    (A, f, B), cov = curve_fit(model, ms, ys, p0=[0.5, 0.9998, 0.5], sigma=sem, absolute_sigma=True,
                               bounds=([0, 0.99, 0], [1, 1, 1]))
    f_err = float(np.sqrt(cov[1, 1]))
    return {"points": [{"m": int(m), "survival": float(y), "sem": float(e)} for m, y, e in zip(ms, ys, sem)],
            "A": float(A), "B": float(B), "f": float(f), "f_err": f_err,
            "error_per_clifford": float((1 - f) / 2), "error_per_clifford_err": f_err / 2}


def main():
    name = sys.argv[1]
    source = sys.argv[2] if len(sys.argv) > 2 else "simulated"
    if name == "rb":
        datasets = [json.loads(p.read_text()) for p in sorted(RESULTS.glob(f"rb*-{source}.json"))]
        data = datasets[-1]
        out = rb(datasets)
        out["runs_combined"] = len(datasets)
    else:
        data = load(name, source)
        out = {"chsh": chsh, "schwinger": schwinger}[name](data)
    out = {"experiment": name, "source": data["source"], "device_layout": data.get("layout"), "shots": data.get("shots"),
           "quantum_seconds": data.get("quantum_seconds"), "calibration": data.get("calibration"), "job_id": data.get("job_id"), **out}
    (RESULTS / f"{name}-{source}-analysis.json").write_text(json.dumps(out, indent=1, default=float))
    print(json.dumps({k: v for k, v in out.items() if k not in ("sweep", "points")}, indent=1, default=float)[:2500])


if __name__ == "__main__":
    main()
