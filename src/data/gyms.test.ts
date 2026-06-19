import { describe, it, expect } from 'vitest';
import { STATIC_GYMS } from './gyms';
import { bestUsableGymIdForStat, georgesGymId, GymGate } from '../engine/gym-eligibility';
import { gainPerTrain } from '../engine/vladar';

describe('STATIC_GYMS (manual mode data)', () => {
  it('has all 32 trainable gyms with verified key values', () => {
    expect(STATIC_GYMS).toHaveLength(32);
    const byName = (n: string) => STATIC_GYMS.find((g) => g.name === n)!;
    expect(byName("George's").dots.strength).toBe(7.3);
    expect(byName("George's").energyPerTrain).toBe(10);
    expect(byName('The Elites').dots.dexterity).toBe(8.0);
    expect(byName('The Elites').energyPerTrain).toBe(50);
    expect(byName('Mr. Isoyamas').dots.defense).toBe(8.0);
    expect(byName('The Sports Science Lab').dots.speed).toBe(9.0);
    expect(byName('Fight Club').dots.strength).toBe(10.0);
    expect(byName('Premier Fitness').dots.defense).toBe(2.0);
    // gyms that can't train a stat are encoded as 0
    expect(byName('Balboas Gym').dots.strength).toBe(0);
    expect(byName('Davies Den').dots.speed).toBe(0);
  });

  it("treats George's as the top standard gym for the EXP gate", () => {
    expect(georgesGymId(STATIC_GYMS)).toBe(24);
  });

  it('picks SSL (9.0) when the player is drug-light, Elites (8.0) when SSL is locked', () => {
    const stats = { strength: 20e6, defense: 15e6, speed: 30e6, dexterity: 60e6 };
    const gate: GymGate = { unlockedCapId: georgesGymId(STATIC_GYMS), georgesUnlocked: true };
    // 0 Xanax+Ecstasy → SSL eligible → SSL beats Elites for any stat
    const sslId = bestUsableGymIdForStat(STATIC_GYMS, 'dexterity', stats, 0, gate);
    expect(STATIC_GYMS.find((g) => g.id === sslId)!.name).toBe('The Sports Science Lab');
    // 200 taken → SSL locked → high Dex unlocks The Elites
    const elitesId = bestUsableGymIdForStat(STATIC_GYMS, 'dexterity', stats, 200, gate);
    expect(STATIC_GYMS.find((g) => g.id === elitesId)!.name).toBe('The Elites');
  });

  it('feeds the Vladar engine without NaN for manual input', () => {
    const georges = STATIC_GYMS.find((g) => g.name === "George's")!;
    const gain = gainPerTrain({
      dots: georges.dots.defense,
      energyPerTrain: georges.energyPerTrain,
      happy: 5025,
      statValue: 15_000_000,
      modifiers: 1,
    });
    expect(gain).toBeGreaterThan(0);
    expect(Number.isFinite(gain)).toBe(true);
  });
});
