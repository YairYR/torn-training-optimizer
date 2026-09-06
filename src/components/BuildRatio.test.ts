import { describe, it, expect } from 'vitest';
import { nearestUnlock } from './BuildRatio';
import { STATIC_GYMS } from '../data/gyms';

describe('nearestUnlock', () => {
  it('never proposes a specialist that is ratio-eligible but still gate-locked', () => {
    // Cha Cha's (20) is unlocked, George's (24) is not: the paired
    // specialists (which only need Cha Cha's) are reachable, but the four
    // 50E single-stat specialists (which need George's) stay locked no
    // matter the ratio. Gym 3000 is already ratio-eligible here (strength is
    // way past 1.25x the rest) — resolveUnlockTarget alone would report a
    // 0-point gap for it and let it win "nearest" outright.
    const gate = { unlockedCapId: 22, georgesUnlocked: false };
    const stats = { strength: 1000, defense: 100, speed: 100, dexterity: 100 };

    const result = nearestUnlock(STATIC_GYMS, stats, 0, gate);

    expect(result?.gym.name).not.toBe('Gym 3000');
    // Balboas is genuinely the nearest: gate-open (Cha Cha's suffices) and
    // still short on ratio.
    expect(result?.gym.name).toBe('Balboas Gym');
    expect(result?.pointsNeeded).toBeGreaterThan(0);
  });
});
