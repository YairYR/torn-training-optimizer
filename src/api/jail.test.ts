import { describe, it, expect } from 'vitest';
import { normalizePlayer, RawUser } from './normalize';
import { readSharedState, buildShareUrl } from '../url-state';

const base: RawUser = {
  strength: 1000,
  defense: 1000,
  speed: 1000,
  dexterity: 1000,
  happy: { current: 100, maximum: 5025 },
  energy: { current: 150, maximum: 150 },
};

describe('jail detection from the API', () => {
  it('reads status.state', () => {
    expect(normalizePlayer({ ...base, status: { state: 'Jail' } }).inJail).toBe(true);
    expect(normalizePlayer({ ...base, status: { state: 'Okay' } }).inJail).toBe(false);
    expect(normalizePlayer({ ...base, status: { state: 'Hospital' } }).inJail).toBe(false);
  });

  it('reports unknown rather than false when the selection is missing', () => {
    // The distinction matters: a key or cached response without `basic` must
    // not be read as a positive assertion that the player is free. Downstream
    // treats only an explicit true as "in jail", so unknown fails closed.
    expect(normalizePlayer(base).inJail).toBeNull();
  });
});

describe('jail survives a shared link', () => {
  const manual = {
    stats: { strength: 1000, defense: 1000, speed: 1000, dexterity: 1000 },
    maxHappy: 5025,
    maxEnergy: 150,
    xanaxEcstasy: 0,
    unlockedGymId: 3,
    inJail: true,
  };

  it('round-trips the flag', () => {
    const url = buildShareUrl({ manual }, 'https://example.com');
    expect(url).toContain('jail=1');
    expect(readSharedState(new URL(url).search)!.manual!.inJail).toBe(true);
  });

  it('omits the flag when free, and reads back as false', () => {
    const url = buildShareUrl({ manual: { ...manual, inJail: false } }, 'https://example.com');
    expect(url).not.toContain('jail=');
    expect(readSharedState(new URL(url).search)!.manual!.inJail).toBe(false);
  });
});
