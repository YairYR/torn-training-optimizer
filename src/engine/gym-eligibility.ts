import { Gym, StatKey, STAT_KEYS, STAT_LABEL } from './types';

// Standard gyms (the 24 progressing to George's) unlock by GYM EXP, which is
// total energy spent training over the player's whole career (wiki). The API
// doesn't expose gym EXP, but it does expose the active gym; combined with a
// manual "highest unlocked gym" cap we can gate the standard progression
// instead of assuming every gym is available. Specialist gyms gate on stats
// (ratios) + drug count (SSL) AND require George's / Last Round unlocked.

export type EligibilityStatus = 'accessible' | 'eligible' | 'locked' | 'invite' | 'unknown';

export interface GymEligibility {
  status: EligibilityStatus;
  requirement?: string;
}

export interface GymGate {
  /** Numeric id of the highest unlocked standard gym. Standard gyms above this are locked. */
  unlockedCapId?: number | null;
  /** Whether George's (the top standard gym) is unlocked — required by specialists. */
  georgesUnlocked?: boolean;
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

function specialistLockedByProgress(gate?: GymGate): GymEligibility | null {
  if (gate && gate.georgesUnlocked === false) {
    return { status: 'locked', requirement: 'Unlock George’s first (needs more gym EXP)' };
  }
  return null;
}

export function evaluateGymEligibility(
  gym: Gym,
  stats: Record<StatKey, number>,
  xanaxEcstasyTaken?: number | null,
  gate?: GymGate,
): GymEligibility {
  const e = gym.energyPerTrain;
  const trained = trainedStats(gym);
  const maxDots = Math.max(...STAT_KEYS.map((s) => gym.dots[s]));

  // Fight Club: 10E, all four ~10.0 dots, invite only.
  if (e <= 10 && trained.length === 4 && maxDots >= 9.5) {
    return { status: 'invite', requirement: 'Invite only' };
  }

  // Standard gyms (Premier through George's) — gated by gym EXP via the cap.
  if (e <= 10) {
    if (gate && gate.unlockedCapId != null && Number(gym.id) > gate.unlockedCapId) {
      return {
        status: 'locked',
        requirement: 'Not yet unlocked — needs more gym EXP (total energy trained)',
      };
    }
    return { status: 'accessible' };
  }

  // 50E single-stat specialists: trained stat 25% above the 2nd-highest stat.
  if (e === 50 && trained.length === 1) {
    const locked = specialistLockedByProgress(gate);
    if (locked) return locked;
    const s = trained[0];
    const ok = stats[s] >= 1.25 * secondHighest(stats);
    return {
      status: ok ? 'eligible' : 'locked',
      requirement: `${STAT_LABEL[s]} ≥ 25% above 2nd-highest stat`,
    };
  }

  // 25E specialists.
  if (e === 25) {
    const locked = specialistLockedByProgress(gate);
    if (locked) return locked;
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
  gate?: GymGate,
): string {
  let bestId = '';
  let bestDots = -1;
  for (const g of gyms) {
    if (g.dots[stat] <= 0) continue;
    const el = evaluateGymEligibility(g, stats, xanaxEcstasyTaken, gate);
    if (USABLE.includes(el.status) && g.dots[stat] > bestDots) {
      bestDots = g.dots[stat];
      bestId = g.id;
    }
  }
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

/** Standard (non-specialist, non-invite) gyms, ordered by progression (id). */
export function standardGyms(gyms: Gym[]): Gym[] {
  return gyms
    .filter((g) => {
      const maxDots = Math.max(...STAT_KEYS.map((s) => g.dots[s]));
      const allFour = STAT_KEYS.every((s) => g.dots[s] > 0);
      const isFightClub = g.energyPerTrain <= 10 && allFour && maxDots >= 9.5;
      return g.energyPerTrain <= 10 && !isFightClub;
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/** Id of George's — the top standard gym (highest id among standard gyms). */
export function georgesGymId(gyms: Gym[]): number | null {
  const std = standardGyms(gyms);
  if (!std.length) return null;
  return Number(std[std.length - 1].id);
}

export function isUsable(status: EligibilityStatus): boolean {
  return USABLE.includes(status);
}
