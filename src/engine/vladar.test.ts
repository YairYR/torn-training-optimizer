import { describe, it, expect } from 'vitest';
import { effectiveStat, gainPerTrain } from './vladar';
import { STAT_SOFT_CAP } from './constants';

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

describe('effectiveStat (post-2022 cap removal)', () => {
  it('is the identity below the 50M soft cap', () => {
    expect(effectiveStat(10_000)).toBe(10_000);
    expect(effectiveStat(STAT_SOFT_CAP)).toBe(STAT_SOFT_CAP);
  });

  it('keeps growing above the cap, but sub-linearly', () => {
    const at100m = effectiveStat(100e6);
    const at1b = effectiveStat(1e9);
    expect(at100m).toBeGreaterThan(STAT_SOFT_CAP);
    expect(at1b).toBeGreaterThan(at100m);
    // 10x the raw stat must NOT give 10x the effective stat.
    expect(at1b / at100m).toBeLessThan(10);
  });

  // Torn published monthly-growth figures for a fixed heavy-training regime
  // (1500E/day, George's, PI happy) before and after removing the cap. Because
  // gain-per-train is affine in S_eff, the ratio of those two figures at the
  // same stat equals the ratio of the gain terms — which pins the curve.
  const OFFICIAL = [
    { stat: 1e9, before: 10.33, after: 12.87 },
    { stat: 5e9, before: 2.07, after: 4.47 },
    { stat: 1e10, before: 1.03, after: 3.37 },
    { stat: 5e10, before: 0.21, after: 2.4 },
    { stat: 1e11, before: 0.1, after: 2.24 },
    { stat: 1e12, before: 0.01, after: 1.97 },
  ];

  it.each(OFFICIAL)(
    'reproduces Torn\'s published growth ratio at $stat',
    ({ stat, before, after }) => {
      const regime = { modifiers: 1, dots: 7.3, energyPerTrain: 10, happy: 9192 };
      const capped = gainPerTrain({ ...regime, statValue: STAT_SOFT_CAP });
      const uncapped = gainPerTrain({ ...regime, statValue: stat });
      // Torn rounded the published percentages to 2 dp, so tiny stats-side
      // figures (0.01%) carry a lot of rounding noise — allow 12%.
      expect(uncapped / capped).toBeCloseTo(after / before, -Math.log10(0.12 * (after / before)));
    },
  );
});
