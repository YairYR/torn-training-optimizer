import { describe, it, expect } from 'vitest';
import { gainPerTrain } from './vladar';

describe('gainPerTrain', () => {
  // Pinned value, hand-computed from the formula (spec §4.1):
  // M=1, dots=2.0, E=10, H=5000, S=10000
  // H+b = 5250; ln(5250) = 8.565983
  // a·ln+c = 6.0727e-6 ; ·S = 0.060727
  // d·(H+b)+e = 0.358457 - 0.030143 = 0.328314
  // bracket = 0.389041 ; ·E·G·M = 0.389041·10·2 = 7.7808
  it('matches the hand-computed reference value', () => {
    const g = gainPerTrain({ modifiers: 1, dots: 2, energyPerTrain: 10, happy: 5000, statValue: 10000 });
    expect(g).toBeCloseTo(7.7808, 2);
  });

  it('increases with stat total (compounding)', () => {
    const base = { modifiers: 1, dots: 2, energyPerTrain: 10, happy: 5000 };
    const low = gainPerTrain({ ...base, statValue: 10_000 });
    const high = gainPerTrain({ ...base, statValue: 1_000_000 });
    expect(high).toBeGreaterThan(low);
  });

  it('increases with happy', () => {
    const base = { modifiers: 1, dots: 2, energyPerTrain: 10, statValue: 50_000 };
    const low = gainPerTrain({ ...base, happy: 100 });
    const high = gainPerTrain({ ...base, happy: 50_000 });
    expect(high).toBeGreaterThan(low);
  });

  it('scales linearly with modifiers', () => {
    const base = { dots: 2, energyPerTrain: 10, happy: 5000, statValue: 50_000 };
    const m1 = gainPerTrain({ ...base, modifiers: 1 });
    const m2 = gainPerTrain({ ...base, modifiers: 2 });
    expect(m2 / m1).toBeCloseTo(2, 6);
  });

  it('returns 0 when the gym does not train the stat (dots = 0)', () => {
    expect(gainPerTrain({ modifiers: 1, dots: 0, energyPerTrain: 50, happy: 5000, statValue: 50_000 })).toBe(0);
  });
});
