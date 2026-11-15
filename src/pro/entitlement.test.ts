import { describe, it, expect } from 'vitest';
import { parseDonation, expiryOf } from './entitlement';

const ev = (event: string) => ({ timestamp: 1_000, event });
const DAY = 86_400;

describe('parseDonation', () => {
  it('reads quantity and sender from the event HTML', () => {
    const d = parseDonation(
      'e1',
      ev('You were sent 3x Xanax from <a href = "http://www.torn.com/profiles.php?XID=123456">Bob</a> with the message: thanks'),
    );
    expect(d).toEqual({ eventId: 'e1', playerId: 123456, qty: 3, ts: 1_000 });
  });

  it('treats a missing quantity as one', () => {
    expect(parseDonation('e2', ev('You were sent a Xanax from <a href="profiles.php?XID=7">A</a>'))?.qty).toBe(1);
  });

  it('ignores other items and outgoing sends', () => {
    expect(parseDonation('e3', ev('You were sent 1x Ecstasy from <a href="profiles.php?XID=7">A</a>'))).toBeNull();
    expect(parseDonation('e4', ev('You sent 1x Xanax to <a href="profiles.php?XID=7">A</a>'))).toBeNull();
    expect(parseDonation('e5', ev('You pop the Xanax pill into your mouth'))).toBeNull();
  });
});

describe('expiryOf', () => {
  it('is zero without donations', () => {
    expect(expiryOf([])).toBe(0);
  });

  it('gives 30 days per Xanax', () => {
    expect(expiryOf([{ ts: 0, qty: 2 }])).toBe(60 * DAY);
  });

  it('extends from the current expiry when paying early', () => {
    expect(expiryOf([{ ts: 10 * DAY, qty: 1 }, { ts: 0, qty: 1 }])).toBe(60 * DAY);
  });

  it('restarts from the payment date after a lapse', () => {
    expect(expiryOf([{ ts: 0, qty: 1 }, { ts: 100 * DAY, qty: 1 }])).toBe(130 * DAY);
  });
});
