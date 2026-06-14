import { STAT_KEYS, StatKey, Gym } from './types';
import { gainPerTrain } from './vladar';

export interface GymStatMetric {
  /** Gain per train. */
  gpt: number;
  /** Gain per energy = gpt / energyPerTrain (normalises across 5/10/25/50). */
  gpe: number;
  /** True if this gym has the highest gpe for this stat among the input set. */
  isBest: boolean;
}

export interface GymComparisonRow {
  gym: Gym;
  perStat: Record<StatKey, GymStatMetric>;
}

export interface CompareInput {
  gyms: Gym[];
  stats: Record<StatKey, number>;
  happy: number;
  modifiers: Record<StatKey, number>;
}

/**
 * Ranks gyms per stat by gain-per-energy (spec §9).
 * Note: M multiplies every gym equally for a given stat, so the ranking is
 * invariant to M; M only affects the absolute gpt/gpe figures.
 */
export function compareGyms(i: CompareInput): GymComparisonRow[] {
  const rows: GymComparisonRow[] = i.gyms.map((gym) => {
    const perStat = {} as Record<StatKey, GymStatMetric>;
    for (const s of STAT_KEYS) {
      const gpt = gainPerTrain({
        modifiers: i.modifiers[s],
        dots: gym.dots[s],
        energyPerTrain: gym.energyPerTrain,
        happy: i.happy,
        statValue: i.stats[s],
      });
      const gpe = gym.energyPerTrain > 0 ? gpt / gym.energyPerTrain : 0;
      perStat[s] = { gpt, gpe, isBest: false };
    }
    return { gym, perStat };
  });

  for (const s of STAT_KEYS) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    rows.forEach((r, idx) => {
      if (r.perStat[s].gpe > bestVal) {
        bestVal = r.perStat[s].gpe;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && bestVal > 0) rows[bestIdx].perStat[s].isBest = true;
  }

  return rows;
}
