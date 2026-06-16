import { describe, it, expect } from 'vitest';
import { buildIntervals, sortSnapshots, Snapshot } from './progress';
import { StatKey } from './types';

const mk = (id: string, date: string, stats: Partial<Record<StatKey, number>>): Snapshot => ({
  id,
  date,
  stats: { strength: 0, defense: 0, speed: 0, dexterity: 0, ...stats },
});

describe('buildIntervals', () => {
  it('computes deltas and gain/day between consecutive snapshots', () => {
    const snaps = [
      mk('a', '2026-06-01T00:00:00Z', { strength: 1_000_000 }),
      mk('b', '2026-06-11T00:00:00Z', { strength: 1_500_000 }),
    ];
    const iv = buildIntervals(snaps);
    expect(iv).toHaveLength(1);
    expect(iv[0].days).toBe(10);
    expect(iv[0].perStat.strength).toBe(500_000);
    expect(iv[0].gainPerDay.strength).toBe(50_000);
    expect(iv[0].totalDelta).toBe(500_000);
  });

  it('sorts out-of-order snapshots', () => {
    const snaps = [
      mk('b', '2026-06-11T00:00:00Z', { defense: 200 }),
      mk('a', '2026-06-01T00:00:00Z', { defense: 100 }),
    ];
    expect(sortSnapshots(snaps).map((s) => s.id)).toEqual(['a', 'b']);
    expect(buildIntervals(snaps)[0].perStat.defense).toBe(100);
  });

  it('returns no intervals for a single snapshot', () => {
    expect(buildIntervals([mk('a', '2026-06-01T00:00:00Z', {})])).toHaveLength(0);
  });

  it('handles a zero-day interval without dividing by zero', () => {
    const snaps = [
      mk('a', '2026-06-01T00:00:00Z', { speed: 100 }),
      mk('b', '2026-06-01T00:00:00Z', { speed: 150 }),
    ];
    const iv = buildIntervals(snaps);
    expect(iv[0].gainPerDay.speed).toBe(0);
  });
});
