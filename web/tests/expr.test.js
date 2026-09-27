import assert from 'node:assert/strict';
import test from 'node:test';

import { ExprError, compile } from '../lib/expr.js';

test('formulas evaluate with the usual precedence', () => {
  const cases = [
    ['0.5*x^2', 3, 4.5],
    ['-x^2', 2, -4],
    ['2^3^2', 0, 512],
    ['(1 + x) * 2 - 6 / 3', 1, 2],
    ['5*(abs(x) > 3)', -4, 5],
    ['5*(abs(x) > 3)', 1, 0],
    ['step(x - 1) + min(x, 2) + max(x, 2)', 3, 6],
    ['exp(-x) * sin(pi*x/2)', 1, Math.exp(-1)],
    ['1e-3*x + .5', 1000, 1.5],
    ['0.08*(x^2 - 6.25)^2', 0, 0.08 * 6.25 ** 2],
  ];
  for (const [src, x, want] of cases) assert.ok(Math.abs(compile(src)(x) - want) < 1e-12, `${src} at x = ${x}`);
});

test('bad formulas give readable errors, and nothing outside the grammar runs', () => {
  for (const src of ['', 'x +', '2 x', 'foo(x)', 'sin x', 'min(x)', 'x; alert(1)', 'constructor', '(x', 'x)']) {
    assert.throws(() => compile(src), ExprError, src);
  }
});
