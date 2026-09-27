// The circuit sandbox's model: a grid of columns, each holding cells { g, q, a? } where g is a
// gate name (H, X, Y, Z, S, SDG, T, TDG, RX, RY, RZ, P, M), 'C' for a control dot or 'W' for
// one end of a swap. Control dots control every other gate in their column (like Quirk).
//
// URL form (fragment, no escaping needed): n=3&c=H0/C0_X1/RY2@-45
//   columns separated by '/', cells by '_', angles in degrees after '@'.

export const ANGLE_GATES = new Set(['RX', 'RY', 'RZ', 'P']);
export const GATE_NAMES = ['H', 'X', 'Y', 'Z', 'S', 'SDG', 'T', 'TDG', 'RX', 'RY', 'RZ', 'P', 'M', 'C', 'W'];
export const MAX_QUBITS = 6;

const CELL = /^([A-Z]+)(\d+)(?:@(-?\d+(?:\.\d+)?))?$/;

export function emptyModel(n = 2) {
  return { n, cols: [] };
}

export function encode(model) {
  const cols = model.cols.map((col) =>
    col
      .slice()
      .sort((x, y) => x.q - y.q)
      .map((x) => `${x.g}${x.q}${x.a !== undefined ? `@${Number(((x.a * 180) / Math.PI).toFixed(2))}` : ''}`)
      .join('_'),
  );
  while (cols.length && cols[cols.length - 1] === '') cols.pop();
  return `n=${model.n}&c=${cols.join('/')}`;
}

export function decode(fragment) {
  const fields = Object.fromEntries(
    fragment
      .replace(/^#/, '')
      .split('&')
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf('=');
        return i < 0 ? [kv, ''] : [kv.slice(0, i), decodeURIComponent(kv.slice(i + 1))];
      }),
  );
  const n = Number(fields.n);
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUBITS) return null;
  const cols = (fields.c ?? '').split('/').map((col) =>
    col
      .split('_')
      .filter(Boolean)
      .map((cell) => {
        const m = CELL.exec(cell);
        if (!m || !GATE_NAMES.includes(m[1]) || Number(m[2]) >= n) return null;
        const x = { g: m[1], q: Number(m[2]) };
        if (ANGLE_GATES.has(x.g)) x.a = ((m[3] === undefined ? 45 : Number(m[3])) * Math.PI) / 180;
        return x;
      })
      .filter(Boolean),
  );
  // One cell per wire per column.
  for (const col of cols) {
    const seen = new Set();
    for (let i = col.length - 1; i >= 0; i--) {
      if (seen.has(col[i].q)) col.splice(i, 1);
      else seen.add(col[i].q);
    }
  }
  while (cols.length && cols[cols.length - 1].length === 0) cols.pop();
  return { n, cols };
}

// Turn the grid into engine ops. colOf[i] is the grid column that produced ops[i].
export function toOps(model) {
  const ops = [];
  const colOf = [];
  const warnings = [];
  model.cols.forEach((col, c) => {
    const controls = col.filter((x) => x.g === 'C').map((x) => x.q);
    const swaps = col.filter((x) => x.g === 'W').map((x) => x.q);
    const gates = col.filter((x) => x.g !== 'C' && x.g !== 'W');
    const push = (op) => {
      ops.push(op);
      colOf.push(c);
    };
    if (controls.length && !gates.some((x) => x.g !== 'M') && swaps.length !== 2) {
      warnings.push(`Column ${c + 1}: control dots need a gate (or a swap) in the same column.`);
    }
    for (const x of gates) {
      if (x.g === 'M') {
        push({ gate: 'MEASURE', target: x.q, bit: x.q });
        if (controls.length) warnings.push(`Column ${c + 1}: measurements can't be controlled; the dots are ignored for M.`);
        continue;
      }
      const op = { gate: x.g, target: x.q };
      if (ANGLE_GATES.has(x.g)) op.angle = x.a;
      if (controls.length) op.controls = controls;
      push(op);
    }
    if (swaps.length === 2) {
      const [a, b] = swaps;
      if (controls.length) {
        // Controlled swap (Fredkin) = CNOT(b->a), Toffoli(controls + a -> b), CNOT(b->a).
        push({ gate: 'X', target: a, controls: [b] });
        push({ gate: 'X', target: b, controls: [...controls, a] });
        push({ gate: 'X', target: a, controls: [b] });
      } else {
        push({ gate: 'SWAP', targets: [a, b] });
      }
    } else if (swaps.length) {
      warnings.push(`Column ${c + 1}: a swap needs exactly two × marks.`);
    }
  });
  return { ops, colOf, warnings };
}

// Convert engine ops (from a lesson) into a grid. Classically controlled gates become
// ordinary controls on the measured qubit, which is equivalent once it has been measured.
// Returns null for ops the grid can't express (custom blocks, "if bit = 0" conditions).
export function fromOps(n, ops) {
  if (n > MAX_QUBITS) return null;
  const cols = [];
  const measuredQubit = {};
  let sealed = true;
  for (const op of ops) {
    if (op.gate === 'BARRIER') {
      sealed = true;
      continue;
    }
    if (op.gate === 'BLOCK') return null;
    let cells;
    if (op.gate === 'MEASURE') {
      measuredQubit[op.bit ?? op.target] = op.target;
      cells = [{ g: 'M', q: op.target }];
    } else if (op.gate === 'SWAP') {
      cells = op.targets.map((q) => ({ g: 'W', q }));
    } else {
      const x = { g: op.gate, q: op.target };
      if (ANGLE_GATES.has(op.gate)) x.a = op.angle;
      if (!GATE_NAMES.includes(op.gate)) return null;
      const controls = [...(op.controls ?? [])];
      if (op.if) {
        if (op.if.value !== 1 || measuredQubit[op.if.bit] === undefined) return null;
        controls.push(measuredQubit[op.if.bit]);
      }
      cells = [x, ...controls.map((q) => ({ g: 'C', q }))];
    }
    const simple = cells.length === 1 && cells[0].g !== 'W';
    const last = cols[cols.length - 1];
    const canShare =
      simple && !sealed && last && last.every((y) => y.g !== 'C' && y.g !== 'W') && !last.some((y) => y.q === cells[0].q);
    if (canShare) last.push(...cells);
    else cols.push(cells);
    sealed = !simple;
  }
  return { n, cols };
}

export function cellAt(model, c, q) {
  return model.cols[c]?.find((x) => x.q === q) ?? null;
}

export function setCell(model, c, q, cell) {
  while (model.cols.length <= c) model.cols.push([]);
  model.cols[c] = model.cols[c].filter((x) => x.q !== q);
  if (cell) model.cols[c].push({ ...cell, q });
  while (model.cols.length && model.cols[model.cols.length - 1].length === 0) model.cols.pop();
}
