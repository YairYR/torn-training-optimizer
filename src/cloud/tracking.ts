import { HistoryPoint } from '../engine/history';
import { StatKey, STAT_KEYS } from '../engine/types';

// Lógica pura del seguimiento diario: compartida por las funciones de /api y la app.

export interface SnapshotRow {
  player_id: number;
  day: string; // YYYY-MM-DD (UTC)
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
}

export interface MemberSummary {
  playerId: number;
  name: string;
  day: string;
  stats: Record<StatKey, number>;
  total: number;
  /** Crecimiento del total en la ventana (0.12 = +12%); null con un solo día. */
  growth: number | null;
}

export const utcDay = (d: Date = new Date()) => d.toISOString().slice(0, 10);

const total = (r: Record<StatKey, number>) => STAT_KEYS.reduce((s, k) => s + r[k], 0);

/** Último snapshot por jugador y crecimiento desde el primero de la ventana. Ordenado por total. */
export function summarize(rows: SnapshotRow[], names: Record<number, string>): MemberSummary[] {
  const by = new Map<number, SnapshotRow[]>();
  for (const r of rows) by.set(r.player_id, [...(by.get(r.player_id) ?? []), r]);
  return [...by.entries()]
    .map(([playerId, rs]) => {
      rs.sort((a, b) => a.day.localeCompare(b.day));
      const first = rs[0];
      const last = rs[rs.length - 1];
      const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, Number(last[k])])) as Record<StatKey, number>;
      const t0 = total(first);
      return {
        playerId,
        name: names[playerId] ?? String(playerId),
        day: last.day,
        stats,
        total: total(stats),
        growth: rs.length > 1 && t0 > 0 ? total(stats) / t0 - 1 : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export const toHistory = (rows: SnapshotRow[]): HistoryPoint[] =>
  rows
    .map((r) => ({
      t: Date.parse(`${r.day}T12:00:00Z`), // mediodía UTC: cae en el mismo día local en casi todo el mundo
      strength: Number(r.strength),
      defense: Number(r.defense),
      speed: Number(r.speed),
      dexterity: Number(r.dexterity),
    }))
    .sort((a, b) => a.t - b.t);

/**
 * Errores de la API de Torn que invalidan la key de forma permanente: la guía de
 * la API pide dejar de usarla. 2 key incorrecta, 13 desactivada por inactividad,
 * 16 nivel de acceso insuficiente, 18 pausada por el dueño.
 */
export const isDeadKeyError = (code: number) => [2, 13, 16, 18].includes(code);
