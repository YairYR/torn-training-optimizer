import { StatKey, STAT_KEYS } from './types';
import { simulateSession } from './session';

// Progress tracking: stat snapshots over time, the deltas between them, and a
// predicted-vs-actual check that reuses the session engine. This closes the
// validation loop — and at very high stats it surfaces whether real gains keep
// scaling with stat total or flatten (the community-reported ~50M cap).

export interface Snapshot {
  id: string;
  date: string; // ISO timestamp
  stats: Record<StatKey, number>;
}

export interface Interval {
  from: Snapshot;
  to: Snapshot;
  days: number;
  perStat: Record<StatKey, number>;
  totalDelta: number;
  gainPerDay: Record<StatKey, number>;
}

export function sortSnapshots(snaps: Snapshot[]): Snapshot[] {
  return [...snaps].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildIntervals(snaps: Snapshot[]): Interval[] {
  const sorted = sortSnapshots(snaps);
  const out: Interval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1];
    const to = sorted[i];
    const days = Math.max(
      0,
      (new Date(to.date).getTime() - new Date(from.date).getTime()) / 86_400_000,
    );
    const perStat = {} as Record<StatKey, number>;
    const gainPerDay = {} as Record<StatKey, number>;
    let totalDelta = 0;
    for (const s of STAT_KEYS) {
      const d = to.stats[s] - from.stats[s];
      perStat[s] = d;
      totalDelta += d;
      gainPerDay[s] = days > 0 ? d / days : 0;
    }
    out.push({ from, to, days, perStat, totalDelta, gainPerDay });
  }
  return out;
}

/**
 * Predicted stat gain for training `energy` at a fixed happy (reuses the session
 * engine). Real training varies happy across the interval, so this is an
 * approximation — closest in the energy-training regime (sustained max happy).
 */
export function predictedGain(args: {
  statValue: number;
  energy: number;
  happy: number;
  modifiers: number;
  dots: number;
  energyPerTrain: number;
}): number {
  return simulateSession({
    statValue: args.statValue,
    happy: args.happy,
    modifiers: args.modifiers,
    energyPerTrain: args.energyPerTrain,
    dots: args.dots,
    energyBudget: args.energy,
    mode: 'expected',
  }).totalGain;
}
