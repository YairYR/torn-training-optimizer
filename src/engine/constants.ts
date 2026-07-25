// Game constants. Per spec §11 these are [VALIDAR] values: confirmed against
// the Torn wiki and against in-production implementations of the Vladar formula.
// Centralised here so a game rebalance only touches one file.

/**
 * Vladar gym-gain formula constants.
 * gain = M · G · E · [ (a·ln(H+b)+c)·S + d·(H+b) + e ]
 */
export const VLADAR = {
  a: 3.480061091e-7,
  b: 250,
  c: 3.091619094e-6,
  d: 6.82775184551527e-5,
  e: -0.0301431777,
} as const;

/**
 * Happy loss per train: dH = round( (1/10) · energyPerTrain · r ), with r drawn
 * uniformly from {4, 5, 6}. The loss is independent of the energy source.
 */
export const HAPPY_LOSS_FACTORS = [4, 5, 6] as const;

/**
 * Gym-gain "stat cap". Historically S was hard-capped at 50M inside the gain
 * formula. Torn REMOVED that cap on 02/08/22 (wiki → "Gym Training Stat Cap
 * Removal"): above 50M, gains keep growing at a steadily decreasing rate.
 *
 * The effective stat used by the formula above the cap is
 *   S_eff = CAP + (S − CAP) / (POST_CAP_LOG_DIVISOR · log10(S))
 *
 * DERIVED, not guessed: Chedburn's announcement published monthly-growth
 * figures before and after the change for 100M → 1t stats under a fixed
 * regime (1500E/day, George's, PI happy, no Steadfast). The "before" figures
 * scale exactly as 1/S, which proves gain-per-train was constant above the cap
 * and lets us calibrate the formula's S-coefficient. Inverting the "after"
 * figures then yields S_eff for each published point; this expression
 * reproduces all of them from 1b to 1t within 0.5%. (The 100M point sits ~3%
 * off because its >100%/month growth compounds inside the month, which the
 * linear inversion ignores.)
 */
export const STAT_SOFT_CAP = 50_000_000;
export const POST_CAP_LOG_DIVISOR = 8.77635;
