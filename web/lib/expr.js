// A small, safe parser for formulas in one variable, such as  0.5*x^2  or  5*(abs(x) > 3).
// It compiles to a JS closure without eval, so formulas arriving in shared links can't run code.
//
//   numbers 2, 0.5, 1e-3   constants pi, e   variable x
//   + - * / ^ (power, right-assoc) and comparisons < > <= >= (true = 1, false = 0)
//   functions sin cos tan exp log sqrt abs tanh cosh sinh sign floor min max step(x) = (x > 0)

export class ExprError extends Error {}

const FUNCS = {
  sin: [1, Math.sin],
  cos: [1, Math.cos],
  tan: [1, Math.tan],
  exp: [1, Math.exp],
  log: [1, Math.log],
  ln: [1, Math.log],
  sqrt: [1, Math.sqrt],
  abs: [1, Math.abs],
  tanh: [1, Math.tanh],
  cosh: [1, Math.cosh],
  sinh: [1, Math.sinh],
  sign: [1, Math.sign],
  floor: [1, Math.floor],
  step: [1, (v) => (v > 0 ? 1 : 0)],
  min: [2, Math.min],
  max: [2, Math.max],
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const tokens = [];
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z_][a-z0-9_]*)|(<=|>=|[-+*/^(),<>]))/giy;
  let m;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new ExprError(`Unexpected "${src.slice(pos).trim()[0]}"`);
    }
    pos = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ type: 'num', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'id', value: m[2].toLowerCase() });
    else tokens.push({ type: 'op', value: m[3] });
  }
  return tokens;
}

export function compile(src) {
  if (src.length > 500) throw new ExprError('The formula is too long');
  const tokens = tokenize(src);
  let i = 0;
  const peek = () => tokens[i];
  const isOp = (v) => peek()?.type === 'op' && peek().value === v;
  const expect = (v) => {
    if (!isOp(v)) throw new ExprError(`Expected "${v}"`);
    i++;
  };

  function compare() {
    const a = additive();
    for (const op of ['<=', '>=', '<', '>']) {
      if (isOp(op)) {
        i++;
        const b = additive();
        if (op === '<') return (x) => (a(x) < b(x) ? 1 : 0);
        if (op === '>') return (x) => (a(x) > b(x) ? 1 : 0);
        if (op === '<=') return (x) => (a(x) <= b(x) ? 1 : 0);
        return (x) => (a(x) >= b(x) ? 1 : 0);
      }
    }
    return a;
  }
  function additive() {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[i++].value;
      const l = a;
      const r = term();
      a = op === '+' ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return a;
  }
  function term() {
    let a = unary();
    while (isOp('*') || isOp('/')) {
      const op = tokens[i++].value;
      const l = a;
      const r = unary();
      a = op === '*' ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
    }
    return a;
  }
  function unary() {
    if (isOp('-')) {
      i++;
      const a = unary();
      return (x) => -a(x);
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  }
  function power() {
    const base = primary();
    if (isOp('^')) {
      i++;
      const exp = unary();
      return (x) => base(x) ** exp(x);
    }
    return base;
  }
  function primary() {
    const t = peek();
    if (!t) throw new ExprError('The formula ends too early');
    if (t.type === 'num') {
      i++;
      return () => t.value;
    }
    if (t.type === 'id') {
      i++;
      if (t.value === 'x') return (x) => x;
      if (Object.hasOwn(CONSTS, t.value)) return () => CONSTS[t.value];
      if (Object.hasOwn(FUNCS, t.value)) {
        const [arity, fn] = FUNCS[t.value];
        expect('(');
        const args = [compare()];
        while (isOp(',')) {
          i++;
          args.push(compare());
        }
        expect(')');
        if (args.length !== arity) throw new ExprError(`${t.value}() takes ${arity} argument${arity > 1 ? 's' : ''}`);
        return arity === 1 ? (x) => fn(args[0](x)) : (x) => fn(args[0](x), args[1](x));
      }
      throw new ExprError(`Unknown name "${t.value}"`);
    }
    if (isOp('(')) {
      i++;
      const a = compare();
      expect(')');
      return a;
    }
    throw new ExprError(`Unexpected "${t.value}"`);
  }

  if (tokens.length === 0) throw new ExprError('Type a formula in x');
  const f = compare();
  if (i < tokens.length) throw new ExprError(`Unexpected "${tokens[i].value}"`);
  return f;
}
