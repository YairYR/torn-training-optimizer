import { describe, it, expect } from 'vitest';
import { trainingRegime, atGrowthCap } from './training-method';

describe('trainingRegime', () => {
  it('recommends happy jump for low stats', () => {
    expect(trainingRegime(100_000).regime).toBe('happy-jump');
  });

  it('recommends hybrid in the mid range', () => {
    expect(trainingRegime(2_000_000).regime).toBe('hybrid');
  });

  it('recommends energy training for high stats', () => {
    expect(trainingRegime(20_000_000).regime).toBe('energy-training');
    expect(trainingRegime(50_806_102).regime).toBe('energy-training');
  });
});

describe('atGrowthCap', () => {
  it('flags stats at or above the 50M growth cap', () => {
    expect(atGrowthCap(50_806_102)).toBe(true);
    expect(atGrowthCap(40_000_000)).toBe(false);
  });
});
