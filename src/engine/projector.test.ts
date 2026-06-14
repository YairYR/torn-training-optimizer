import { describe, it, expect } from 'vitest';
import { project, ProjectorInput, DailyPlan } from './projector';
import { StatKey } from './types';

const gymForStat = {
  strength: { energyPerTrain: 10, dots: 7.3 },
  defense: { energyPerTrain: 10, dots: 7.3 },
  speed: { energyPerTrain: 10, dots: 7.3 },
  dexterity: { energyPerTrain: 10, dots: 7.3 },
};

const focusDefense: Record<StatKey, number> = { strength: 0, defense: 1, speed: 0, dexterity: 0 };

const basePlan: DailyPlan = { naturalEnergy: 480, useRefill: true, xanax: 3, edvd: 18, ecstasy: true };

const base: ProjectorInput = {
  stats: { strength: 1_000_000, defense: 1_000_000, speed: 1_000_000, dexterity: 1_000_000 },
  baseHappy: 5025,
  happyCap: 99_999,
  modifiers: 1.186,
  gymForStat,
  allocation: focusDefense,
  plan: basePlan,
  prices: { xanax: 800_000, edvd: 2_500_000, ecstasy: 70_000, refill: 1_500_000 },
  horizonDays: 90,
  goal: { type: 'defense', target: 5_000_000 },
};

describe('project', () => {
  it('grows the trained stat day over day', () => {
    const r = project(base);
    expect(r.series[0].value).toBeGreaterThan(base.stats.defense);
    expect(r.series[r.series.length - 1].value).toBeGreaterThan(r.series[0].value);
  });

  it('compounds: later daily gains exceed earlier ones', () => {
    const r = project(base);
    const firstDay = r.series[0].value - base.stats.defense;
    const lastDay = r.series[r.series.length - 1].value - r.series[r.series.length - 2].value;
    expect(lastDay).toBeGreaterThan(firstDay);
  });

  it('reports days to goal when reached within the horizon', () => {
    const r = project({ ...base, goal: { type: 'defense', target: 2_000_000 } });
    expect(r.daysToGoal).not.toBeNull();
    expect(r.spendAtGoal).toBeGreaterThan(0);
  });

  it('returns null daysToGoal when goal is out of reach in horizon', () => {
    const r = project({ ...base, goal: { type: 'defense', target: 1_000_000_000 }, horizonDays: 10 });
    expect(r.daysToGoal).toBeNull();
  });

  it('caps session happy at 99999', () => {
    const r = project({ ...base, plan: { ...basePlan, edvd: 40, ecstasy: true } });
    expect(r.sessionHappy).toBe(99_999);
  });

  it('computes daily energy from the plan', () => {
    const r = project(base);
    expect(r.dailyEnergy).toBe(480 + 150 + 3 * 250); // 1380
  });

  it('returns null spend when a required price is missing', () => {
    const r = project({ ...base, prices: { xanax: null, edvd: 2_500_000, ecstasy: 70_000, refill: 1_500_000 } });
    expect(r.dailySpend).toBeNull();
    expect(r.spendAtGoal).toBeNull();
  });
});
