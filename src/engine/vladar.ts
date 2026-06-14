import { VLADAR } from './constants';

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
 * Expected stat gain for a single train (spec §4.1).
 * Gain grows with both S and H (compounding) — see spec §4.1.
 */
export function gainPerTrain(i: GainInput): number {
  const { a, b, c, d, e } = VLADAR;
  const { modifiers: M, dots: G, energyPerTrain: E, happy: H, statValue: S } = i;
  if (G <= 0 || E <= 0) return 0;
  const bracket = (a * Math.log(H + b) + c) * S + d * (H + b) + e;
  return M * G * E * bracket;
}
