// A tiny safe expression evaluator for the in-game calculator (no eval).
export function evaluate(src: string): number | null {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  function primary(): number {
    if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw new Error('paren'); i++; return v; }
    if (peek() === 'π') { i++; return Math.PI; }
    if (peek() === '√') { i++; return Math.sqrt(postfix()); }
    if (peek() === '-') { i++; return -postfix(); }
    const m = /^\d*\.?\d+/.exec(s.slice(i)) ?? /^\d+\.?/.exec(s.slice(i));
    if (!m) throw new Error('num');
    i += m[0].length;
    return Number(m[0]);
  }
  function postfix(): number {
    let v = primary();
    while (peek() === '²') { i++; v *= v; }
    // Implicit multiplication: 2π, 3(4), π5
    while (peek() === 'π' || peek() === '(' || peek() === '√' || (/\d/.test(peek() ?? '') && s[i - 1] === 'π')) v *= primary();
    return v;
  }
  function term(): number {
    let v = postfix();
    while (peek() === '*' || peek() === '/') { const op = s[i++]; const r = postfix(); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  try {
    if (!s) return null;
    const v = expr();
    return i === s.length && Number.isFinite(v) ? v : null;
  } catch { return null; }
}
