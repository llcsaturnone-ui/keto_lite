// Same rational-arithmetic approach as the calculator in «Чистыми».
// Expressions are parsed as numbers and operators; no code is evaluated.
const SCALE = 1_000_000n;
const MAX_GRAMS = 1_000_000_000n;

export const displayExpression = value => value.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, ',');
export const displayWeight = value => String(value).replace('.', ',');

export function calculateWeight(source) {
  const raw = String(source).replace(/\s/g, '').replace(/,/g, '.').replace(/−/g, '-').replace(/[×хx]/g, '*').replace(/÷/g, '/');
  if (!raw) return { status: 'empty' };
  if (raw.length > 200 || !/^[\d.+*/-]+$/.test(raw)) return { status: 'error', message: 'Проверь выражение' };
  let pos = 0;
  function reduce(n, d) {
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n, b = d;
    while (b) { const next = a % b; a = b; b = next; }
    return { n: n / (a || 1n), d: d / (a || 1n) };
  }
  function factor() {
    let sign = 1n;
    if (raw[pos] === '+' || raw[pos] === '-') { if (raw[pos++] === '-') sign = -1n; }
    if (pos >= raw.length || raw.slice(pos) === '.') throw new Error('pending');
    const match = raw.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error('Проверь выражение');
    pos += match[0].length;
    const [whole, fraction = ''] = match[0].split('.');
    const d = 10n ** BigInt(fraction.length), n = BigInt((whole || '0') + fraction);
    if (n > MAX_GRAMS * d) throw new Error('Слишком большое число');
    return reduce(sign * n, d);
  }
  function term() {
    let a = factor();
    while (raw[pos] === '*' || raw[pos] === '/') {
      const operator = raw[pos++], b = factor();
      if (operator === '/' && b.n === 0n) throw new Error('На ноль делить нельзя');
      a = operator === '*' ? reduce(a.n * b.n, a.d * b.d) : reduce(a.n * b.d, a.d * b.n);
    }
    return a;
  }
  try {
    let a = term();
    while (pos < raw.length) {
      const operator = raw[pos++];
      if (operator !== '+' && operator !== '-') throw new Error('Проверь выражение');
      const b = term();
      a = reduce(a.n * b.d + (operator === '+' ? 1n : -1n) * b.n * a.d, a.d * b.d);
    }
    const abs = a.n < 0n ? -a.n : a.n;
    if (abs > MAX_GRAMS * a.d) throw new Error('Слишком большое число');
    const rounded = (abs * SCALE + a.d / 2n) / a.d * (a.n < 0n ? -1n : 1n);
    return { status: 'ok', value: Number(rounded) / Number(SCALE), expression: /[+*/-]/.test(raw) };
  } catch (error) {
    return error.message === 'pending' ? { status: 'pending', message: 'Продолжи выражение' } : { status: 'error', message: error.message };
  }
}
