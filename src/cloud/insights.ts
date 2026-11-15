import type { HistoryPoint } from '../engine/history';
import type { StatKey } from '../engine/types';

// Pro sobre el historial propio: ritmo real, hitos y resumen semanal. Puro y sin
// red; solo import type, porque /api también lo carga (Node ESM).

const STATS: StatKey[] = ['strength', 'defense', 'speed', 'dexterity'];
const DAY = 86_400_000;
export type Series = StatKey | 'total';
export const SERIES: Series[] = [...STATS, 'total'];

const val = (p: HistoryPoint, s: Series) => (s === 'total' ? STATS.reduce((t, k) => t + p[k], 0) : p[s]);

/** Ganancia media por día de cada serie en los últimos `days` días de historial; null con menos de un día. */
export function pace(points: HistoryPoint[], days = 30): Record<Series, number> | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const first = points.find((p) => p.t >= last.t - days * DAY) ?? points[0];
  const span = (last.t - first.t) / DAY;
  if (span < 1) return null;
  return Object.fromEntries(SERIES.map((s) => [s, (val(last, s) - val(first, s)) / span])) as Record<Series, number>;
}

/** Siguiente número "redondo" (1, 2, 5 × 10^k) estrictamente mayor que n. */
export function nextMilestone(n: number): number {
  let step = 10 ** Math.floor(Math.log10(Math.max(n, 1)));
  for (;;) {
    for (const m of [1, 2, 5]) if (m * step > n) return m * step;
    step *= 10;
  }
}

/** Fecha en que se alcanza `target` a ritmo lineal; null si no se avanza. */
export const etaDate = (now: number, perDay: number, target: number, from: number) =>
  perDay > 0 ? new Date(from + Math.ceil((target - now) / perDay) * DAY) : null;

export interface Weekly {
  days: number;
  gain: Record<Series, number>;
  /** Crecimiento del total en la semana (0.021 = +2,1%). */
  pct: number;
  best: StatKey;
  /** Semana contra el ritmo de 30 días (0.12 = 12% más rápido); null sin base. */
  vsPace: number | null;
}

/** La última semana: el punto más reciente con al menos 6,5 días de distancia (≈7 con snapshots diarios). */
export function weekly(points: HistoryPoint[]): Weekly | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const start = [...points].reverse().find((p) => last.t - p.t >= 6.5 * DAY);
  if (!start) return null;
  const days = (last.t - start.t) / DAY;
  const gain = Object.fromEntries(SERIES.map((s) => [s, val(last, s) - val(start, s)])) as Record<Series, number>;
  const best = STATS.reduce((a, b) => (gain[b] > gain[a] ? b : a));
  const p = pace(points, 30);
  const vsPace = p && p.total > 0 ? gain.total / days / p.total - 1 : null;
  return { days, gain, pct: val(start, 'total') > 0 ? gain.total / val(start, 'total') : 0, best, vsPace };
}
