import { describe, it, expect } from 'vitest';
import { happyLossPerTrain, simulateSession, simulateBand } from './session';

describe('happyLossPerTrain', () => {
  it('matches the spec table for expected loss', () => {
    expect(happyLossPerTrain(5, 'expected')).toBeCloseTo(2.667, 2);
    expect(happyLossPerTrain(10, 'expected')).toBeCloseTo(5, 6);
    expect(happyLossPerTrain(25, 'expected')).toBeCloseTo(12.667, 2);
    expect(happyLossPerTrain(50, 'expected')).toBeCloseTo(25, 6);
  });

  it('bounds: best loses less happy than worst', () => {
    expect(happyLossPerTrain(10, 'best')).toBe(4);
    expect(happyLossPerTrain(10, 'worst')).toBe(6);
    expect(happyLossPerTrain(25, 'best')).toBe(10);
    expect(happyLossPerTrain(25, 'worst')).toBe(15);
  });
});

describe('simulateSession', () => {
  const base = {
    statValue: 50_000,
    happy: 5000,
    modifiers: 1,
    energyPerTrain: 10,
    dots: 2,
  };

  it('runs the correct number of trains', () => {
    const r = simulateSession({ ...base, energyBudget: 100, mode: 'expected' });
    expect(r.trains).toBe(10);
    expect(r.energyUsed).toBe(100);
  });

  it('leaves leftover energy that cannot fund a full train', () => {
    const r = simulateSession({ ...base, energyBudget: 95, mode: 'expected' });
    expect(r.trains).toBe(9);
    expect(r.energyUsed).toBe(90);
  });

  it('reduces happy over the session', () => {
    const r = simulateSession({ ...base, energyBudget: 100, mode: 'expected' });
    expect(r.finalHappy).toBeLessThan(base.happy);
  });

  it('produces positive total gain and a higher final stat', () => {
    const r = simulateSession({ ...base, energyBudget: 100, mode: 'expected' });
    expect(r.totalGain).toBeGreaterThan(0);
    expect(r.finalStat).toBeCloseTo(base.statValue + r.totalGain, 6);
  });
});

describe('simulateBand', () => {
  it('orders gain best >= expected >= worst', () => {
    const band = simulateBand({
      statValue: 50_000,
      happy: 5000,
      modifiers: 1,
      energyPerTrain: 10,
      dots: 2,
      energyBudget: 500,
    });
    expect(band.best.totalGain).toBeGreaterThanOrEqual(band.expected.totalGain);
    expect(band.expected.totalGain).toBeGreaterThanOrEqual(band.worst.totalGain);
  });
});
