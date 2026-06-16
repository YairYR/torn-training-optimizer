import { gainPerTrain } from './vladar';
import { Gym, StatKey, STAT_KEYS } from './types';

// Inverts the gain model: how many trains / how much energy to take a stat from
// its current value to a target, simulating each train (gain compounds as the
// stat grows). Happy is held at the chosen level (the realistic energy-training
// case trains at sustainable max happy; the book case at 99,999).

export interface PlanInput {
  statValue: number;
  target: number;
  happy: number;
  modifiers: number;
  dots: number;
  energyPerTrain: number;
  maxTrains?: number;
}

export interface PlanResult {
  reachable: boolean;
  trains: number;
  energy: number;
  finalStat: number;
  gap: number;
}

export function planToTarget(i: PlanInput): PlanResult {
  const cap = i.maxTrains ?? 500_000;
  const gap = Math.max(0, i.target - i.statValue);

  if (i.statValue >= i.target) {
    return { reachable: true, trains: 0, energy: 0, finalStat: i.statValue, gap: 0 };
  }
  if (i.dots <= 0 || i.energyPerTrain <= 0) {
    return { reachable: false, trains: 0, energy: 0, finalStat: i.statValue, gap };
  }

  let s = i.statValue;
  let trains = 0;
  let energy = 0;
  while (s < i.target && trains < cap) {
    const g = gainPerTrain({
      modifiers: i.modifiers,
      dots: i.dots,
      energyPerTrain: i.energyPerTrain,
      happy: i.happy,
      statValue: s,
    });
    if (g <= 0) break;
    s += g;
    trains += 1;
    energy += i.energyPerTrain;
  }

  return { reachable: s >= i.target, trains, energy, finalStat: s, gap };
}

function maxExcluding(stats: Record<StatKey, number>, exclude: StatKey[]): number {
  return Math.max(...STAT_KEYS.filter((s) => !exclude.includes(s)).map((s) => stats[s]));
}

/**
 * For a gym locked by a stat requirement, resolves which stat to train and the
 * value it must reach. Returns null for non-stat gates (SSL drug count, invite).
 */
export function resolveUnlockTarget(
  gym: Gym,
  stats: Record<StatKey, number>,
): { stat: StatKey; target: number } | null {
  const e = gym.energyPerTrain;
  const trained = STAT_KEYS.filter((s) => gym.dots[s] > 0);

  // 50E single-stat: stat >= 1.25 x highest of the other three.
  if (e === 50 && trained.length === 1) {
    const s = trained[0];
    return { stat: s, target: Math.ceil(1.25 * maxExcluding(stats, [s])) };
  }

  // 25E paired (Balboas Def+Dex, Frontline Str+Spd): the pair sum must reach
  // 1.25x the other pair's sum. Raise the higher of the two (fewest trains).
  if (e === 25 && trained.length === 2) {
    const [a, b] = trained;
    const otherPair = STAT_KEYS.filter((s) => !trained.includes(s));
    const thisSum = stats[a] + stats[b];
    const otherSum = otherPair.reduce((x, k) => x + stats[k], 0);
    const deficit = Math.max(0, Math.ceil(1.25 * otherSum - thisSum));
    const s = stats[a] >= stats[b] ? a : b;
    return { stat: s, target: stats[s] + deficit };
  }

  return null;
}
