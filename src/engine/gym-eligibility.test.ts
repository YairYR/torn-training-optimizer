import { describe, it, expect } from 'vitest';
import { evaluateGymEligibility, bestUsableGymIdForStat, standardGyms, georgesGymId } from './gym-eligibility';
import { Gym, StatKey } from './types';

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
