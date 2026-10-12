// Surface-code error correction: the rotated surface code, matching graphs, two decoders and
// Monte Carlo estimates of logical error rates.
//
// Rotated surface code of odd distance d: data qubit (i, j) = i d + j on a d x d grid (row i from the
// top). Stabilizers sit on faces (i, j), i, j = 0..d, touching data (i-1, j-1), (i-1, j), (i, j-1),
// (i, j). Face type alternates like a chessboard: (i + j) even is X-type, odd is Z-type. Bulk faces
// have weight 4; on the top and bottom edges only X-type weight-2 faces are kept, on the left and
// right edges only Z-type ones. That gives d² − 1 stabilizers for d² qubits: one logical qubit.
//   Logical X: X on a column (top to bottom). Logical Z: Z on a row (left to right).
// X errors are caught by Z-type checks, Z errors by X-type checks.

export function surfaceCode(d) {
  const checks = [];
  const inGrid = (i, j) => i >= 0 && i < d && j >= 0 && j < d;
  for (let i = 0; i <= d; i++) {
    for (let j = 0; j <= d; j++) {
      const type = (i + j) % 2 === 0 ? 'X' : 'Z';
      const qubits = [
        [i - 1, j - 1],
        [i - 1, j],
        [i, j - 1],
        [i, j],
      ]
        .filter(([a, b]) => inGrid(a, b))
        .map(([a, b]) => a * d + b);
      if (qubits.length === 4) checks.push({ type, qubits, i, j });
      else if (qubits.length === 2) {
        const topBottom = i === 0 || i === d;
        if ((topBottom && type === 'X') || (!topBottom && type === 'Z')) checks.push({ type, qubits, i, j });
      }
    }
  }
  const logicalX = Array.from({ length: d }, (_, i) => i * d); // column 0
  const logicalZ = Array.from({ length: d }, (_, j) => j); // row 0
  return { d, n: d * d, checks, logicalX, logicalZ };
}

// The matching graph for errors of one Pauli type: X errors are seen by Z checks and vice versa.
// Nodes are the checks of the detecting type plus one boundary node; each data qubit is an edge
// between the checks it touches (or to the boundary if it touches only one).
export function matchingGraph(code, errorType) {
  const detecting = errorType === 'X' ? 'Z' : 'X';
  const checks = code.checks.filter((c) => c.type === detecting);
  const boundary = checks.length;
  const touching = Array.from({ length: code.n }, () => []);
  checks.forEach((c, k) => c.qubits.forEach((q) => touching[q].push(k)));
  const edges = [];
  touching.forEach((ks, q) => {
    if (ks.length === 2) edges.push({ a: ks[0], b: ks[1], q });
    else if (ks.length === 1) edges.push({ a: ks[0], b: boundary, q });
  });
  return finishGraph({ nodes: boundary + 1, boundary, edges, checks });
}

function finishGraph(g) {
  g.adj = Array.from({ length: g.nodes }, () => []);
  g.edges.forEach((e, k) => {
    g.adj[e.a].push(k);
    g.adj[e.b].push(k);
  });
  return g;
}

// Syndrome of an error (array of 0/1 per data qubit) on the graph's checks: which checks fire.
export function syndrome(graph, error) {
  return graph.checks.map((c) => c.qubits.reduce((s, q) => s ^ error[q], 0));
}

// Breadth-first search from node src (unit edge weights): distances and the edge used to arrive.
function bfs(graph, src) {
  const dist = new Int32Array(graph.nodes).fill(-1);
  const via = new Int32Array(graph.nodes).fill(-1);
  const queue = [src];
  dist[src] = 0;
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const k of graph.adj[u]) {
      const e = graph.edges[k];
      const v = e.a === u ? e.b : e.a;
      if (dist[v] >= 0) continue;
      dist[v] = dist[u] + 1;
      via[v] = k;
      queue.push(v);
    }
  }
  return { dist, via };
}

function pathEdges(graph, tree, target) {
  const out = [];
  let v = target;
  while (tree.via[v] >= 0) {
    const k = tree.via[v];
    out.push(k);
    const e = graph.edges[k];
    v = e.a === v ? e.b : e.a;
  }
  return out;
}

// Minimum-weight perfect matching of the defects (nodes that fire), each paired with another defect
// or with the boundary, by exact dynamic programming over subsets. Returns { edges, weight, pairs }
// or null when there are too many defects for the exact method.
export const MWPM_LIMIT = 18;

export function mwpm(graph, defects) {
  const k = defects.length;
  if (k > MWPM_LIMIT) return null;
  if (k === 0) return { edges: [], weight: 0, pairs: [] };
  const trees = defects.map((d) => bfs(graph, d));
  const hasBoundary = graph.boundary >= 0;
  const D = (i, j) => trees[i].dist[defects[j]];
  const B = (i) => (hasBoundary ? trees[i].dist[graph.boundary] : Infinity);
  const full = (1 << k) - 1;
  const cost = new Float64Array(1 << k).fill(Infinity);
  const choice = new Int32Array(1 << k).fill(-2);
  cost[0] = 0;
  for (let mask = 1; mask <= full; mask++) {
    // resolve the lowest defect in the mask
    const i = 31 - Math.clz32(mask & -mask);
    const rest = mask & ~(1 << i);
    let best = B(i) + cost[rest];
    let pick = -1;
    for (let j = i + 1; j < k; j++) {
      if (!(rest & (1 << j))) continue;
      const c = D(i, j) + cost[rest & ~(1 << j)];
      if (c < best) {
        best = c;
        pick = j;
      }
    }
    cost[mask] = best;
    choice[mask] = pick;
  }
  const pairs = [];
  const edges = [];
  let mask = full;
  while (mask) {
    const i = 31 - Math.clz32(mask & -mask);
    const j = choice[mask];
    if (j === -1) {
      pairs.push([defects[i], graph.boundary]);
      edges.push(...pathEdges(graph, trees[i], graph.boundary));
      mask &= ~(1 << i);
    } else {
      pairs.push([defects[i], defects[j]]);
      edges.push(...pathEdges(graph, trees[i], defects[j]));
      mask &= ~((1 << i) | (1 << j));
    }
  }
  return { edges, weight: cost[full], pairs };
}

// Union-find decoder (Delfosse & Nickerson 2017): grow every unresolved cluster by half an edge in
// all directions, merge clusters that meet, stop when every cluster holds an even number of
// defects or touches the boundary; then peel a spanning forest of each cluster into a correction.
// Returns { edges, grown } where grown lists the fully grown edges (for drawing).
export function unionFind(graph, defects, { trace = false } = {}) {
  const N = graph.nodes;
  const parent = Int32Array.from({ length: N }, (_, i) => i);
  const parity = new Uint8Array(N);
  const touchesBoundary = new Uint8Array(N);
  const isDefect = new Uint8Array(N);
  for (const d of defects) {
    isDefect[d] = 1;
    parity[d] = 1;
  }
  if (graph.boundary >= 0) touchesBoundary[graph.boundary] = 1;
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent[rb] = ra;
    parity[ra] ^= parity[rb];
    touchesBoundary[ra] |= touchesBoundary[rb];
  };
  const support = new Uint8Array(graph.edges.length);
  const inCluster = new Uint8Array(N);
  for (const d of defects) inCluster[d] = 1;
  const active = (r) => parity[r] === 1 && !touchesBoundary[r];
  const rounds = [];
  for (let round = 0; round < 4 * N; round++) {
    const roots = new Set();
    for (let v = 0; v < N; v++) if (inCluster[v] && active(find(v))) roots.add(find(v));
    if (!roots.size) break;
    const grow = [];
    for (let v = 0; v < N; v++) {
      if (!inCluster[v] || !roots.has(find(v))) continue;
      for (const k of graph.adj[v]) if (support[k] < 2) grow.push(k);
    }
    // an edge between two growing clusters gets half an edge from each side
    const fused = [];
    for (const k of grow) {
      if (support[k] >= 2) continue;
      support[k] += 1;
      if (support[k] === 2) fused.push(k);
    }
    for (const k of fused) {
      const { a, b } = graph.edges[k];
      inCluster[a] = 1;
      inCluster[b] = 1;
      union(a, b);
    }
    if (trace) rounds.push(Uint8Array.from(support));
  }
  // Peeling: build a spanning forest of the grown edges, rooted at the boundary where possible.
  const grown = [];
  for (let k = 0; k < graph.edges.length; k++) if (support[k] === 2) grown.push(k);
  const adj = Array.from({ length: N }, () => []);
  for (const k of grown) {
    adj[graph.edges[k].a].push(k);
    adj[graph.edges[k].b].push(k);
  }
  const seen = new Uint8Array(N);
  const order = [];
  const treeEdge = new Int32Array(N).fill(-1);
  const visit = (root) => {
    seen[root] = 1;
    const queue = [root];
    for (let h = 0; h < queue.length; h++) {
      const u = queue[h];
      order.push(u);
      for (const k of adj[u]) {
        const e = graph.edges[k];
        const v = e.a === u ? e.b : e.a;
        if (seen[v]) continue;
        seen[v] = 1;
        treeEdge[v] = k;
        queue.push(v);
      }
    }
  };
  if (graph.boundary >= 0) visit(graph.boundary);
  for (let v = 0; v < N; v++) if (!seen[v] && adj[v].length) visit(v);
  const flag = Uint8Array.from(isDefect);
  const edges = [];
  for (let idx = order.length - 1; idx >= 0; idx--) {
    const v = order[idx];
    const k = treeEdge[v];
    if (k < 0 || !flag[v]) continue;
    edges.push(k);
    flag[v] = 0;
    const e = graph.edges[k];
    const u = e.a === v ? e.b : e.a;
    if (u !== graph.boundary) flag[u] ^= 1;
  }
  return { edges, grown, rounds };
}

// Turn decoder edges into a correction on the data qubits (edges with q < 0 are time-like).
export function correctionOf(graph, edges, n) {
  const c = new Uint8Array(n);
  for (const k of edges) {
    const q = graph.edges[k].q;
    if (q >= 0) c[q] ^= 1;
  }
  return c;
}

// Does residual (error XOR correction) of the given type flip the logical qubit? An X residual is a
// logical X when it anticommutes with logical Z (odd overlap with the row), and vice versa.
export function logicalFlip(code, residual, errorType) {
  const support = errorType === 'X' ? code.logicalZ : code.logicalX;
  return support.reduce((s, q) => s ^ residual[q], 0) === 1;
}

export function decode(graph, defects, decoder) {
  if (decoder === 'mwpm') {
    const m = mwpm(graph, defects);
    if (m) return m.edges;
  }
  return unionFind(graph, defects).edges;
}

// ----- Monte Carlo -----

// One code-capacity trial with independent X errors (probability p per qubit): did decoding fail?
export function trialCodeCapacity(code, graph, p, decoder, rng) {
  const err = new Uint8Array(code.n);
  for (let q = 0; q < code.n; q++) if (rng() < p) err[q] = 1;
  const syn = syndrome(graph, err);
  const defects = [];
  syn.forEach((s, k) => s && defects.push(k));
  const corr = correctionOf(graph, decode(graph, defects, decoder), code.n);
  for (let q = 0; q < code.n; q++) err[q] ^= corr[q];
  return logicalFlip(code, err, 'X');
}

// Phenomenological noise: `rounds` rounds of noisy syndrome measurement (each data qubit flips with
// probability p between rounds, each recorded syndrome bit flips with probability q), then one
// perfect round. Decoding matches detection events (changes of the syndrome) in space-time.
export function spaceTimeGraph(code, rounds) {
  const base = matchingGraph(code, 'X');
  const m = base.checks.length;
  const layers = rounds + 1;
  const boundary = m * layers;
  const edges = [];
  for (let t = 0; t < layers; t++) {
    for (const e of base.edges) {
      const a = t * m + e.a;
      const b = e.b === base.boundary ? boundary : t * m + e.b;
      edges.push({ a, b, q: e.q, t });
    }
    if (t + 1 < layers) for (let c = 0; c < m; c++) edges.push({ a: t * m + c, b: (t + 1) * m + c, q: -1, t });
  }
  return finishGraph({ nodes: boundary + 1, boundary, edges, checks: base.checks, layers, perLayer: m, base });
}

export function trialPhenomenological(code, st, p, q, decoder, rng) {
  const err = new Uint8Array(code.n);
  const m = st.perLayer;
  let prev = new Uint8Array(m);
  const defects = [];
  for (let t = 0; t < st.layers; t++) {
    for (let k = 0; k < code.n; k++) if (rng() < p) err[k] ^= 1;
    const syn = Uint8Array.from(syndrome(st.base, err));
    if (t < st.layers - 1) for (let c = 0; c < m; c++) if (rng() < q) syn[c] ^= 1;
    for (let c = 0; c < m; c++) if (syn[c] !== prev[c]) defects.push(t * m + c);
    prev = syn;
  }
  const corr = correctionOf(st, decode(st, defects, decoder), code.n);
  for (let k = 0; k < code.n; k++) err[k] ^= corr[k];
  return logicalFlip(code, err, 'X');
}

// Logical error rates for a grid of distances and physical error rates. Runs in a Web Worker
// (ui/worker.js); reports progress as a fraction.
export function thresholdScan({ distances, ps, trials, decoder = 'mwpm', noise = 'code-capacity', seed = 1 }, progress) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const results = [];
  const total = distances.length * ps.length;
  let done = 0;
  for (const d of distances) {
    const code = surfaceCode(d);
    const graph = noise === 'code-capacity' ? matchingGraph(code, 'X') : spaceTimeGraph(code, d);
    const row = [];
    for (const p of ps) {
      let fails = 0;
      for (let k = 0; k < trials; k++) {
        const failed = noise === 'code-capacity' ? trialCodeCapacity(code, graph, p, decoder, rng) : trialPhenomenological(code, graph, p, p, decoder, rng);
        if (failed) fails++;
      }
      row.push({ p, fails, trials, rate: fails / trials });
      done++;
      progress?.(done / total);
    }
    results.push({ d, row });
  }
  return results;
}
