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
  /** Whether the player is currently in jail. Only then is Crims Gym usable. */
  inJail?: boolean;
}

/** Prefer the explicit flag; fall back to the name for older cached data. */
export function isJailGym(gym: Gym): boolean {
  return gym.jailOnly === true || /jail|crim/i.test(gym.name ?? '');
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

/**
 * Standard-gym prerequisites for the specialists (wiki, "Specialist Gyms &
 * Requirements"). These are NOT all George's, which is what this used to
 * assume:
 *   Balboas / Frontline  → Cha Cha's   (20th standard gym)
 *   Sports Science Lab   → Last Round  (22nd)
 *   the four 50E singles → George's    (24th)
 * Getting this wrong locked mid-game players out of the two-stat gyms they had
 * already earned — precisely the players deciding on a build.
 *
 * The ids are progression positions. The standard ladder is a fixed sequence
 * of 24 gyms and the rest of this module already relies on that ordering
 * (see the unlockedCapId gate), so naming the positions here is consistent
 * with how the gate works everywhere else.
 */
const CHA_CHAS_ID = 20;
const LAST_ROUND_ID = 22;
const GEORGES_ID = 24;

function requiresStandardGym(
  gate: GymGate | undefined,
  requiredId: number,
  label: string,
): GymEligibility | null {
  if (!gate) return null;
  // Prefer the explicit cap; fall back to the George's flag when that is all
  // the caller supplied.
  if (gate.unlockedCapId != null) {
    return gate.unlockedCapId >= requiredId
      ? null
      : { status: 'locked', requirement: `Unlock ${label} first (needs more gym EXP)` };
  }
  if (requiredId >= GEORGES_ID && gate.georgesUnlocked === false) {
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

  // Crims Gym: no cost, no EXP requirement, but you have to be in jail. It
  // stays visible in comparisons as reference data and is only ever
  // recommended when the caller says the player is actually inside.
  if (isJailGym(gym)) {
    return gate?.inJail
      ? { status: 'accessible', requirement: 'Free while you are in jail' }
      : { status: 'locked', requirement: 'Only usable while you are in jail' };
  }

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
    const locked = requiresStandardGym(gate, GEORGES_ID, 'George’s');
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
    if (trained.length === 4) {
      // The Sports Science Lab — Last Round, not George's.
      const locked = requiresStandardGym(gate, LAST_ROUND_ID, 'Last Round');
      if (locked) return locked;
      if (xanaxEcstasyTaken == null) {
        return { status: 'unknown', requirement: '≤150 Xanax+Ecstasy taken in total' };
      }
      return {
        status: xanaxEcstasyTaken <= 150 ? 'eligible' : 'locked',
        requirement: `≤150 Xanax+Ecstasy taken (you: ${xanaxEcstasyTaken.toLocaleString('en-US')})`,
      };
    }
    // Balboas and Frontline — Cha Cha's, not George's.
    const twoStatLocked = requiresStandardGym(gate, CHA_CHAS_ID, 'Cha Cha’s');
    if (twoStatLocked) return twoStatLocked;

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
      // Crims Gym is only usable while in jail — it is NOT part of the
      // gym-EXP progression and must never count as a standard gym (otherwise
      // its high API id is mistaken for George's, the top standard gym).
      return g.energyPerTrain <= 10 && !isFightClub && !isJailGym(g);
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
