import { describe, it, expect } from 'vitest';
import { naturalEnergyPerDay, dosesPerDay, dailyEnergyCapacity } from './energy-capacity';

describe('naturalEnergyPerDay', () => {
  it('is 720/day with donator (max 150)', () => {
    expect(naturalEnergyPerDay(150)).toBe(720);
  });
  it('is 480/day without donator (max 100)', () => {
    expect(naturalEnergyPerDay(100)).toBe(480);
  });
});

describe('dosesPerDay', () => {
  it('gives ~3 doses/day for a ~7h cooldown', () => {
    expect(dosesPerDay(420)).toBe(3); // Xanax avg
    expect(dosesPerDay(425)).toBe(3); // LSD avg
  });
  it('handles zero gracefully', () => {
    expect(dosesPerDay(0)).toBe(0);
  });
});

describe('dailyEnergyCapacity', () => {
  it('Xanax: natural + 3x250 + refill', () => {
    const r = dailyEnergyCapacity({
      maxEnergy: 150,
      drugEnergyPerDose: 250,
      drugCooldownMinutes: 420,
    });
    expect(r.drugDoses).toBe(3);
    expect(r.drugEnergy).toBe(750);
    expect(r.refill).toBe(150);
    expect(r.total).toBe(720 + 750 + 150); // 1620
  });

  it('LSD yields far less drug energy for the same cooldown slots', () => {
    const x = dailyEnergyCapacity({ maxEnergy: 150, drugEnergyPerDose: 250, drugCooldownMinutes: 420 });
    const l = dailyEnergyCapacity({ maxEnergy: 150, drugEnergyPerDose: 50, drugCooldownMinutes: 425 });
    expect(x.drugEnergy).toBe(750);
    expect(l.drugEnergy).toBe(150);
    expect(x.drugEnergy / l.drugEnergy).toBe(5);
  });
});
