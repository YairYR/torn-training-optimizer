import { HAPPY_LOSS_FACTORS } from './constants';
import { gainPerTrain } from './vladar';

/**
 * Outcome flavour for a session (spec §4.3):
 *  - 'expected': average happy loss (mean of the three rounded outcomes)
 *  - 'best':     minimum happy loss  -> upper bound of gain
 *  - 'worst':    maximum happy loss  -> lower bound of gain
 */
export type SimMode = 'expected' | 'best' | 'worst';

/** dH per train for a given energy cost and outcome flavour (spec §4.2). */
export function happyLossPerTrain(energyPerTrain: number, mode: SimMode): number {
  const dH = (r: number) => Math.round((energyPerTrain * r) / 10);
  if (mode === 'best') return dH(4);
  if (mode === 'worst') return dH(6);
  // expected = mean of the three *rounded* outcomes (matches spec table)
  return HAPPY_LOSS_FACTORS.reduce((s, r) => s + dH(r), 0) / HAPPY_LOSS_FACTORS.length;
}

export interface SessionInput {
  statValue: number;
  happy: number;
  modifiers: number;
  energyPerTrain: number;
  dots: number;
  /** Total energy to spend in the session. */
  energyBudget: number;
  mode: SimMode;
}

export interface SessionResult {
  trains: number;
  totalGain: number;
  finalStat: number;
  finalHappy: number;
  energyUsed: number;
}

/**
 * Iterates train by train (spec §4.3): there is no difference between N trains
 * in one click and N individual trains. Happy and stat are recomputed each step.
 */
export function simulateSession(i: SessionInput): SessionResult {
  let H = i.happy;
  let S = i.statValue;
  let energy = i.energyBudget;
  let totalGain = 0;
  let trains = 0;
  const dH = happyLossPerTrain(i.energyPerTrain, i.mode);

  while (energy >= i.energyPerTrain && i.energyPerTrain > 0) {
    const g = gainPerTrain({
      modifiers: i.modifiers,
      dots: i.dots,
      energyPerTrain: i.energyPerTrain,
      happy: H,
      statValue: S,
    });
    totalGain += g;
    S += g;
    H = Math.max(0, H - dH);
    energy -= i.energyPerTrain;
    trains += 1;
  }

  return {
    trains,
    totalGain,
    finalStat: S,
    finalHappy: H,
    energyUsed: i.energyBudget - energy,
  };
}

export interface SessionBand {
  expected: SessionResult;
  best: SessionResult;
  worst: SessionResult;
}

/** Expected result plus the min–max band the UI displays (spec §4.3). */
export function simulateBand(i: Omit<SessionInput, 'mode'>): SessionBand {
  return {
    expected: simulateSession({ ...i, mode: 'expected' }),
    best: simulateSession({ ...i, mode: 'best' }),
    worst: simulateSession({ ...i, mode: 'worst' }),
  };
}
