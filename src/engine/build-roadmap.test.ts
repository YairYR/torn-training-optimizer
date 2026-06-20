import { describe, it, expect } from 'vitest';
import { buildRoadmap, PAIR_OF } from './build-roadmap';
import { STATIC_GYMS } from '../data/gyms';
import { georgesGymId, GymGate } from './gym-eligibility';
import { StatKey } from './types';

const gate: GymGate = { unlockedCapId: georgesGymId(STATIC_GYMS), georgesUnlocked: true };
const stat = (s: number, sp: number, d: number, dx: number): Record<StatKey, number> => ({
  strength: s,
  speed: sp,
  defense: d,
  dexterity: dx,
});

describe('buildRoadmap', () => {
  it('maps defensive/offensive pairs correctly', () => {
    expect(PAIR_OF.dexterity).toBe('defense');
    expect(PAIR_OF.strength).toBe('speed');
    const r = buildRoadmap(STATIC_GYMS, stat(20e6, 30e6, 15e6, 40e6), 'dexterity', 200, gate);
    expect(r.pair).toBe('defense');
    expect(r.dumped.sort()).toEqual(['speed', 'strength']);
    expect(r.isOffensive).toBe(false);
  });

  it('builds the George -> Balboas -> Elites ladder for a Dex build', () => {
    const r = buildRoadmap(STATIC_GYMS, stat(20e6, 30e6, 15e6, 40e6), 'dexterity', 200, gate);
    const names = r.stages.map((s) => s.gymName);
    expect(names).toContain("George's");
    expect(names).toContain('Balboas Gym');
    expect(names).toContain('The Elites');
    // dots reported for the primary stat
    expect(r.stages.find((s) => s.gymName === 'The Elites')!.dots).toBe(8.0);
    expect(r.stages.find((s) => s.gymName === "George's")!.dots).toBe(7.3);
  });

  it('flags the nearest locked specialist as next, with the right gap', () => {
    // Dex 40M, highest other = Speed 35M -> Elites needs 1.25*35M = 43.75M (gap 3.75M)
    const r = buildRoadmap(STATIC_GYMS, stat(20e6, 35e6, 15e6, 40e6), 'dexterity', 200, gate);
    expect(r.nextStage).not.toBeNull();
    expect(r.nextStage!.gymName).toBe('The Elites');
    expect(r.nextStage!.trainStat).toBe('dexterity');
    expect(r.nextStage!.targetValue).toBe(Math.ceil(1.25 * 35e6));
    expect(r.nextStage!.gap).toBeCloseTo(43.75e6 - 40e6, 0);
  });

  it('marks specialists unlocked when the ratio is already met', () => {
    // Dex 60M dominates -> Elites + Balboas already unlocked; nothing locked
    const r = buildRoadmap(STATIC_GYMS, stat(20e6, 30e6, 15e6, 60e6), 'dexterity', 200, gate);
    expect(r.nextStage).toBeNull();
    expect(r.stages.find((s) => s.gymName === 'The Elites')!.status).toBe('unlocked');
  });

  it('includes SSL as a parallel option gated by drug count', () => {
    const clean = buildRoadmap(STATIC_GYMS, stat(20e6, 30e6, 15e6, 60e6), 'dexterity', 0, gate);
    const sslClean = clean.stages.find((s) => s.parallel);
    expect(sslClean?.gymName).toBe('The Sports Science Lab');
    expect(sslClean?.status).toBe('unlocked');
    const dirty = buildRoadmap(STATIC_GYMS, stat(20e6, 30e6, 15e6, 60e6), 'dexterity', 200, gate);
    expect(dirty.stages.find((s) => s.parallel)?.status).toBe('locked');
  });
});
