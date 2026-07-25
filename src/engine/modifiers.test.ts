import { describe, it, expect } from 'vitest';
import { parseGymGainModifiers } from './modifiers';

describe('parseGymGainModifiers', () => {
  it('compounds per-stat and all-stat gym-gain perks multiplicatively', () => {
    const r = parseGymGainModifiers({
      merit_perks: ['+ 10% strength gym gains'],
      faction_perks: ['+ 5% Strength gym gains', '+ 8% Defense gym gains'],
      education_perks: ['+ 1% gym gains'], // applies to all stats
    });
    // strength: 1.10 · 1.05 · 1.01 = 1.16655 (additive would say 1.16)
    expect(r.perStat.strength).toBeCloseTo(1.16655, 6);
    // defense: 1.08 · 1.01 = 1.0908
    expect(r.perStat.defense).toBeCloseTo(1.0908, 6);
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

  it('compounds the reference perk set (1.10 · 1.076 · 1.01)', () => {
    const r = parseGymGainModifiers({
      merit_perks: ['+ 10% strength gym gains'],
      faction_perks: ['+ 7.6% strength gym gains'],
      education_perks: ['+ 1% gym gains'],
    });
    // Additive would give 1.186; compounding gives 1.195436.
    expect(r.perStat.strength).toBeCloseTo(1.195436, 6);
  });
});
