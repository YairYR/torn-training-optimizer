import { describe, it, expect } from 'vitest';
import { dollarsPerEnergy, rankEnergy, applyHappyPlan, boosterValue, Prices } from './cost-model';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from '../data/consumables';

const prices: Prices = {
  items: { Xanax: 800_000, 'Erotic DVD': 2_500_000, Ecstasy: 70_000 },
  pointPrice: 60_000,
};

const xanax = ENERGY_SOURCES.find((s) => s.id === 'xanax')!;
const refill = ENERGY_SOURCES.find((s) => s.id === 'refill')!;
const natural = ENERGY_SOURCES.find((s) => s.id === 'natural')!;

describe('dollarsPerEnergy', () => {
  it('is 0 for natural energy', () => {
    expect(dollarsPerEnergy(natural, prices)).toBe(0);
  });

  it('prices Xanax as item price / 250', () => {
    expect(dollarsPerEnergy(xanax, prices)).toBeCloseTo(800_000 / 250, 6); // 3200 $/E
  });

  it('prices a refill as pointPrice * 25 / 150', () => {
    expect(dollarsPerEnergy(refill, prices)).toBeCloseTo((60_000 * 25) / 150, 6); // 10000 $/E
  });

  it('returns null when the item price is unknown', () => {
    const lsd = ENERGY_SOURCES.find((s) => s.id === 'lsd')!;
    expect(dollarsPerEnergy(lsd, prices)).toBeNull();
  });
});

describe('rankEnergy', () => {
  it('orders cheapest first and sinks unknown prices', () => {
    const ranked = rankEnergy(ENERGY_SOURCES, prices);
    expect(ranked[0].source.id).toBe('natural'); // free
    expect(ranked[ranked.length - 1].dollarsPerEnergy).toBeNull(); // unknown last
    // Xanax (3200) should beat refill (10000)
    const ids = ranked.filter((r) => r.dollarsPerEnergy != null).map((r) => r.source.id);
    expect(ids.indexOf('xanax')).toBeLessThan(ids.indexOf('refill'));
  });
});

describe('applyHappyPlan', () => {
  const edvd = HAPPY_BOOSTERS.find((b) => b.id === 'edvd')!;
  const ecstasy = HAPPY_BOOSTERS.find((b) => b.id === 'ecstasy')!;

  it('adds additive happy', () => {
    expect(applyHappyPlan(5000, [{ booster: edvd, qty: 5 }])).toBe(5000 + 12_500);
  });

  it('applies Ecstasy after additive (additive then ×2)', () => {
    // (5000 + 2500) * 2
    expect(applyHappyPlan(5000, [{ booster: edvd, qty: 1 }, { booster: ecstasy, qty: 1 }])).toBe(15_000);
  });
});

describe('boosterValue', () => {
  const ctx = {
    statValue: 50_000,
    baseHappy: 5000,
    modifiers: 1,
    energyPerTrain: 10,
    dots: 7.3,
    energyBudget: 1000,
  };
  const edvd = HAPPY_BOOSTERS.find((b) => b.id === 'edvd')!;

  it('produces positive marginal gain and a $/point figure', () => {
    const v = boosterValue(edvd, 5, ctx, prices);
    expect(v.marginalGain).toBeGreaterThan(0);
    expect(v.resultingHappy).toBe(5000 + 12_500);
    expect(v.cost).toBe(2_500_000 * 5);
    expect(v.dollarsPerPoint).toBeCloseTo(v.cost! / v.marginalGain, 6);
  });

  it('returns null $/point when price is unknown', () => {
    const noPrice: Prices = { items: {}, pointPrice: null };
    const v = boosterValue(edvd, 5, ctx, noPrice);
    expect(v.dollarsPerPoint).toBeNull();
  });
});
