import { Gym, StatKey, STAT_KEYS, STAT_LABEL } from './types';

// Specialist-gym unlock requirements are computable from the player's stats
// (wiki). Standard gyms (through George's) unlock by money/progression, which
// the API doesn't expose, so they are assumed accessible for an established
// player. Specialists are identified by their energy + dot signature (robust to
// the "Unknown"/Fight Club name coming back empty from the API).

export type EligibilityStatus = 'accessible' | 'eligible' | 'locked' | 'invite' | 'unknown';

export interface GymEligibility {
  status: EligibilityStatus;
  requirement?: string;
}

function trainedStats(gym: Gym): StatKey[] {
  return STAT_KEYS.filter((s) => gym.dots[s] > 0);
}

function secondHighest(stats: Record<StatKey, number>): number {
  return STAT_KEYS.map((s) => stats[s]).sort((a, b) => b - a)[1];
}

function sum(stats: Record<StatKey, number>, keys: StatKey[]): number {
  return keys.reduce((a, k) => a + stats[k], 0);
}

export function evaluateGymEligibility(
  gym: Gym,
  stats: Record<StatKey, number>,
  xanaxEcstasyTaken?: number | null,
): GymEligibility {
  const e = gym.energyPerTrain;
  const trained = trainedStats(gym);
  const maxDots = Math.max(...STAT_KEYS.map((s) => gym.dots[s]));

  // Fight Club: 10E, all four ~10.0 dots, invite only.
  if (e <= 10 && trained.length === 4 && maxDots >= 9.5) {
    return { status: 'invite', requirement: 'Invite only' };
  }
  // Standard gyms (Premier through George's).
  if (e <= 10) return { status: 'accessible' };

  // 50E single-stat specialists: trained stat 25% above the 2nd-highest stat.
  if (e === 50 && trained.length === 1) {
    const s = trained[0];
    const ok = stats[s] >= 1.25 * secondHighest(stats);
    return {
      status: ok ? 'eligible' : 'locked',
      requirement: `${STAT_LABEL[s]} ≥ 25% above 2nd-highest stat`,
    };
  }

  // 25E specialists.
  if (e === 25) {
    if (trained.length === 4) {
      // The Sports Science Lab.
      if (xanaxEcstasyTaken == null) {
        return { status: 'unknown', requirement: '≤150 Xanax+Ecstasy taken in total' };
      }
      return {
        status: xanaxEcstasyTaken <= 150 ? 'eligible' : 'locked',
        requirement: `≤150 Xanax+Ecstasy taken (you: ${xanaxEcstasyTaken.toLocaleString('en-US')})`,
      };
    }
    const set = new Set(trained);
    if (trained.length === 2 && set.has('defense') && set.has('dexterity')) {
      const ok = sum(stats, ['defense', 'dexterity']) >= 1.25 * sum(stats, ['strength', 'speed']);
      return { status: ok ? 'eligible' : 'locked', requirement: 'Def+Dex ≥ 25% above Str+Spd' };
    }
    if (trained.length === 2 && set.has('strength') && set.has('speed')) {
      const ok = sum(stats, ['strength', 'speed']) >= 1.25 * sum(stats, ['dexterity', 'defense']);
      return { status: ok ? 'eligible' : 'locked', requirement: 'Str+Spd ≥ 25% above Dex+Def' };
    }
  }

  return { status: 'accessible' };
}

const USABLE: EligibilityStatus[] = ['accessible', 'eligible'];

/** Best gym for a stat among those the player can actually use (highest dots). */
export function bestUsableGymIdForStat(
  gyms: Gym[],
  stat: StatKey,
  stats: Record<StatKey, number>,
  xanaxEcstasyTaken?: number | null,
): string {
  let bestId = '';
  let bestDots = -1;
  for (const g of gyms) {
    if (g.dots[stat] <= 0) continue;
    const el = evaluateGymEligibility(g, stats, xanaxEcstasyTaken);
    if (USABLE.includes(el.status) && g.dots[stat] > bestDots) {
      bestDots = g.dots[stat];
      bestId = g.id;
    }
  }
  // Fallback: any gym training the stat (should not happen for established players).
  if (!bestId) {
    for (const g of gyms) {
      if (g.dots[stat] > bestDots) {
        bestDots = g.dots[stat];
        bestId = g.id;
      }
    }
  }
  return bestId;
}

export function isUsable(status: EligibilityStatus): boolean {
  return USABLE.includes(status);
}
