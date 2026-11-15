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

/** 398966085 → "399.0M"; para cifras grandes en texto corrido. */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}
