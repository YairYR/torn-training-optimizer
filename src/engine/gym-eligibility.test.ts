import { describe, it, expect } from 'vitest';
import {
  evaluateGymEligibility,
  bestUsableGymIdForStat,
  standardGyms,
  georgesGymId,
  ratioReachable,
} from './gym-eligibility';
import { Gym, StatKey, STAT_KEYS } from './types';
import { STATIC_GYMS } from '../data/gyms';
import { DEMO } from '../demo';

const g = (id: string, energyPerTrain: number, dots: Partial<Record<StatKey, number>>): Gym => ({
  id,
  name: id,
  energyPerTrain,
  dots: { strength: 0, defense: 0, speed: 0, dexterity: 0, ...dots },
  unlockStage: null,
  joinCost: null,
});

// The user's real stats from testing.
const stats: Record<StatKey, number> = {
  strength: 20_466_471,
  defense: 15_354_081,
  speed: 40_674_378,
  dexterity: 50_806_102,
};

const georges = g('georges', 10, { strength: 7.3, defense: 7.3, speed: 7.3, dexterity: 7.3 });
const elites = g('elites', 50, { dexterity: 8.0 });
const isoyamas = g('isoyamas', 50, { defense: 8.0 });
const fightClub = g('fc', 10, { strength: 10, defense: 10, speed: 10, dexterity: 10 });
const ssl = g('ssl', 25, { strength: 9, defense: 9, speed: 9, dexterity: 9 });

describe('evaluateGymEligibility', () => {
  it('standard gym is accessible', () => {
    expect(evaluateGymEligibility(georges, stats).status).toBe('accessible');
  });

  it('Fight Club signature is invite-only', () => {
    expect(evaluateGymEligibility(fightClub, stats).status).toBe('invite');
  });

  it('Elites is locked when Dex is not 25% above 2nd-highest', () => {
    // Dex 50.81M vs 1.25 * Spd 40.67M = 50.84M -> just short
    expect(evaluateGymEligibility(elites, stats).status).toBe('locked');
  });

  it('Elites becomes eligible once Dex clears the threshold', () => {
    const ok = { ...stats, dexterity: 60_000_000 };
    expect(evaluateGymEligibility(elites, ok).status).toBe('eligible');
  });

  it('Isoyamas is locked when Defense is not the top stat', () => {
    expect(evaluateGymEligibility(isoyamas, stats).status).toBe('locked');
  });

  it('SSL is unknown without the Xanax/Ecstasy count, resolved with it', () => {
    expect(evaluateGymEligibility(ssl, stats).status).toBe('unknown');
    expect(evaluateGymEligibility(ssl, stats, 50).status).toBe('eligible');
    expect(evaluateGymEligibility(ssl, stats, 500).status).toBe('locked');
  });
});

describe('bestUsableGymIdForStat', () => {
  it('picks George\'s over a locked specialist for defense', () => {
    const best = bestUsableGymIdForStat([georges, isoyamas, fightClub], 'defense', stats);
    expect(best).toBe('georges');
  });

  it('picks the eligible specialist when the player qualifies', () => {
    const ok = { ...stats, dexterity: 60_000_000 };
    const best = bestUsableGymIdForStat([georges, elites], 'dexterity', ok);
    expect(best).toBe('elites');
  });
});

describe('gym EXP gating (unlocked cap)', () => {
  const lowStats: Record<StatKey, number> = {
    strength: 5000,
    defense: 6000,
    speed: 5000,
    dexterity: 50,
  };
  const premier = g('1', 5, { strength: 2, defense: 2, speed: 2, dexterity: 2 });
  const mid = g('10', 10, { strength: 4, defense: 4, speed: 4, dexterity: 4 });
  const georgesN = g('24', 10, { strength: 7.3, defense: 7.3, speed: 7.3, dexterity: 7.3 });
  const isoyamasN = g('30', 50, { defense: 8.0 });

  it('locks standard gyms above the unlocked cap', () => {
    const gate = { unlockedCapId: 10, georgesUnlocked: false };
    expect(evaluateGymEligibility(mid, lowStats, null, gate).status).toBe('accessible');
    expect(evaluateGymEligibility(georgesN, lowStats, null, gate).status).toBe('locked');
  });

  it('leaves standard gyms open when no gate is given', () => {
    expect(evaluateGymEligibility(georgesN, lowStats).status).toBe('accessible');
  });

  it('locks specialists until George’s is unlocked', () => {
    const gate = { unlockedCapId: 10, georgesUnlocked: false };
    expect(evaluateGymEligibility(isoyamasN, lowStats, null, gate).status).toBe('locked');
  });

  it('bestUsableGymIdForStat respects the cap', () => {
    const gyms = [premier, mid, georgesN];
    const gate = { unlockedCapId: 10, georgesUnlocked: false };
    expect(bestUsableGymIdForStat(gyms, 'strength', lowStats, null, gate)).toBe('10');
  });
});

describe('standardGyms / georgesGymId', () => {
  const premier = g('1', 5, { strength: 2 });
  const mid = g('10', 10, { strength: 4 });
  const georgesN = g('24', 10, { strength: 7.3, defense: 7.3, speed: 7.3, dexterity: 7.3 });
  const fc = g('25', 10, { strength: 10, defense: 10, speed: 10, dexterity: 10 });
  const iso = g('30', 50, { defense: 8 });
  const gyms = [premier, mid, georgesN, fc, iso];

  it('keeps only standard gyms, excluding Fight Club and specialists', () => {
    const ids = standardGyms(gyms).map((x) => x.id);
    expect(ids).toEqual(['1', '10', '24']);
  });

  it('identifies George’s as the top standard gym', () => {
    expect(georgesGymId(gyms)).toBe(24);
  });
});

describe('ratioReachable', () => {
  // Dex 60M is already 1.25x Speed 40.67M, so the ratio is met: the ONLY
  // thing standing between this player and The Elites is George's.
  const ratioMet = { ...stats, dexterity: 60_000_000 };

  it('es falso cuando el bloqueo real es el gate de progresion, no el ratio', () => {
    expect(evaluateGymEligibility(elites, ratioMet, 0, { unlockedCapId: 22 }).status).toBe('locked');
    expect(ratioReachable(elites, ratioMet, 0, { unlockedCapId: 22 })).toBe(false);
  });

  it('es verdadero cuando el gate esta abierto y falta ratio', () => {
    // Mismo gym, cap en George's: aca entrenar Dex si abre la puerta.
    expect(ratioReachable(elites, stats, 0, { unlockedCapId: 24 })).toBe(true);
  });

  it('es falso para los gyms cuyo gate no es un stat', () => {
    expect(ratioReachable(ssl, stats, 500, { unlockedCapId: 24 })).toBe(false);
    expect(ratioReachable(fightClub, stats, 0, { unlockedCapId: 24 })).toBe(false);
  });
});

describe('TrainingPlan "Next upgrade" election on real data (regression, finding 1)', () => {
  // Reproduces the election in TrainingPlan.tsx's `plans` useMemo: the best
  // higher-dots gym that is not already usable AND is ratioReachable — using
  // the real gym table and the shipped demo player, not synthetic fixtures.
  // Before the fix this always elected The Sports Science Lab (9.0 dots on
  // all four stats, gated on a permanent lifetime drug count) for every
  // stat, because only the 'invite' status was excluded.
  function nextUpgrade(stat: StatKey, xanaxEcstasyTaken: number, unlockedCapId: number) {
    const gate = { unlockedCapId, georgesUnlocked: unlockedCapId >= georgesGymId(STATIC_GYMS)! };
    const usableId = bestUsableGymIdForStat(STATIC_GYMS, stat, DEMO.stats, xanaxEcstasyTaken, gate);
    const dots = STATIC_GYMS.find((g) => g.id === usableId)!.dots[stat];
    let best: Gym | null = null;
    for (const g of STATIC_GYMS) {
      if (g.dots[stat] <= dots) continue;
      const el = evaluateGymEligibility(g, DEMO.stats, xanaxEcstasyTaken, gate);
      if (['accessible', 'eligible'].includes(el.status)) continue;
      if (!ratioReachable(g, DEMO.stats, xanaxEcstasyTaken, gate)) continue;
      if (!best || g.dots[stat] > best.dots[stat]) best = g;
    }
    return best;
  }

  it('demo player (cap below Last Round, over the drug cap): SSL never wins, each stat gets a real trainable specialist', () => {
    for (const stat of STAT_KEYS) {
      const upgrade = nextUpgrade(stat, DEMO.xanaxEcstasy!, DEMO.unlockedGymId);
      expect(upgrade?.name).not.toBe('The Sports Science Lab');
      expect(upgrade?.name).not.toBe('Fight Club');
    }
    // The two pairs are the correct, reachable specialists for this player.
    expect(nextUpgrade('strength', DEMO.xanaxEcstasy!, DEMO.unlockedGymId)?.name).toBe(
      'Frontline Fitness',
    );
    expect(nextUpgrade('defense', DEMO.xanaxEcstasy!, DEMO.unlockedGymId)?.name).toBe(
      'Balboas Gym',
    );
  });

  it('once Last Round is unlocked and the drug count is under the cap, SSL becomes usable (not an "upgrade") and nothing beats it but invite-only Fight Club', () => {
    const capAtLastRound = 22;
    for (const stat of STAT_KEYS) {
      const gate = { unlockedCapId: capAtLastRound, georgesUnlocked: false };
      const usableId = bestUsableGymIdForStat(STATIC_GYMS, stat, DEMO.stats, 100, gate);
      expect(STATIC_GYMS.find((g) => g.id === usableId)!.name).toBe('The Sports Science Lab');
      // No upgrade line at all — the only higher-dots gym is Fight Club (invite).
      expect(nextUpgrade(stat, 100, capAtLastRound)).toBeNull();
    }
  });
});
