import { describe, it, expect } from 'vitest';
import { parseGymGainModifiers } from './modifiers';

describe('parseGymGainModifiers', () => {
  it('sums per-stat and all-stat gym-gain perks additively', () => {
    const r = parseGymGainModifiers({
      merit_perks: ['+ 10% strength gym gains'],
      faction_perks: ['+ 5% Strength gym gains', '+ 8% Defense gym gains'],
      education_perks: ['+ 1% gym gains'], // applies to all stats
    });
    // strength: 10 + 5 + 1 = 16% -> 1.16
    expect(r.perStat.strength).toBeCloseTo(1.16, 6);
    // defense: 8 + 1 = 9% -> 1.09
    expect(r.perStat.defense).toBeCloseTo(1.09, 6);
    // speed/dex: only the 1% all-stat
    expect(r.perStat.speed).toBeCloseTo(1.01, 6);
    expect(r.perStat.dexterity).toBeCloseTo(1.01, 6);
  });

  it('ignores non-gym perks', () => {
    const r = parseGymGainModifiers({
      property_perks: ['+ 10% happy'],
      job_perks: ['+ 5% job points'],
    });
    expect(r.perStat.strength).toBe(1);
    expect(r.contributions).toHaveLength(0);
  });

  it('records contributions for transparency', () => {
    const r = parseGymGainModifiers({ merit_perks: ['+ 13% defense gym gains'] });
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0]).toMatchObject({ source: 'merit_perks', stat: 'defense', percent: 13 });
  });

  it('handles British spelling "defence"', () => {
    const r = parseGymGainModifiers({ faction_perks: ['+ 7% defence gym gains'] });
    expect(r.perStat.defense).toBeCloseTo(1.07, 6);
  });

  it('reproduces the validated strength modifier ~1.186', () => {
    const r = parseGymGainModifiers({
      merit_perks: ['+ 10% strength gym gains'],
      faction_perks: ['+ 7.6% strength gym gains'],
      education_perks: ['+ 1% gym gains'],
    });
    expect(r.perStat.strength).toBeCloseTo(1.186, 3);
  });
});
