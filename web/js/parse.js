// Parsing for Pauli-sum expressions ("0.5*Z0 Z1 + X0", "ZZI - 0.3*XIX") and initial states.
// Qubit q is the q-th character of a full Pauli string and of a state string (qubit 0 first).

export class ParseError extends Error {}

const TOKEN = /\s*(?:(\d+\.?\d*(?:E[+-]?\d+)?|\.\d+(?:E[+-]?\d+)?)|([XYZI])(\d+)|([XYZI]+)|([+\-*]))/y;

function locate(src, pos) {
  const before = src.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  return line > 1 ? `line ${line}, column ${col}` : `position ${col}`;
}

function describe(token) {
  if (token.type === 'num') return `the number ${token.value}`;
  if (token.type === 'op') return `"${token.pauli}${token.qubit}"`;
  return `"${token.value}"`;
}

function tokenize(text) {
  // Comments are blanked out rather than removed so reported positions still match the input.
  const src = text
    .replace(/#[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/−/g, '-')
    .toUpperCase();
  const tokens = [];
  let pos = 0;
  while (!/^\s*$/.test(src.slice(pos))) {
    const rest = src.slice(pos);
    const start = pos + rest.length - rest.trimStart().length;
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw new ParseError(`Unexpected "${text[start]}" at ${locate(src, start)}`);
    const at = locate(src, start);
    if (m[1] !== undefined) tokens.push({ type: 'num', value: parseFloat(m[1]), at });
    else if (m[2] !== undefined) tokens.push({ type: 'op', pauli: m[2], qubit: parseInt(m[3], 10), at });
    else if (m[4] !== undefined) tokens.push({ type: 'str', value: m[4], at });
    else tokens.push({ type: 'sym', value: m[5], at });
    pos = TOKEN.lastIndex;
  }
  return tokens;
}

export function parsePauliSum(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) throw new ParseError('Enter at least one term, e.g. Z0 Z1 + 0.5*X0');

  const isSym = (t, v) => t !== undefined && t.type === 'sym' && t.value === v;
  const isOperator = (t) => t !== undefined && (t.type === 'op' || t.type === 'str');
  const terms = [];
  let i = 0;

  while (i < tokens.length) {
    let sign = 1;
    if (isSym(tokens[i], '+') || isSym(tokens[i], '-')) {
      sign = tokens[i].value === '-' ? -1 : 1;
      i++;
    } else if (terms.length > 0) {
      const t = tokens[i];
      if (t.type === 'num') {
        throw new ParseError(`A term's coefficient goes first, e.g. 0.5*Z0 (${t.at})`);
      }
      throw new ParseError(`Expected "+" or "-" before ${describe(t)} at ${t.at}`);
    }

    let coeff = 1;
    let hasCoeff = false;
    if (tokens[i] !== undefined && tokens[i].type === 'num') {
      coeff = tokens[i].value;
      hasCoeff = true;
      i++;
      if (isSym(tokens[i], '*')) i++;
    }

    const ops = [];
    let str = null;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === 'op') {
        if (ops.some(([q]) => q === t.qubit)) {
          throw new ParseError(`Qubit ${t.qubit} appears twice in one term (${t.at}); write it as a single Pauli`);
        }
        ops.push([t.qubit, t.pauli]);
        i++;
      } else if (t.type === 'str') {
        if (str !== null) throw new ParseError(`Two Pauli strings in one term ("${str}" and "${t.value}", ${t.at})`);
        str = t.value;
        i++;
      } else if (isSym(t, '*') && (ops.length > 0 || str !== null) && isOperator(tokens[i + 1])) {
        i++;
      } else {
        break;
      }
    }

    if (!hasCoeff && ops.length === 0 && str === null) {
      const t = tokens[i];
      throw new ParseError(t ? `Unexpected ${describe(t)} at ${t.at}` : 'The expression ends with a dangling "+" or "-"');
    }
    if (str !== null && ops.length > 0) {
      throw new ParseError(`Use either a full Pauli string ("${str}") or indexed operators like X0 in a term, not both`);
    }
    terms.push({ coeff: sign * coeff, ops, str });
  }

  let width = null;
  let minQubits = 0;
  for (const t of terms) {
    if (t.str !== null && /[XYZ]/.test(t.str)) {
      if (width === null) width = t.str.length;
      else if (t.str.length !== width) {
        throw new ParseError(`Pauli strings must all be the same length ("${t.str}" has ${t.str.length} characters, an earlier one has ${width})`);
      }
    }
    for (const [q] of t.ops) minQubits = Math.max(minQubits, q + 1);
  }
  if (width !== null && minQubits > width) {
    throw new ParseError(`Qubit ${minQubits - 1} is out of range for ${width}-character Pauli strings`);
  }
  return { terms, width, minQubits };
}

export function qubitCount(parsed) {
  return parsed.width ?? parsed.minQubits;
}

// Resolve a parsed sum into bitmask form on n qubits, merging repeated Pauli strings.
// xmask marks qubits with X or Y, zmask marks qubits with Z or Y.
export function toPauliTerms(parsed, n) {
  if (parsed.width !== null && parsed.width !== n) {
    throw new ParseError(`These Pauli strings have ${parsed.width} characters, but the Hamiltonian acts on ${n} qubits`);
  }
  if (parsed.minQubits > n) {
    throw new ParseError(`Qubit ${parsed.minQubits - 1} doesn't exist here: the Hamiltonian acts on qubits 0 to ${n - 1}`);
  }
  const merged = new Map();
  for (const t of parsed.terms) {
    let xmask = 0;
    let zmask = 0;
    const place = (q, p) => {
      if (p === 'X' || p === 'Y') xmask |= 1 << q;
      if (p === 'Z' || p === 'Y') zmask |= 1 << q;
    };
    if (t.str !== null) for (let q = 0; q < t.str.length; q++) place(q, t.str[q]);
    for (const [q, p] of t.ops) place(q, p);
    const key = `${xmask},${zmask}`;
    const prev = merged.get(key);
    if (prev) prev.coeff += t.coeff;
    else merged.set(key, { coeff: t.coeff, xmask, zmask });
  }
  return [...merged.values()].filter((t) => Math.abs(t.coeff) > 1e-14);
}

export function parseState(text, n) {
  const s = text.replace(/−/g, '-').replace(/[|>⟩\s]/g, '');
  if (s === '') return '0'.repeat(n);
  if (!/^[01+-]+$/.test(s)) throw new ParseError('Use only 0, 1, + and - (one character per qubit)');
  if (s.length !== n) {
    throw new ParseError(`The Hamiltonian acts on ${n} qubit${n === 1 ? '' : 's'}, so the state needs ${n} characters (got ${s.length})`);
  }
  return s;
}
