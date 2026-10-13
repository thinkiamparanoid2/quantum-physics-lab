"""Run the hardware experiments on IBM Quantum, or simulate them first with the device's noise model.

    python hardware_runs/run.py simulate chsh|schwinger|rb     # free: Aer with ibm_kingston's noise
    python hardware_runs/run.py submit   chsh|schwinger|rb     # uses quantum time; prints the job id
    python hardware_runs/run.py fetch    chsh|schwinger|rb     # waits for the job, saves raw counts

Needs a saved IBM Quantum account (QiskitRuntimeService.save_account); the key never enters this
repository. Raw counts, job ids, the device and its calibration time go to hardware_runs/results/.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from qiskit.transpiler import generate_preset_pass_manager
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import experiments as ex  # noqa: E402

DEVICE = "ibm_kingston"
INSTANCE = "quantum-physics-lab"
RESULTS = Path(__file__).resolve().parent / "results"
SHOTS = {"chsh": 4000, "schwinger": 4000, "rb": 500}
ZNE_SCALES = [float(x) for x in __import__('os').environ.get('ZNE_SCALES', '1,2,3').split(',')]


def build(name):
    if name == "chsh":
        return ex.chsh_circuits()
    if name == "schwinger":
        circs, meta = ex.schwinger_circuits()
        cal, cal_meta = ex.readout_calibration_circuits()
        return circs + cal, meta + cal_meta
    if name == "rb":
        return ex.rb_circuits()
    raise SystemExit(f"unknown experiment {name}")


def fold(circuit, scale):
    """Scale the two-qubit noise by `scale` (≥ 1) by local folding: a native two-qubit gate G becomes
    G (G† G)^k. Every gate gets ⌊(scale − 1)/2⌋ pairs and the first gates one more pair, so that the
    two-qubit gate count is multiplied by `scale` (to the nearest gate). CZ is self-inverse."""
    if scale == 1:
        return circuit
    twoq = [i for i, inst in enumerate(circuit.data) if inst.operation.num_qubits == 2]
    base = int((scale - 1) // 2)
    extra = round(((scale - 1) / 2 - base) * len(twoq))
    pairs = {g: base + (1 if j < extra else 0) for j, g in enumerate(twoq)}
    out = circuit.copy_empty_like()
    for i, inst in enumerate(circuit.data):
        out.append(inst)
        for _ in range(pairs.get(i, 0)):
            out.append(inst.operation.inverse(), inst.qubits, inst.clbits)
            out.append(inst)
    return out


def best_qubits(backend, n):
    """Pick physical qubits from the device's current calibration: for n = 1 the qubit with the
    lowest readout + SX error, otherwise the connected chain of n qubits with the lowest summed
    readout and CZ error, skipping qubits whose readout error exceeds 3%."""
    t = backend.target
    ro = {q[0]: p.error for q, p in t["measure"].items() if p and p.error is not None}
    sx = {q[0]: p.error for q, p in t["sx"].items() if p and p.error is not None}
    twoq = next(g for g in ("cz", "ecr", "cx") if g in t.operation_names)
    edges = {tuple(q): p.error for q, p in t[twoq].items() if p and p.error is not None}
    good = {q for q, e in ro.items() if e < 0.03}
    if n == 1:
        return [min(good, key=lambda q: ro[q] + sx.get(q, 1))]
    nbrs = {}
    for (a, b), e in edges.items():
        if a in good and b in good and e < 0.01:
            nbrs.setdefault(a, {})[b] = min(e, nbrs.get(a, {}).get(b, 1))
            nbrs.setdefault(b, {})[a] = min(e, nbrs.get(b, {}).get(a, 1))
    best = None

    def walk(path, cost):
        nonlocal best
        if len(path) == n:
            if best is None or cost < best[0]:
                best = (cost, path)
            return
        for nb, e in nbrs.get(path[-1], {}).items():
            if nb not in path:
                walk(path + [nb], cost + e + ro[nb])

    for q in nbrs:
        walk([q], ro[q])
    return best[1]


def transpile_all(name, backend):
    circuits, meta = build(name)
    pm = generate_preset_pass_manager(optimization_level=3, backend=backend, seed_transpiler=7)
    if name == "schwinger":
        # one chain of good qubits for every circuit, so ZNE scales and the readout calibration all
        # use the same physical qubits
        layout = best_qubits(backend, ex.SCHWINGER["num_sites"])
        pm = generate_preset_pass_manager(optimization_level=3, backend=backend, seed_transpiler=7, initial_layout=layout)
        isa, isa_meta = [], []
        for c, m in zip(circuits, meta):
            t = pm.run(c)
            for s in ZNE_SCALES if m["kind"] == "schwinger" else [1]:
                isa.append(fold(t, s))
                isa_meta.append({**m, "scale": s})
        return isa, isa_meta, layout
    if name == "rb":
        # keep the sequence intact: optimisation_level 1 respects the barriers
        pm = generate_preset_pass_manager(optimization_level=1, backend=backend, seed_transpiler=7, initial_layout=best_qubits(backend, 1))
    elif name == "chsh":
        pm = generate_preset_pass_manager(optimization_level=3, backend=backend, seed_transpiler=7, initial_layout=best_qubits(backend, 2))
    isa = [pm.run(c) for c in circuits]
    return isa, meta, isa[0].layout.initial_index_layout(filter_ancillas=True)


def summary(isa):
    twoq = [sum(1 for i in c.data if i.operation.num_qubits == 2) for c in isa]
    return {"circuits": len(isa), "max_two_qubit_gates": max(twoq), "max_depth": max(c.depth() for c in isa)}


def counts_of(result, i):
    return result[i].data.c.get_counts()


def main():
    mode, name = sys.argv[1], sys.argv[2]
    service = QiskitRuntimeService(instance=INSTANCE)
    backend = service.backend(DEVICE)
    RESULTS.mkdir(exist_ok=True)
    if mode in ("simulate", "submit"):
        isa, meta, layout = transpile_all(name, backend)
        info = summary(isa)
        print(name, info, "layout", layout)
        if mode == "simulate":
            from qiskit_aer import AerSimulator
            from qiskit_aer.primitives import SamplerV2 as AerSampler

            sim = AerSimulator.from_backend(backend)
            res = AerSampler.from_backend(sim, seed=3).run(isa, shots=SHOTS[name]).result()
            out = {"experiment": name, "source": f"Aer with {DEVICE} noise model", "layout": layout, **info, "shots": SHOTS[name],
                   "runs": [{**m, "counts": counts_of(res, i)} for i, m in enumerate(meta)]}
            (RESULTS / f"{name}-simulated.json").write_text(json.dumps(out, indent=1))
            print("saved simulation")
        else:
            job = SamplerV2(mode=backend).run(isa, shots=SHOTS[name])
            pending = {"experiment": name, "job_id": job.job_id(), "device": DEVICE, "layout": layout, **info, "shots": SHOTS[name], "meta": meta,
                       "submitted": datetime.now(timezone.utc).isoformat()}
            (RESULTS / f"{name}-job.json").write_text(json.dumps(pending, indent=1))
            print("submitted", job.job_id())
    elif mode == "fetch":
        pending = json.loads((RESULTS / f"{name}-job.json").read_text())
        job = service.job(pending["job_id"])
        res = job.result()
        usage = job.usage() if hasattr(job, "usage") else None
        props = backend.properties()
        out = {**{k: v for k, v in pending.items() if k != "meta"}, "source": DEVICE, "quantum_seconds": usage,
               "calibration": str(props.last_update_date) if props else None,
               "runs": [{**m, "counts": counts_of(res, i)} for i, m in enumerate(pending["meta"])]}
        (RESULTS / f"{name}-{DEVICE}.json").write_text(json.dumps(out, indent=1))
        print("saved", name, "quantum seconds", usage)


if __name__ == "__main__":
    main()
