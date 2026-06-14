import { describe, it, expect } from 'vitest';
import { compareGyms } from './gym-comparator';
import { Gym, StatKey } from './types';

const mkGym = (id: string, energyPerTrain: number, dots: number): Gym => ({
  id,
  name: id,
  energyPerTrain,
  dots: { strength: dots, defense: dots, speed: dots, dexterity: dots },
  unlockStage: null,
  joinCost: null,
});

const stats: Record<StatKey, number> = {
  strength: 50_000,
  defense: 50_000,
  speed: 50_000,
  dexterity: 50_000,
};

describe('compareGyms', () => {
  it('marks the gym with the highest gain-per-energy as best', () => {
    const gyms = [mkGym('low', 10, 2.0), mkGym('high', 10, 5.0)];
    const rows = compareGyms({ gyms, stats, happy: 5000, modifiers: 1 });
    const best = rows.find((r) => r.perStat.strength.isBest);
    expect(best?.gym.id).toBe('high');
  });

  it('computes gpe as gpt / energyPerTrain', () => {
    const rows = compareGyms({ gyms: [mkGym('g', 10, 2.0)], stats, happy: 5000, modifiers: 1 });
    const m = rows[0].perStat.strength;
    expect(m.gpe).toBeCloseTo(m.gpt / 10, 6);
  });

  it('ranking is invariant to the modifier M', () => {
    const gyms = [mkGym('a', 10, 2.0), mkGym('b', 25, 4.0)];
    const r1 = compareGyms({ gyms, stats, happy: 5000, modifiers: 1 });
    const r2 = compareGyms({ gyms, stats, happy: 5000, modifiers: 3.5 });
    const best1 = r1.find((r) => r.perStat.defense.isBest)?.gym.id;
    const best2 = r2.find((r) => r.perStat.defense.isBest)?.gym.id;
    expect(best1).toBe(best2);
  });

  it('does not mark a stat the gym cannot train (0 dots)', () => {
    const onlyDef: Gym = {
      id: 'spec',
      name: 'spec',
      energyPerTrain: 50,
      dots: { strength: 0, defense: 8, speed: 0, dexterity: 0 },
      unlockStage: null,
      joinCost: null,
    };
    const rows = compareGyms({ gyms: [onlyDef], stats, happy: 5000, modifiers: 1 });
    expect(rows[0].perStat.strength.isBest).toBe(false);
    expect(rows[0].perStat.defense.isBest).toBe(true);
  });
});
