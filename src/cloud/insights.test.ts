import { describe, it, expect } from 'vitest';
import { pace, nextMilestone, etaDate, weekly } from './insights';

const DAY = 86_400_000;
const pt = (d: number, s: number, x = s) => ({ t: d * DAY, strength: s, defense: x, speed: s, dexterity: s });

describe('pace', () => {
  it('is null with less than a day of history', () => {
    expect(pace([pt(0, 100)])).toBeNull();
    expect(pace([pt(0, 100), { ...pt(0, 110), t: 3_600_000 }])).toBeNull();
  });

  it('averages gain per day over the window only', () => {
    const p = pace([pt(0, 0), pt(40, 400), pt(50, 500)], 30)!;
    expect(p.strength).toBe(10);
    expect(p.total).toBe(40);
  });
});

describe('nextMilestone', () => {
  it('steps through 1-2-5 numbers', () => {
    expect(nextMilestone(398_966_085)).toBe(500_000_000);
    expect(nextMilestone(500_000_000)).toBe(1_000_000_000);
    expect(nextMilestone(105_986_320)).toBe(200_000_000);
    expect(nextMilestone(0)).toBe(1);
  });
});

describe('etaDate', () => {
  it('projects linearly and refuses a flat pace', () => {
    expect(etaDate(100, 10, 200, 0)!.getTime()).toBe(10 * DAY);
    expect(etaDate(100, 0, 200, 0)).toBeNull();
  });
});

describe('weekly', () => {
  it('needs about a week of history', () => {
    expect(weekly([pt(0, 100), pt(3, 130)])).toBeNull();
  });

  it('reports the week, the best stat and the pace comparison', () => {
    // 30 días a +10/día por stat, última semana a +20/día en defense
    const pts = [pt(0, 0), pt(23, 230, 230), pt(30, 300, 370)];
    const w = weekly(pts)!;
    expect(w.days).toBe(7);
    expect(w.best).toBe('defense');
    expect(w.gain.total).toBe(70 * 3 + 140);
    expect(w.vsPace).toBeGreaterThan(0);
  });
});
