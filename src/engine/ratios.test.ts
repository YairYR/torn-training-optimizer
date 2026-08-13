import { describe, expect, it } from 'vitest';
import { STATIC_GYMS } from '../data/gyms';
import { evaluateGymEligibility, isUsable } from './gym-eligibility';
import { StatKey } from './types';

/**
 * The /training-ratios page documents Hank's Ratio and Baldr's Ratio, the two
 * named builds the Torn community actually trains to. Those are community
 * conventions, not game rules — but the *claim* the page makes about them is a
 * hard one: that a player sitting exactly on each ratio unlocks a specific set
 * of specialist gyms.
 *
 * That claim is checkable, because the gym requirements are implemented right
 * here in gym-eligibility.ts. These tests pin the documented ratios against the
 * engine, so the page and the calculator cannot drift apart — if someone
 * changes a requirement, the prose that describes it fails with it.
 *
 * Ratios are expressed as multipliers of the highest stat, matching how the
 * community tooling states them:
 *   Baldr's  high : 80% : 72% : 72%
 *   Hank's   high : 80% : 80% : 28% max
 */

const gym = (name: string) => STATIC_GYMS.find((g) => g.name === name)!;

/** A player sitting exactly on a ratio, scaled to a realistic stat size. */
const build = (m: { str: number; spd: number; def: number; dex: number }, base = 10_000_000) => ({
  strength: m.str * base,
  speed: m.spd * base,
  defense: m.def * base,
  dexterity: m.dex * base,
});

/** Can this player train here? George's is unlocked in all these scenarios. */
const usable = (gymName: string, stats: Record<StatKey, number>) =>
  isUsable(
    evaluateGymEligibility(gym(gymName), stats, 0, { unlockedCapId: 24, georgesUnlocked: true })
      .status,
  );

describe("Baldr's Ratio — high : 80% : 72% : 72%", () => {
  // Strength primary, Speed secondary: both live in the Str+Spd pair, which is
  // what makes the paired gym reachable at the same time as the single-stat one.
  const baldr = build({ str: 1.0, spd: 0.8, def: 0.72, dex: 0.72 });

  it('unlocks the 8.0-dot single-stat gym for the primary', () => {
    // 1.00 / 0.80 = exactly the 1.25x over second-highest that the rule demands.
    expect(usable('Gym 3000', baldr)).toBe(true);
  });

  it('unlocks the 7.5-dot paired gym for the primary pair', () => {
    // (1.00 + 0.80) / (0.72 + 0.72) = 1.80 / 1.44 = exactly 1.25.
    expect(usable('Frontline Fitness', baldr)).toBe(true);
  });

  it('sits exactly on both thresholds, not above them', () => {
    const second = 0.8;
    expect(1.0 / second).toBeCloseTo(1.25, 10);
    expect((1.0 + 0.8) / (0.72 + 0.72)).toBeCloseTo(1.25, 10);
  });

  it('does not unlock the opposite pair, or the other single-stat gyms', () => {
    expect(usable('Balboas Gym', baldr)).toBe(false);
    expect(usable('Mr. Isoyamas', baldr)).toBe(false);
    expect(usable('The Elites', baldr)).toBe(false);
    expect(usable('Total Rebound', baldr)).toBe(false);
  });

  it('leaves the abandoned stats at a real fraction of the build', () => {
    // The point of Baldr's: nothing is thrown away. Lowest stat is ~22% of total.
    const total = 1.0 + 0.8 + 0.72 + 0.72;
    expect(0.72 / total).toBeCloseTo(0.2222, 3);
  });
});

describe("Hank's Ratio — high : 80% : 80% : 28% max", () => {
  // Strength primary, Speed secondary (same pair), Defense third, Dexterity
  // deliberately held down.
  const hank = build({ str: 1.0, spd: 0.8, def: 0.8, dex: 0.28 });

  it('unlocks the 8.0-dot single-stat gym for the primary', () => {
    expect(usable('Gym 3000', hank)).toBe(true);
  });

  it('unlocks the 7.5-dot paired gym, with room to spare', () => {
    // (1.00 + 0.80) / (0.80 + 0.28) = 1.80 / 1.08 = 1.667, well over 1.25.
    expect(usable('Frontline Fitness', hank)).toBe(true);
    expect((1.0 + 0.8) / (0.8 + 0.28)).toBeCloseTo(1.6667, 3);
  });

  it('holds the fourth stat low enough to keep the ratio', () => {
    // Raising Dexterity past the paired-gym threshold costs access. The break
    // point is where Str+Spd stops being 25% above Def+Dex.
    const breakingPoint = (1.0 + 0.8) / 1.25 - 0.8; // = 0.64
    expect(breakingPoint).toBeCloseTo(0.64, 10);
    expect(usable('Frontline Fitness', build({ str: 1, spd: 0.8, def: 0.8, dex: 0.65 }))).toBe(
      false,
    );
  });

  it('gives up more of the fourth stat than Baldr’s does', () => {
    const hankTotal = 1.0 + 0.8 + 0.8 + 0.28;
    expect(0.28 / hankTotal).toBeCloseTo(0.0972, 3); // ~9.7% vs Baldr's ~22.2%
  });
});

describe('a balanced build unlocks no specialist gym', () => {
  const balanced = build({ str: 1, spd: 1, def: 1, dex: 1 });

  it('is locked out of every ratio-gated gym', () => {
    for (const name of [
      'Gym 3000',
      'Mr. Isoyamas',
      'Total Rebound',
      'The Elites',
      'Balboas Gym',
      'Frontline Fitness',
    ]) {
      expect(usable(name, balanced), name).toBe(false);
    }
  });

  it("still has George's at 7.3", () => {
    expect(usable("George's", balanced)).toBe(true);
    expect(gym("George's").dots.strength).toBe(7.3);
  });
});
