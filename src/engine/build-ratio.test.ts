import { describe, it, expect } from 'vitest';
import { BUILD_PRESETS, evaluateBuildRatio } from './build-ratio';
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
});
