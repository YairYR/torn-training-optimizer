import { describe, it, expect } from 'vitest';
import { jumpRoi, HAPPY_CAP } from './jump-roi';

const prices = {
  items: { Xanax: 800_000, 'Erotic DVD': 4_000_000, Ecstasy: 70_000 },
  pointPrice: 45_000,
};
const base = {
  baseHappy: 5_025,
  maxEnergy: 150,
  modifiers: 1,
  dots: 7.3,
  energyPerTrain: 10,
  edvds: 5,
  edvdHappy: 2_500,
};

describe('jumpRoi', () => {
  it('jumps win at low stats', () => {
    const r = jumpRoi({ ...base, statValue: 20_000 }, prices);
    expect(r.extraGain).toBeGreaterThan(0);
    expect(r.extraPerStat).toBeGreaterThan(0);
  });

  it('energy training wins at high stats', () => {
    const r = jumpRoi({ ...base, statValue: 20_000_000 }, prices);
    expect(r.extraGain).toBeLessThan(0);
    expect(r.extraPerStat).toBeNull();
  });

  it('no-jump trains more energy over the stack window', () => {
    const r = jumpRoi({ ...base, statValue: 100_000 }, prices);
    expect(r.jump.energy).toBe(1_150);
    expect(r.noJump.energy).toBe(1_150 + 1_080);
  });

  it('caps happy at 99,999 and prices the boosters on top', () => {
    const r = jumpRoi({ ...base, statValue: 1, edvds: 20 }, prices);
    expect(r.jump.happy).toBe(HAPPY_CAP);
    expect(r.jump.cost! - r.noJump.cost!).toBe(20 * 4_000_000 + 70_000);
  });

  it('reports unknown cost when a price is missing', () => {
    const r = jumpRoi({ ...base, statValue: 1 }, { items: {}, pointPrice: null });
    expect(r.jump.cost).toBeNull();
    expect(r.extraPerStat).toBeNull();
  });
});
