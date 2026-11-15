import { describe, it, expect } from 'vitest';
import { seal, unseal, signSession, verifySession } from './crypto';
import { summarize, toHistory, isDeadKeyError } from './tracking';

const S = 'test-secret-with-enough-entropy-123456';

describe('crypto', () => {
  it('round-trips a key and never stores it in clear', async () => {
    const sealed = await seal(S, 'abcd1234abcd1234');
    expect(sealed).not.toContain('abcd1234');
    expect(await unseal(S, sealed)).toBe('abcd1234abcd1234');
  });

  it('fails to open with another secret', async () => {
    await expect(unseal('other', await seal(S, 'k'))).rejects.toThrow();
  });

  it('accepts its own session and rejects a forged one', async () => {
    const t = await signSession(S, 2885363);
    expect(await verifySession(S, t)).toBe(2885363);
    expect(await verifySession(S, t.replace('2885363', '1171127'))).toBeNull();
    expect(await verifySession('other', t)).toBeNull();
    expect(await verifySession(S, null)).toBeNull();
  });
});

describe('tracking', () => {
  const row = (player_id: number, day: string, v: number) => ({
    player_id, day, strength: v, defense: v, speed: v, dexterity: v,
  });

  it('summarizes latest stats and window growth, biggest first', () => {
    const s = summarize(
      [row(1, '2026-11-01', 100), row(1, '2026-11-15', 110), row(2, '2026-11-15', 500)],
      { 1: 'A', 2: 'B' },
    );
    expect(s.map((m) => m.name)).toEqual(['B', 'A']);
    expect(s[1].total).toBe(440);
    expect(s[1].growth).toBeCloseTo(0.1);
    expect(s[0].growth).toBeNull();
  });

  it('maps rows to chart points in date order', () => {
    const h = toHistory([row(1, '2026-11-02', 2), row(1, '2026-11-01', 1)]);
    expect(h.map((p) => p.strength)).toEqual([1, 2]);
  });

  it('only drops keys on permanent errors', () => {
    expect(isDeadKeyError(2)).toBe(true);
    expect(isDeadKeyError(5)).toBe(false); // too many requests: transitorio
  });
});
