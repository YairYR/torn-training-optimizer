import { describe, it, expect } from 'vitest';
import { DEMO } from './demo';
import { STATIC_GYMS } from './data/gyms';
import { bestUsableGymIdForStat, georgesGymId } from './engine/gym-eligibility';
import { gainPerTrain } from './engine/vladar';
import { trainingRegime } from './engine/training-method';
import { STAT_KEYS } from './engine/types';

// The demo player is the first thing a visitor sees, so a broken one is a
// broken landing page. These guard the properties that make it a good demo,
// not the exact numbers — tune those freely and the tests still hold.
describe('demo player', () => {
  const gate = {
    unlockedCapId: DEMO.unlockedGymId,
    georgesUnlocked: DEMO.unlockedGymId >= (georgesGymId(STATIC_GYMS) ?? 24),
  };

  it('has a usable gym and a non-zero gain for every stat', () => {
    for (const stat of STAT_KEYS) {
      const id = bestUsableGymIdForStat(STATIC_GYMS, stat, DEMO.stats, DEMO.xanaxEcstasy, gate);
      const gym = STATIC_GYMS.find((g) => g.id === id);
      expect(gym, `no gym for ${stat}`).toBeTruthy();
      expect(gym!.dots[stat]).toBeGreaterThan(0);
      expect(
        gainPerTrain({
          modifiers: 1,
          dots: gym!.dots[stat],
          energyPerTrain: gym!.energyPerTrain,
          happy: DEMO.maxHappy,
          statValue: DEMO.stats[stat],
        }),
      ).toBeGreaterThan(0);
    }
  });

  it('sits in the hybrid regime — past happy jumps, short of the soft cap', () => {
    // A demo stuck at either extreme would show off only one branch of the
    // advice engine and leave the roadmap with nothing to recommend.
    expect(trainingRegime(DEMO.stats.strength).regime).toBe('hybrid');
  });

  it('leaves headroom so the roadmap has something to unlock', () => {
    expect(DEMO.unlockedGymId).toBeLessThan(georgesGymId(STATIC_GYMS) ?? 24);
  });

  it('is lopsided enough for specialist ratio logic to be meaningful', () => {
    const sorted = [...STAT_KEYS.map((s) => DEMO.stats[s])].sort((a, b) => b - a);
    expect(sorted[0] / sorted[1]).toBeGreaterThan(1.1);
  });
});
