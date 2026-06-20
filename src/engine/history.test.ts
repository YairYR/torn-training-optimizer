import { describe, it, expect } from 'vitest';
import { parseTornStatsHistory, withLivePoint, HistoryPoint } from './history';

// Minimal slice mirroring the real TornStats Chart.js export shape: five
// labelled datasets, each with a `data: [{x,y}, ...]` array. Timestamps are
// deliberately misaligned across stats to exercise the forward-fill.
const SAMPLE = `
  datasets: [
    {
      label: 'Strength',
      borderColor: '#3366cc',
      data: [
        {x: 1000, y: 100},
        {x: 3000, y: 300},
      ],
    },
    {
      label: 'Defense',
      data: [
        {x: 2000, y: 50},
      ],
    },
    {
      label: 'Speed',
      data: [
        {x: 1000, y: 10},
        {x: 2000, y: 20},
      ],
    },
    {
      label: 'Dexterity',
      data: [
        {x: 3000, y: 7},
      ],
    },
    {
      label: 'Total',
      data: [
        {x: 1000, y: 9999},
      ],
      hidden: true,
    },
  ]
`;

describe('parseTornStatsHistory', () => {
  it('merges all stats onto a single sorted timeline', () => {
    const rows = parseTornStatsHistory(SAMPLE);
    expect(rows.map((r) => r.t)).toEqual([1000, 2000, 3000]);
  });

  it('forward-fills missing stats from the last known value', () => {
    const rows = parseTornStatsHistory(SAMPLE);
    // t=1000: only STR and SPD seen; DEF/DEX not yet → 0
    expect(rows[0]).toMatchObject({ t: 1000, strength: 100, defense: 0, speed: 10, dexterity: 0 });
    // t=2000: DEF appears, STR carries forward
    expect(rows[1]).toMatchObject({ t: 2000, strength: 100, defense: 50, speed: 20, dexterity: 0 });
    // t=3000: STR and DEX update, DEF/SPD carry forward
    expect(rows[2]).toMatchObject({ t: 3000, strength: 300, defense: 50, speed: 20, dexterity: 7 });
  });

  it('ignores the Total dataset (total is recomputed downstream)', () => {
    const rows = parseTornStatsHistory(SAMPLE);
    // 9999 must never appear in any parsed stat field.
    for (const r of rows) {
      expect([r.strength, r.defense, r.speed, r.dexterity]).not.toContain(9999);
    }
  });

  it('returns an empty array for unrelated text', () => {
    expect(parseTornStatsHistory('no chart here')).toEqual([]);
  });
});

describe('withLivePoint', () => {
  const base: HistoryPoint[] = [
    { t: 1000, strength: 1, defense: 1, speed: 1, dexterity: 1 },
  ];
  const stats = { strength: 9, defense: 8, speed: 7, dexterity: 6 };

  it('appends a future point', () => {
    const out = withLivePoint(base, stats, 100_000_000_000); // far future
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ strength: 9, defense: 8, speed: 7, dexterity: 6 });
  });

  it('seeds history when empty', () => {
    const out = withLivePoint([], stats, 5000);
    expect(out).toEqual([{ t: 5000, strength: 9, defense: 8, speed: 7, dexterity: 6 }]);
  });
});
