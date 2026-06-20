// Historical battle-stats time series.
//
// Two sources feed the history chart:
//   1. A one-time import of the user's TornStats "Battle Stats" export (the
//      Chart.js page), parsed here. TornStats is the only place that keeps a
//      long-running snapshot history; the Torn API only exposes *current*
//      stats, so without an import we can only chart from "today" forward.
//   2. The current live player point, appended at render time.
//
// The TornStats export embeds, per stat, a `data: [{x: <ms>, y: <value>}, ...]`
// array. We parse each labelled series, then merge them onto a single sorted
// timeline with forward-fill so every row carries all four stats (total is
// always recomputed as the sum, never trusted from the export).

import { StatKey } from './types';

export interface HistoryPoint {
  t: number; // epoch ms
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
}

const HISTORY_STORE = 'tto.history';

const LABEL_MAP: Record<string, StatKey> = {
  Strength: 'strength',
  Defense: 'defense',
  Speed: 'speed',
  Dexterity: 'dexterity',
  // 'Total' is intentionally absent — we recompute it.
};

const STAT_ORDER: StatKey[] = ['strength', 'defense', 'speed', 'dexterity'];

/**
 * Parse a TornStats battle-stats export (raw pasted text / HTML) into a merged,
 * forward-filled history. Tolerant of surrounding markup: it only looks for the
 * `label: '...'` + `data: [ {x:..,y:..}, ... ]` blocks.
 */
export function parseTornStatsHistory(text: string): HistoryPoint[] {
  const series: Partial<Record<StatKey, { t: number; v: number }[]>> = {};

  // Each dataset: label, then (later) its data array. `[\s\S]*?` is lazy so we
  // stop at the first `data:` after the label; the inner `[^\]]*` never crosses
  // a `]`, so it captures exactly one data array.
  const blockRe = /label:\s*'([^']+)'[\s\S]*?data:\s*\[([^\]]*)\]/g;
  const ptRe = /\{\s*x:\s*(\d+)\s*,\s*y:\s*(-?\d+(?:\.\d+)?)\s*\}/g;

  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(text)) !== null) {
    const key = LABEL_MAP[block[1].trim()];
    if (!key) continue;
    const pts: { t: number; v: number }[] = [];
    let p: RegExpExecArray | null;
    ptRe.lastIndex = 0;
    while ((p = ptRe.exec(block[2])) !== null) {
      pts.push({ t: Number(p[1]), v: Math.round(Number(p[2])) });
    }
    pts.sort((a, b) => a.t - b.t);
    series[key] = pts;
  }

  return mergeSeries(series);
}

/** Merge per-stat series onto one sorted timeline with forward-fill. */
function mergeSeries(series: Partial<Record<StatKey, { t: number; v: number }[]>>): HistoryPoint[] {
  const times = new Set<number>();
  for (const key of STAT_ORDER) {
    for (const pt of series[key] ?? []) times.add(pt.t);
  }
  const sorted = [...times].sort((a, b) => a - b);
  if (!sorted.length) return [];

  const idx: Record<StatKey, number> = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
  const last: Record<StatKey, number> = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
  const rows: HistoryPoint[] = [];

  for (const t of sorted) {
    for (const key of STAT_ORDER) {
      const arr = series[key] ?? [];
      while (idx[key] < arr.length && arr[idx[key]].t <= t) {
        last[key] = arr[idx[key]].v;
        idx[key]++;
      }
    }
    rows.push({
      t,
      strength: last.strength,
      defense: last.defense,
      speed: last.speed,
      dexterity: last.dexterity,
    });
  }
  return rows;
}

/** Append/refresh a single point (e.g. the live player) at timestamp `t`. */
export function withLivePoint(
  history: HistoryPoint[],
  stats: Record<StatKey, number>,
  t: number = Date.now(),
): HistoryPoint[] {
  const point: HistoryPoint = {
    t,
    strength: stats.strength,
    defense: stats.defense,
    speed: stats.speed,
    dexterity: stats.dexterity,
  };
  if (!history.length) return [point];
  const lastT = history[history.length - 1].t;
  // Same calendar day → replace the trailing point instead of stacking.
  const sameDay = new Date(lastT).toDateString() === new Date(t).toDateString();
  if (t <= lastT || sameDay) {
    const trimmed = sameDay ? history.slice(0, -1) : history;
    return [...trimmed, point].sort((a, b) => a.t - b.t);
  }
  return [...history, point];
}

export function loadHistory(): HistoryPoint[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryPoint[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: HistoryPoint[]): void {
  try {
    localStorage.setItem(HISTORY_STORE, JSON.stringify(history));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORE);
  } catch {
    /* non-fatal */
  }
}
