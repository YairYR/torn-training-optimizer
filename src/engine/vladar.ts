import { POST_CAP_LOG_DIVISOR, STAT_SOFT_CAP, VLADAR } from './constants';

export interface GainInput {
  /** M — product of multiplicative perks, Π(1 + perk_i). Default 1. */
  modifiers: number;
  /** G — real gym dots for the trained stat (already API value / 10). */
  dots: number;
  /** E — energy per train (gym energy cost). */
  energyPerTrain: number;
  /** H — happy at the start of the train. */
  happy: number;
  /** S — current value of the trained stat (not the sum of all stats). */
  statValue: number;
}

/**
 * The stat value the gain formula actually sees.
 *
 * Below 50M it is the stat itself. Above 50M, Torn's 2022 cap removal replaced
 * the old hard cap with continued but sharply decelerating growth — see
 * STAT_SOFT_CAP in constants.ts for the derivation. Tools that still clamp S at
 * 50M under-predict end-game gains by ~5% at 200M and by orders of magnitude in
 * the billions; tools that ignore the cap entirely wildly over-predict.
 */
export function effectiveStat(statValue: number): number {
  if (statValue <= STAT_SOFT_CAP) return statValue;
  return (
    STAT_SOFT_CAP +
    (statValue - STAT_SOFT_CAP) / (POST_CAP_LOG_DIVISOR * Math.log10(statValue))
  );
}

/**
 * Expected stat gain for a single train (spec §4.1).
 * Gain grows with both S and H (compounding) — see spec §4.1.
 */
export function gainPerTrain(i: GainInput): number {
  const { a, b, c, d, e } = VLADAR;
  const { modifiers: M, dots: G, energyPerTrain: E, happy: H } = i;
  if (G <= 0 || E <= 0) return 0;
  const S = effectiveStat(i.statValue);
  const bracket = (a * Math.log(H + b) + c) * S + d * (H + b) + e;
  return M * G * E * bracket;
}
