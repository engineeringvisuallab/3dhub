// Safe expression evaluator for parametric fields: numbers, $param, + - * / ( ) min() max().
// Never uses eval. Example: "$T/2 + 10", "max($dn*0.5, 50)".
export function evalExpr(v, params) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') throw new Error('bad expression: ' + v);
  const tok = v.match(/\$[A-Za-z_]\w*|\d+\.?\d*|[A-Za-z_]\w*|[()+\-*\/,]/g) || [];
  let i = 0;
  const peek = () => tok[i], next = () => tok[i++];
  function primary() {
    const t = next();
    if (t === undefined) throw new Error('unexpected end in "' + v + '"');
    if (t === '(') { const x = sum(); next(); return x; }
    if (t === '-') return -primary();
    if (t[0] === '$') { const n = t.slice(1); if (!(n in params)) throw new Error('unknown param $' + n); return +params[n]; }
    if (/^[0-9]/.test(t)) return parseFloat(t);
    if (t === 'min' || t === 'max') {
      next(); const a = [sum()]; while (peek() === ',') { next(); a.push(sum()); } next();
      return Math[t](...a);
    }
    throw new Error('bad token ' + t + ' in "' + v + '"');
  }
  function prod() { let x = primary(); while (peek() === '*' || peek() === '/') { const o = next(), y = primary(); x = o === '*' ? x*y : x/y; } return x; }
  function sum() { let x = prod(); while (peek() === '+' || peek() === '-') { const o = next(), y = prod(); x = o === '+' ? x+y : x-y; } return x; }
  const r = sum();
  if (i < tok.length) throw new Error('trailing tokens in "' + v + '"');
  return r;
}
export const evalVec = (a, p) => a.map(x => evalExpr(x, p));
