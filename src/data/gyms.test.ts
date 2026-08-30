import { describe, it, expect } from 'vitest';
import { STATIC_GYMS } from './gyms';
import {
  bestUsableGymIdForStat,
  evaluateGymEligibility,
  georgesGymId,
  standardGyms,
  GymGate,
} from '../engine/gym-eligibility';
import { gainPerTrain } from '../engine/vladar';

describe('STATIC_GYMS (manual mode data)', () => {
  it('has all 33 gyms with verified key values', () => {
    // The wiki counts 33: 24 standard + 9 special-use (8 specialists + Crims).
    expect(STATIC_GYMS).toHaveLength(33);
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

  it('carries Crims Gym as jail-only reference data', () => {
    const crims = STATIC_GYMS.find((g) => g.name === 'Crims Gym')!;
    expect(crims.jailOnly).toBe(true);
    expect(crims.energyPerTrain).toBe(5);
    expect(crims.joinCost).toBe(0);
    expect(crims.dots.dexterity).toBe(0); // no dexterity in jail
    // The reason it exists for a new player: 4.5 Defense beats every
    // lightweight gym and Knuckle Heads, and loses to Pioneer Fitness.
    const def = (n: string) => STATIC_GYMS.find((g) => g.name === n)!.dots.defense;
    expect(crims.dots.defense).toBeGreaterThan(def('Global Gym'));
    expect(crims.dots.defense).toBeGreaterThan(def('Knuckle Heads'));
    expect(crims.dots.defense).toBeLessThan(def('Pioneer Fitness'));
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

describe('the jail gym is excluded from the standard progression', () => {
  // Regression: the API returns the jail gym (5E, jail-only) with an id higher
  // than George's. It must not count as a standard gym, or georgesGymId picks
  // it instead of George's and breaks the "George's unlocked?" gate. The API
  // name is "The Jail Gym"; the wiki calls it Crims. Both must be caught.
  const apiNamed = {
    id: '99',
    name: 'The Jail Gym',
    energyPerTrain: 5,
    unlockStage: null,
    joinCost: null,
    dots: { strength: 3.4, speed: 3.4, defense: 4.5, dexterity: 0 },
  };
  const withJail = [...STATIC_GYMS, apiNamed];

  it('standardGyms excludes it under either name', () => {
    expect(standardGyms(withJail).some((g: any) => /jail|crim/i.test(g.name))).toBe(false);
  });

  it("georgesGymId still resolves to George's", () => {
    expect(georgesGymId(withJail)).toBe(24);
    expect(georgesGymId(STATIC_GYMS)).toBe(24);
  });

  it('is never recommended to a player who is not in jail', () => {
    const stats = { strength: 1000, defense: 1000, speed: 1000, dexterity: 1000 };
    const gate: GymGate = { unlockedCapId: 3, georgesUnlocked: false };
    const free = bestUsableGymIdForStat(STATIC_GYMS, 'defense', stats, 0, gate);
    expect(STATIC_GYMS.find((g) => g.id === free)!.name).not.toBe('Crims Gym');

    // ...but it wins on Defense for an early player who IS in jail.
    const jailed = bestUsableGymIdForStat(STATIC_GYMS, 'defense', stats, 0, {
      ...gate,
      inJail: true,
    });
    expect(STATIC_GYMS.find((g) => g.id === jailed)!.name).toBe('Crims Gym');
  });
});

describe('specialist prerequisites are per-gym, not all George’s', () => {
  // Regression. The gate used to require George's for every specialist, which
  // locked mid-game players out of Balboas and Frontline (Cha Cha's) and the
  // SSL (Last Round) — gyms they had already earned. Wiki, "Specialist Gyms &
  // Requirements".
  const gym = (n: string) => STATIC_GYMS.find((g) => g.name === n)!;
  const evalAt = (name: string, capId: number, stats: Record<string, number>) =>
    evaluateGymEligibility(gym(name), stats as any, 0, {
      unlockedCapId: capId,
      georgesUnlocked: capId >= 24,
    });

  // Every ratio requirement below is satisfied with room to spare, so the only
  // thing that can block these gyms is the progression gate:
  //   Def+Dex (43m) ≥ 1.25 × Str+Spd (10m)      → Balboas
  //   Def (25m)     ≥ 1.25 × 2nd-highest (18m)  → Mr. Isoyamas
  const lopsided = { strength: 5e6, defense: 25e6, speed: 5e6, dexterity: 18e6 };

  it("opens Balboas at Cha Cha's, without George's", () => {
    expect(evalAt('Balboas Gym', 19, lopsided).status).toBe('locked');
    expect(evalAt('Balboas Gym', 20, lopsided).status).toBe('eligible');
  });

  it('opens the SSL at Last Round, without George’s', () => {
    expect(evalAt('The Sports Science Lab', 21, lopsided).status).toBe('locked');
    expect(evalAt('The Sports Science Lab', 22, lopsided).status).toBe('eligible');
  });

  it("still requires George's for the 50E single-stat gyms", () => {
    expect(evalAt('Mr. Isoyamas', 23, lopsided).status).toBe('locked');
    expect(evalAt('Mr. Isoyamas', 24, lopsided).status).toBe('eligible');
  });

  it('names the gym that is actually missing', () => {
    expect(evalAt('Balboas Gym', 19, lopsided).requirement).toContain('Cha Cha');
    expect(evalAt('The Sports Science Lab', 21, lopsided).requirement).toContain('Last Round');
    expect(evalAt('Mr. Isoyamas', 23, lopsided).requirement).toContain('George');
  });
});

describe('Crims Gym end to end', () => {
  const early = { strength: 5000, defense: 5000, speed: 5000, dexterity: 5000 };
  const cap = 3; // a new player, a few lightweight gyms in

  it('is the best Defense option while jailed, and invisible while free', () => {
    const free = bestUsableGymIdForStat(STATIC_GYMS, 'defense', early, 0, {
      unlockedCapId: cap,
      georgesUnlocked: false,
    });
    const jailed = bestUsableGymIdForStat(STATIC_GYMS, 'defense', early, 0, {
      unlockedCapId: cap,
      georgesUnlocked: false,
      inJail: true,
    });
    const name = (id: string | null) => STATIC_GYMS.find((g) => g.id === id)?.name;
    expect(name(free)).not.toBe('Crims Gym');
    expect(name(jailed)).toBe('Crims Gym');
  });

  it('stops being the pick once Pioneer Fitness is open, even in jail', () => {
    // The wiki is explicit that the jail gym's advantage ends at Pioneer
    // Fitness (4.8 Defense vs 4.5). Encode that so a future dots edit cannot
    // quietly resurrect bad advice.
    const jailed = bestUsableGymIdForStat(STATIC_GYMS, 'defense', early, 0, {
      unlockedCapId: 10, // Pioneer Fitness
      georgesUnlocked: false,
      inJail: true,
    });
    expect(STATIC_GYMS.find((g) => g.id === jailed)!.name).toBe('Pioneer Fitness');
  });

  it('never wins for dexterity, which it cannot train', () => {
    const jailed = bestUsableGymIdForStat(STATIC_GYMS, 'dexterity', early, 0, {
      unlockedCapId: cap,
      georgesUnlocked: false,
      inJail: true,
    });
    expect(STATIC_GYMS.find((g) => g.id === jailed)!.name).not.toBe('Crims Gym');
  });
});
