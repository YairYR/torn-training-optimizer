export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtGain(n: number): string {
  if (n >= 100) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function fmtMoney(n: number | null): string {
  if (n == null) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtPerPoint(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US');
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
