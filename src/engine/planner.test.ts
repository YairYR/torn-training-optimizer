import { describe, it, expect } from 'vitest';
import { planToTarget, resolveUnlockTarget } from './planner';
import { Gym, StatKey } from './types';

const zero: Record<StatKey, number> = { strength: 0, defense: 0, speed: 0, dexterity: 0 };

describe('planToTarget', () => {
  const base = { happy: 5025, modifiers: 1, dots: 7.3, energyPerTrain: 10 };

  it('returns 0 trains when already at target', () => {
    const r = planToTarget({ ...base, statValue: 1_000_000, target: 1_000_000 });
    expect(r.trains).toBe(0);
    expect(r.reachable).toBe(true);
  });

  it('accumulates trains and energy to close a gap', () => {
    const r = planToTarget({ ...base, statValue: 50_000_000, target: 50_050_000 });
    expect(r.reachable).toBe(true);
    expect(r.trains).toBeGreaterThan(0);
    expect(r.energy).toBe(r.trains * base.energyPerTrain);
    expect(r.finalStat).toBeGreaterThanOrEqual(50_050_000);
  });

  it('reports the gap', () => {
    const r = planToTarget({ ...base, statValue: 100, target: 100_100 });
    expect(r.gap).toBe(100_000);
  });

  it('is unreachable with no dots', () => {
    const r = planToTarget({ ...base, dots: 0, statValue: 100, target: 200 });
    expect(r.reachable).toBe(false);
  });
});

describe('resolveUnlockTarget', () => {
  const g = (id: string, e: number, dots: Partial<Record<StatKey, number>>): Gym => ({
    id,
    name: id,
    energyPerTrain: e,
    unlockStage: null,
    joinCost: null,
    dots: { ...zero, ...dots },
  });

  it('targets 1.25x the highest other stat for a 50E single-stat gym', () => {
    const stats: Record<StatKey, number> = {
      strength: 20_000_000,
      defense: 15_000_000,
      speed: 40_000_000,
      dexterity: 50_000_000,
    };
    const elites = g('elites', 50, { dexterity: 8 });
    const r = resolveUnlockTarget(elites, stats);
    expect(r).toEqual({ stat: 'dexterity', target: Math.ceil(1.25 * 40_000_000) });
  });

  it('raises the higher stat for a 25E paired gym', () => {
    const stats: Record<StatKey, number> = {
      strength: 30_000_000,
      defense: 10_000_000,
      speed: 30_000_000,
      dexterity: 12_000_000,
    };
    const balboas = g('balboas', 25, { defense: 7.5, dexterity: 7.5 });
    const r = resolveUnlockTarget(balboas, stats);
    // other pair (str+spd) = 60M -> target sum 75M; this pair (def+dex)=22M -> deficit 53M
    // train the higher of def/dex -> dexterity (12M) -> target 12M + 53M = 65M
    expect(r?.stat).toBe('dexterity');
    expect(r?.target).toBe(12_000_000 + Math.ceil(1.25 * 60_000_000 - 22_000_000));
  });

  it('returns null for SSL (all-four 25E)', () => {
    const ssl = g('ssl', 25, { strength: 9, defense: 9, speed: 9, dexterity: 9 });
    expect(resolveUnlockTarget(ssl, zero)).toBeNull();
  });
});
