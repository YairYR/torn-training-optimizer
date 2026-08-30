import { describe, it, expect } from 'vitest';
import {
  BUILD_PRESETS,
  evaluateBuildRatio,
  nearestGymTarget,
  ratioSummary,
} from './build-ratio';
import { STATIC_GYMS } from '../data/gyms';
import { evaluateGymEligibility, GymGate, georgesGymId } from './gym-eligibility';
import { StatKey, STAT_KEYS } from './types';

const preset = (id: string) => BUILD_PRESETS.find((p) => p.id === id)!.weights;

describe('evaluateBuildRatio', () => {
  it('splits a balanced build into four equal targets', () => {
    const r = evaluateBuildRatio(
      { strength: 100, defense: 100, speed: 100, dexterity: 100 },
      preset('balanced'),
    );
    for (const row of r.rows) expect(row.targetShare).toBeCloseTo(0.25, 10);
    expect(r.onTrack).toBe(true);
    expect(r.trainNext).toBeNull();
  });

  it("puts Hank's primary at 1.25/3.25 and the abandoned stat at zero", () => {
    const r = evaluateBuildRatio(
      { strength: 1, defense: 1, speed: 1, dexterity: 1 },
      preset('hank-str'),
    );
    const by = (s: StatKey) => r.rows.find((x) => x.stat === s)!;
    expect(by('strength').targetShare).toBeCloseTo(1.25 / 3.25, 10);
    expect(by('speed').targetShare).toBe(0);
    // Speed is trained but the build wants none of it, so it reads as ahead.
    expect(by('speed').status).toBe('ahead');
    expect(r.trainNext).toBe('strength');
  });

  it('reports the points needed to reach a target share', () => {
    // 100/400 = 25% now; the balanced target is 25%, so nudge it off.
    const stats = { strength: 40, defense: 120, speed: 120, dexterity: 120 };
    const r = evaluateBuildRatio(stats, preset('balanced'));
    const str = r.rows.find((x) => x.stat === 'strength')!;
    expect(str.status).toBe('behind');

    // Adding exactly that many points must land the share on target.
    const after = { ...stats, strength: stats.strength + str.pointsBehind! };
    const total = STAT_KEYS.reduce((a, s) => a + after[s], 0);
    expect(after.strength / total).toBeCloseTo(0.25, 8);
  });

  it('never claims a stat can be reduced', () => {
    const r = evaluateBuildRatio(
      { strength: 900, defense: 10, speed: 10, dexterity: 10 },
      preset('balanced'),
    );
    const str = r.rows.find((x) => x.stat === 'strength')!;
    expect(str.status).toBe('ahead');
    expect(str.pointsBehind).toBeNull();
  });

  it('survives a fresh account with no stats at all', () => {
    const r = evaluateBuildRatio(
      { strength: 0, defense: 0, speed: 0, dexterity: 0 },
      preset('hank-def'),
    );
    expect(r.total).toBe(0);
    expect(r.rows.every((x) => Number.isFinite(x.deltaPoints))).toBe(true);
  });

  it('summarises in one line', () => {
    const r = evaluateBuildRatio(
      { strength: 10, defense: 100, speed: 100, dexterity: 100 },
      preset('balanced'),
    );
    expect(ratioSummary(r)).toContain('Strength');
  });
});

describe('nearestGymTarget', () => {
  const gate: GymGate = {
    unlockedCapId: georgesGymId(STATIC_GYMS),
    georgesUnlocked: true,
  };

  it('finds the stat gap that unlocks a single-stat specialist', () => {
    // Defense-led but not yet 25% clear of the second-highest stat.
    const stats = { strength: 10e6, defense: 11e6, speed: 9e6, dexterity: 8e6 };
    const t = nearestGymTarget(STATIC_GYMS, stats, 500, gate)!;
    expect(t).toBeTruthy();
    expect(t.pointsNeeded).toBeGreaterThan(0);

    // The reported gap has to be the real boundary: a hair over unlocks the
    // gym, a hair under does not. This is what makes the number quotable.
    const at = (mult: number) =>
      evaluateGymEligibility(
        t.gym,
        { ...stats, [t.stat]: stats[t.stat] + t.pointsNeeded * mult },
        500,
        gate,
      ).status;
    expect(at(1.001)).not.toBe('locked');
    expect(at(0.999)).toBe('locked');
  });

  it('never proposes the jail gym', () => {
    const stats = { strength: 1000, defense: 1000, speed: 1000, dexterity: 1000 };
    const t = nearestGymTarget(STATIC_GYMS, stats, 0, { unlockedCapId: 2, georgesUnlocked: false });
    expect(t?.gym.name).not.toBe('Crims Gym');
  });

  it('returns null when nothing is left to unlock by training', () => {
    // Everything already accessible or invite-only.
    const stats = { strength: 1e9, defense: 1e6, speed: 1e6, dexterity: 1e6 };
    const t = nearestGymTarget([STATIC_GYMS[0]], stats, 0, gate);
    expect(t).toBeNull();
  });
});
