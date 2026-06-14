import { describe, it, expect } from 'vitest';
import { optimizeBudget, OptimizerInput } from './optimizer';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from '../data/consumables';
import { Prices } from './cost-model';

const prices: Prices = {
  items: { Xanax: 800_000, 'Erotic DVD': 2_500_000, Ecstasy: 70_000 },
  pointPrice: 60_000,
};

const base: OptimizerInput = {
  budget: 0,
  statValue: 20_000_000,
  baseHappy: 5025,
  modifiers: 1.186,
  energyPerTrain: 10,
  dots: 7.3,
  freeEnergy: 150,
  maxStackEnergy: 1000,
  maxHappy: 99_999,
  prices,
  energySources: ENERGY_SOURCES,
  happyBoosters: HAPPY_BOOSTERS,
};

describe('optimizeBudget', () => {
  it('with zero budget trains only free natural energy, no purchases', () => {
    const r = optimizeBudget({ ...base, budget: 0 });
    expect(r.totalCost).toBe(0);
    expect(r.totalEnergy).toBe(150);
    expect(r.edvdQty).toBe(0);
    expect(r.ecstasy).toBe(false);
    expect(r.buyList.every((l) => l.cost === 0)).toBe(true);
  });

  it('never exceeds the budget', () => {
    const r = optimizeBudget({ ...base, budget: 10_000_000 });
    expect(r.totalCost).toBeLessThanOrEqual(10_000_000);
  });

  it('spends on energy and/or happy when given budget, increasing gain', () => {
    const poor = optimizeBudget({ ...base, budget: 0 });
    const rich = optimizeBudget({ ...base, budget: 30_000_000 });
    expect(rich.totalGain).toBeGreaterThan(poor.totalGain);
    expect(rich.totalEnergy).toBeGreaterThanOrEqual(poor.totalEnergy);
  });

  it('respects the happy cap', () => {
    const r = optimizeBudget({ ...base, budget: 500_000_000, maxHappy: 50_000 });
    expect(r.sessionHappy).toBeLessThanOrEqual(50_000);
  });

  it('caps paid energy at maxStackEnergy', () => {
    const r = optimizeBudget({ ...base, budget: 1_000_000_000, maxStackEnergy: 1000 });
    // natural 150 + refill 150 + paid <= 1000
    expect(r.totalEnergy).toBeLessThanOrEqual(150 + 150 + 1000);
  });

  it('produces a buy list whose costs sum to total cost', () => {
    const r = optimizeBudget({ ...base, budget: 20_000_000 });
    const sum = r.buyList.reduce((s, l) => s + l.cost, 0);
    expect(sum).toBeCloseTo(r.totalCost, 0);
  });
});
